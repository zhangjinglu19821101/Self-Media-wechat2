
/**
 * 子任务状态机管理
 *
 * 功能：
 * 1. 状态更新触发机制
 * 2. 执行成功后的处理
 * 3. 执行失败后的处理
 * 4. 交互记录管理
 * 5. 🔥 自动上传公众号草稿箱（通过 MCP 工具）
 */

import { db } from '@/lib/db';
import { agentSubTasks, agentSubTasksStepHistory, dailyTask } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import type { InteractContent } from '@/lib/types/interact-content';
import {
  createAgentConsultContent,
  createAgentResponseContent,
  createArtificialConfirmContent,
  createSystemTipContent,
  createAgentSummaryContent,
} from '@/lib/types/interact-content';
import { getCurrentBeijingTime } from '@/lib/utils/date-time';

// 🔥 新增：自动上传公众号草稿箱（复用 MCP 工具相同逻辑）
// 注意：wechat-automation 和 wechat API 使用动态导入，避免模块加载失败阻断整个状态机
import { getAccountById, getDraftDefaults } from '@/config/wechat-official-account.config';

// === 状态枚举 ===

export type SubTaskStatus =
  | 'pending'
  | 'in_progress'
  | 'need_support'
  | 'waiting_agent_b'
  | 'waiting_user'
  | 'completed'
  | 'split_to_be_destroyed'
  | 'failed';

// === 执行 Agent 返回结果类型 ===

export type ExecAgentResponse = 'SUCCESS' | 'FAILED' | 'NEED_SUPPORT';

// === 状态机类 ===

export class SubtaskStateMachine {
  /**
   * 更新状态：基于执行 Agent 的返回
   * @param subTaskId 子任务 ID
   * @param response 执行 Agent 的返回
   * @param resultData 结果数据（可选）
   */
  static async updateStatusFromAgentResponse(
    subTaskId: string,
    response: ExecAgentResponse,
    resultData?: {
      result?: string;
      errorMsg?: string;
    }
  ): Promise<void> {
    console.log('[State Machine] 更新状态，执行 Agent 返回:', response);

    let newStatus: SubTaskStatus;
    let updateData: any = {
      updatedAt: getCurrentBeijingTime(),
    };

    switch (response) {
      case 'SUCCESS':
        newStatus = 'completed';
        updateData.status = newStatus;
        updateData.completedAt = getCurrentBeijingTime();
        if (resultData?.result) {
          updateData.executionResult = resultData.result;
        }
        break;

      case 'FAILED':
        newStatus = 'failed';
        updateData.status = newStatus;
        if (resultData?.errorMsg) {
          updateData.statusProof = resultData.errorMsg;
        }
        break;

      case 'NEED_SUPPORT':
        newStatus = 'need_support';
        updateData.status = newStatus;
        break;

      default:
        console.warn('[State Machine] 未知的执行 Agent 返回:', response);
        return;
    }

    // 更新数据库
    await db
      .update(agentSubTasks)
      .set(updateData)
      .where(eq(agentSubTasks.id, subTaskId));

    console.log('[State Machine] 状态已更新:', newStatus);

    // 执行成功/失败后的处理
    if (newStatus === 'completed') {
      await this.handleExecutionSuccess(subTaskId);
    } else if (newStatus === 'failed') {
      await this.handleExecutionFailure(subTaskId, resultData?.errorMsg);
    }
  }

  /**
   * 执行成功后的处理
   * @param subTaskId 子任务 ID
   */
  private static async handleExecutionSuccess(subTaskId: string): Promise<void> {
    console.log('[State Machine] 处理执行成功...');

    // 1. 查询子任务信息
    const subTask = await db.query.agentSubTasks.findFirst({
      where: eq(agentSubTasks.id, subTaskId),
    });

    if (!subTask) {
      console.warn('[State Machine] 未找到子任务');
      return;
    }

    // 2. 更新 daily_task 表（如果需要）
    if (subTask.commandResultId) {
      // 更新已完成子任务数
      await db
        .update(dailyTask)
        .set({
          completedSubTasks: dailyTask.completedSubTasks + 1,
          completedSubTasksDescription: subTask.taskTitle,
          updatedAt: getCurrentBeijingTime(),
        })
        .where(eq(dailyTask.id, subTask.commandResultId));

      console.log('[State Machine] 已更新 daily_task');
    }

    // 3. 🔥🔥🔥 新增：自动上传公众号草稿箱（仅对 insurance-d 的文章任务）
    try {
      await this.tryAutoUploadToWechat(subTask);
    } catch (uploadError) {
      console.error('[State Machine] 自动上传公众号草稿箱失败（不影响任务完成）:', uploadError);
      // 静默失败，不影响任务完成状态
    }

    // 4. 记录执行成功的交互（可选）
    // 这里可以记录到 agent_sub_tasks_step_history 表
  }

  /**
   * 🔥🔥🔥 自动上传公众号草稿箱 + 自动配置
   * 
   * 复用 WeChatDraftCreatorExecutor (MCP capabilityId=11) 的相同逻辑：
   * 1. 格式化文章 + 上传草稿（微信 API）
   * 2. 自动配置原创声明/赞赏/合集（Playwright，需 Cookie）
   * 
   * 仅对 insurance-d 的文章任务（orderIndex = 2）
   * 注意：insurance-xiaohongshu 不需要上传公众号，其内容预览由前端处理
   */
  private static async tryAutoUploadToWechat(subTask: any): Promise<void> {
    console.log('[State Machine] 检查是否需要自动上传公众号草稿箱...');

    const isInsuranceDTask = subTask.executor === 'insurance-d';
    const isArticleTask = subTask.orderIndex === 2;
    
    if (!isInsuranceDTask || !isArticleTask) {
      console.log('[State Machine] 不是 insurance-d 公众号文章任务，跳过自动上传');
      return;
    }

    console.log('[State Machine] 检测到 insurance-d 文章任务，开始自动上传...');

    if (!subTask.taskTitle || !subTask.executionResult) {
      console.warn('[State Machine] 缺少文章标题或内容，跳过自动上传');
      return;
    }

    const accountId = 'insurance-account';
    const account = getAccountById(accountId);
    
    if (!account || !account.enabled || !account.appId || !account.appSecret) {
      console.warn('[State Machine] 公众号配置不完整，跳过自动上传');
      return;
    }

    const draftDefaults = getDraftDefaults(accountId);

    // 动态导入 wechat API 模块（避免静态导入阻断状态机）
    let addDraft: typeof import('@/lib/wechat-official-account/api').addDraft;
    let formatArticleForWechat: typeof import('@/lib/wechat-official-account/api').formatArticleForWechat;
    try {
      const wechatApi = await import('@/lib/wechat-official-account/api');
      addDraft = wechatApi.addDraft;
      formatArticleForWechat = wechatApi.formatArticleForWechat;
    } catch (importError) {
      console.error('[State Machine] 动态导入 wechat API 模块失败，跳过自动上传:', importError);
      return;
    }

    // Step 1: 格式化文章并上传草稿（与 MCP 工具 WeChatDraftCreatorExecutor 相同逻辑）
    const draft = formatArticleForWechat(
      subTask.taskTitle,
      subTask.executionResult,
      draftDefaults.author || account.defaultAuthor,
      undefined,
      undefined,
      accountId
    );

    console.log('[State Machine] Step 1: 上传草稿到公众号...');
    const uploadResult = await addDraft(account, [draft]);

    if (!uploadResult?.media_id) {
      console.error('[State Machine] 上传草稿失败');
      return;
    }

    console.log('[State Machine] Step 1 完成: media_id:', uploadResult.media_id);

    // Step 2: 自动配置原创声明/赞赏/合集（与 MCP 工具相同逻辑）
    try {
      const { hasValidCookie, autoConfigureDraft } = await import('@/lib/wechat-automation/wechat-automation');
      if (hasValidCookie(accountId)) {
        console.log('[State Machine] Step 2: 检测到有效 Cookie，开始自动配置...');
        try {
          const configResult = await autoConfigureDraft({
            accountId,
            mediaId: uploadResult.media_id,
            config: draftDefaults,
          });

          if (configResult.success) {
            console.log('[State Machine] Step 2 完成: 已设置字段:', configResult.configuredFields);
          } else {
            console.warn('[State Machine] Step 2 失败:', configResult.error);
          }
        } catch (configError) {
          console.warn('[State Machine] Step 2 异常（不影响草稿上传）:', configError);
        }
      } else {
        console.log('[State Machine] Step 2: Cookie 未授权，跳过自动配置');
      }
    } catch (automationImportError) {
      console.warn('[State Machine] wechat-automation 模块不可用，跳过自动配置:', automationImportError);
    }

    console.log('[State Machine] 自动上传流程完成！');
  }

  /**
   * 执行失败后的处理
   * @param subTaskId 子任务 ID
   * @param errorMsg 错误信息
   */
  private static async handleExecutionFailure(
    subTaskId: string,
    errorMsg?: string
  ): Promise<void> {
    console.log('[State Machine] 处理执行失败...');

    // 1. 查询子任务信息
    const subTask = await db.query.agentSubTasks.findFirst({
      where: eq(agentSubTasks.id, subTaskId),
    });

    if (!subTask) {
      console.warn('[State Machine] 未找到子任务');
      return;
    }

    // 2. 判断是否需要支持
    // 这里可以根据错误类型判断是否需要返回 NEED_SUPPORT
    // 如果错误是临时的或可解决的，可以更新状态为 need_support
    // 暂时保持 failed 状态
  }

  /**
   * 记录一次交互（执行 Agent 反馈 + Agent B 应答）
   * @param params 交互参数
   */
  static async recordInteraction(params: {
    commandResultId: string;
    stepNo: number;
    executorFeedback: string;
    agentBResponse: string;
    executorAgentId: string;
  }): Promise<void> {
    console.log('[State Machine] 记录交互...');

    const { commandResultId, stepNo, executorFeedback, agentBResponse, executorAgentId } = params;

    // 1. 记录执行 Agent 反馈
    const executorContent = createAgentConsultContent({
      consultant: executorAgentId,
      responder: 'agent_b',
      question: executorFeedback,
      response: '',
      executionResult: {
        status: 'waiting',
      },
    });

    await db.insert(agentSubTasksStepHistory).values({
      commandResultId,
      stepNo,
      interactContent: executorContent,
      interactUser: executorAgentId,
      createdAt: getCurrentBeijingTime(),
    });

    // 2. 记录 Agent B 应答
    const agentBContent = createAgentResponseContent({
      consultant: 'agent_b',
      responder: executorAgentId,
      question: '',
      response: agentBResponse,
      executionResult: {
        status: 'success',
      },
    });

    await db.insert(agentSubTasksStepHistory).values({
      commandResultId,
      stepNo,
      interactContent: agentBContent,
      interactUser: 'agent_b',
      createdAt: getCurrentBeijingTime(),
    });

    console.log('[State Machine] 交互已记录');
  }

  /**
   * 记录 Agent B 提问 + 执行 Agent 反馈
   * @param params 交互参数
   */
  static async recordAgentBInitiatedInteraction(params: {
    commandResultId: string;
    stepNo: number;
    agentBQuestion: string;
    executorFeedback: string;
    executorAgentId: string;
  }): Promise<void> {
    console.log('[State Machine] 记录 Agent B 发起的交互...');

    const { commandResultId, stepNo, agentBQuestion, executorFeedback, executorAgentId } = params;

    // 1. 记录 Agent B 提问
    const agentBContent = createAgentConsultContent({
      consultant: 'agent_b',
      responder: executorAgentId,
      question: agentBQuestion,
      response: '',
      executionResult: {
        status: 'waiting',
      },
    });

    await db.insert(agentSubTasksStepHistory).values({
      commandResultId,
      stepNo,
      interactContent: agentBContent,
      interactUser: 'agent_b',
      createdAt: getCurrentBeijingTime(),
    });

    // 2. 记录执行 Agent 反馈
    const executorContent = createAgentResponseContent({
      consultant: executorAgentId,
      responder: 'agent_b',
      question: '',
      response: executorFeedback,
      executionResult: {
        status: 'success',
      },
    });

    await db.insert(agentSubTasksStepHistory).values({
      commandResultId,
      stepNo,
      interactContent: executorContent,
      interactUser: executorAgentId,
      createdAt: getCurrentBeijingTime(),
    });

    console.log('[State Machine] Agent B 发起的交互已记录');
  }

  /**
   * 记录用户提问 + 执行 Agent 反馈
   * @param params 交互参数
   */
  static async recordUserInitiatedInteraction(params: {
    commandResultId: string;
    stepNo: number;
    userQuestion: string;
    executorFeedback: string;
    executorAgentId: string;
  }): Promise<void> {
    console.log('[State Machine] 记录用户发起的交互...');

    const { commandResultId, stepNo, userQuestion, executorFeedback, executorAgentId } = params;

    // 1. 记录用户提问
    const userContent = createArtificialConfirmContent({
      consultant: '人工',
      responder: executorAgentId,
      question: userQuestion,
      response: '',
      executionResult: {
        status: 'waiting',
      },
    });

    await db.insert(agentSubTasksStepHistory).values({
      commandResultId,
      stepNo,
      interactContent: userContent,
      interactUser: '人工',
      createdAt: getCurrentBeijingTime(),
    });

    // 2. 记录执行 Agent 反馈
    const executorContent = createAgentResponseContent({
      consultant: executorAgentId,
      responder: 'agent_b',
      question: '',
      response: executorFeedback,
      executionResult: {
        status: 'success',
      },
    });

    await db.insert(agentSubTasksStepHistory).values({
      commandResultId,
      stepNo,
      interactContent: executorContent,
      interactUser: executorAgentId,
      createdAt: getCurrentBeijingTime(),
    });

    console.log('[State Machine] 用户发起的交互已记录');
  }

  /**
   * 记录上报前的应答（Agent B 总结）
   * @param params 记录参数
   */
  static async recordReportSummary(params: {
    commandResultId: string;
    stepNo: number;
    summary: string;
  }): Promise<void> {
    console.log('[State Machine] 记录上报总结...');

    const { commandResultId, stepNo, summary } = params;

    const summaryContent = createAgentSummaryContent({
      consultant: 'agent_b',
      responder: 'agent_a',
      question: '问题总结',
      response: summary,
      executionResult: {
        status: 'confirmed',
      },
    });

    await db.insert(agentSubTasksStepHistory).values({
      commandResultId,
      stepNo,
      interactContent: summaryContent,
      interactUser: 'agent_b',
      createdAt: getCurrentBeijingTime(),
    });

    console.log('[State Machine] 上报总结已记录');
  }
}


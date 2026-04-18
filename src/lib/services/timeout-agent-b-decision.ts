/**
 * 超时场景下的 Agent B 决策服务
 *
 * 处理三个核心超时场景：
 * 1. 场景1：等用户反馈超时 → 用户反馈后需要 Agent B 分析或重新执行
 * 2. 场景2：执行 Agent 执行异常 → 任务卡在 in_progress
 * 3. 场景3：执行 Agent 需要技术支撑 → 任务卡在 in_progress
 */

import { db } from '@/lib/db';
import { agentSubTasks, agentSubTasksStepHistory } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getCurrentBeijingTime } from '@/lib/utils/date-time';

// ============================================
// 超时场景类型
// ============================================

export type TimeoutScenario =
  | 'waiting_user_timeout'      // 场景1：等用户反馈超时
  | 'executor_exception'        // 场景2：执行 Agent 执行异常
  | 'executor_need_support';    // 场景3：执行 Agent 需要技术支撑

export interface TimeoutScenarioAnalysis {
  scenario: TimeoutScenario;
  description: string;
  confidence: number;
  suggestedAction: 'invoke_agent_b' | 'retry_executor' | 'escalate_to_user';
  reasoning: string;
}

// ============================================
// Agent B 超时决策服务
// ============================================

export class TimeoutAgentBDecisionService {
  private static instance: TimeoutAgentBDecisionService;

  public static getInstance(): TimeoutAgentBDecisionService {
    if (!TimeoutAgentBDecisionService.instance) {
      TimeoutAgentBDecisionService.instance = new TimeoutAgentBDecisionService();
    }
    return TimeoutAgentBDecisionService.instance;
  }

  /**
   * 分析超时场景
   */
  public async analyzeTimeoutScenario(
    task: typeof agentSubTasks.$inferSelect
  ): Promise<TimeoutScenarioAnalysis> {
    console.log('[TimeoutAgentB] ========== 分析超时场景 ==========');
    console.log('[TimeoutAgentB] 任务ID:', task.id);
    console.log('[TimeoutAgentB] 当前状态:', task.status);

    // 查询历史记录，了解超时背景
    const historyRecords = task.commandResultId ? await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(
        and(
          eq(agentSubTasksStepHistory.commandResultId, task.commandResultId),
          eq(agentSubTasksStepHistory.stepNo, task.orderIndex)
        )
      )
      .orderBy(agentSubTasksStepHistory.interactTime)
      : [];

    console.log('[TimeoutAgentB] 历史记录数:', historyRecords.length);

    // 分析场景
    const analysis = this.determineScenario(task, historyRecords);

    console.log('[TimeoutAgentB] 场景分析结果:', analysis);
    console.log('[TimeoutAgentB] ========== 场景分析完成 ==========');

    return analysis;
  }

  /**
   * 执行 Agent B 超时决策流程
   */
  public async executeAgentBTimeoutDecision(
    task: typeof agentSubTasks.$inferSelect,
    analysis: TimeoutScenarioAnalysis
  ): Promise<void> {
    console.log('[TimeoutAgentB] ========== 执行 Agent B 超时决策 ==========');
    console.log('[TimeoutAgentB] 场景:', analysis.scenario);
    console.log('[TimeoutAgentB] 建议动作:', analysis.suggestedAction);

    switch (analysis.suggestedAction) {
      case 'invoke_agent_b':
        await this.invokeAgentBDirectly(task, analysis);
        break;
      case 'retry_executor':
        await this.retryExecutor(task, analysis);
        break;
      case 'escalate_to_user':
        await this.escalateToUser(task, analysis);
        break;
      default:
        await this.escalateToUser(task, analysis);
    }

    console.log('[TimeoutAgentB] ========== Agent B 超时决策完成 ==========');
  }

  // ============================================
  // 私有方法
  // ============================================

  /**
   * 判断超时场景
   */
  private determineScenario(
    task: typeof agentSubTasks.$inferSelect,
    historyRecords: typeof agentSubTasksStepHistory.$inferSelect[]
  ): TimeoutScenarioAnalysis {
    // 场景1：等用户反馈超时
    if (task.status === 'waiting_user') {
      return {
        scenario: 'waiting_user_timeout',
        description: '场景1：等待用户反馈超时',
        confidence: 0.9,
        suggestedAction: 'invoke_agent_b',
        reasoning: '任务处于 waiting_user 状态超时，需要 Agent B 分析是否需要重新执行或调整策略',
      };
    }

    // 检查历史记录中的执行信息
    const hasExecutorException = historyRecords.some(record => {
      const content = record.interactContent as any;
      return content?.type === 'executor_exception' ||
             content?.error?.type === 'executor_error' ||
             (record.interactType === 'response' && content?.error);
    });

    const hasNeedSupport = historyRecords.some(record => {
      const content = record.interactContent as any;
      return content?.type === 'need_support' ||
             content?.needSupport === true ||
             (task.status === 'pre_need_support');
    });

    // 场景2：执行 Agent 执行异常
    if (hasExecutorException) {
      return {
        scenario: 'executor_exception',
        description: '场景2：执行 Agent 执行异常',
        confidence: 0.85,
        suggestedAction: 'invoke_agent_b',
        reasoning: '检测到执行 Agent 执行异常，需要 Agent B 进行故障诊断和决策',
      };
    }

    // 场景3：执行 Agent 需要技术支撑
    if (hasNeedSupport || task.status === 'pre_need_support') {
      return {
        scenario: 'executor_need_support',
        description: '场景3：执行 Agent 需要技术支撑',
        confidence: 0.9,
        suggestedAction: 'invoke_agent_b',
        reasoning: '执行 Agent 需要技术支撑，直接调用 Agent B 进行评审',
      };
    }

    // 默认：未知场景，降级处理
    return {
      scenario: 'executor_exception',
      description: '未知超时场景，默认按执行异常处理',
      confidence: 0.6,
      suggestedAction: 'invoke_agent_b',
      reasoning: '无法明确判断超时场景，尝试调用 Agent B 进行分析',
    };
  }

  /**
   * 直接调用 Agent B
   */
  private async invokeAgentBDirectly(
    task: typeof agentSubTasks.$inferSelect,
    analysis: TimeoutScenarioAnalysis
  ): Promise<void> {
    console.log('[TimeoutAgentB] ========== 直接调用 Agent B ==========');
    console.log('[TimeoutAgentB] 当前状态:', task.status);

    // 🔴 重要：如果任务已经是 pre_completed 或 pre_need_support 状态，就不要再处理了！
    if (task.status === 'pre_completed' || task.status === 'pre_need_support') {
      console.log('[TimeoutAgentB] ⚠️  任务已经是 pre_completed/pre_need_support 状态，跳过处理');
      return;
    }

    // 1. 记录超时决策历史
    await this.recordTimeoutDecisionHistory(task, analysis, 'invoke_agent_b');

    // 2. 根据不同场景，将任务转换为 Agent B 可以处理的状态
    let targetStatus: 'pre_completed' | 'pre_need_support';
    
    switch (analysis.scenario) {
      case 'waiting_user_timeout':
        // 场景1：等用户反馈超时 → 转换为 pre_need_support，让 Agent B 重新分析
        targetStatus = 'pre_need_support';
        console.log('[TimeoutAgentB] 场景1：waiting_user 超时 → pre_need_support');
        break;
      
      case 'executor_exception':
        // 场景2：执行异常 → 转换为 pre_need_support，让 Agent B 诊断
        targetStatus = 'pre_need_support';
        console.log('[TimeoutAgentB] 场景2：执行异常 → pre_need_support');
        break;
      
      case 'executor_need_support':
        // 场景3：需要技术支撑 → 已经是 pre_need_support，保持
        targetStatus = 'pre_need_support';
        console.log('[TimeoutAgentB] 场景3：需要技术支撑 → 保持 pre_need_support');
        break;
      
      default:
        targetStatus = 'pre_need_support';
    }

    // 3. 更新任务状态，让 Agent B 可以介入
    console.log('[TimeoutAgentB] 更新任务状态:', targetStatus);
    
    // 如果已有 executionResult，保留；否则创建一个说明超时的结果
    let executionResult = task.executionResult;
    if (!executionResult) {
      executionResult = JSON.stringify({
        isNeedMcp: true,
        isTaskDown: false,
        problem: `超时场景：${analysis.description}`,
        capabilityType: 'timeout_recovery',
        executionResult: {
          timeoutScenario: analysis.scenario,
          timeoutAnalysis: analysis,
          timestamp: getCurrentBeijingTime().toISOString(),
        },
      });
    }

    await db
      .update(agentSubTasks)
      .set({
        status: targetStatus,
        executionResult: executionResult,
        metadata: {
          ...(task.metadata as any),
          timeoutScenario: analysis.scenario,
          timeoutAnalysis: analysis,
          timeoutHandledAt: getCurrentBeijingTime().toISOString(),
          timeoutHandledBy: 'agent_b',
        },
        updatedAt: getCurrentBeijingTime(),
      })
      .where(eq(agentSubTasks.id, task.id));

    console.log('[TimeoutAgentB] ✅ 任务状态已更新，Agent B 将介入处理');
    console.log('[TimeoutAgentB] ========== 直接调用 Agent B 完成 ==========');

    // 4. 注意：这里不需要直接调用 Agent B 的方法
    // 因为 SubtaskExecutionEngine 的下一次执行会自动检测到 pre_need_support 状态
    // 然后调用 executeAgentBReviewWorkflow 方法
  }

  /**
   * 重试执行 Agent
   */
  private async retryExecutor(
    task: typeof agentSubTasks.$inferSelect,
    analysis: TimeoutScenarioAnalysis
  ): Promise<void> {
    console.log('[TimeoutAgentB] ========== 重试执行 Agent ==========');
    console.log('[TimeoutAgentB] 当前状态:', task.status);

    // 🔴 重要：如果任务已经是 pre_completed 或 pre_need_support 状态，就不要再重试了！
    if (task.status === 'pre_completed' || task.status === 'pre_need_support') {
      console.log('[TimeoutAgentB] ⚠️  任务已经是 pre_completed/pre_need_support 状态，跳过重试');
      return;
    }

    // 记录超时决策历史
    await this.recordTimeoutDecisionHistory(task, analysis, 'retry_executor');

    // 更新任务状态为 pending，让执行 Agent 重新执行
    await db
      .update(agentSubTasks)
      .set({
        status: 'pending',
        startedAt: null,
        metadata: {
          ...(task.metadata as any),
          timeoutScenario: analysis.scenario,
          timeoutAnalysis: analysis,
          timeoutHandledAt: getCurrentBeijingTime().toISOString(),
          timeoutHandledBy: 'retry_executor',
          retryCount: ((task.metadata as any)?.retryCount || 0) + 1,
        },
        updatedAt: getCurrentBeijingTime(),
      })
      .where(eq(agentSubTasks.id, task.id));

    console.log('[TimeoutAgentB] ✅ 任务状态已重置为 pending，执行 Agent 将重试');
    console.log('[TimeoutAgentB] ========== 重试执行 Agent 完成 ==========');
  }

  /**
   * 升级到用户
   */
  private async escalateToUser(
    task: typeof agentSubTasks.$inferSelect,
    analysis: TimeoutScenarioAnalysis
  ): Promise<void> {
    console.log('[TimeoutAgentB] ========== 升级到用户 ==========');
    console.log('[TimeoutAgentB] 当前状态:', task.status);

    // 🔴 重要：如果任务已经是 pre_completed 或 pre_need_support 状态，就不要再转人工了！
    if (task.status === 'pre_completed' || task.status === 'pre_need_support') {
      console.log('[TimeoutAgentB] ⚠️  任务已经是 pre_completed/pre_need_support 状态，跳过转人工');
      return;
    }

    // 记录超时决策历史
    await this.recordTimeoutDecisionHistory(task, analysis, 'escalate_to_user');

    // 更新任务状态为 waiting_user
    const userMessage = `任务超时（场景：${analysis.description}）。\n\n分析：${analysis.reasoning}\n\n请您决定下一步操作。`;

    await db
      .update(agentSubTasks)
      .set({
        status: 'waiting_user',
        metadata: {
          ...(task.metadata as any),
          timeoutScenario: analysis.scenario,
          timeoutAnalysis: analysis,
          timeoutHandledAt: getCurrentBeijingTime().toISOString(),
          timeoutHandledBy: 'user',
          userMessage,
        },
        updatedAt: getCurrentBeijingTime(),
      })
      .where(eq(agentSubTasks.id, task.id));

    // 记录用户询问
    await this.recordUserInquiry(task, analysis, userMessage);

    console.log('[TimeoutAgentB] ✅ 已升级到用户');
    console.log('[TimeoutAgentB] ========== 升级到用户完成 ==========');
  }

  /**
   * 记录超时决策历史
   */
  private async recordTimeoutDecisionHistory(
    task: typeof agentSubTasks.$inferSelect,
    analysis: TimeoutScenarioAnalysis,
    action: string
  ): Promise<void> {
    if (!task.commandResultId) {
      console.log('[TimeoutAgentB] 无 commandResultId，跳过记录决策历史');
      return;
    }

    // 查询当前历史记录数量
    const historyRecords = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(
        and(
          eq(agentSubTasksStepHistory.commandResultId, task.commandResultId),
          eq(agentSubTasksStepHistory.stepNo, task.orderIndex)
        )
      );

    const nextInteractNum = historyRecords.length > 0
      ? Math.max(...historyRecords.map(h => h.interactNum || 1)) + 1
      : 1;

    // 记录决策
    await db.insert(agentSubTasksStepHistory).values({
      commandResultId: task.commandResultId,
      stepNo: task.orderIndex,
      interactType: 'timeout_agent_b_decision',
      interactContent: {
        type: 'timeout_agent_b_decision',
        scenario: analysis.scenario,
        analysis,
        action,
        timestamp: getCurrentBeijingTime().toISOString(),
      },
      interactUser: 'ai',
      interactTime: getCurrentBeijingTime(),
      interactNum: nextInteractNum,
    });

    console.log('[TimeoutAgentB] ✅ 超时决策历史已记录');
  }

  /**
   * 记录用户询问
   */
  private async recordUserInquiry(
    task: typeof agentSubTasks.$inferSelect,
    analysis: TimeoutScenarioAnalysis,
    userMessage: string
  ): Promise<void> {
    if (!task.commandResultId) {
      console.log('[TimeoutAgentB] 无 commandResultId，跳过记录用户询问');
      return;
    }

    // 查询当前历史记录数量（再次查询，因为可能刚记录了决策）
    const historyRecords = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(
        and(
          eq(agentSubTasksStepHistory.commandResultId, task.commandResultId),
          eq(agentSubTasksStepHistory.stepNo, task.orderIndex)
        )
      );

    const nextInteractNum = historyRecords.length > 0
      ? Math.max(...historyRecords.map(h => h.interactNum || 1)) + 1
      : 1;

    // 记录用户询问
    await db.insert(agentSubTasksStepHistory).values({
      commandResultId: task.commandResultId,
      stepNo: task.orderIndex,
      interactType: 'inquiry',
      interactContent: {
        type: 'timeout_user_inquiry',
        message: userMessage,
        scenario: analysis.scenario,
        analysis,
        timestamp: getCurrentBeijingTime().toISOString(),
      },
      interactUser: 'ai',
      interactTime: getCurrentBeijingTime(),
      interactNum: nextInteractNum,
    });

    console.log('[TimeoutAgentB] ✅ 用户询问已记录');
  }
}

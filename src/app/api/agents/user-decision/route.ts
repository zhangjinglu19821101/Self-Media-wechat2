/**
 * 用户决策 API - 简化版
 *
 * GET /api/agents/user-decision - 获取执行者选项列表（含避坑信息）
 * POST /api/agents/user-decision - 接收用户决策并处理任务
 *
 * 功能：
 * 1. 获取可选执行者列表，排除已拒绝过的执行者
 * 2. 接收用户决策
 * 3. 记录用户交互到 agent_sub_tasks_step_history
 * 4. 更新任务状态为 pending
 * 5. 支持用户强制指定执行者
 * 6. 触发任务继续执行
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { db } from '@/lib/db';
import { agentSubTasks, agentSubTasksStepHistory } from '@/lib/db/schema';
import { eq, and, desc, sql, or, ne } from 'drizzle-orm';
import { manuallyExecuteInProgressSubtasks } from '@/lib/cron';

// ═══════════════════════════════════════════════════════════════
// 🔴 P2-1 修复：类型定义
// ═══════════════════════════════════════════════════════════════

/**
 * 预览修改节点的结果数据结构
 * 用于 user_preview_edit 虚拟执行器完成时的 markTaskCompleted 参数
 */
interface PreviewEditResultData {
  isCompleted: boolean;
  isNeedMcp: boolean;
  isTaskDown: boolean;
  interactionType: 'preview_edit_article';
  previewAction: 'skip' | 'save';
  wasModified: boolean;
  originalContentLength: number;
  finalContentLength: number;
  confirmedAt: string;
  // 🔴 新增：供 preview-article API 直接读取的顶层字段
  articleContent?: string;
  articleTitle?: string;
  platform?: string;
  platformRenderData?: any;
  executorOutput: {
    output: string;
    result: {
      content: string;
      articleTitle: string;
      platformData: {
        platform: string;
        interactionType: 'preview_edit_article';
        wasModified: boolean;
      };
    };
  };
}

// ═══════════════════════════════════════════════════════════════
// 执行者配置
// ═══════════════════════════════════════════════════════════════
const EXECUTOR_CONFIG = [
  {
    id: 'insurance-d',
    name: 'insurance-d',
    description: '公众号文章创作专家',
    capabilities: ['内容创作', '文章撰写', '公众号文章', '内容优化'],
  },
  {
    id: 'insurance-xiaohongshu',
    name: 'insurance-xiaohongshu',
    description: '小红书图文创作专家',
    capabilities: ['小红书图文', '图文创作', '笔记撰写', 'emoji风格'],
  },
  {
    id: 'insurance-zhihu',
    name: 'insurance-zhihu',
    description: '知乎创作专家',
    capabilities: ['知乎回答', '专业长文', '深度分析', 'Markdown'],
  },
  {
    id: 'insurance-toutiao',
    name: 'insurance-toutiao',
    description: '头条创作专家',
    capabilities: ['信息流文章', '短段落', '强节奏', '标题优化'],
  },
  {
    id: 'insurance-c',
    name: 'insurance-c',
    description: '合规审核专家',
    capabilities: ['合规审核', '内容检查', '风险识别'],
  },
  {
    id: 'agent T',
    name: 'agent T',
    description: '通用执行者',
    capabilities: ['MCP调用', '通用任务', '技术操作'],
  },
  {
    id: 'user_preview_edit',
    name: '预览修改',
    description: '用户预览修改初稿',
    capabilities: ['预览', '编辑', '确认'],
  },
  {
    id: 'deai-optimizer',
    name: '去AI化优化专家',
    description: '对文章进行去AI化优化，消除AI痕迹',
    capabilities: ['去AI化', '文风自然化', '句式改写', '词汇替换'],
  },
];

/**
 * GET - 获取执行者选项列表（含避坑信息）
 */
export async function GET(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const { searchParams } = new URL(request.url);
    const subTaskId = searchParams.get('subTaskId');

    console.log('[User Decision] ========== 获取执行者选项 ==========');
    console.log('[User Decision] subTaskId:', subTaskId);

    if (!subTaskId) {
      return NextResponse.json(
        { success: false, error: '缺少 subTaskId 参数' },
        { status: 400 }
      );
    }

    // 1. 查询任务信息
    const subTask = await db.query.agentSubTasks.findFirst({
      where: eq(agentSubTasks.id, subTaskId),
    });

    if (!subTask) {
      return NextResponse.json(
        { success: false, error: '未找到子任务' },
        { status: 404 }
      );
    }

    // 2. 解析历史执行记录，构建避坑名单
    const metadata = (subTask.metadata as any) || {};
    const reexecuteHistory = metadata.reexecuteHistory || [];
    
    // 统计每个执行者的拒绝/失败次数
    const rejectionStats: Record<string, { count: number; reasons: string[] }> = {};
    
    for (const record of reexecuteHistory) {
      const executor = record.executor;
      if (!rejectionStats[executor]) {
        rejectionStats[executor] = { count: 0, reasons: [] };
      }
      
      // 记录拒绝/失败原因
      if (record.reason === 'executor_refused' || record.reason === 'cannot_handle') {
        rejectionStats[executor].count++;
        if (record.reasonDetail) {
          rejectionStats[executor].reasons.push(record.reasonDetail);
        }
      }
    }

    // 3. 查询 MCP 执行历史，获取更详细的失败信息
    // 从 step_history 中提取 canComplete=false 的记录（排除 auto 记录）
    const stepHistory = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(
        and(
          eq(agentSubTasksStepHistory.commandResultId, subTask.commandResultId),
          eq(agentSubTasksStepHistory.stepNo, subTask.orderIndex),
          ne(agentSubTasksStepHistory.interactUser, 'auto')  // 排除系统自动执行记录
        )
      )
      .orderBy(desc(agentSubTasksStepHistory.interactTime));

    // 分析执行者失败记录
    for (const record of stepHistory) {
      const content = record.interactContent as any;
      if (content?.executorOutput?.canComplete === false) {
        const executor = content.executor || record.interactUser;
        if (executor && EXECUTOR_CONFIG.some(e => e.id === executor)) {
          if (!rejectionStats[executor]) {
            rejectionStats[executor] = { count: 0, reasons: [] };
          }
          rejectionStats[executor].count++;
          const reason = content.executorOutput?.result || content.executorOutput?.suggestion;
          if (reason && !rejectionStats[executor].reasons.includes(reason)) {
            rejectionStats[executor].reasons.push(reason);
          }
        }
      }
    }

    console.log('[User Decision] 拒绝统计:', rejectionStats);

    // 5. 构建执行者选项列表
    const isOutlineTask = metadata.subTaskRole === 'outline_generation';

    // 🔴 新增：检测是否为预览修改节点
    let resultDataParsed: any = {};
    try {
      resultDataParsed = typeof subTask.resultData === 'string'
        ? JSON.parse(subTask.resultData)
        : subTask.resultData || {};
    } catch {
      // ignore
    }
    const isPreviewEditTask = resultDataParsed.interactionType === 'preview_edit_article'
      || subTask.fromParentsExecutor === 'user_preview_edit';

    const executorOptions = [
      // Phase 3: 大纲确认任务的特殊选项
      ...(isOutlineTask ? [{
        value: 'outline_confirmed',
        label: '✅ 确认大纲，继续生成全文',
        description: '大纲内容符合预期，确认后系统将自动生成完整文章',
        status: 'outline_confirm_option',
        rejectionCount: 0,
        rejectionReasons: [],
      }, {
        value: 'outline_revision',
        label: '✏️ 修改大纲后重新生成',
        description: '对大纲提出修改意见，系统将根据修改后的要求重新生成大纲',
        status: 'outline_revision_option',
        rejectionCount: 0,
        rejectionReasons: [],
      }] : []),
      // 🔴 新增：预览修改节点的选项
      ...(isPreviewEditTask ? [{
        value: 'preview_edit_article',
        label: '👁️ 确认并继续',
        description: '确认文章内容（修改或跳过），继续执行合规校验',
        status: 'preview_edit_option',
        rejectionCount: 0,
        rejectionReasons: [],
      }] : []),
      {
        value: 'task_completed',
        label: '✅ 指令已完成',
        description: '任务已经完成，直接标记为完成状态',
        status: 'completed_option',
        rejectionCount: 0,
        rejectionReasons: [],
      },
      {
        value: '',
        label: '系统自动分配（推荐）',
        description: '让 Agent B 智能决策，自动选择最合适的执行者',
        status: 'recommended',
        rejectionCount: 0,
        rejectionReasons: [],
      },
      ...EXECUTOR_CONFIG.map(executor => {
        const stats = rejectionStats[executor.id] || { count: 0, reasons: [] };
        const hasRejected = stats.count > 0;
        
        return {
          value: executor.id,
          label: executor.name,
          description: executor.description,
          capabilities: executor.capabilities,
          status: hasRejected ? 'rejected_before' : 'available',
          rejectionCount: stats.count,
          rejectionReasons: stats.reasons.slice(0, 3), // 最多显示3条原因
        };
      }),
    ];

    console.log('[User Decision] 执行者选项:', executorOptions.map(o => ({
      value: o.value,
      status: o.status,
      rejectionCount: o.rejectionCount
    })));

    // 5. 返回结果
    return NextResponse.json({
      success: true,
      data: {
        taskId: subTask.id,
        taskTitle: subTask.taskTitle,
        currentExecutor: subTask.fromParentsExecutor,
        executorOptions,
        rejectionStats,
      },
    });

  } catch (error) {
    console.error('[User Decision] 获取执行者选项失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '获取失败' },
      { status: 500 }
    );
  }
}

/**
 * POST - 接收用户决策并处理任务
 */
export async function POST(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const body = await request.json();
    const {
      subTaskId,
      commandResultId,
      userDecision,
      decisionType,
      forcedExecutor,  // 🔴 用户强制指定的执行者
      // Phase 3: 大纲确认相关字段
      confirmedOutline,   // 用户确认后的大纲文本（可能被修改过）
      outlineFeedback,    // 用户的修改意见
    } = body;

    console.log('[User Decision] ========== 收到用户决策 ==========');
    console.log('[User Decision] 收到参数:', {
      subTaskId,
      commandResultId,
      userDecision: userDecision?.substring?.(0, 50) + '...',
      decisionType,
      forcedExecutor  // 🔴 打印强制执行者
    });

    // 1. 验证参数
    if (!subTaskId || !userDecision) {
      console.log('[User Decision] ❌ 缺少必要参数');
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 2. 查询子任务信息
    console.log('[User Decision] 查询子任务...', subTaskId);
    const subTask = await db.query.agentSubTasks.findFirst({
      where: eq(agentSubTasks.id, subTaskId),
    });

    if (!subTask) {
      console.log('[User Decision] ❌ 未找到子任务');
      return NextResponse.json(
        { success: false, error: '未找到子任务' },
        { status: 404 }
      );
    }

    console.log('[User Decision] 当前子任务状态:', subTask.status);

    // 🔴 修复：明确禁止 completed 和 cancelled 状态
    if (subTask.status === 'completed' || subTask.status === 'cancelled') {
      console.log('[User Decision] ❌ 任务已结束，不允许提交用户决策:', {
        taskId: subTaskId,
        currentStatus: subTask.status
      });
      return NextResponse.json(
        { success: false, error: '已完成或已取消的任务不能提交用户决策' },
        { status: 400 }
      );
    }

    // 验证状态是否允许用户决策
    if (subTask.status !== 'waiting_user' && subTask.status !== 'failed') {
      return NextResponse.json(
        { success: false, error: '仅 waiting_user 和 failed 状态的任务可以提交用户决策' },
        { status: 400 }
      );
    }

    // 🔴🔴🔴 【新增】如果用户选择"指令已完成"，直接标记任务为完成
    if (forcedExecutor === 'task_completed' || userDecision === 'task_completed' || decisionType === 'task_completed') {
      console.log('[User Decision] 🔴🔴🔴 用户选择"指令已完成"，直接标记任务为完成');
      
      // 使用子任务中的 commandResultId
      const actualCommandResultId = commandResultId || subTask.commandResultId;
      
      // 1. 查询沟通历史记录（排除 auto 记录）
      const interactionHistoryForComplete = await db
        .select()
        .from(agentSubTasksStepHistory)
        .where(
          and(
            eq(agentSubTasksStepHistory.commandResultId, actualCommandResultId),
            eq(agentSubTasksStepHistory.stepNo, subTask.orderIndex),
            ne(agentSubTasksStepHistory.interactUser, 'auto')  // 排除系统自动执行记录
          )
        )
        .orderBy(agentSubTasksStepHistory.interactTime);
      
      // 2. 计算下一个交互编号
      const nextInteractNumForComplete = interactionHistoryForComplete.length > 0
        ? Math.max(...interactionHistoryForComplete.map(h => h.interactNum || 1)) + 1
        : 1;
      
      // 3. 记录用户交互
      const interactContentForComplete = {
        type: 'user_decision',
        decisionType: 'task_completed',
        userDecision: '用户确认指令已完成',
        timestamp: new Date().toISOString(),
      };
      
      await db.insert(agentSubTasksStepHistory).values({
        commandResultId: actualCommandResultId,
        stepNo: subTask.orderIndex,
        interactType: 'response',
        interactContent: interactContentForComplete,
        interactUser: 'human',
        interactTime: new Date(),
        interactNum: nextInteractNumForComplete,
      });
      
      // 4. 直接标记任务为完成！
      // 这里我们直接调用 markTaskCompleted，传入一个简单的 result
      const { SubtaskExecutionEngine } = await import('@/lib/services/subtask-execution-engine');
      const engine = new SubtaskExecutionEngine();
      
      await engine.markTaskCompleted(subTask, {
        isNeedMcp: false,
        isTaskDown: true,
        resultData: {
          isCompleted: true,
          userConfirmed: true,
          confirmationTime: new Date().toISOString()
        }
      });
      
      console.log('[User Decision] ✅✅✅ 用户确认指令已完成，任务已标记为 completed！');
      
      return NextResponse.json({
        success: true,
        message: '指令已确认完成，任务已标记为完成状态'
      });
    }

    // 🔴🔴🔴 Phase 3 新增：大纲确认决策处理
    if (decisionType === 'outline_confirmed' || forcedExecutor === 'outline_confirmed') {
      console.log('[User Decision] 📋 [Phase3] 用户确认大纲，激活全文子任务');

      const taskMetadata = (subTask.metadata as any) || {};
      const taskResultData = (subTask.resultData as any) || {};
      
      // 🔧 修复：同时检查 metadata 和 resultData 中的 subTaskRole，增加任务标题匹配作为兜底
      const isOutlineTask = 
        taskMetadata.subTaskRole === 'outline_generation' ||
        taskResultData.subTaskRole === 'outline_generation' ||
        subTask.taskTitle?.includes('大纲'); // 兜底：通过任务标题匹配

      if (!isOutlineTask) {
        console.log('[User Decision] 📋 [Phase3] 当前任务不是大纲生成任务，检查通过任务标题:', subTask.taskTitle);
        // 不再硬性拦截，允许通过任务标题匹配的大纲任务继续执行
      }
      
      console.log('[User Decision] 📋 [Phase3] 大纲任务检查:', {
        taskTitle: subTask.taskTitle,
        metadataRole: taskMetadata.subTaskRole,
        resultDataRole: taskResultData.subTaskRole,
        isOutlineTask
      });

      // 1. 标记大纲任务为 completed
      await db
        .update(agentSubTasks)
        .set({
          status: 'completed',
          resultText: '【大纲已确认】用户已确认大纲内容',
          resultData: {
            ...(typeof subTask.resultData === 'object' ? subTask.resultData : {}),
            outlineConfirmed: true,
            confirmedAt: new Date().toISOString(),
            outlineFeedback: outlineFeedback || null,
          } as any,
          updatedAt: new Date(),
        })
        .where(eq(agentSubTasks.id, subTaskId));

      // 2. 查找对应的全文子任务
      // 🔧 P2-2 优化：直接使用 orderIndex + 1 查询（利用复合索引 idx_agent_sub_tasks_cmd_order）
      const fullArticleTask = await db.query.agentSubTasks.findFirst({
        where: and(
          eq(agentSubTasks.commandResultId, subTask.commandResultId),
          eq(agentSubTasks.orderIndex, subTask.orderIndex + 1)
        ),
      });

      if (!fullArticleTask) {
        console.error('[User Decision] 📋 [Phase3] 未找到对应的全文子任务');
        return NextResponse.json(
          { success: false, error: '未找到对应的全文生成子任务' },
          { status: 500 }
        );
      }

      console.log('[User Decision] 📋 [Phase3] 找到全文子任务:', {
        id: fullArticleTask.id,
        orderIndex: fullArticleTask.orderIndex,
        taskTitle: fullArticleTask.taskTitle
      });

      // 3. 将确认后的大纲写入全文子任务的 metadata 和 InsuranceDTaskExtension 字段
      const finalOutline = confirmedOutline || userDecision || '';
      const fullArticleMetadata = (fullArticleTask.metadata as any) || {};

      await db
        .update(agentSubTasks)
        .set({
          status: 'pending', // 激活全文子任务
          userOpinion: finalOutline, // 将大纲作为 userOpinion 传递（InsuranceDTaskExtension.confirmedOutline 从此读取）
          metadata: {
            ...fullArticleMetadata,
            confirmedOutline: finalOutline, // 存入 metadata 作为备份
            outlineConfirmedAt: new Date().toISOString(),
            outlineFeedback: outlineFeedback || null,
            outlineSourceTaskId: subTaskId, // 记录来源大纲任务
          } as any,
          updatedAt: new Date(),
        })
        .where(eq(agentSubTasks.id, fullArticleTask.id));

      // 4. 记录用户交互到 step_history
      const interactionHistoryForOutline = await db
        .select()
        .from(agentSubTasksStepHistory)
        .where(
          and(
            eq(agentSubTasksStepHistory.commandResultId, subTask.commandResultId),
            eq(agentSubTasksStepHistory.stepNo, subTask.orderIndex)
          )
        )
        .orderBy(agentSubTasksStepHistory.interactTime);

      const nextInteractNum = interactionHistoryForOutline.length > 0
        ? Math.max(...interactionHistoryForOutline.map(h => h.interactNum || 1)) + 1
        : 1;

      await db.insert(agentSubTasksStepHistory).values({
        commandResultId: subTask.commandResultId,
        stepNo: subTask.orderIndex,
        interactType: 'response',
        interactContent: {
          type: 'user_decision',
          decisionType: 'outline_confirmed',
          userDecision: '用户确认大纲',
          confirmedOutline: finalOutline,
          outlineFeedback: outlineFeedback || null,
          activatedFullArticleTaskId: fullArticleTask.id,
          timestamp: new Date().toISOString(),
        } as any,
        interactUser: 'human',
        interactTime: new Date(),
        interactNum: nextInteractNum,
      });

      console.log('[User Decision] 📋 [Phase3] ✅ 大纲确认处理完成:', {
        outlineTaskId: subTaskId,
        fullArticleTaskId: fullArticleTask.id,
        outlineLength: finalOutline.length,
      });

      return NextResponse.json({
        success: true,
        message: '大纲已确认，全文生成任务已激活',
        data: {
          outlineTaskId: subTaskId,
          fullArticleTaskId: fullArticleTask.id,
          outlineLength: finalOutline.length,
        },
      });
    }

    // 🔴🔴🔴 Phase 3 新增：大纲修改意见处理（重新生成大纲）
    if (decisionType === 'outline_revision' || forcedExecutor === 'outline_revision') {
      console.log('[User Decision] 📋 [Phase3] 用户要求修改大纲');

      // 将用户的修改意见写入当前大纲任务的 userOpinion，使其作为下一轮执行的输入
      const revisionInstruction = outlineFeedback || userDecision || '';

      await db
        .update(agentSubTasks)
        .set({
          status: 'pending', // 重新激活，让引擎拾取重试
          userOpinion: revisionInstruction, // 修改意见作为新的 userOpinion
          resultData: {
            ...(typeof subTask.resultData === 'object' ? subTask.resultData : {}),
            outlineRevisionRequested: true,
            revisionInstruction,
            revisionAt: new Date().toISOString(),
          } as any,
          updatedAt: new Date(),
        })
        .where(eq(agentSubTasks.id, subTaskId));

      return NextResponse.json({
        success: true,
        message: '大纲修改意见已收到，将重新生成大纲',
        data: {
          revisionInstruction,
        },
      });
    }

    // 🔴🔴🔴 【虚拟执行器】预览修改节点决策处理
    if (decisionType === 'preview_edit_article' || forcedExecutor === 'preview_edit_article') {
      console.log('[User Decision] 👁️ [Preview] 用户处理预览修改节点');

      // 解析请求参数
      const previewAction = body.previewAction || 'skip'; // 'skip' | 'save'
      const modifiedContent = body.modifiedContent || '';   // 修改后的文章内容
      const modifiedTitle = body.modifiedTitle || '';       // 修改后的文章标题

      console.log('[User Decision] 👁️ [Preview] 操作:', previewAction, {
        hasModifiedContent: modifiedContent.length > 0,
        hasModifiedTitle: modifiedTitle.length > 0,
      });

      // 1. 记录用户交互到 step_history
      const previewHistoryRecords = await db
        .select()
        .from(agentSubTasksStepHistory)
        .where(
          and(
            eq(agentSubTasksStepHistory.commandResultId, subTask.commandResultId),
            eq(agentSubTasksStepHistory.stepNo, subTask.orderIndex)
          )
        )
        .orderBy(agentSubTasksStepHistory.interactTime);

      const previewNextInteractNum = previewHistoryRecords.length > 0
        ? Math.max(...previewHistoryRecords.map(h => h.interactNum || 1)) + 1
        : 1;

      await db.insert(agentSubTasksStepHistory).values({
        commandResultId: subTask.commandResultId,
        stepNo: subTask.orderIndex,
        interactType: 'response',
        interactContent: {
          type: 'user_decision',
          decisionType: 'preview_edit_article',
          previewAction,
          userDecision: previewAction === 'skip' ? '用户跳过修改，确认使用原稿' : '用户修改了文章内容',
          modifiedContentLength: modifiedContent.length,
          modifiedTitle,
          timestamp: new Date().toISOString(),
        } as any,
        interactUser: 'human',
        interactTime: new Date(),
        interactNum: previewNextInteractNum,
      });

      // 2. 确定最终内容
      // 从 resultData 获取原始文章内容
      let originalContent = '';
      let articleTitle = '';
      let previewPlatform = 'wechat_official';
      let originalPlatformRenderData: any = null;  // 🔴 新增：保存原始 platformRenderData
      try {
        const rd = typeof subTask.resultData === 'string'
          ? JSON.parse(subTask.resultData)
          : subTask.resultData || {};
        originalContent = rd.articleContent || '';
        articleTitle = rd.articleTitle || '';
        previewPlatform = rd.platform || 'wechat_official';
        originalPlatformRenderData = rd.platformRenderData || null;  // 🔴 新增：提取原始 platformRenderData
      } catch {
        // ignore
      }

      const finalContent = previewAction === 'save' && modifiedContent
        ? modifiedContent
        : originalContent;
      const finalTitle = previewAction === 'save' && modifiedTitle
        ? modifiedTitle
        : articleTitle;
      
      // 🔴 新增：构建更新后的 platformRenderData
      // 原则：从哪个字段展示就保存回哪个字段
      let updatedPlatformRenderData = originalPlatformRenderData;
      if (previewAction === 'save' && modifiedContent) {
        if (previewPlatform === 'wechat_official') {
          // 公众号：更新 platformRenderData.htmlContent
          updatedPlatformRenderData = {
            ...(originalPlatformRenderData || {}),
            htmlContent: finalContent,  // 🔴 关键：保存回 htmlContent 字段
          };
        } else if (previewPlatform === 'xiaohongshu') {
          // 小红书：尝试解析 JSON 更新 platformRenderData
          try {
            const jsonMatch = finalContent.match(/\{[\s\S]*"title"[\s\S]*"points"[\s\S]*\}/);
            if (jsonMatch) {
              const xhsData = JSON.parse(jsonMatch[0]);
              // 🔴 P1-2 修复：xhsData 有 fullText 但没有 textContent
              // 而 XhsPlatformRenderData 的正文存储字段是 textContent
              // 必须同步更新 textContent，确保下游 extractResultTextFromResultData 路径0 能正确提取
              const textContent = typeof xhsData.fullText === 'string' ? xhsData.fullText :
                                 (typeof xhsData.content === 'string' ? xhsData.content : undefined);
              updatedPlatformRenderData = {
                ...(originalPlatformRenderData || {}),
                ...xhsData,
                ...(textContent ? { textContent } : {}),  // 🔴 关键：同步更新 textContent
              };
            }
          } catch {
            // 解析失败，保持原样
          }
        }
      }

      // 3. 标记预览任务为完成
      // 🔴 关键设计：用户修改的内容存入本节点的 result_text
      // 不修改前序写作任务的 result_text（保持不可变性）
      // 下游合规校验通过 priorStepOutput 自然获取本节点的 result_text（最新版本）
      const { SubtaskExecutionEngine } = await import('@/lib/services/subtask-execution-engine');
      const engine = new SubtaskExecutionEngine();

      // 🔴 P2-1 修复：使用类型定义的 PreviewEditResultData
      // 构建标准化的 result 结构，确保 extractResultTextFromResultData 能正确提取
      // 使用 executorOutput.output 字段（路径 1，最高优先级），写入纯文本
      // 🔴 关键修复：从哪个字段展示就保存回哪个字段
      const previewResult: PreviewEditResultData = {
        isCompleted: true,
        isNeedMcp: false,
        isTaskDown: true,
        interactionType: 'preview_edit_article',
        previewAction,
        wasModified: previewAction === 'save',
        originalContentLength: originalContent.length,
        finalContentLength: finalContent.length,
        confirmedAt: new Date().toISOString(),
        // 🔴 新增：顶层字段，供 preview-article API 直接读取
        articleContent: finalContent,
        articleTitle: finalTitle,
        platform: previewPlatform,
        platformRenderData: updatedPlatformRenderData,  // 🔴 关键：保存更新后的 platformRenderData
        // 🔴 核心：executorOutput.output 写入纯文本，extractResultTextFromResultData 路径 1 可提取
        executorOutput: {
          output: finalContent,
          result: {
            content: finalContent,
            articleTitle: finalTitle,
            platformData: {
              platform: previewPlatform,
              interactionType: 'preview_edit_article',
              wasModified: previewAction === 'save',
            },
          },
        },
      };

      await engine.markTaskCompleted(subTask, previewResult);

      console.log('[User Decision] 👁️ [Preview] ✅ 预览修改节点已完成:', {
        taskId: subTaskId,
        previewAction,
        wasModified: previewAction === 'save',
        finalContentLength: finalContent.length,
      });

      // ========== 🔥 小红书卡片生成（用户确认后） ==========
      // 设计原则：用户确认后的内容才是最终版本，卡片应基于此生成
      if (previewPlatform === 'xiaohongshu') {
        console.log('[User Decision] 🎨 检测到小红书平台，异步生成图文卡片...');
        
        // 异步生成卡片，不阻塞用户确认流程
        (async () => {
          try {
            // 1. 解析小红书 JSON 格式
            let xhsData: { title: string; intro?: string; points: Array<{ title: string; content: string }>; conclusion: string; tags: string[]; fullText?: string } | null = null;
            
            // 尝试从 finalContent 中提取 JSON
            const jsonMatch = finalContent.match(/\{[\s\S]*"title"[\s\S]*"points"[\s\S]*\}/);
            if (jsonMatch) {
              try {
                xhsData = JSON.parse(jsonMatch[0]);
                console.log('[User Decision] 🎨 解析小红书JSON格式成功, points:', xhsData?.points?.length);
              } catch (parseErr) {
                console.warn('[User Decision] 🎨 JSON解析失败，跳过卡片生成');
                return;
              }
            }
            
            if (!xhsData || !xhsData.points || xhsData.points.length === 0) {
              console.warn('[User Decision] 🎨 未解析到有效的 points 数据，跳过卡片生成');
              return;
            }
            
            // 2. 导入卡片生成服务
            const { generateCardsFromArticle } = await import('@/lib/services/xiaohongshu-card-service');
            const { uploadXhsCardGroup } = await import('@/lib/services/xhs-storage-service');
            
            // 3. 确定卡片数量模式
            let imageCountMode: '3-card' | '5-card' | '7-card' = '5-card';
            const metadataImageMode = (subTask.metadata as Record<string, any>)?.imageCountMode;
            if (metadataImageMode && ['3-card', '5-card', '7-card'].includes(metadataImageMode)) {
              imageCountMode = metadataImageMode as '3-card' | '5-card' | '7-card';
            }
            console.log('[User Decision] 🎨 图片模式:', imageCountMode);
            
            // 4. 读取自定义配色方案（来自风格模板）
            let customColorScheme: any = undefined;
            try {
              const { digitalAssetService } = await import('@/lib/services/digital-asset-service');
              const { styleTemplateService } = await import('@/lib/services/style-template-service');
              const templateId = await styleTemplateService.getTemplateIdByAccount((subTask.metadata as any)?.accountId || '');
              if (templateId) {
                const rules = await digitalAssetService.listStyleRules(templateId);
                const colorRule = rules.find(r => r.ruleType === 'color_scheme' && r.metadata?.primaryColor);
                if (colorRule) {
                  customColorScheme = {
                    primaryColor: colorRule.metadata.primaryColor,
                    secondaryColor: colorRule.metadata.secondaryColor,
                    backgroundColor: colorRule.metadata.backgroundColor,
                    accentColor: colorRule.metadata.accentColor,
                    textPrimaryColor: colorRule.metadata.textPrimaryColor,
                    textSecondaryColor: colorRule.metadata.textSecondaryColor,
                  };
                  console.log('[User Decision] 🎨 从模板读取配色方案:', customColorScheme.primaryColor);
                }
              }
            } catch (colorErr) {
              console.warn('[User Decision] 🎨 读取配色方案失败:', colorErr);
            }
            
            // 5. 生成卡片
            const cards = await generateCardsFromArticle({
              title: xhsData.title,
              intro: xhsData.intro,
              points: xhsData.points.slice(0, 5),
              conclusion: xhsData.conclusion || '感谢阅读',
              tags: xhsData.tags || [],
            },
              ['pinkOrange', 'bluePurple', 'tealGreen', 'orangeYellow', 'deepBlue'],
              imageCountMode,
              customColorScheme
            );
            
            console.log('[User Decision] 🎨 生成卡片数量:', cards.length);
            
            // 6. 上传到 OSS
            if (cards.length < 2) {
              console.error('[User Decision] 🎨 卡片数量不足：生成', cards.length, '张，至少需要 2 张');
              return;
            }
            
            const cardTypes: Array<'cover' | 'point' | 'ending'> = ['cover'];
            const pointCount = cards.length - 2;
            for (let pi = 0; pi < pointCount; pi++) {
              cardTypes.push('point');
            }
            cardTypes.push('ending');
            
            const uploadResult = await uploadXhsCardGroup(
              cards.map((card, index) => ({
                base64: card.base64,
                cardType: cardTypes[index] || 'point',
                title: index === 0
                  ? xhsData.title
                  : index === cards.length - 1
                    ? xhsData.conclusion
                    : xhsData.points[index - 1]?.title,
                content: index === 0
                  ? xhsData.intro
                  : index === cards.length - 1
                    ? (xhsData.tags || []).join(' ')
                    : xhsData.points[index - 1]?.content,
              })),
              subTaskId,  // 使用当前预览任务的 ID
              {
                cardCountMode: imageCountMode,
                articleTitle: xhsData.title,
                articleIntro: xhsData.intro,
                workspaceId: subTask.workspaceId,
                commandResultId: subTask.commandResultId || undefined,
              }
            );
            
            console.log('[User Decision] 🎨 ✅ 卡片已上传到OSS:', {
              groupId: uploadResult.groupId,
              totalCards: uploadResult.totalCards,
            });
            
            // 7. 更新文章的 extInfo（存储 OSS key）
            const { db } = await import('@/lib/db');
            const { articleContent } = await import('@/lib/db/schema');
            const { eq } = await import('drizzle-orm');
            
            // 查找文章记录
            const existingArticles = await db.select()
              .from(articleContent)
              .where(eq(articleContent.subTaskId, subTaskId))
              .limit(1);
            
            if (existingArticles.length > 0) {
              const existingExt = (existingArticles[0] as any).extInfo || {};
              await db.update(articleContent)
                .set({
                  extInfo: {
                    ...existingExt,
                    xhsCardStorageKeys: uploadResult.cards.map(c => c.storageKey),
                    xhsCardGroupId: uploadResult.groupId,
                    xhsCardStorageType: 'oss',
                    xhsFullText: xhsData.fullText || '',
                    xhsTags: xhsData.tags || [],
                    xhsIntro: xhsData.intro || '',
                  },
                } as any)
                .where(eq(articleContent.subTaskId, subTaskId));
              
              console.log('[User Decision] 🎨 ✅ 卡片信息已保存到文章 extInfo');
            } else {
              console.warn('[User Decision] 🎨 ⚠️ 未找到文章记录，无法保存卡片信息');
            }
            
          } catch (cardError) {
            console.error('[User Decision] 🎨 ❌ 卡片生成失败:', cardError);
            // 不影响主流程
          }
        })().catch(err => console.error('[User Decision] 🎨 ❌ 卡片生成异步任务失败:', err));
      }

      return NextResponse.json({
        success: true,
        message: previewAction === 'skip'
          ? '已确认使用原稿，继续执行'
          : '已保存修改，继续执行',
        data: {
          previewAction,
          wasModified: previewAction === 'save',
          finalContentLength: finalContent.length,
        },
      });
    }

    // 使用子任务中的 commandResultId
    const actualCommandResultId = commandResultId || subTask.commandResultId;
    if (!actualCommandResultId) {
      console.log('[User Decision] ❌ 缺少 commandResultId');
      return NextResponse.json(
        { success: false, error: '缺少任务关联信息' },
        { status: 400 }
      );
    }

    // 3. 查询沟通历史记录
    const interactionHistory = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(
        and(
          eq(agentSubTasksStepHistory.commandResultId, actualCommandResultId),
          eq(agentSubTasksStepHistory.stepNo, subTask.orderIndex)
        )
      )
      .orderBy(agentSubTasksStepHistory.interactTime);

    console.log('[User Decision] 沟通历史记录数:', interactionHistory.length);

    // 4. 计算下一个交互编号
    const nextInteractNum = interactionHistory.length > 0
      ? Math.max(...interactionHistory.map(h => h.interactNum || 1)) + 1
      : 1;

    console.log('[User Decision] 下一个交互编号:', nextInteractNum);

    // 5. 记录用户交互
    console.log('[User Decision] 记录用户交互...');

    const interactContent = {
      type: 'user_decision',
      decisionType: decisionType || 'waiting_user_confirm',
      userDecision: userDecision,
      forcedExecutor: forcedExecutor,  // 🔴 记录用户强制指定的执行者
      timestamp: new Date().toISOString(),
    };

    await db.insert(agentSubTasksStepHistory).values({
      commandResultId: actualCommandResultId,
      stepNo: subTask.orderIndex,
      interactType: 'response',
      interactContent: interactContent,
      interactUser: 'human',
      interactTime: new Date(),
      interactNum: nextInteractNum,
    });

    console.log('[User Decision] 用户交互已记录');

    // 6. 更新子任务状态和执行者
    console.log('[User Decision] 更新子任务状态和执行者...');
    
    // 构建更新对象
    const updateFields: any = {
      status: 'pending',
      statusProof: null,
      startedAt: null,
      updatedAt: new Date(),
    };

    // 🔴 如果用户强制指定了执行者，更新执行者信息
    if (forcedExecutor) {
      console.log('[User Decision] 🔴 用户强制指定执行者:', forcedExecutor);
      
      const currentMetadata = (subTask.metadata as any) || {};
      
      updateFields.fromParentsExecutor = forcedExecutor;
      updateFields.metadata = {
        ...currentMetadata,
        userForcedExecutor: forcedExecutor,  // 标记用户强制指定
        userForcedExecutorAt: new Date().toISOString(),
        userForcedExecutorReason: userDecision,  // 记录用户决策作为原因
        // 🔴 增加 reexecute_history 记录
        reexecuteHistory: [
          ...(currentMetadata.reexecuteHistory || []),
          {
            executor: forcedExecutor,
            reason: 'user_forced',
            reasonDetail: userDecision,
            timestamp: new Date().toISOString(),
          }
        ]
      };
    }

    await db
      .update(agentSubTasks)
      .set(updateFields)
      .where(eq(agentSubTasks.id, subTaskId));

    console.log('[User Decision] 任务状态已更新');

    // 7. 不即时触发任务执行，靠定时任务兜底
    // 用户决策只改状态，定时任务会自动按 order_index 顺序处理
    console.log('[User Decision] 任务状态已更新，定时任务会按顺序自动处理');

    console.log('[User Decision] ========== 处理完成 ==========');

    return NextResponse.json({
      success: true,
      message: '用户决策已提交'
    });

  } catch (error) {
    console.error('[User Decision] 处理失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '处理失败' },
      { status: 500 }
    );
  }
}

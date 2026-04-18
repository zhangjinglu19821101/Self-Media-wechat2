/**
 * 超时智能决策服务
 *
 * 功能：
 * 1. 分析超时原因和场景
 * 2. 优先让 Agent B 介入决策
 * 3. 形成闭环，让任务能继续执行
 *
 * 三个核心超时场景：
 * 1. 场景1：等用户反馈超时 → 用户反馈后需要 Agent B 分析或重新执行
 * 2. 场景2：执行 Agent 执行异常 → 任务卡在 in_progress
 * 3. 场景3：执行 Agent 需要技术支撑 → 任务卡在 in_progress
 *
 * 决策选项：
 * - invoke_agent_b: 调用 Agent B 介入（优先）
 * - retry_immediately: 立即重试
 * - retry_with_backoff: 退避重试（等一会儿再试）
 * - adjust_parameters: 调整参数重试
 * - switch_strategy: 换一种策略
 * - escalate_to_user: 转人工处理
 */

import { callLLM } from '@/lib/agent-llm';
import { db } from '@/lib/db';
import { agentSubTasks, agentSubTasksStepHistory } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getCurrentBeijingTime } from '@/lib/utils/date-time';
import { TimeoutAgentBDecisionService } from './timeout-agent-b-decision';

// ============================================
// 类型定义
// ============================================

export type TimeoutDecision =
  | 'invoke_agent_b'
  | 'retry_immediately'
  | 'retry_with_backoff'
  | 'adjust_parameters'
  | 'switch_strategy'
  | 'escalate_to_user';

export interface TimeoutAnalysis {
  reason: string;
  confidence: number;
  suggestedAction: TimeoutDecision;
  retryDelay?: number; // 毫秒
  adjustedParameters?: Record<string, any>;
  alternativeStrategy?: string;
  explanation: string;
  scenario?: string; // 超时场景
}

export interface TimeoutContext {
  task: typeof agentSubTasks.$inferSelect;
  historyRecords: typeof agentSubTasksStepHistory.$inferSelect[];
  timeoutCount: number;
  elapsedTime: number; // 毫秒
}

// ============================================
// 超时智能决策服务
// ============================================

export class TimeoutIntelligentDecisionService {
  private static instance: TimeoutIntelligentDecisionService;
  private agentBDecisionService: TimeoutAgentBDecisionService;

  private constructor() {
    this.agentBDecisionService = TimeoutAgentBDecisionService.getInstance();
  }

  public static getInstance(): TimeoutIntelligentDecisionService {
    if (!TimeoutIntelligentDecisionService.instance) {
      TimeoutIntelligentDecisionService.instance = new TimeoutIntelligentDecisionService();
    }
    return TimeoutIntelligentDecisionService.instance;
  }

  /**
   * 分析超时并做出智能决策
   */
  public async analyzeAndDecide(context: TimeoutContext): Promise<TimeoutAnalysis> {
    console.log('[TimeoutDecision] ========== 开始超时智能分析 ==========');
    console.log('[TimeoutDecision] 任务ID:', context.task.id);
    console.log('[TimeoutDecision] 超时次数:', context.timeoutCount);
    console.log('[TimeoutDecision] 已用时间:', context.elapsedTime, 'ms');

    try {
      // 1. 首先使用 Agent B 决策服务分析场景
      console.log('[TimeoutDecision] 步骤1：分析超时场景');
      const scenarioAnalysis = await this.agentBDecisionService.analyzeTimeoutScenario(context.task);

      console.log('[TimeoutDecision] 超时场景分析结果:', scenarioAnalysis);

      // 2. 如果场景分析建议调用 Agent B，直接返回这个决策
      if (scenarioAnalysis.suggestedAction === 'invoke_agent_b') {
        console.log('[TimeoutDecision] 场景分析建议调用 Agent B，优先执行');
        return {
          reason: scenarioAnalysis.description,
          confidence: scenarioAnalysis.confidence,
          suggestedAction: 'invoke_agent_b',
          explanation: scenarioAnalysis.reasoning,
          scenario: scenarioAnalysis.scenario,
        };
      }

      // 3. 否则，继续使用 LLM 进行通用分析
      console.log('[TimeoutDecision] 步骤2：使用 LLM 进行通用分析');
      const contextInfo = this.buildContextInfo(context);
      const llmAnalysis = await this.callLLMForAnalysis(contextInfo);

      console.log('[TimeoutDecision] LLM 智能分析结果:', llmAnalysis);
      console.log('[TimeoutDecision] ========== 超时智能分析完成 ==========');

      return llmAnalysis;
    } catch (error) {
      console.error('[TimeoutDecision] 智能分析失败，使用默认策略:', error);
      
      // LLM 调用失败时的降级策略
      return this.getFallbackDecision(context);
    }
  }

  /**
   * 执行决策
   */
  public async executeDecision(
    task: typeof agentSubTasks.$inferSelect,
    analysis: TimeoutAnalysis
  ): Promise<void> {
    console.log('[TimeoutDecision] ========== 执行超时决策 ==========');
    console.log('[TimeoutDecision] 决策类型:', analysis.suggestedAction);

    // 优先处理 invoke_agent_b 决策
    if (analysis.suggestedAction === 'invoke_agent_b') {
      console.log('[TimeoutDecision] 决策：调用 Agent B 介入');
      
      // 先分析场景（如果还没分析过）
      let scenarioAnalysis;
      if (analysis.scenario) {
        scenarioAnalysis = {
          scenario: analysis.scenario as any,
          description: analysis.reason,
          confidence: analysis.confidence,
          suggestedAction: 'invoke_agent_b',
          reasoning: analysis.explanation,
        };
      } else {
        scenarioAnalysis = await this.agentBDecisionService.analyzeTimeoutScenario(task);
      }
      
      // 执行 Agent B 决策
      await this.agentBDecisionService.executeAgentBTimeoutDecision(task, scenarioAnalysis);
      return;
    }

    // 处理其他决策
    switch (analysis.suggestedAction) {
      case 'retry_immediately':
        await this.retryImmediately(task, analysis);
        break;
      case 'retry_with_backoff':
        await this.retryWithBackoff(task, analysis);
        break;
      case 'adjust_parameters':
        await this.adjustParameters(task, analysis);
        break;
      case 'switch_strategy':
        await this.switchStrategy(task, analysis);
        break;
      case 'escalate_to_user':
        await this.escalateToUser(task, analysis);
        break;
      default:
        await this.escalateToUser(task, analysis);
    }

    console.log('[TimeoutDecision] ========== 超时决策执行完成 ==========');
  }

  // ============================================
  // 私有方法
  // ============================================

  /**
   * 构建上下文信息
   */
  private buildContextInfo(context: TimeoutContext): string {
    const { task, historyRecords, timeoutCount, elapsedTime } = context;

    // 构建历史记录摘要
    const historySummary = historyRecords
      .slice(-5) // 最近5条
      .map(record => {
        const content = record.interactContent as any;
        return `[${record.interactTime.toISOString()}] ${record.interactType} - ${JSON.stringify(content).substring(0, 100)}`;
      })
      .join('\n');

    return `
# 超时任务信息

## 任务基本信息
- 任务ID: ${task.id}
- 任务标题: ${task.taskTitle}
- 任务描述: ${task.taskDescription}
- 当前状态: ${task.status}
- 超时次数: ${timeoutCount}
- 已用时间: ${elapsedTime}ms

## 任务元数据
${task.metadata ? JSON.stringify(task.metadata, null, 2) : '无'}

## 执行结果（如果有）
${task.executionResult ? JSON.stringify(task.executionResult, null, 2) : '无'}

## 状态证据（如果有）
${task.statusProof ? JSON.stringify(task.statusProof, null, 2) : '无'}

## 最近历史记录
${historySummary || '无历史记录'}

## 请分析：
1. 超时的可能原因是什么？
2. 应该采取什么行动？
3. 如果需要重试，是否需要调整参数？
4. 是否需要调用 Agent B 介入？
`;
  }

  /**
   * 调用 LLM 进行分析
   */
  private async callLLMForAnalysis(contextInfo: string): Promise<TimeoutAnalysis> {
    const systemPrompt = `
你是一个专业的任务执行监控和故障诊断专家。你的职责是：

1. 分析任务超时的原因
2. 给出智能的决策建议
3. 确保任务能够继续执行形成闭环

## 决策选项说明（按优先级排序）：

| 决策选项 | 说明 | 适用场景 |
|---------|------|---------|
| invoke_agent_b | 调用 Agent B 介入 | 等待用户反馈超时、执行异常、需要技术支撑 |
| retry_immediately | 立即重试 | 临时性网络问题、API限流刚解除 |
| retry_with_backoff | 退避重试 | API限流、服务暂时不可用 |
| adjust_parameters | 调整参数重试 | 参数不合理、超时时间太短 |
| switch_strategy | 换一种策略 | 当前方法不可行、有替代方案 |
| escalate_to_user | 转人工处理 | 尝试多次失败、需要人工判断 |

## 重要提示：
1. 优先考虑 invoke_agent_b，特别是在以下情况：
   - 任务处于 waiting_user 状态超时
   - 检测到执行 Agent 异常
   - 任务需要技术支撑
2. confidence: 0-1 之间的数字，表示对分析的信心程度
3. retryDelay: 只有 retry_with_backoff 时需要，单位毫秒
4. adjustedParameters: 只有 adjust_parameters 时需要
5. alternativeStrategy: 只有 switch_strategy 时需要
6. 尽量不要直接 escalate_to_user，除非尝试了其他方法都失败

## 输出格式要求：

请严格按照以下 JSON 格式输出（不要有其他文字）：

\`\`\`json
{
  "reason": "超时原因分析",
  "confidence": 0.8,
  "suggestedAction": "invoke_agent_b",
  "retryDelay": 5000,
  "adjustedParameters": {},
  "alternativeStrategy": "",
  "explanation": "详细的决策解释"
}
\`\`\`
`;

    const response = await callLLM(
      'timeout-decision-agent',
      contextInfo,
      systemPrompt,
      contextInfo,
      { temperature: 0.3 }
    );

    // 解析 LLM 响应
    return this.parseLLMResponse(response);
  }

  /**
   * 解析 LLM 响应
   */
  private parseLLMResponse(response: string): TimeoutAnalysis {
    try {
      // 尝试提取 JSON
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : response;
      
      const parsed = JSON.parse(jsonStr);
      
      return {
        reason: parsed.reason || '未知原因',
        confidence: parsed.confidence || 0.5,
        suggestedAction: parsed.suggestedAction || 'escalate_to_user',
        retryDelay: parsed.retryDelay,
        adjustedParameters: parsed.adjustedParameters,
        alternativeStrategy: parsed.alternativeStrategy,
        explanation: parsed.explanation || '无解释',
      };
    } catch (error) {
      console.error('[TimeoutDecision] 解析 LLM 响应失败:', error);
      throw new Error('解析 LLM 响应失败');
    }
  }

  /**
   * 降级策略
   */
  private getFallbackDecision(context: TimeoutContext): TimeoutAnalysis {
    const { timeoutCount, task } = context;

    // 如果是 waiting_user 状态，优先调用 Agent B
    if (task.status === 'waiting_user') {
      return {
        reason: '等待用户反馈超时',
        confidence: 0.9,
        suggestedAction: 'invoke_agent_b',
        explanation: '任务处于 waiting_user 状态超时，需要 Agent B 介入分析',
        scenario: 'waiting_user_timeout',
      };
    }

    // 如果是 pre_need_support 状态，优先调用 Agent B
    if (task.status === 'pre_need_support') {
      return {
        reason: '执行 Agent 需要技术支撑',
        confidence: 0.9,
        suggestedAction: 'invoke_agent_b',
        explanation: '任务处于 pre_need_support 状态，需要 Agent B 介入评审',
        scenario: 'executor_need_support',
      };
    }

    // 根据超时次数决定策略
    if (timeoutCount === 1) {
      return {
        reason: '首次超时，可能是临时性问题',
        confidence: 0.6,
        suggestedAction: 'retry_immediately',
        explanation: '首次超时，尝试立即重试',
      };
    } else if (timeoutCount === 2) {
      return {
        reason: '第二次超时，可能需要等待',
        confidence: 0.5,
        suggestedAction: 'retry_with_backoff',
        retryDelay: 10000, // 10秒
        explanation: '第二次超时，退避重试',
      };
    } else {
      return {
        reason: '多次超时，尝试调用 Agent B',
        confidence: 0.7,
        suggestedAction: 'invoke_agent_b',
        explanation: '多次超时，需要 Agent B 介入分析',
        scenario: 'executor_exception',
      };
    }
  }

  /**
   * 立即重试
   */
  private async retryImmediately(
    task: typeof agentSubTasks.$inferSelect,
    analysis: TimeoutAnalysis
  ): Promise<void> {
    console.log('[TimeoutDecision] 立即重试任务:', task.id);
    console.log('[TimeoutDecision] 当前状态:', task.status);

    // 🔴 重要：如果任务已经是 pre_completed 或 pre_need_support 状态，就不要再重试了！
    // 这些状态表示任务已经等待用户确认，不应该被自动重试
    if (task.status === 'pre_completed' || task.status === 'pre_need_support') {
      console.log('[TimeoutDecision] ⚠️  任务已经是 pre_completed/pre_need_support 状态，跳过重试');
      console.log('[TimeoutDecision] 任务状态:', task.status);
      return;
    }

    // 记录超时次数
    const timeoutCount = (task.metadata?.timeoutCount || 0) + 1;

    // 更新任务状态为 in_progress，立即重试
    await db
      .update(agentSubTasks)
      .set({
        status: 'in_progress',
        metadata: {
          ...task.metadata,
          timeoutCount,
          lastTimeoutDecision: analysis,
          lastTimeoutAt: getCurrentBeijingTime().toISOString(),
        },
        updatedAt: getCurrentBeijingTime(),
      })
      .where(eq(agentSubTasks.id, task.id));

    // 记录决策历史
    await this.recordDecisionHistory(task, analysis, 'retry_immediately');
  }

  /**
   * 退避重试
   */
  private async retryWithBackoff(
    task: typeof agentSubTasks.$inferSelect,
    analysis: TimeoutAnalysis
  ): Promise<void> {
    console.log('[TimeoutDecision] 退避重试任务:', task.id, '延迟:', analysis.retryDelay, 'ms');
    console.log('[TimeoutDecision] 当前状态:', task.status);

    // 🔴 重要：如果任务已经是 pre_completed 或 pre_need_support 状态，就不要再重试了！
    if (task.status === 'pre_completed' || task.status === 'pre_need_support') {
      console.log('[TimeoutDecision] ⚠️  任务已经是 pre_completed/pre_need_support 状态，跳过重试');
      return;
    }

    // 记录超时次数
    const timeoutCount = (task.metadata?.timeoutCount || 0) + 1;

    // 更新任务状态为 in_progress，但标记延迟执行
    await db
      .update(agentSubTasks)
      .set({
        status: 'in_progress',
        metadata: {
          ...task.metadata,
          timeoutCount,
          lastTimeoutDecision: analysis,
          lastTimeoutAt: getCurrentBeijingTime().toISOString(),
          retryAfter: new Date(Date.now() + (analysis.retryDelay || 10000)).toISOString(),
        },
        updatedAt: getCurrentBeijingTime(),
      })
      .where(eq(agentSubTasks.id, task.id));

    // 记录决策历史
    await this.recordDecisionHistory(task, analysis, 'retry_with_backoff');
  }

  /**
   * 调整参数重试
   */
  private async adjustParameters(
    task: typeof agentSubTasks.$inferSelect,
    analysis: TimeoutAnalysis
  ): Promise<void> {
    console.log('[TimeoutDecision] 调整参数重试任务:', task.id);
    console.log('[TimeoutDecision] 当前状态:', task.status);

    // 🔴 重要：如果任务已经是 pre_completed 或 pre_need_support 状态，就不要再重试了！
    if (task.status === 'pre_completed' || task.status === 'pre_need_support') {
      console.log('[TimeoutDecision] ⚠️  任务已经是 pre_completed/pre_need_support 状态，跳过重试');
      return;
    }

    // 记录超时次数
    const timeoutCount = (task.metadata?.timeoutCount || 0) + 1;

    // 更新任务状态为 in_progress，更新参数
    await db
      .update(agentSubTasks)
      .set({
        status: 'in_progress',
        metadata: {
          ...task.metadata,
          timeoutCount,
          lastTimeoutDecision: analysis,
          lastTimeoutAt: getCurrentBeijingTime().toISOString(),
          adjustedParameters: analysis.adjustedParameters,
        },
        updatedAt: getCurrentBeijingTime(),
      })
      .where(eq(agentSubTasks.id, task.id));

    // 记录决策历史
    await this.recordDecisionHistory(task, analysis, 'adjust_parameters');
  }

  /**
   * 换一种策略
   */
  private async switchStrategy(
    task: typeof agentSubTasks.$inferSelect,
    analysis: TimeoutAnalysis
  ): Promise<void> {
    console.log('[TimeoutDecision] 换策略重试任务:', task.id);
    console.log('[TimeoutDecision] 当前状态:', task.status);

    // 🔴 重要：如果任务已经是 pre_completed 或 pre_need_support 状态，就不要再重试了！
    if (task.status === 'pre_completed' || task.status === 'pre_need_support') {
      console.log('[TimeoutDecision] ⚠️  任务已经是 pre_completed/pre_need_support 状态，跳过重试');
      return;
    }

    // 记录超时次数
    const timeoutCount = (task.metadata?.timeoutCount || 0) + 1;

    // 更新任务状态为 in_progress，更新策略
    await db
      .update(agentSubTasks)
      .set({
        status: 'in_progress',
        metadata: {
          ...task.metadata,
          timeoutCount,
          lastTimeoutDecision: analysis,
          lastTimeoutAt: getCurrentBeijingTime().toISOString(),
          alternativeStrategy: analysis.alternativeStrategy,
        },
        updatedAt: getCurrentBeijingTime(),
      })
      .where(eq(agentSubTasks.id, task.id));

    // 记录决策历史
    await this.recordDecisionHistory(task, analysis, 'switch_strategy');
  }

  /**
   * 转人工处理
   */
  private async escalateToUser(
    task: typeof agentSubTasks.$inferSelect,
    analysis: TimeoutAnalysis
  ): Promise<void> {
    console.log('[TimeoutDecision] 转人工处理任务:', task.id);
    console.log('[TimeoutDecision] 当前状态:', task.status);

    // 🔴 重要：如果任务已经是 pre_completed 或 pre_need_support 状态，就不要再转人工了！
    // 这些状态表示任务已经在等待用户确认了
    if (task.status === 'pre_completed' || task.status === 'pre_need_support') {
      console.log('[TimeoutDecision] ⚠️  任务已经是 pre_completed/pre_need_support 状态，跳过转人工');
      return;
    }

    // 记录超时次数
    const timeoutCount = (task.metadata?.timeoutCount || 0) + 1;

    // 更新任务状态为 waiting_user
    await db
      .update(agentSubTasks)
      .set({
        status: 'waiting_user',
        metadata: {
          ...task.metadata,
          timeoutCount,
          lastTimeoutDecision: analysis,
          lastTimeoutAt: getCurrentBeijingTime().toISOString(),
        },
        updatedAt: getCurrentBeijingTime(),
      })
      .where(eq(agentSubTasks.id, task.id));

    // 记录决策历史
    await this.recordDecisionHistory(task, analysis, 'escalate_to_user');

    // 记录用户询问
    await this.recordUserInquiry(task, analysis);
  }

  /**
   * 记录决策历史
   */
  private async recordDecisionHistory(
    task: typeof agentSubTasks.$inferSelect,
    analysis: TimeoutAnalysis,
    decisionType: string
  ): Promise<void> {
    if (!task.commandResultId) {
      console.log('[TimeoutDecision] 无 commandResultId，跳过记录决策历史');
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
      interactType: 'timeout_decision',
      interactContent: {
        type: 'timeout_decision',
        decisionType,
        analysis,
        timestamp: getCurrentBeijingTime().toISOString(),
      },
      interactUser: 'ai',
      interactTime: getCurrentBeijingTime(),
      interactNum: nextInteractNum,
    });
  }

  /**
   * 记录用户询问
   */
  private async recordUserInquiry(
    task: typeof agentSubTasks.$inferSelect,
    analysis: TimeoutAnalysis
  ): Promise<void> {
    if (!task.commandResultId) {
      console.log('[TimeoutDecision] 无 commandResultId，跳过记录用户询问');
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
    const userMessage = `任务执行超时（任务ID: ${task.id}，标题: ${task.taskTitle}）。\n\n超时原因分析：${analysis.reason}\n\n建议：${analysis.explanation}\n\n请您决定下一步操作：重试任务、放弃任务或手动处理。`;

    await db.insert(agentSubTasksStepHistory).values({
      commandResultId: task.commandResultId,
      stepNo: task.orderIndex,
      interactType: 'inquiry',
      interactContent: {
        type: 'user_inquiry',
        message: userMessage,
        reason: 'timeout',
        analysis,
        timestamp: getCurrentBeijingTime().toISOString(),
      },
      interactUser: 'ai',
      interactTime: getCurrentBeijingTime(),
      interactNum: nextInteractNum,
    });
  }
}

/**
 * 用户反馈流程 - Agent B 决策服务 v2
 *
 * 包含历史记录恢复和决策逻辑
 */

import {
  AgentBDecisionContextV2,
  AgentBDecisionV2,
  AgentBDecisionType,
  HistoryRecoveryResult,
  MCPExecutionHistory,
  InteractionRecord,
  ExecutorResult,
  TaskStatusV2,
} from './types';
import { UserFeedbackStateMachine } from './state-machine';

/**
 * Agent B 决策服务 v2
 */
export class AgentBDecisionServiceV2 {
  /**
   * 执行 Agent B 决策（带历史记录恢复）
   */
  static async executeAgentBDecisionWithHistory(
    context: AgentBDecisionContextV2
  ): Promise<AgentBDecisionV2> {
    console.log('[AgentBDecisionV2] 开始决策（带历史记录）');
    console.log('[AgentBDecisionV2] 上下文:', {
      dailyTaskId: context.dailyTaskId,
      userFeedbackLength: context.userFeedback.length,
      mcpHistoryCount: context.mcpExecutionHistory.length,
      interactionCount: context.userInteractions.length,
    });

    try {
      // 1. 构建完整上下文供 LLM 使用
      const fullContext = AgentBDecisionServiceV2.buildFullContext(context);

      // 2. 调用 LLM 进行决策（模拟）
      const decision = await AgentBDecisionServiceV2.makeDecisionWithLLM(context.userFeedback, fullContext);

      // 3. 验证决策
      AgentBDecisionServiceV2.validateDecision(decision);

      console.log('[AgentBDecisionV2] 决策完成:', decision);
      return decision;
    } catch (error) {
      console.error('[AgentBDecisionV2] 决策失败:', error);
      throw error;
    }
  }

  /**
   * 恢复历史记录
   */
  static async recoverHistory(dailyTaskId: string): Promise<HistoryRecoveryResult> {
    console.log('[AgentBDecisionV2] 恢复历史记录:', dailyTaskId);

    try {
      // TODO: 从数据库或缓存中恢复真实的历史记录
      // 这里返回模拟数据，实际应该从数据库查询

      const mcpExecutionHistory: MCPExecutionHistory[] = [
        // 模拟数据
      ];

      const userInteractions: InteractionRecord[] = [
        // 模拟数据
      ];

      const executorResult: ExecutorResult | undefined = undefined;

      return {
        success: true,
        mcpExecutionHistory,
        userInteractions,
        executorResult,
        metadata: {
          dailyTaskId,
          recoveredAt: Date.now(),
        },
      };
    } catch (error) {
      console.error('[AgentBDecisionV2] 恢复历史记录失败:', error);
      return {
        success: false,
        mcpExecutionHistory: [],
        userInteractions: [],
        executorResult: undefined,
        metadata: {
          dailyTaskId,
          error: error instanceof Error ? error.message : '未知错误',
        },
      };
    }
  }

  /**
   * 构建完整上下文
   */
  private static buildFullContext(context: AgentBDecisionContextV2): string {
    const parts: string[] = [];

    // 1. 用户反馈
    parts.push('【用户反馈】');
    parts.push(context.userFeedback);
    parts.push('');

    // 2. MCP 执行历史
    if (context.mcpExecutionHistory.length > 0) {
      parts.push('【MCP 执行历史】');
      context.mcpExecutionHistory.forEach((history, index) => {
        parts.push(`${index + 1}. ${history.mcpServerName}.${history.toolName}`);
        parts.push(`   状态: ${history.status}`);
        if (history.result) {
          parts.push(`   结果: ${JSON.stringify(history.result).substring(0, 200)}`);
        }
        if (history.error) {
          parts.push(`   错误: ${history.error}`);
        }
      });
      parts.push('');
    }

    // 3. 用户交互历史
    if (context.userInteractions.length > 0) {
      parts.push('【交互历史】');
      context.userInteractions.forEach((interaction) => {
        const time = new Date(interaction.timestamp).toLocaleString();
        parts.push(`[${time}] ${interaction.role}: ${interaction.content}`);
      });
      parts.push('');
    }

    // 4. 执行 Agent 结果
    if (context.executorResult) {
      parts.push('【执行 Agent 结果】');
      parts.push(`成功: ${context.executorResult.success}`);
      parts.push(`输出: ${context.executorResult.output}`);
      if (context.executorResult.error) {
        parts.push(`错误: ${context.executorResult.error}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * 使用 LLM 进行决策
   */
  private static async makeDecisionWithLLM(
    userFeedback: string,
    fullContext: string
  ): Promise<AgentBDecisionV2> {
    // TODO: 实际应该调用 LLM API 进行决策
    // 这里返回一个模拟的决策

    const lowerFeedback = userFeedback.toLowerCase();

    // 简单的规则判断（实际应该用 LLM）
    if (lowerFeedback.includes('重新执行') || lowerFeedback.includes('重做') || lowerFeedback.includes('再来一次')) {
      return {
        type: AgentBDecisionType.RE_EXECUTE,
        reasoning: '用户要求重新执行，将任务状态设置为 pending，让执行 Agent 重新执行',
        data: { userFeedback },
      };
    }

    if (lowerFeedback.includes('完成') || lowerFeedback.includes('好了') || lowerFeedback.includes('结束')) {
      return {
        type: AgentBDecisionType.COMPLETE,
        reasoning: '用户反馈任务已完成',
        data: { userFeedback },
      };
    }

    if (lowerFeedback.includes('不理解') || lowerFeedback.includes('不清楚') || lowerFeedback.includes('问')) {
      return {
        type: AgentBDecisionType.NEED_USER,
        reasoning: '需要进一步询问用户以明确需求',
        data: { userFeedback },
      };
    }

    // 默认决策：继续执行
    return {
      type: AgentBDecisionType.EXECUTE_MCP,
      reasoning: '根据用户反馈，继续执行相关操作',
      data: { userFeedback },
    };
  }

  /**
   * 验证决策
   */
  private static validateDecision(decision: AgentBDecisionV2): void {
    if (!Object.values(AgentBDecisionType).includes(decision.type)) {
      throw new Error(`无效的决策类型: ${decision.type}`);
    }

    if (!decision.reasoning || decision.reasoning.trim().length === 0) {
      throw new Error('决策理由不能为空');
    }
  }

  /**
   * 根据决策确定下一个状态
   */
  static getNextStateFromDecision(decision: AgentBDecisionV2): TaskStatusV2 {
    return UserFeedbackStateMachine.getNextStateFromDecision(decision.type);
  }
}

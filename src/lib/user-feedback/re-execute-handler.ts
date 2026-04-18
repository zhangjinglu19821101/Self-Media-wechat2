/**
 * 用户反馈流程 - RE_EXECUTE 决策处理器
 *
 * 处理 Agent B 的 RE_EXECUTE 决策
 */

import {
  ReExecuteRequest,
  ReExecuteResponse,
  TaskStatusV2,
  AgentBDecisionType,
} from './types';
import { UserFeedbackStateMachine } from './state-machine';

/**
 * RE_EXECUTE 决策处理器
 */
export class ReExecuteHandler {
  /**
   * 处理 RE_EXECUTE 决策
   */
  static async handleReExecuteDecision(
    request: ReExecuteRequest
  ): Promise<ReExecuteResponse> {
    console.log('[ReExecuteHandler] 开始处理 RE_EXECUTE 决策:', request);

    try {
      const { dailyTaskId, decision, metadata } = request;

      // 1. 验证决策类型
      if (decision.type !== AgentBDecisionType.RE_EXECUTE) {
        throw new Error('决策类型不是 RE_EXECUTE');
      }

      // 2. 更新任务状态为 pending
      const newStatus = TaskStatusV2.PENDING;

      // 3. 记录日志
      console.log(
        `[ReExecuteHandler] 任务 ${dailyTaskId} 状态更新为: ${newStatus}`
      );

      // 4. 返回成功响应
      return {
        success: true,
        data: {
          taskId: dailyTaskId,
          status: newStatus,
          message: 'RE_EXECUTE 决策处理成功，任务状态已更新为 pending，等待执行 Agent 重新执行',
        },
      };
    } catch (error) {
      console.error('[ReExecuteHandler] 处理 RE_EXECUTE 决策失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '处理 RE_EXECUTE 决策失败',
      };
    }
  }

  /**
   * 验证 RE_EXECUTE 决策是否有效
   */
  static validateReExecuteDecision(request: ReExecuteRequest): {
    valid: boolean;
    reason?: string;
  } {
    const { decision } = request;

    // 1. 检查决策类型
    if (decision.type !== AgentBDecisionType.RE_EXECUTE) {
      return {
        valid: false,
        reason: '决策类型不是 RE_EXECUTE',
      };
    }

    // 2. 检查决策理由
    if (!decision.reasoning || decision.reasoning.trim().length === 0) {
      return {
        valid: false,
        reason: '决策理由不能为空',
      };
    }

    return { valid: true };
  }

  /**
   * 准备重新执行的上下文
   */
  static prepareReExecutionContext(request: ReExecuteRequest): Record<string, any> {
    const { dailyTaskId, decision, metadata } = request;

    return {
      dailyTaskId,
      decisionType: decision.type,
      decisionReasoning: decision.reasoning,
      decisionData: decision.data,
      originalMetadata: metadata,
      timestamp: Date.now(),
    };
  }
}

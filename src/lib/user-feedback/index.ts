/**
 * 用户反馈流程 - 主要服务入口
 *
 * 整合所有用户反馈流程的功能
 */

// 导出类型
export * from './types';

// 导出状态机
export { UserFeedbackStateMachine } from './state-machine';

// 导出 RE_EXECUTE 处理器
export { ReExecuteHandler } from './re-execute-handler';

// 导出 Agent B 决策服务
export { AgentBDecisionServiceV2 } from './agent-b-decision-v2';

// 导出执行引擎适配器
export { ExecutionEngineAdapter } from './execution-engine-adapter';

// 导出主服务
import {
  UserFeedbackRequestV2,
  UserFeedbackResponseV2,
  TaskStatusV2,
  AgentBDecisionType,
} from './types';
import { UserFeedbackStateMachine } from './state-machine';
import { ReExecuteHandler } from './re-execute-handler';
import { AgentBDecisionServiceV2 } from './agent-b-decision-v2';

/**
 * 用户反馈主服务
 */
export class UserFeedbackService {
  /**
   * 处理用户反馈（主入口）
   */
  static async handleUserFeedback(
    request: UserFeedbackRequestV2
  ): Promise<UserFeedbackResponseV2> {
    console.log('[UserFeedbackService] 处理用户反馈:', request);

    try {
      const { dailyTaskId, userFeedback, agentId } = request;

      // 1. 恢复历史记录
      const historyResult = await AgentBDecisionServiceV2.recoverHistory(dailyTaskId);
      if (!historyResult.success) {
        console.warn('[UserFeedbackService] 历史记录恢复失败，但继续处理');
      }

      // 2. Agent B 决策
      const decision = await AgentBDecisionServiceV2.executeAgentBDecisionWithHistory({
        dailyTaskId,
        userFeedback,
        mcpExecutionHistory: historyResult.mcpExecutionHistory,
        userInteractions: historyResult.userInteractions,
        executorResult: historyResult.executorResult,
      });

      // 3. 如果是 RE_EXECUTE 决策，特殊处理
      if (decision.type === AgentBDecisionType.RE_EXECUTE) {
        const reExecuteResult = await ReExecuteHandler.handleReExecuteDecision({
          dailyTaskId,
          decision,
        });

        if (!reExecuteResult.success) {
          return {
            success: false,
            error: reExecuteResult.error,
          };
        }

        return {
          success: true,
          data: {
            taskId: dailyTaskId,
            status: TaskStatusV2.PENDING,
            decision,
            message: '用户反馈已处理，Agent B 决定重新执行',
          },
        };
      }

      // 4. 处理其他决策
      const nextStatus = AgentBDecisionServiceV2.getNextStateFromDecision(decision);

      return {
        success: true,
        data: {
          taskId: dailyTaskId,
          status: nextStatus,
          decision,
          message: '用户反馈处理成功',
        },
      };
    } catch (error) {
      console.error('[UserFeedbackService] 处理用户反馈失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '处理用户反馈失败',
      };
    }
  }
}

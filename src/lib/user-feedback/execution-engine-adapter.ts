/**
 * 用户反馈流程 - 执行引擎适配器
 *
 * 适配现有的执行引擎来处理新的状态和决策
 */

import {
  TaskStatusV2,
  AgentBDecisionType,
  AgentBDecisionV2,
} from './types';
import { UserFeedbackStateMachine } from './state-machine';

/**
 * 执行引擎适配器
 */
export class ExecutionEngineAdapter {
  /**
   * 处理 user_feedback_received 状态
   */
  static async handleUserFeedbackReceivedState(
    dailyTaskId: string,
    currentStatus: string
  ): Promise<void> {
    console.log(
      `[ExecutionEngineAdapter] 处理 user_feedback_received 状态: ${dailyTaskId}`
    );

    try {
      // 验证状态转换
      UserFeedbackStateMachine.validateTransition(
        currentStatus as TaskStatusV2,
        TaskStatusV2.IN_PROGRESS
      );

      // TODO: 实际更新数据库中的状态
      console.log(
        `[ExecutionEngineAdapter] 任务 ${dailyTaskId} 状态从 ${currentStatus} 更新为 ${TaskStatusV2.IN_PROGRESS}`
      );
    } catch (error) {
      console.error(
        '[ExecutionEngineAdapter] 处理 user_feedback_received 状态失败:',
        error
      );
      throw error;
    }
  }

  /**
   * 处理 RE_EXECUTE 决策后的状态
   */
  static async handleReExecuteDecision(
    dailyTaskId: string,
    decision: AgentBDecisionV2
  ): Promise<void> {
    console.log(
      `[ExecutionEngineAdapter] 处理 RE_EXECUTE 决策: ${dailyTaskId}`
    );

    try {
      if (decision.type !== AgentBDecisionType.RE_EXECUTE) {
        throw new Error('决策类型不是 RE_EXECUTE');
      }

      // 验证状态转换
      UserFeedbackStateMachine.validateTransition(
        TaskStatusV2.IN_PROGRESS,
        TaskStatusV2.PENDING
      );

      // TODO: 实际更新数据库中的状态
      console.log(
        `[ExecutionEngineAdapter] 任务 ${dailyTaskId} 状态更新为 ${TaskStatusV2.PENDING}`
      );

      // TODO: 通知执行 Agent 重新执行
      console.log(
        `[ExecutionEngineAdapter] 通知执行 Agent 重新执行任务: ${dailyTaskId}`
      );
    } catch (error) {
      console.error(
        '[ExecutionEngineAdapter] 处理 RE_EXECUTE 决策失败:',
        error
      );
      throw error;
    }
  }

  /**
   * 检查是否需要处理新状态
   */
  static shouldHandleNewState(status: string): boolean {
    const newStates = [
      TaskStatusV2.USER_FEEDBACK_RECEIVED,
    ];
    return newStates.includes(status as TaskStatusV2);
  }

  /**
   * 获取状态处理策略
   */
  static getStateHandlingStrategy(status: string): {
    handler: () => Promise<void>;
    description: string;
  } | null {
    switch (status) {
      case TaskStatusV2.USER_FEEDBACK_RECEIVED:
        return {
          handler: async () => {
            // 实际使用时需要传入正确的参数
            console.log('[ExecutionEngineAdapter] 处理 user_feedback_received 状态策略');
          },
          description: '处理用户反馈已收到状态，继续处理',
        };
      default:
        return null;
    }
  }
}

/**
 * 用户反馈流程 - 状态机管理
 *
 * 管理任务状态转换的核心逻辑
 */

import { TaskStatusV2, AgentBDecisionType } from './types';

/**
 * 状态转换规则
 */
interface StateTransitionRule {
  from: TaskStatusV2;
  to: TaskStatusV2;
  trigger: string;
  description: string;
}

/**
 * 状态机配置
 */
const STATE_TRANSITIONS: StateTransitionRule[] = [
  // 用户反馈流程
  {
    from: TaskStatusV2.WAITING_USER,
    to: TaskStatusV2.USER_FEEDBACK_RECEIVED,
    trigger: 'USER_FEEDBACK_SUBMITTED',
    description: '用户提交反馈后，状态变为 user_feedback_received',
  },
  {
    from: TaskStatusV2.USER_FEEDBACK_RECEIVED,
    to: TaskStatusV2.IN_PROGRESS,
    trigger: 'START_PROCESSING_FEEDBACK',
    description: '开始处理用户反馈，状态变为 in_progress',
  },
  {
    from: TaskStatusV2.IN_PROGRESS,
    to: TaskStatusV2.PENDING,
    trigger: 'RE_EXECUTE_DECIDED',
    description: 'Agent B 决定重新执行，状态变为 pending',
  },
  {
    from: TaskStatusV2.PENDING,
    to: TaskStatusV2.IN_PROGRESS,
    trigger: 'START_RE_EXECUTION',
    description: '执行 Agent 开始重新执行，状态变为 in_progress',
  },
  // 正常完成/失败流程
  {
    from: TaskStatusV2.IN_PROGRESS,
    to: TaskStatusV2.COMPLETED,
    trigger: 'TASK_COMPLETED',
    description: '任务完成',
  },
  {
    from: TaskStatusV2.IN_PROGRESS,
    to: TaskStatusV2.FAILED,
    trigger: 'TASK_FAILED',
    description: '任务失败',
  },
  {
    from: TaskStatusV2.IN_PROGRESS,
    to: TaskStatusV2.WAITING_USER,
    trigger: 'NEED_USER_DECISION',
    description: '需要用户决策',
  },
];

/**
 * 状态机类
 */
export class UserFeedbackStateMachine {
  /**
   * 检查状态转换是否合法
   */
  static canTransition(from: TaskStatusV2, to: TaskStatusV2): boolean {
    return STATE_TRANSITIONS.some(
      (rule) => rule.from === from && rule.to === to
    );
  }

  /**
   * 获取从某个状态可以转换到的所有状态
   */
  static getValidTransitions(from: TaskStatusV2): TaskStatusV2[] {
    return STATE_TRANSITIONS
      .filter((rule) => rule.from === from)
      .map((rule) => rule.to);
  }

  /**
   * 获取转换规则描述
   */
  static getTransitionDescription(
    from: TaskStatusV2,
    to: TaskStatusV2
  ): string | null {
    const rule = STATE_TRANSITIONS.find(
      (rule) => rule.from === from && rule.to === to
    );
    return rule ? rule.description : null;
  }

  /**
   * 根据 Agent B 决策确定下一个状态
   */
  static getNextStateFromDecision(
    decisionType: AgentBDecisionType
  ): TaskStatusV2 {
    switch (decisionType) {
      case AgentBDecisionType.COMPLETE:
        return TaskStatusV2.COMPLETED;
      case AgentBDecisionType.NEED_USER:
        return TaskStatusV2.WAITING_USER;
      case AgentBDecisionType.FAILED:
        return TaskStatusV2.FAILED;
      case AgentBDecisionType.EXECUTE_MCP:
        return TaskStatusV2.IN_PROGRESS;
      case AgentBDecisionType.RE_EXECUTE:
        return TaskStatusV2.PENDING;
      default:
        return TaskStatusV2.IN_PROGRESS;
    }
  }

  /**
   * 验证状态转换
   * @throws Error 如果转换不合法
   */
  static validateTransition(from: TaskStatusV2, to: TaskStatusV2): void {
    if (!this.canTransition(from, to)) {
      const validTransitions = this.getValidTransitions(from);
      throw new Error(
        `Invalid state transition: ${from} -> ${to}. ` +
        `Valid transitions from ${from} are: ${validTransitions.join(', ')}`
      );
    }
  }
}

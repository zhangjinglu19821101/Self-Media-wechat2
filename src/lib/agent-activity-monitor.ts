/**
 * Agent 活动监控类型定义
 * 定义 Agent 的当前活动、任务理解、执行日志等
 */

import { AgentId, TaskStatus } from './agent-types';

/**
 * Agent 活动状态
 */
export enum AgentActivityStatus {
  IDLE = 'idle',
  THINKING = 'thinking',
  PLANNING = 'planning',
  EXECUTING = 'executing',
  WAITING_CONFIRMATION = 'waiting_confirmation',
  COMPLETED = 'completed',
  ERROR = 'error',
}

/**
 * Agent 任务理解
 */
export interface AgentTaskUnderstanding {
  taskId: string;
  taskTitle: string;
  taskDescription: string;
  strategy: string; // 对战略的理解
  approach: string; // 执行方法
  expectedOutcome: string; // 预期结果
  risks: string[]; // 风险评估
  dependencies: string[]; // 依赖项
  confidence: number; // 理解信心度 (0-100)
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Agent 执行日志
 */
export interface AgentExecutionLog {
  id: string;
  agentId: AgentId;
  timestamp: Date;
  type: 'action' | 'decision' | 'question' | 'progress' | 'error' | 'confirmation';
  category: string; // 任务类别
  message: string; // 日志消息
  details?: Record<string, any>; // 详细信息
  relatedTaskId?: string; // 关联任务
  relatedStepId?: string; // 关联工作流程步骤
}

/**
 * Agent 当前活动
 */
export interface AgentCurrentActivity {
  agentId: AgentId;
  status: AgentActivityStatus;
  currentTask?: {
    id: string;
    title: string;
    description: string;
    progress: number; // 0-100
    startedAt: Date;
  };
  taskUnderstanding?: AgentTaskUnderstanding;
  lastActivity?: string;
  lastActivityAt: Date;
  currentWorkflowId?: string;
  currentStepId?: string;
}

/**
 * Agent 活动监控
 */
export class AgentActivityMonitor {
  private activities: Map<AgentId, AgentCurrentActivity> = new Map();
  private logs: AgentExecutionLog[] = [];

  /**
   * 更新 Agent 活动
   */
  updateActivity(agentId: AgentId, activity: Partial<AgentCurrentActivity>): void {
    const existing = this.activities.get(agentId) || {
      agentId,
      status: AgentActivityStatus.IDLE,
      lastActivityAt: new Date(),
    };

    const updated: AgentCurrentActivity = {
      ...existing,
      ...activity,
      lastActivityAt: new Date(),
    };

    this.activities.set(agentId, updated);
  }

  /**
   * 获取 Agent 活动
   */
  getActivity(agentId: AgentId): AgentCurrentActivity | null {
    return this.activities.get(agentId) || null;
  }

  /**
   * 获取所有 Agent 活动
   */
  getAllActivities(): AgentCurrentActivity[] {
    return Array.from(this.activities.values());
  }

  /**
   * 记录执行日志
   */
  logExecution(
    agentId: AgentId,
    type: AgentExecutionLog['type'],
    category: string,
    message: string,
    details?: Record<string, any>,
    relatedTaskId?: string,
    relatedStepId?: string
  ): void {
    const log: AgentExecutionLog = {
      id: `log_${Date.now()}_${agentId}`,
      agentId,
      timestamp: new Date(),
      type,
      category,
      message,
      details,
      relatedTaskId,
      relatedStepId,
    };

    this.logs.push(log);

    // 只保留最近 1000 条日志
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }
  }

  /**
   * 获取 Agent 的执行日志
   */
  getLogs(agentId: AgentId, limit: number = 50): AgentExecutionLog[] {
    return this.logs
      .filter(log => log.agentId === agentId)
      .slice(-limit)
      .reverse();
  }

  /**
   * 获取所有日志
   */
  getAllLogs(limit: number = 100): AgentExecutionLog[] {
    return this.logs.slice(-limit).reverse();
  }

  /**
   * 设置任务理解
   */
  setTaskUnderstanding(agentId: AgentId, understanding: AgentTaskUnderstanding): void {
    this.updateActivity(agentId, { taskUnderstanding: understanding });
    this.logExecution(
      agentId,
      'decision',
      '任务理解',
      `理解任务: ${understanding.taskTitle}`,
      {
        strategy: understanding.strategy,
        approach: understanding.approach,
        confidence: understanding.confidence,
      },
      understanding.taskId
    );
  }

  /**
   * 设置等待确认状态
   */
  setWaitingConfirmation(
    agentId: AgentId,
    taskTitle: string,
    confirmationMessage: string,
    relatedWorkflowId?: string,
    relatedStepId?: string
  ): void {
    this.updateActivity(agentId, {
      status: AgentActivityStatus.WAITING_CONFIRMATION,
      currentTask: {
        id: `task_${Date.now()}`,
        title: taskTitle,
        description: confirmationMessage,
        progress: 0,
        startedAt: new Date(),
      },
      currentWorkflowId: relatedWorkflowId,
      currentStepId: relatedStepId,
    });

    this.logExecution(
      agentId,
      'confirmation',
      '等待确认',
      confirmationMessage,
      {},
      undefined,
      relatedStepId
    );
  }

  /**
   * 检查是否有 Agent 在等待确认
   */
  hasWaitingAgents(): boolean {
    return Array.from(this.activities.values()).some(
      activity => activity.status === AgentActivityStatus.WAITING_CONFIRMATION
    );
  }

  /**
   * 获取等待确认的 Agent 列表
   */
  getWaitingAgents(): AgentCurrentActivity[] {
    return Array.from(this.activities.values()).filter(
      activity => activity.status === AgentActivityStatus.WAITING_CONFIRMATION
    );
  }
}

// 单例实例
export const agentActivityMonitor = new AgentActivityMonitor();

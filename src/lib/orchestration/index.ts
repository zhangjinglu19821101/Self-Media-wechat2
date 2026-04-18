/**
 * Agent 编排引擎主入口
 * 整合所有编排引擎模块，提供统一的接口
 */

import { MessageRouter } from './message-router';
import { TaskScheduler } from './task-scheduler';
import { WorkflowExecutor } from './workflow-executor';
import { ConversationManager } from './conversation-manager';
import { DecisionEngine } from './decision-engine';
import { LLMClient } from 'coze-coding-dev-sdk';
import {
  OrchestrationConfig,
  ScheduledTask,
  OrchestrationMessage,
  WorkflowDefinition,
  WorkflowInstance,
  ConversationSession,
  DecisionRule,
  DecisionType,
  SchedulingStrategy,
} from './types';

export class OrchestrationEngine {
  private messageRouter: MessageRouter;
  private taskScheduler: TaskScheduler;
  private workflowExecutor: WorkflowExecutor;
  private conversationManager: ConversationManager;
  private decisionEngine: DecisionEngine;

  constructor(llm: LLMClient, config?: OrchestrationConfig) {
    // 初始化各模块
    this.messageRouter = new MessageRouter();
    this.taskScheduler = new TaskScheduler(
      config?.schedulingStrategy || SchedulingStrategy.PRIORITY
    );
    this.workflowExecutor = new WorkflowExecutor(this.taskScheduler);
    this.conversationManager = new ConversationManager();
    this.decisionEngine = new DecisionEngine(
      llm,
      config?.enableDecisionLogging || true
    );

    // 应用配置
    if (config) {
      this.applyConfig(config);
    }

    // 建立模块之间的连接
    this.connectModules();
  }

  /**
   * 应用配置
   */
  private applyConfig(config: OrchestrationConfig): void {
    // 任务调度器配置
    if (config.taskTimeout) {
      // 可以在这里设置任务超时
    }
    if (config.taskMaxRetries) {
      // 可以在这里设置任务最大重试次数
    }
    if (config.maxConcurrentTasks) {
      this.taskScheduler.setMaxConcurrentTasks(config.maxConcurrentTasks);
    }

    // 对话管理器配置
    if (config.conversationTimeout) {
      this.conversationManager.setConversationTimeout(config.conversationTimeout);
    }
    if (config.maxConversationHistory) {
      this.conversationManager.setMaxHistoryLength(config.maxConversationHistory);
    }

    // 决策引擎配置
    if (config.decisionConfidenceThreshold) {
      this.decisionEngine.setConfidenceThreshold(config.decisionConfidenceThreshold);
    }
  }

  /**
   * 连接模块
   */
  private connectModules(): void {
    // 任务完成时发送消息通知
    this.taskScheduler.on('taskCompleted', (task) => {
      this.messageRouter.sendMessage({
        id: `msg-${Date.now()}`,
        from: task.agentId,
        to: 'system',
        type: 'task_result' as any,
        content: { taskId: task.id, result: task.result },
        priority: 2 as any,
        status: 'pending' as any,
        timestamp: Date.now(),
      });
    });

    // 任务失败时发送错误消息
    this.taskScheduler.on('taskFailed', (task) => {
      this.messageRouter.sendMessage({
        id: `msg-${Date.now()}`,
        from: task.agentId,
        to: 'system',
        type: 'error_report' as any,
        content: { taskId: task.id, error: task.error },
        priority: 4 as any,
        status: 'pending' as any,
        timestamp: Date.now(),
      });
    });

    // 工作流实例完成时清理相关会话
    this.workflowExecutor.on('instanceCompleted', (instance) => {
      const session = this.conversationManager.getSession(
        instance.variables.sessionId
      );
      if (session) {
        this.conversationManager.closeSession(session.id);
      }
    });
  }

  // ============================================================================
  // 消息路由接口
  // ============================================================================

  /**
   * 添加消息路由规则
   */
  addRoutingRule(rule: any): void {
    this.messageRouter.addRule(rule);
  }

  /**
   * 发送消息
   */
  async sendMessage(message: OrchestrationMessage): Promise<void> {
    await this.messageRouter.sendMessage(message);
  }

  /**
   * 获取消息统计
   */
  getMessageStats() {
    return this.messageRouter.getStats();
  }

  // ============================================================================
  // 任务调度接口
  // ============================================================================

  /**
   * 提交任务
   */
  submitTask(task: Omit<ScheduledTask, 'id' | 'status' | 'createdAt'>): ScheduledTask {
    return this.taskScheduler.submitTask(task);
  }

  /**
   * 取消任务
   */
  cancelTask(taskId: string): boolean {
    return this.taskScheduler.cancelTask(taskId);
  }

  /**
   * 获取任务
   */
  getTask(taskId: string): ScheduledTask | undefined {
    return this.taskScheduler.getTask(taskId);
  }

  /**
   * 更新任务进度
   */
  updateTaskProgress(taskId: string, progress: number): void {
    this.taskScheduler.updateTaskProgress(taskId, progress);
  }

  /**
   * 完成任务
   */
  completeTask(taskId: string, result?: any): void {
    this.taskScheduler.completeTask(taskId, result);
  }

  /**
   * 标记任务失败
   */
  failTask(taskId: string, error: string): void {
    this.taskScheduler.failTask(taskId, error);
  }

  /**
   * 获取任务统计
   */
  getTaskStats() {
    return this.taskScheduler.getStats();
  }

  // ============================================================================
  // 工作流执行接口
  // ============================================================================

  /**
   * 注册工作流定义
   */
  registerWorkflow(definition: WorkflowDefinition): void {
    this.workflowExecutor.registerDefinition(definition);
  }

  /**
   * 创建工作流实例
   */
  createWorkflowInstance(
    definitionId: string,
    initialVariables?: Record<string, any>
  ): WorkflowInstance {
    return this.workflowExecutor.createInstance(definitionId, initialVariables);
  }

  /**
   * 启动工作流实例
   */
  async startWorkflowInstance(instanceId: string): Promise<void> {
    await this.workflowExecutor.startInstance(instanceId);
  }

  /**
   * 暂停工作流实例
   */
  pauseWorkflowInstance(instanceId: string): void {
    this.workflowExecutor.pauseInstance(instanceId);
  }

  /**
   * 恢复工作流实例
   */
  async resumeWorkflowInstance(instanceId: string): Promise<void> {
    await this.workflowExecutor.resumeInstance(instanceId);
  }

  /**
   * 取消工作流实例
   */
  cancelWorkflowInstance(instanceId: string): void {
    this.workflowExecutor.cancelInstance(instanceId);
  }

  /**
   * 获取工作流统计
   */
  getWorkflowStats() {
    return this.workflowExecutor.getStats();
  }

  // ============================================================================
  // 对话管理接口
  // ============================================================================

  /**
   * 创建对话会话
   */
  createConversation(
    userId?: string,
    agentId?: string,
    initialVariables?: Record<string, any>
  ): ConversationSession {
    return this.conversationManager.createSession(userId, agentId, initialVariables);
  }

  /**
   * 获取对话会话
   */
  getConversation(sessionId: string): ConversationSession | undefined {
    return this.conversationManager.getSession(sessionId);
  }

  /**
   * 更新对话变量
   */
  updateConversationVariables(
    sessionId: string,
    variables: Record<string, any>
  ): void {
    this.conversationManager.updateSessionVariables(sessionId, variables);
  }

  /**
   * 添加消息到对话
   */
  addMessageToConversation(sessionId: string, messageId: string): void {
    this.conversationManager.addMessageToSession(sessionId, messageId);
  }

  /**
   * 关闭对话会话
   */
  closeConversation(sessionId: string): void {
    this.conversationManager.closeSession(sessionId);
  }

  /**
   * 获取对话统计
   */
  getConversationStats() {
    return this.conversationManager.getStats();
  }

  // ============================================================================
  // 决策引擎接口
  // ============================================================================

  /**
   * 添加决策规则
   */
  addDecisionRule(rule: DecisionRule): void {
    this.decisionEngine.addRule(rule);
  }

  /**
   * 执行决策
   */
  async decide(
    data: any,
    options?: {
      type?: DecisionType;
      prompt?: string;
      ruleSet?: string[];
    }
  ) {
    return this.decisionEngine.decide(data, options);
  }

  /**
   * 获取决策统计
   */
  getDecisionStats() {
    return this.decisionEngine.getStats();
  }

  // ============================================================================
  // 统一统计接口
  // ============================================================================

  /**
   * 获取引擎整体统计信息
   */
  getStats() {
    return {
      messageRouter: this.messageRouter.getStats(),
      taskScheduler: this.taskScheduler.getStats(),
      workflowExecutor: this.workflowExecutor.getStats(),
      conversationManager: this.conversationManager.getStats(),
      decisionEngine: this.decisionEngine.getStats(),
    };
  }

  /**
   * 销毁引擎
   */
  destroy(): void {
    this.conversationManager.destroy();
    this.messageRouter.removeAllListeners();
    this.taskScheduler.removeAllListeners();
    this.workflowExecutor.removeAllListeners();
    this.conversationManager.removeAllListeners();
    this.decisionEngine.removeAllListeners();
  }
}

// 导出所有类型
export * from './types';
export { MessageRouter } from './message-router';
export { TaskScheduler } from './task-scheduler';
export { WorkflowExecutor } from './workflow-executor';
export { ConversationManager } from './conversation-manager';
export { DecisionEngine } from './decision-engine';

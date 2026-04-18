/**
 * 消息路由器
 * 负责路由 Agent 之间的消息，确保消息按照配置的通信规则传递
 */

import {
  Message,
  MessageType,
  AgentId,
  TaskPriority,
} from './agent-types';
import { agentManager } from './agent-manager';

export class MessageRouter {
  private messageHistory: Message[] = [];
  private messageHandlers: Map<MessageType, (message: Message) => Promise<void>> =
    new Map();

  constructor() {
    this.registerDefaultHandlers();
  }

  /**
   * 注册默认消息处理器
   */
  private registerDefaultHandlers(): void {
    this.messageHandlers.set(
      MessageType.TASK_ASSIGNMENT,
      this.handleTaskAssignment.bind(this)
    );
    this.messageHandlers.set(
      MessageType.TASK_UPDATE,
      this.handleTaskUpdate.bind(this)
    );
    this.messageHandlers.set(
      MessageType.TASK_RESULT,
      this.handleTaskResult.bind(this)
    );
    this.messageHandlers.set(
      MessageType.QUERY,
      this.handleQuery.bind(this)
    );
    this.messageHandlers.set(
      MessageType.RESPONSE,
      this.handleResponse.bind(this)
    );
    this.messageHandlers.set(
      MessageType.STATUS_UPDATE,
      this.handleStatusUpdate.bind(this)
    );
    this.messageHandlers.set(
      MessageType.EMERGENCY,
      this.handleEmergency.bind(this)
    );
  }

  /**
   * 发送消息
   */
  async sendMessage(message: Message): Promise<boolean> {
    // 验证消息
    if (!this.validateMessage(message)) {
      return false;
    }

    // 检查通信权限
    if (!agentManager.canSendMessage(message.from, message.to)) {
      console.error(
        `Agent ${message.from} is not allowed to send messages to ${message.to}`
      );
      return false;
    }

    // 检查接收 Agent 是否可以接收消息
    if (!agentManager.canReceiveMessage(message.from, message.to)) {
      console.error(
        `Agent ${message.to} is not allowed to receive messages from ${message.from}`
      );
      return false;
    }

    // 记录消息历史
    this.messageHistory.push(message);

    // 更新发送 Agent 的最后活跃时间
    const fromAgent = agentManager.getAgent(message.from);
    if (fromAgent) {
      fromAgent.lastActiveAt = new Date();
    }

    // 更新接收 Agent 的最后活跃时间
    const toAgent = agentManager.getAgent(message.to);
    if (toAgent) {
      toAgent.lastActiveAt = new Date();
    }

    // 调用对应的处理器
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      await handler(message);
    }

    return true;
  }

  /**
   * 验证消息
   */
  private validateMessage(message: Message): boolean {
    // 检查必要的字段
    if (!message.id || !message.from || !message.to || !message.content) {
      console.error('Message missing required fields');
      return false;
    }

    // 检查 Agent 是否存在
    if (!agentManager.getAgent(message.from) || !agentManager.getAgent(message.to)) {
      console.error('Invalid agent ID in message');
      return false;
    }

    // 检查优先级
    if (
      message.priority < TaskPriority.LOW ||
      message.priority > TaskPriority.URGENT
    ) {
      console.error('Invalid message priority');
      return false;
    }

    return true;
  }

  /**
   * 处理任务分配消息
   */
  private async handleTaskAssignment(message: Message): Promise<void> {
    console.log(`[Task Assignment] ${message.from} → ${message.to}: ${message.content}`);

    // 更新目标 Agent 的状态
    agentManager.updateAgentStatus(message.to, 'BUSY' as any);

    // 增加任务计数
    const queue = agentManager.getTaskQueue(message.to);
    if (queue) {
      queue.currentRunning++;
    }

    // TODO: 这里可以调用 LLM 来执行任务
    // const result = await executeTask(message.content, message.to);
  }

  /**
   * 处理任务更新消息
   */
  private async handleTaskUpdate(message: Message): Promise<void> {
    console.log(`[Task Update] ${message.from} → ${message.to}: ${message.content}`);

    // 更新发送 Agent 的状态
    agentManager.updateAgentStatus(message.from, 'BUSY' as any);
  }

  /**
   * 处理任务结果消息
   */
  private async handleTaskResult(message: Message): Promise<void> {
    console.log(`[Task Result] ${message.from} → ${message.to}: ${message.content}`);

    // 更新发送 Agent 的状态
    agentManager.updateAgentStatus(message.from, 'IDLE' as any);

    // 减少任务计数
    const queue = agentManager.getTaskQueue(message.from);
    if (queue && queue.currentRunning > 0) {
      queue.currentRunning--;
    }

    // 增加技能经验值
    if (message.metadata?.skillId) {
      const experienceGain = message.metadata.experienceGain || 10;
      agentManager.updateAgentSkillExperience(
        message.from,
        message.metadata.skillId,
        experienceGain
      );
    }
  }

  /**
   * 处理查询消息
   */
  private async handleQuery(message: Message): Promise<void> {
    console.log(`[Query] ${message.from} → ${message.to}: ${message.content}`);
  }

  /**
   * 处理响应消息
   */
  private async handleResponse(message: Message): Promise<void> {
    console.log(`[Response] ${message.from} → ${message.to}: ${message.content}`);
  }

  /**
   * 处理状态更新消息
   */
  private async handleStatusUpdate(message: Message): Promise<void> {
    console.log(`[Status Update] ${message.from} → ${message.to}: ${message.content}`);
  }

  /**
   * 处理紧急消息
   */
  private async handleEmergency(message: Message): Promise<void> {
    console.warn(`[Emergency] ${message.from} → ${message.to}: ${message.content}`);

    // 紧急消息优先处理
    // TODO: 可以添加特殊处理逻辑
  }

  /**
   * 获取消息历史
   */
  getMessageHistory(limit?: number): Message[] {
    if (limit) {
      return this.messageHistory.slice(-limit);
    }
    return this.messageHistory;
  }

  /**
   * 获取某个 Agent 的消息历史
   */
  getAgentMessages(agentId: AgentId, limit?: number): Message[] {
    const messages = this.messageHistory.filter(
      (m) => m.from === agentId || m.to === agentId
    );
    if (limit) {
      return messages.slice(-limit);
    }
    return messages;
  }

  /**
   * 清空消息历史
   */
  clearMessageHistory(): void {
    this.messageHistory = [];
  }

  /**
   * 创建消息
   */
  createMessage(
    from: AgentId,
    to: AgentId,
    type: MessageType,
    content: string,
    priority: TaskPriority = TaskPriority.MEDIUM,
    metadata?: Record<string, any>
  ): Message {
    return {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      from,
      to,
      type,
      content,
      timestamp: new Date(),
      priority,
      metadata,
    };
  }
}

// 导出单例
export const messageRouter = new MessageRouter();

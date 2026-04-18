/**
 * Agent 消息路由系统
 * 负责 Agent 之间的消息传递、路由规则匹配和消息转换
 */

import { EventEmitter } from 'events';
import {
  OrchestrationMessage,
  MessageType,
  MessagePriority,
  MessageStatus,
  RoutingRule,
} from './types';

export class MessageRouter extends EventEmitter {
  private rules: Map<string, RoutingRule> = new Map();
  private messageQueue: OrchestrationMessage[] = [];
  private processing: boolean = false;
  private pendingMessages: Map<string, OrchestrationMessage> = new Map();

  constructor() {
    super();
    this.startProcessing();
  }

  /**
   * 添加路由规则
   */
  addRule(rule: RoutingRule): void {
    this.rules.set(rule.id, rule);
    this.emit('ruleAdded', rule);
  }

  /**
   * 移除路由规则
   */
  removeRule(ruleId: string): boolean {
    const result = this.rules.delete(ruleId);
    if (result) {
      this.emit('ruleRemoved', ruleId);
    }
    return result;
  }

  /**
   * 获取所有路由规则
   */
  getRules(): RoutingRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * 启用/禁用路由规则
   */
  toggleRule(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
      this.emit('ruleToggled', ruleId, enabled);
      return true;
    }
    return false;
  }

  /**
   * 发送消息
   */
  async sendMessage(message: OrchestrationMessage): Promise<void> {
    // 设置消息初始状态
    message.status = MessageStatus.PENDING;
    message.timestamp = Date.now();

    // 应用路由规则
    const routedMessage = this.applyRoutingRules(message);

    if (routedMessage) {
      this.messageQueue.push(routedMessage);
      this.emit('messageQueued', routedMessage);
    } else {
      message.status = MessageStatus.FAILED;
      this.emit('messageFailed', message, 'No matching route found');
    }
  }

  /**
   * 批量发送消息
   */
  async sendMessages(messages: OrchestrationMessage[]): Promise<void> {
    const promises = messages.map(msg => this.sendMessage(msg));
    await Promise.all(promises);
  }

  /**
   * 应用路由规则
   */
  private applyRoutingRules(message: OrchestrationMessage): OrchestrationMessage | null {
    let routedMessage = { ...message };

    // 按优先级排序规则（优先级高的先执行）
    const sortedRules = Array.from(this.rules.values())
      .filter(rule => rule.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const rule of sortedRules) {
      if (this.matchRule(message, rule)) {
        // 执行消息转换
        if (rule.transform) {
          routedMessage = rule.transform(routedMessage);
        }

        // 设置接收方
        if (rule.to) {
          routedMessage.to = rule.to;
        }

        this.emit('ruleMatched', rule, routedMessage);
        return routedMessage;
      }
    }

    return routedMessage; // 如果没有匹配的规则，返回原始消息
  }

  /**
   * 检查消息是否匹配规则
   */
  private matchRule(message: OrchestrationMessage, rule: RoutingRule): boolean {
    // 检查发送方
    if (!this.matchPattern(message.from, rule.from)) {
      return false;
    }

    // 检查消息类型
    if (message.type !== rule.messageType) {
      return false;
    }

    // 检查优先级
    if (rule.priority && message.priority < rule.priority) {
      return false;
    }

    // 检查自定义条件
    if (rule.condition && !rule.condition(message)) {
      return false;
    }

    return true;
  }

  /**
   * 模式匹配（支持通配符）
   */
  private matchPattern(value: string, pattern: string): boolean {
    if (pattern === '*') {
      return true;
    }

    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
    );

    return regex.test(value);
  }

  /**
   * 开始处理消息队列
   */
  private startProcessing(): void {
    this.processQueue();
  }

  /**
   * 处理消息队列
   */
  private async processQueue(): Promise<void> {
    if (this.processing) {
      return;
    }

    this.processing = true;

    while (this.messageQueue.length > 0) {
      // 按优先级排序消息
      this.messageQueue.sort((a, b) => b.priority - a.priority);

      const message = this.messageQueue.shift();
      if (message) {
        await this.processMessage(message);
      }
    }

    this.processing = false;
  }

  /**
   * 处理单个消息
   */
  private async processMessage(message: OrchestrationMessage): Promise<void> {
    try {
      // 更新状态为已发送
      message.status = MessageStatus.SENT;
      this.emit('messageSent', message);

      // 模拟网络传输
      await this.simulateDelivery(message);

      // 更新状态为已送达
      message.status = MessageStatus.DELIVERED;
      message.deliveredAt = Date.now();
      this.emit('messageDelivered', message);

      // 保存到待处理消息列表
      this.pendingMessages.set(message.id, message);

      // 设置超时检查
      if (message.timeout) {
        setTimeout(() => {
          if (message.status === MessageStatus.PROCESSING) {
            this.handleTimeout(message);
          }
        }, message.timeout);
      }

    } catch (error) {
      message.status = MessageStatus.FAILED;
      this.emit('messageFailed', message, error);
    }
  }

  /**
   * 模拟消息送达
   */
  private async simulateDelivery(message: OrchestrationMessage): Promise<void> {
    // 这里可以添加实际的传输逻辑
    // 例如：通过 WebSocket、HTTP API 等方式发送消息

    return new Promise((resolve) => {
      // 模拟网络延迟
      const delay = Math.random() * 100 + 50; // 50-150ms
      setTimeout(resolve, delay);
    });
  }

  /**
   * 处理消息超时
   */
  private handleTimeout(message: OrchestrationMessage): void {
    message.status = MessageStatus.TIMEOUT;
    this.pendingMessages.delete(message.id);

    // 检查是否需要重试
    const retryCount = (message.retryCount || 0) + 1;
    const maxRetries = message.maxRetries || 3;

    if (retryCount <= maxRetries) {
      message.retryCount = retryCount;
      message.status = MessageStatus.PENDING;
      this.messageQueue.push(message);
      this.emit('messageRetry', message);
    } else {
      this.emit('messageTimeout', message);
    }
  }

  /**
   * 确认消息处理完成
   */
  acknowledgeMessage(messageId: string, result?: any): void {
    const message = this.pendingMessages.get(messageId);
    if (message) {
      message.status = MessageStatus.COMPLETED;
      message.completedAt = Date.now();
      this.pendingMessages.delete(messageId);
      this.emit('messageCompleted', message, result);
    }
  }

  /**
   * 标记消息处理失败
   */
  failMessage(messageId: string, error: string): void {
    const message = this.pendingMessages.get(messageId);
    if (message) {
      message.status = MessageStatus.FAILED;
      this.pendingMessages.delete(messageId);
      this.emit('messageFailed', message, error);
    }
  }

  /**
   * 获取待处理的消息
   */
  getPendingMessages(): OrchestrationMessage[] {
    return Array.from(this.pendingMessages.values());
  }

  /**
   * 获取队列中的消息
   */
  getQueuedMessages(): OrchestrationMessage[] {
    return [...this.messageQueue];
  }

  /**
   * 清空消息队列
   */
  clearQueue(): void {
    this.messageQueue = [];
    this.emit('queueCleared');
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      queuedMessages: this.messageQueue.length,
      pendingMessages: this.pendingMessages.size,
      activeRules: Array.from(this.rules.values()).filter(r => r.enabled).length,
      totalRules: this.rules.size,
    };
  }
}

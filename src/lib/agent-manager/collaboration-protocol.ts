/**
 * Agent 协作协议管理器
 * 负责管理 Agent 之间的协作会话和协议执行
 */

import { EventEmitter } from 'events';
import {
  CollaborationSession,
  CollaborationProtocol,
  CollaborationMessageType,
  ProtocolState,
  ProtocolTransition,
  AgentRole,
} from './types';

export class CollaborationProtocolManager extends EventEmitter {
  private protocols: Map<string, CollaborationProtocol> = new Map();
  private sessions: Map<string, CollaborationSession> = new Map();
  private nextSessionId: number = 1;
  private timeoutCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startTimeoutChecks();
  }

  /**
   * 注册协作协议
   */
  registerProtocol(protocol: CollaborationProtocol): void {
    // 验证协议
    this.validateProtocol(protocol);

    this.protocols.set(protocol.id, protocol);
    this.emit('protocolRegistered', protocol);
  }

  /**
   * 注销协作协议
   */
  unregisterProtocol(protocolId: string): boolean {
    const result = this.protocols.delete(protocolId);
    if (result) {
      this.emit('protocolUnregistered', protocolId);
    }
    return result;
  }

  /**
   * 获取协议
   */
  getProtocol(protocolId: string): CollaborationProtocol | undefined {
    return this.protocols.get(protocolId);
  }

  /**
   * 获取所有协议
   */
  getAllProtocols(): CollaborationProtocol[] {
    return Array.from(this.protocols.values());
  }

  /**
   * 创建协作会话
   */
  createSession(
    initiatorId: string,
    protocolId: string,
    participantIds: string[],
    initialContext?: Record<string, any>
  ): CollaborationSession {
    const protocol = this.protocols.get(protocolId);
    if (!protocol) {
      throw new Error(`Protocol not found: ${protocolId}`);
    }

    const session: CollaborationSession = {
      id: this.generateSessionId(),
      initiatorId,
      participantIds,
      protocolId,
      state: ProtocolState.IDLE,
      startTime: Date.now(),
      timeout: protocol.timeout,
      messages: [],
      context: initialContext || {},
    };

    this.sessions.set(session.id, session);
    this.emit('sessionCreated', session);

    // 初始化协议状态机
    this.initializeSession(session, protocol);

    return session;
  }

  /**
   * 获取会话
   */
  getSession(sessionId: string): CollaborationSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 获取所有会话
   */
  getAllSessions(): CollaborationSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * 获取活跃会话
   */
  getActiveSessions(): CollaborationSession[] {
    return Array.from(this.sessions.values()).filter(
      s => s.state === ProtocolState.NEGOTIATING || s.state === ProtocolState.COLLABORATING
    );
  }

  /**
   * 发送消息
   */
  async sendMessage(
    sessionId: string,
    from: string,
    to: string,
    messageType: CollaborationMessageType,
    content: any
  ): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const protocol = this.protocols.get(session.protocolId);
    if (!protocol) {
      throw new Error(`Protocol not found: ${session.protocolId}`);
    }

    // 验证消息是否符合协议
    if (!this.validateMessage(protocol, from, to, messageType)) {
      this.emit('messageValidationFailed', session, { from, to, messageType });
      return false;
    }

    // 创建消息记录
    const messageId = this.generateMessageId();
    session.messages.push(messageId);

    // 更新会话状态
    this.updateSessionState(session, messageType);

    this.emit('messageSent', session, { from, to, messageType, content });
    return true;
  }

  /**
   * 接收消息
   */
  async receiveMessage(
    sessionId: string,
    from: string,
    to: string,
    messageType: CollaborationMessageType,
    content: any
  ): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const protocol = this.protocols.get(session.protocolId);
    if (!protocol) {
      throw new Error(`Protocol not found: ${session.protocolId}`);
    }

    // 创建消息记录
    const messageId = this.generateMessageId();
    session.messages.push(messageId);

    // 更新会话状态
    this.updateSessionState(session, messageType);

    this.emit('messageReceived', session, { from, to, messageType, content });
    return true;
  }

  /**
   * 完成会话
   */
  completeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.state = ProtocolState.COMPLETED;
      session.endTime = Date.now();
      this.emit('sessionCompleted', session);
    }
  }

  /**
   * 失败会话
   */
  failSession(sessionId: string, reason: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.state = ProtocolState.FAILED;
      session.endTime = Date.now();
      session.context = { ...session.context, failureReason: reason };
      this.emit('sessionFailed', session, reason);
    }
  }

  /**
   * 取消会话
   */
  cancelSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.state = ProtocolState.FAILED;
      session.endTime = Date.now();
      this.emit('sessionCancelled', session);
    }
  }

  /**
   * 删除会话
   */
  deleteSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
      this.emit('sessionDeleted', session);
      return true;
    }
    return false;
  }

  /**
   * 验证协议
   */
  private validateProtocol(protocol: CollaborationProtocol): void {
    // 检查角色
    if (!protocol.roles || protocol.roles.length === 0) {
      throw new Error('Protocol must have at least one role');
    }

    // 检查消息
    if (!protocol.messages || protocol.messages.length === 0) {
      throw new Error('Protocol must have at least one message');
    }

    // 检查状态机
    if (!protocol.stateMachine) {
      throw new Error('Protocol must have a state machine');
    }

    // 检查初始状态
    if (!protocol.stateMachine.states.includes(protocol.stateMachine.initialState)) {
      throw new Error('Initial state must be in states list');
    }
  }

  /**
   * 验证消息
   */
  private validateMessage(
    protocol: CollaborationProtocol,
    from: string,
    to: string,
    messageType: CollaborationMessageType
  ): boolean {
    // 检查消息是否符合协议定义
    const messageDefinition = protocol.messages.find(m => m.type === messageType);
    if (!messageDefinition) {
      return false;
    }

    // 检查发送方和接收方
    if (messageDefinition.from !== '*' && messageDefinition.from !== from) {
      return false;
    }

    if (messageDefinition.to !== '*' && messageDefinition.to !== to) {
      return false;
    }

    return true;
  }

  /**
   * 初始化会话
   */
  private initializeSession(
    session: CollaborationSession,
    protocol: CollaborationProtocol
  ): void {
    session.state = ProtocolState.NEGOTIATING;
    session.context.currentState = protocol.stateMachine.initialState;
  }

  /**
   * 更新会话状态
   */
  private updateSessionState(
    session: CollaborationSession,
    messageType: CollaborationMessageType
  ): void {
    const protocol = this.protocols.get(session.protocolId);
    if (!protocol) {
      return;
    }

    // 根据消息类型更新状态
    const transition = this.findTransition(
      protocol,
      session.context.currentState,
      messageType
    );

    if (transition) {
      session.context.currentState = transition.to;

      // 执行转换动作
      if (transition.action) {
        transition.action(session.context);
      }
    }

    // 更新会话状态
    if (session.context.currentState === 'completed') {
      session.state = ProtocolState.COMPLETED;
      session.endTime = Date.now();
    } else if (session.context.currentState === 'failed') {
      session.state = ProtocolState.FAILED;
      session.endTime = Date.now();
    }
  }

  /**
   * 查找转换
   */
  private findTransition(
    protocol: CollaborationProtocol,
    currentState: string,
    messageType: CollaborationMessageType
  ): ProtocolTransition | undefined {
    return protocol.stateMachine.transitions.find(t => {
      return t.from === currentState && t.event === messageType;
    });
  }

  /**
   * 开始超时检查
   */
  private startTimeoutChecks(): void {
    this.timeoutCheckInterval = setInterval(() => {
      this.checkTimeouts();
    }, 10000); // 每 10 秒检查一次
  }

  /**
   * 检查超时
   */
  private checkTimeouts(): void {
    const now = Date.now();
    const timeoutSessions: string[] = [];

    this.sessions.forEach((session, sessionId) => {
      if (session.timeout && now - session.startTime > session.timeout) {
        timeoutSessions.push(sessionId);
      }
    });

    timeoutSessions.forEach(sessionId => {
      this.failSession(sessionId, 'Session timeout');
    });
  }

  /**
   * 生成会话 ID
   */
  private generateSessionId(): string {
    return `collab-session-${Date.now()}-${this.nextSessionId++}`;
  }

  /**
   * 生成消息 ID
   */
  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    if (this.timeoutCheckInterval) {
      clearInterval(this.timeoutCheckInterval);
      this.timeoutCheckInterval = null;
    }
    this.protocols.clear();
    this.sessions.clear();
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      totalProtocols: this.protocols.size,
      totalSessions: this.sessions.size,
      activeSessions: this.getActiveSessions().length,
      completedSessions: Array.from(this.sessions.values())
        .filter(s => s.state === ProtocolState.COMPLETED).length,
      failedSessions: Array.from(this.sessions.values())
        .filter(s => s.state === ProtocolState.FAILED).length,
    };
  }
}

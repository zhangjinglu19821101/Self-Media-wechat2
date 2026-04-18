/**
 * 对话状态管理器
 * 负责管理多轮对话的上下文、状态和变量
 */

import { EventEmitter } from 'events';
import {
  ConversationSession,
  ConversationState,
  StateMachineState,
  StateTransition,
} from './types';

export class ConversationManager extends EventEmitter {
  private sessions: Map<string, ConversationSession> = new Map();
  private stateMachines: Map<string, StateMachineState[]> = new Map();
  private maxHistoryLength: number = 100;
  private conversationTimeout: number = 30 * 60 * 1000; // 30 分钟
  private nextSessionId: number = 1;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startCleanup();
  }

  /**
   * 创建对话会话
   */
  createSession(
    userId?: string,
    agentId?: string,
    initialVariables?: Record<string, any>
  ): ConversationSession {
    const session: ConversationSession = {
      id: this.generateSessionId(),
      userId,
      agentId,
      state: ConversationState.ACTIVE,
      messages: [],
      variables: initialVariables || {},
      context: {},
      startedAt: Date.now(),
      lastActiveAt: Date.now(),
      metadata: {},
    };

    this.sessions.set(session.id, session);
    this.emit('sessionCreated', session);

    return session;
  }

  /**
   * 获取对话会话
   */
  getSession(sessionId: string): ConversationSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 获取所有活跃会话
   */
  getActiveSessions(): ConversationSession[] {
    return Array.from(this.sessions.values()).filter(
      s => s.state === ConversationState.ACTIVE
    );
  }

  /**
   * 获取用户的所有会话
   */
  getUserSessions(userId: string): ConversationSession[] {
    return Array.from(this.sessions.values()).filter(
      s => s.userId === userId
    );
  }

  /**
   * 更新会话变量
   */
  updateSessionVariables(sessionId: string, variables: Record<string, any>): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.variables = { ...session.variables, ...variables };
      session.lastActiveAt = Date.now();
      this.emit('sessionVariablesUpdated', session);
    }
  }

  /**
   * 获取会话变量
   */
  getSessionVariables(sessionId: string): Record<string, any> | undefined {
    const session = this.sessions.get(sessionId);
    return session?.variables;
  }

  /**
   * 更新会话上下文
   */
  updateSessionContext(sessionId: string, context: Record<string, any>): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.context = { ...session.context, ...context };
      session.lastActiveAt = Date.now();
      this.emit('sessionContextUpdated', session);
    }
  }

  /**
   * 获取会话上下文
   */
  getSessionContext(sessionId: string): Record<string, any> | undefined {
    const session = this.sessions.get(sessionId);
    return session?.context;
  }

  /**
   * 添加消息到会话
   */
  addMessageToSession(sessionId: string, messageId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.messages.push(messageId);

      // 限制历史记录长度
      if (session.messages.length > this.maxHistoryLength) {
        session.messages = session.messages.slice(-this.maxHistoryLength);
      }

      session.lastActiveAt = Date.now();
      this.emit('messageAdded', session, messageId);
    }
  }

  /**
   * 获取会话消息历史
   */
  getSessionMessages(sessionId: string): string[] {
    const session = this.sessions.get(sessionId);
    return session?.messages || [];
  }

  /**
   * 更新会话状态
   */
  updateSessionState(sessionId: string, state: ConversationState): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      const oldState = session.state;
      session.state = state;

      if (state === ConversationState.CLOSED || state === ConversationState.ARCHIVED) {
        session.endedAt = Date.now();
      }

      session.lastActiveAt = Date.now();
      this.emit('sessionStateChanged', session, oldState);
    }
  }

  /**
   * 暂停会话
   */
  pauseSession(sessionId: string): void {
    this.updateSessionState(sessionId, ConversationState.PAUSED);
  }

  /**
   * 恢复会话
   */
  resumeSession(sessionId: string): void {
    this.updateSessionState(sessionId, ConversationState.ACTIVE);
  }

  /**
   * 关闭会话
   */
  closeSession(sessionId: string): void {
    this.updateSessionState(sessionId, ConversationState.CLOSED);
  }

  /**
   * 归档会话
   */
  archiveSession(sessionId: string): void {
    this.updateSessionState(sessionId, ConversationState.ARCHIVED);
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
   * 注册状态机
   */
  registerStateMachine(name: string, states: StateMachineState[]): void {
    // 验证状态机
    this.validateStateMachine(states);

    this.stateMachines.set(name, states);
    this.emit('stateMachineRegistered', name);
  }

  /**
   * 验证状态机
   */
  private validateStateMachine(states: StateMachineState[]): void {
    // 检查是否有初始状态
    const initialState = states.find(s => s.initial);
    if (!initialState) {
      throw new Error('State machine must have exactly one initial state');
    }

    // 检查初始状态唯一性
    const initialStates = states.filter(s => s.initial);
    if (initialStates.length !== 1) {
      throw new Error('State machine must have exactly one initial state');
    }

    // 检查状态 ID 唯一性
    const stateIds = new Set(states.map(s => s.id));
    if (stateIds.size !== states.length) {
      throw new Error('State machine states must have unique IDs');
    }

    // 检查转换引用的状态是否存在
    states.forEach(state => {
      state.transitions.forEach(transition => {
        if (!stateIds.has(transition.to)) {
          throw new Error(`Invalid transition: state not found - ${transition.to}`);
        }
      });
    });
  }

  /**
   * 创建状态机实例
   */
  createStateMachineInstance(
    sessionId: string,
    stateMachineName: string,
    initialData?: Record<string, any>
  ): string {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const states = this.stateMachines.get(stateMachineName);
    if (!states) {
      throw new Error(`State machine not found: ${stateMachineName}`);
    }

    const initialState = states.find(s => s.initial);
    if (!initialState) {
      throw new Error('State machine must have an initial state');
    }

    // 初始化状态机数据
    session.context.stateMachine = {
      name: stateMachineName,
      currentState: initialState.id,
      history: [initialState.id],
      data: initialData || {},
    };

    // 执行初始状态的 onEnter 回调
    if (initialState.onEnter) {
      initialState.onEnter(session.context.stateMachine.data);
    }

    this.emit('stateMachineInstanceCreated', session, stateMachineName);
    return session.context.stateMachine.currentState;
  }

  /**
   * 触发状态机事件
   */
  triggerStateMachineEvent(
    sessionId: string,
    event: string,
    eventData?: Record<string, any>
  ): string | null {
    const session = this.sessions.get(sessionId);
    if (!session || !session.context.stateMachine) {
      return null;
    }

    const states = this.stateMachines.get(session.context.stateMachine.name);
    if (!states) {
      return null;
    }

    const currentStateObj = states.find(
      s => s.id === session.context.stateMachine.currentState
    );

    if (!currentStateObj) {
      return null;
    }

    // 查找匹配的转换
    const transition = currentStateObj.transitions.find(t => t.event === event);
    if (!transition) {
      return null;
    }

    // 检查转换条件
    if (transition.condition && !transition.condition(session.context.stateMachine.data)) {
      return null;
    }

    // 执行当前状态的 onExit 回调
    if (currentStateObj.onExit) {
      currentStateObj.onExit(session.context.stateMachine.data);
    }

    // 执行转换动作
    if (transition.action) {
      transition.action(session.context.stateMachine.data);
    }

    // 合并事件数据
    if (eventData) {
      session.context.stateMachine.data = {
        ...session.context.stateMachine.data,
        ...eventData,
      };
    }

    // 更新当前状态
    session.context.stateMachine.currentState = transition.to;
    session.context.stateMachine.history.push(transition.to);

    // 执行新状态的 onEnter 回调
    const newState = states.find(s => s.id === transition.to);
    if (newState && newState.onEnter) {
      newState.onEnter(session.context.stateMachine.data);
    }

    session.lastActiveAt = Date.now();
    this.emit('stateMachineTransition', session, transition);

    return transition.to;
  }

  /**
   * 获取当前状态
   */
  getCurrentState(sessionId: string): string | null {
    const session = this.sessions.get(sessionId);
    if (!session || !session.context.stateMachine) {
      return null;
    }
    return session.context.stateMachine.currentState;
  }

  /**
   * 获取状态历史
   */
  getStateHistory(sessionId: string): string[] | null {
    const session = this.sessions.get(sessionId);
    if (!session || !session.context.stateMachine) {
      return null;
    }
    return session.context.stateMachine.history;
  }

  /**
   * 获取状态机数据
   */
  getStateMachineData(sessionId: string): Record<string, any> | null {
    const session = this.sessions.get(sessionId);
    if (!session || !session.context.stateMachine) {
      return null;
    }
    return session.context.stateMachine.data;
  }

  /**
   * 设置最大历史记录长度
   */
  setMaxHistoryLength(max: number): void {
    this.maxHistoryLength = max;
  }

  /**
   * 设置会话超时时间
   */
  setConversationTimeout(timeout: number): void {
    this.conversationTimeout = timeout;
  }

  /**
   * 开始清理超时会话
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60 * 1000); // 每分钟检查一次
  }

  /**
   * 清理超时会话
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];

    this.sessions.forEach((session, sessionId) => {
      if (
        session.state === ConversationState.ACTIVE &&
        now - session.lastActiveAt > this.conversationTimeout
      ) {
        expiredSessions.push(sessionId);
      }
    });

    expiredSessions.forEach(sessionId => {
      this.archiveSession(sessionId);
    });

    if (expiredSessions.length > 0) {
      this.emit('sessionsCleaned', expiredSessions);
    }
  }

  /**
   * 生成会话 ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${this.nextSessionId++}`;
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.sessions.clear();
    this.stateMachines.clear();
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      totalSessions: this.sessions.size,
      activeSessions: this.getActiveSessions().length,
      pausedSessions: Array.from(this.sessions.values()).filter(
        s => s.state === ConversationState.PAUSED
      ).length,
      closedSessions: Array.from(this.sessions.values()).filter(
        s => s.state === ConversationState.CLOSED
      ).length,
      archivedSessions: Array.from(this.sessions.values()).filter(
        s => s.state === ConversationState.ARCHIVED
      ).length,
      stateMachines: this.stateMachines.size,
      maxHistoryLength: this.maxHistoryLength,
      conversationTimeout: this.conversationTimeout,
    };
  }
}

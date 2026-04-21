/**
 * WebSocket Agent 客户端重连工具
 * 
 * 🔴 阶段1新增：为 Agent 进程提供带指数退避的自动重连能力
 * 
 * 核心功能：
 * 1. 连接断开后自动重连（指数退避，避免重连风暴）
 * 2. 最大重试次数限制（防止无限重连）
 * 3. 连接状态回调（onConnect/onDisconnect/onError）
 * 4. 消息收发（自动排队，断连期间缓存消息）
 * 
 * 使用方式：
 * ```typescript
 * const client = new AgentWSClient({
 *   agentId: 'insurance-d',
 *   url: 'ws://localhost:5001/agent/insurance-d',
 *   onConnect: () => console.log('已连接'),
 *   onDisconnect: () => console.log('已断开'),
 *   onMessage: (msg) => handleTask(msg),
 * });
 * client.connect();
 * ```
 */

import WebSocket from 'ws';

// ========== 配置接口 ==========
export interface AgentWSClientConfig {
  /** Agent ID（用于认证和日志） */
  agentId: string;
  /** WebSocket 服务器地址 */
  url: string;
  /** 连接成功回调 */
  onConnect?: () => void;
  /** 连接断开回调 */
  onDisconnect?: (reason: string) => void;
  /** 消息接收回调 */
  onMessage?: (data: any) => void;
  /** 错误回调 */
  onError?: (error: Error) => void;
  /** 最大重连次数（默认 10，0=不重连，-1=无限） */
  maxReconnects?: number;
  /** 初始重连延迟 ms（默认 1000） */
  initialReconnectDelayMs?: number;
  /** 最大重连延迟 ms（默认 60000 = 1 分钟） */
  maxReconnectDelayMs?: number;
  /** 心跳间隔 ms（默认 30000 = 30 秒） */
  heartbeatIntervalMs?: number;
  /** 连接超时 ms（默认 10000 = 10 秒） */
  connectTimeoutMs?: number;
}

// ========== 连接状态 ==========
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

// ========== 客户端类 ==========
export class AgentWSClient {
  private config: Required<AgentWSClientConfig>;
  private ws: WebSocket | null = null;
  private state: ConnectionState = 'disconnected';
  private reconnectAttempt = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private connectTimer: NodeJS.Timeout | null = null;
  // 断连期间的消息缓存（最多 100 条，防止内存泄漏）
  private pendingMessages: string[] = [];

  constructor(config: AgentWSClientConfig) {
    this.config = {
      agentId: config.agentId,
      url: config.url,
      onConnect: config.onConnect || (() => {}),
      onDisconnect: config.onDisconnect || (() => {}),
      onMessage: config.onMessage || (() => {}),
      onError: config.onError || (() => {}),
      maxReconnects: config.maxReconnects ?? 10,
      initialReconnectDelayMs: config.initialReconnectDelayMs ?? 1000,
      maxReconnectDelayMs: config.maxReconnectDelayMs ?? 60000,
      heartbeatIntervalMs: config.heartbeatIntervalMs ?? 30000,
      connectTimeoutMs: config.connectTimeoutMs ?? 10000,
    };
  }

  /**
   * 建立连接
   */
  connect(): void {
    if (this.state === 'connected' || this.state === 'connecting') {
      console.log(`[AgentWS:${this.config.agentId}] 已在连接状态，跳过`);
      return;
    }

    this.state = 'connecting';
    console.log(`[AgentWS:${this.config.agentId}] 正在连接 ${this.config.url}...`);

    try {
      this.ws = new WebSocket(this.config.url);
    } catch (error) {
      console.error(`[AgentWS:${this.config.agentId}] 创建 WebSocket 失败:`, error);
      this.handleConnectFailure(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    // 连接超时
    this.connectTimer = setTimeout(() => {
      if (this.state === 'connecting') {
        console.warn(`[AgentWS:${this.config.agentId}] 连接超时 (${this.config.connectTimeoutMs}ms)`);
        this.ws?.terminate();
        this.handleConnectFailure(new Error('连接超时'));
      }
    }, this.config.connectTimeoutMs);

    this.ws.on('open', () => {
      this.clearConnectTimer();
      this.state = 'connected';
      this.reconnectAttempt = 0;
      console.log(`[AgentWS:${this.config.agentId}] ✅ 已连接`);

      // 发送缓存消息
      this.flushPendingMessages();

      // 启动心跳
      this.startHeartbeat();

      this.config.onConnect();
    });

    this.ws.on('message', (data: Buffer) => {
      try {
        const parsed = JSON.parse(data.toString());
        this.config.onMessage(parsed);
      } catch (error) {
        console.error(`[AgentWS:${this.config.agentId}] 消息解析失败:`, error);
      }
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      this.clearConnectTimer();
      this.stopHeartbeat();
      const reasonStr = reason.toString() || `code=${code}`;
      console.log(`[AgentWS:${this.config.agentId}] ❌ 连接断开: ${reasonStr}`);
      this.state = 'disconnected';
      this.config.onDisconnect(reasonStr);
      this.scheduleReconnect();
    });

    this.ws.on('error', (error: Error) => {
      console.error(`[AgentWS:${this.config.agentId}] WebSocket 错误:`, error.message);
      this.config.onError(error);
    });
  }

  /**
   * 发送消息
   * 断连期间自动缓存，重连后发送
   */
  send(data: any): boolean {
    const message = typeof data === 'string' ? data : JSON.stringify(data);

    if (this.state === 'connected' && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(message);
      return true;
    }

    // 缓存消息（最多 100 条）
    if (this.pendingMessages.length < 100) {
      this.pendingMessages.push(message);
      console.log(`[AgentWS:${this.config.agentId}] 📨 消息已缓存 (队列: ${this.pendingMessages.length})`);
    } else {
      console.warn(`[AgentWS:${this.config.agentId}] ⚠️ 消息缓存已满，丢弃最旧消息`);
      this.pendingMessages.shift();
      this.pendingMessages.push(message);
    }
    return false;
  }

  /**
   * 主动断开连接（不重连）
   */
  disconnect(): void {
    console.log(`[AgentWS:${this.config.agentId}] 主动断开连接`);
    this.clearReconnectTimer();
    this.stopHeartbeat();
    this.clearConnectTimer();

    if (this.ws) {
      // 移除 close 监听器，避免触发重连
      this.ws.removeAllListeners('close');
      this.ws.close(1000, 'Agent 主动断开');
      this.ws = null;
    }

    this.state = 'disconnected';
    this.pendingMessages = [];
  }

  /**
   * 获取当前连接状态
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * 获取诊断信息
   */
  getStats() {
    return {
      agentId: this.config.agentId,
      state: this.state,
      reconnectAttempt: this.reconnectAttempt,
      pendingMessages: this.pendingMessages.length,
      url: this.config.url,
    };
  }

  // ========== 私有方法 ==========

  /**
   * 连接失败处理
   */
  private handleConnectFailure(error: Error): void {
    this.state = 'disconnected';
    this.config.onError(error);
    this.scheduleReconnect();
  }

  /**
   * 调度重连（指数退避）
   */
  private scheduleReconnect(): void {
    // 检查最大重连次数
    if (this.config.maxReconnects >= 0 && this.reconnectAttempt >= this.config.maxReconnects) {
      console.error(
        `[AgentWS:${this.config.agentId}] ❌ 已达最大重连次数 ${this.config.maxReconnects}，停止重连`
      );
      return;
    }

    this.reconnectAttempt++;
    this.state = 'reconnecting';

    // 指数退避延迟：base * 2^(attempt-1) + 随机抖动
    const baseDelay = this.config.initialReconnectDelayMs;
    const jitter = Math.random() * 1000;
    const delay = Math.min(
      baseDelay * Math.pow(2, this.reconnectAttempt - 1) + jitter,
      this.config.maxReconnectDelayMs
    );

    console.log(
      `[AgentWS:${this.config.agentId}] 🔄 ${Math.round(delay)}ms 后重连 ` +
      `(第 ${this.reconnectAttempt} 次${this.config.maxReconnects >= 0 ? `/${this.config.maxReconnects}` : ''})`
    );

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, this.config.heartbeatIntervalMs);
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 发送缓存消息
   */
  private flushPendingMessages(): void {
    if (this.pendingMessages.length === 0) return;

    console.log(`[AgentWS:${this.config.agentId}] 📨 发送 ${this.pendingMessages.length} 条缓存消息`);
    for (const msg of this.pendingMessages) {
      try {
        this.ws?.send(msg);
      } catch (error) {
        console.error(`[AgentWS:${this.config.agentId}] 发送缓存消息失败:`, error);
      }
    }
    this.pendingMessages = [];
  }

  /**
   * 清理重连定时器
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * 清理连接超时定时器
   */
  private clearConnectTimer(): void {
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
  }
}

/**
 * WebSocket Server
 * 用于 Agent 之间的实时通信和指令推送
 * 支持两种连接模式：
 * 1. Agent 连接（后端内部）：ws://host:5001/agent/{agentId}
 * 2. 用户连接（前端浏览器）：ws://host:5001/user?token={sessionToken}&workspaceId={wsId}
 */

import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { AgentId } from './agent-types';
import { authenticateWebSocket, WSAuthResult } from './websocket-auth';

export interface WSMessage {
  type: 'new_command' | 'task_result' | 'system_notification' | 'pong' | 'ping' | 'command_cancelled' | 'problem_solved' | 'new_problem';
  fromAgentId?: string;
  toAgentId?: string;
  command?: string;
  commandType?: 'instruction' | 'task' | 'report' | 'urgent';
  priority?: 'high' | 'normal' | 'low';
  timestamp?: string;
  message?: string;
  data?: any;
  taskId?: string;
  result?: string;
  status?: string;
  // 🔥 新增：通知ID（用于关联数据库中的通知记录）
  notificationId?: string;
  // 🔥 新增：问题ID（用于问题解决通知）
  problemId?: string;
  solution?: string;
  // 🔥 新增：问题报告相关字段
  fromAgentName?: string;
  problemType?: string;
  title?: string;
  description?: string;
}

export interface WSClient {
  agentId: AgentId;
  socket: WebSocket;
  connectedAt: Date;
  lastPing?: Date;
  /** 认证信息 */
  auth?: WSAuthResult;
}

class WebSocketServer {
  private wss: WSServer | null = null;
  private clients: Map<AgentId, WSClient> = new Map();
  private port: number;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  // 🔴 阶段1新增：简单事件监听机制（避免继承 EventEmitter 的复杂性）
  private eventListeners: Map<string, Array<(...args: any[]) => void>> = new Map();

  /**
   * 🔴 阶段1新增：注册事件监听
   */
  on(event: string, listener: (...args: any[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  /**
   * 🔴 阶段1新增：发射事件
   */
  private emit(event: string, ...args: any[]): void {
    const listeners = this.eventListeners.get(event) || [];
    for (const listener of listeners) {
      try {
        listener(...args);
      } catch (error) {
        console.error(`[WS] 事件监听器错误 (${event}):`, error);
      }
    }
  }

  constructor(port: number = 5001) {
    this.port = port;
  }

  /**
   * 启动 WebSocket 服务器
   */
  start() {
    if (this.wss) {
      console.log('WebSocket server already started');
      return;
    }

    this.wss = new WSServer({ port: this.port });

    this.wss.on('listening', () => {
      console.log(`🔌 WebSocket server started on port ${this.port}`);
    });

    this.wss.on('connection', async (ws: WebSocket, req) => {
      // 解析 URL 和查询参数
      const url = req.url || '';
      const urlObj = new URL(url, 'http://localhost');
      const urlPath = urlObj.pathname;
      const queryParams = urlObj.searchParams;

      // 🔥 认证 WebSocket 连接
      const authResult = await authenticateWebSocket(urlPath, queryParams);
      if (!authResult) {
        console.error(`WebSocket 认证失败: ${url}`);
        ws.close(1008, 'Authentication required');
        return;
      }

      // 根据连接类型处理
      let agentId: AgentId;

      if (authResult.connectionType === 'agent' && authResult.agentId) {
        // Agent 连接（后端内部）
        agentId = authResult.agentId;
      } else if (authResult.connectionType === 'user') {
        // 用户连接（前端浏览器），使用 accountId 作为标识
        // 用户连接复用 Agent B 的通道来接收通知
        agentId = `user-${authResult.accountId}` as AgentId;
        console.log(`👤 用户 WebSocket 连接: accountId=${authResult.accountId}, workspaceId=${authResult.workspaceId}`);
      } else {
        console.error(`WebSocket 认证结果无效: ${url}`);
        ws.close(1008, 'Invalid authentication');
        return;
      }

      // 检查是否已经存在连接
      if (this.clients.has(agentId)) {
        const existingClient = this.clients.get(agentId)!;
        existingClient.socket.close();
        this.clients.delete(agentId);
        console.log(`⚠️  Replaced existing connection for Agent ${agentId}`);
      }

      // 创建新的客户端
      const client: WSClient = {
        agentId,
        socket: ws,
        connectedAt: new Date(),
        auth: authResult,
      };

      this.clients.set(agentId, client);
      console.log(`✅ Agent ${agentId} connected to WebSocket`);

      // 发送连接成功消息
      this.sendToAgent(agentId, {
        type: 'system_notification',
        message: 'WebSocket 连接成功',
        timestamp: new Date().toISOString(),
        data: {
          connectedAt: client.connectedAt,
        },
      });

      // 处理消息
      ws.on('message', (data: Buffer) => {
        try {
          const message: WSMessage = JSON.parse(data.toString());
          this.handleMessage(client, message);
        } catch (error) {
          console.error(`Error parsing message from Agent ${agentId}:`, error);
        }
      });

      // 处理关闭
      ws.on('close', () => {
        console.log(`❌ Agent ${agentId} disconnected from WebSocket`);
        this.clients.delete(agentId);
        // 🔴 阶段1：发射断连事件，供外部监听（如重连调度器）
        this.emit('agentDisconnected', agentId);
      });

      // 处理错误
      ws.on('error', (error) => {
        console.error(`WebSocket error for Agent ${agentId}:`, error);
      });

      // 处理 pong
      ws.on('pong', () => {
        const client = this.clients.get(agentId);
        if (client) {
          client.lastPing = new Date();
        }
      });
    });

    this.wss.on('error', (error) => {
      console.error('WebSocket server error:', error);
    });

    // 启动心跳检测
    this.startHeartbeat();
  }

  /**
   * 停止 WebSocket 服务器
   */
  stop() {
    if (this.wss) {
      // 关闭所有客户端连接
      this.clients.forEach((client) => {
        client.socket.close();
      });
      this.clients.clear();

      // 停止心跳检测
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      // 关闭服务器
      this.wss.close();
      this.wss = null;
      console.log('🛑 WebSocket server stopped');
    }
  }

  /**
   * 向指定 Agent 发送消息
   */
  sendToAgent(agentId: AgentId, message: WSMessage): boolean {
    const client = this.clients.get(agentId);
    if (client && client.socket.readyState === WebSocket.OPEN) {
      try {
        client.socket.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error(`Error sending message to Agent ${agentId}:`, error);
        return false;
      }
    }
    console.log(`⚠️  Agent ${agentId} not connected or socket not ready`);
    return false;
  }

  /**
   * 向多个 Agent 发送消息
   */
  sendToAgents(agentIds: AgentId[], message: WSMessage): Map<AgentId, boolean> {
    const results = new Map<AgentId, boolean>();
    agentIds.forEach((agentId) => {
      const success = this.sendToAgent(agentId, message);
      results.set(agentId, success);
    });
    return results;
  }

  /**
   * 广播消息给所有已连接的 Agent
   */
  broadcast(message: WSMessage): void {
    this.clients.forEach((client) => {
      this.sendToAgent(client.agentId, message);
    });
  }

  /**
   * 获取当前已连接的 Agent 列表
   */
  getConnectedClients(): AgentId[] {
    return Array.from(this.clients.keys());
  }

  /**
   * 检查指定 Agent 是否已连接
   */
  isAgentConnected(agentId: AgentId): boolean {
    const client = this.clients.get(agentId);
    return client?.socket.readyState === WebSocket.OPEN;
  }

  /**
   * 处理客户端消息
   */
  private handleMessage(client: WSClient, message: WSMessage): void {
    switch (message.type) {
      case 'ping':
        // 响应 ping 消息
        client.socket.send(JSON.stringify({ type: 'pong' }));
        break;

      case 'pong':
        // 更新心跳时间
        client.lastPing = new Date();
        break;

      default:
        console.log(`Received message from Agent ${client.agentId}:`, message);
    }
  }

  /**
   * 启动心跳检测（保持长连接）
   * 双向心跳机制：
   * - 服务端每 60 秒发送一次 ping
   * - 期望客户端每 30 秒发送一次 ping
   * - 超时时间：120 秒
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = new Date();

      this.clients.forEach((client, agentId) => {
        if (client.socket.readyState !== WebSocket.OPEN) {
          // 移除已断开的客户端
          this.clients.delete(agentId);
          return;
        }

        // 发送 ping 消息（每 60 秒）
        try {
          client.socket.ping();

          // 检查最后响应时间（超过 120 秒没有响应认为断开）
          // 这个超时时间应该大于客户端的心跳间隔（30s）
          if (client.lastPing && (now.getTime() - client.lastPing.getTime()) > 120000) {
            console.log(`⚠️  Agent ${agentId} heartbeat timeout (120s), closing connection`);
            client.socket.close();
            this.clients.delete(agentId);
            // 🔴 阶段1：发射断连事件
            this.emit('agentDisconnected', agentId);
          } else if (!client.lastPing && (now.getTime() - client.connectedAt.getTime()) > 120000) {
            // 如果从未收到过 pong，连接后 120 秒也认为断开
            console.log(`⚠️  Agent ${agentId} no pong received (120s), closing connection`);
            client.socket.close();
            this.clients.delete(agentId);
            // 🔴 阶段1：发射断连事件
            this.emit('agentDisconnected', agentId);
          }
        } catch (error) {
          console.error(`Error sending ping to Agent ${agentId}:`, error);
          this.clients.delete(agentId);
        }
      });
    }, 60000); // 每 60 秒发送一次心跳
  }

  /**
   * 获取服务器状态
   */
  getStatus(): {
    port: number;
    running: boolean;
    connectedAgents: AgentId[];
    clientCount: number;
  } {
    // 🔥 改进状态检查：不仅检查 wss 是否存在，还检查是否真的在监听
    const isRunning = this.wss !== null && this.wss.listening;
    return {
      port: this.port,
      running: isRunning,
      connectedAgents: this.getConnectedClients(),
      clientCount: this.clients.size,
    };
  }

  /**
   * 🔴 阶段1新增：便捷方法 - 检查 WS 服务是否运行
   */
  isRunning(): boolean {
    return this.wss !== null && this.wss.listening;
  }

  /**
   * 🔴 阶段1新增：便捷方法 - 获取已连接的 Agent 列表
   */
  getConnectedAgents(): AgentId[] {
    return this.getConnectedClients();
  }

  /**
   * 检查端口是否已被占用
   */
  private async isPortInUse(): Promise<boolean> {
    return new Promise((resolve) => {
      const net = require('net');
      const server = net.createServer();

      server.once('error', () => {
        server.close();
        resolve(true); // 端口被占用
      });

      server.once('listening', () => {
        server.close();
        resolve(false); // 端口可用
      });

      server.listen(this.port, '0.0.0.0');
    });
  }
}

// 创建全局 WebSocket 服务器实例
// 🔥 全局单例保护：确保 WebSocket 服务器只启动一次
// 防止 Next.js 热重载导致多次启动
declare global {
  var _wsServerInstance: WebSocketServer | undefined;
}

export const wsServer = global._wsServerInstance || new WebSocketServer(5001);

// 在 Node.js 环境中自动启动服务器（确保只启动一次）
if (typeof window === 'undefined') {
  // 将实例保存到全局变量，防止热重载时重复创建
  if (!global._wsServerInstance) {
    global._wsServerInstance = wsServer;
  }

  // 🔥 改进启动逻辑：检查端口是否被占用
  const startServer = async () => {
    try {
      // 先检查端口是否被占用
      const portInUse = await wsServer.isPortInUse();

      if (portInUse) {
        console.log('⚠️  WebSocket 端口已被占用，跳过启动');
        console.log('✅ 假设 WebSocket 服务器已在运行');
        return;
      }

      // 检查服务器是否已经在运行
      const status = wsServer.getStatus();
      if (!status.running) {
        console.log('🚀 Starting WebSocket server...');
        wsServer.start();
      } else {
        console.log('✅ WebSocket server is already running');
      }
    } catch (error) {
      console.error('Failed to check/start WebSocket server:', error);
    }
  };

  // 异步启动服务器
  startServer();

  // 优雅关闭
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down WebSocket server...');
    wsServer.stop();
  });

  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down WebSocket server...');
    wsServer.stop();
  });
}

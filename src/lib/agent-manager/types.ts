/**
 * Agent 管理器类型定义
 * 包含 Agent 实例管理、生命周期控制、协作协议等核心类型
 */

// ============================================================================
// Agent 实例管理相关类型
// ============================================================================

/**
 * Agent 状态
 */
export enum AgentStatus {
  INITIALIZING = 'initializing',
  IDLE = 'idle',
  BUSY = 'busy',
  PAUSED = 'paused',
  ERROR = 'error',
  OFFLINE = 'offline',
  TERMINATED = 'terminated',
}

/**
 * Agent 健康状态
 */
export enum AgentHealth {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
}

/**
 * Agent 实例
 */
export interface AgentInstance {
  id: string;
  agentId: string;                        // Agent 类型 ID (A, B, C, D, etc.)
  name: string;
  description: string;
  status: AgentStatus;
  health: AgentHealth;
  currentTasks: string[];                // 当前执行的任务 ID
  maxConcurrentTasks: number;
  capabilities: string[];                // Agent 能力列表
  configuration: Record<string, any>;    // Agent 配置
  metrics: AgentMetrics;                 // Agent 指标
  createdAt: number;
  startedAt?: number;
  lastActiveAt: number;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Agent 指标
 */
export interface AgentMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageTaskDuration: number;
  totalMessageCount: number;
  uptime: number;                        // 运行时间（毫秒）
  cpuUsage?: number;
  memoryUsage?: number;
}

// ============================================================================
// 生命周期控制相关类型
// ============================================================================

/**
 * Agent 生命周期事件
 */
export enum LifecycleEvent {
  INITIALIZING = 'initializing',
  INITIALIZED = 'initialized',
  STARTING = 'starting',
  STARTED = 'started',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  RESTARTING = 'restarting',
  RESTARTED = 'restarted',
  ERROR = 'error',
}

/**
 * 生命周期策略
 */
export enum LifecycleStrategy {
  AUTO_RESTART = 'auto_restart',         // 自动重启
  MANUAL_RESTART = 'manual_restart',     // 手动重启
  TERMINATE_ON_ERROR = 'terminate_on_error', // 错误时终止
  GRACEFUL_SHUTDOWN = 'graceful_shutdown', // 优雅关闭
}

/**
 * 生命周期配置
 */
export interface LifecycleConfig {
  maxRetries?: number;                   // 最大重试次数
  retryDelay?: number;                   // 重试延迟（毫秒）
  strategy?: LifecycleStrategy;          // 生命周期策略
  autoHealEnabled?: boolean;             // 是否启用自动修复
  healthCheckInterval?: number;          // 健康检查间隔（毫秒）
  gracefulShutdownTimeout?: number;      // 优雅关闭超时（毫秒）
}

// ============================================================================
// 协作协议相关类型
// ============================================================================

/**
 * 协作消息类型
 */
export enum CollaborationMessageType {
  REQUEST = 'request',                   // 请求
  RESPONSE = 'response',                 // 响应
  NOTIFICATION = 'notification',         // 通知
  BROADCAST = 'broadcast',               // 广播
  HANDSHAKE = 'handshake',               // 握手
  HEARTBEAT = 'heartbeat',               // 心跳
}

/**
 * 协作协议状态
 */
export enum ProtocolState {
  IDLE = 'idle',
  NEGOTIATING = 'negotiating',
  COLLABORATING = 'collaborating',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
}

/**
 * 协作会话
 */
export interface CollaborationSession {
  id: string;
  initiatorId: string;                   // 发起方 Agent ID
  participantIds: string[];              // 参与方 Agent ID 列表
  protocolId: string;                    // 协议 ID
  state: ProtocolState;
  startTime: number;
  endTime?: number;
  timeout?: number;
  messages: string[];                    // 消息 ID 列表
  context: Record<string, any>;          // 协作上下文
  metadata?: Record<string, any>;
}

/**
 * 协作协议
 */
export interface CollaborationProtocol {
  id: string;
  name: string;
  description: string;
  version: string;
  roles: AgentRole[];                    // 角色定义
  messages: ProtocolMessage[];           // 消息定义
  stateMachine: ProtocolStateMachine;    // 状态机
  timeout?: number;                      // 默认超时时间
}

/**
 * Agent 角色
 */
export interface AgentRole {
  id: string;
  name: string;
  responsibilities: string[];
  permissions: string[];
  requiredCapabilities: string[];
}

/**
 * 协议消息
 */
export interface ProtocolMessage {
  id: string;
  name: string;
  type: CollaborationMessageType;
  from: string;                          // 发送方角色
  to: string;                            // 接收方角色
  schema: Record<string, any>;           // 消息 schema
  required: boolean;                     // 是否必需
}

/**
 * 协议状态机
 */
export interface ProtocolStateMachine {
  states: ProtocolState[];
  transitions: ProtocolTransition[];
  initialState: string;
}

/**
 * 协议转换
 */
export interface ProtocolTransition {
  from: string;
  to: string;
  event: string;
  guard?: (context: Record<string, any>) => boolean;
  action?: (context: Record<string, any>) => void;
}

// ============================================================================
// Agent 注册相关类型
// ============================================================================

/**
 * Agent 注册信息
 */
export interface AgentRegistration {
  agentId: string;
  name: string;
  description: string;
  type: string;                          // Agent 类型
  capabilities: string[];
  maxConcurrentTasks: number;
  configuration?: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Agent 发现信息
 */
export interface AgentDiscovery {
  agents: AgentInstance[];
  timestamp: number;
  totalAgents: number;
  activeAgents: number;
}

// ============================================================================
// 权限相关类型
// ============================================================================

/**
 * 权限级别
 */
export enum PermissionLevel {
  NONE = 'none',
  READ = 'read',
  WRITE = 'write',
  ADMIN = 'admin',
}

/**
 * 权限
 */
export interface Permission {
  resource: string;                      // 资源类型
  action: string;                        // 动作类型
  level: PermissionLevel;
}

/**
 * 权限检查结果
 */
export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

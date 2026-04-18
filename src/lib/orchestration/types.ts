/**
 * Agent 编排引擎类型定义
 * 包含消息路由、任务调度、工作流执行、对话状态管理等核心类型
 */

// ============================================================================
// 消息路由相关类型
// ============================================================================

/**
 * 消息类型
 */
export enum MessageType {
  TASK_ASSIGNMENT = 'task_assignment',        // 任务分配
  TASK_RESULT = 'task_result',                // 任务结果
  DATA_TRANSFER = 'data_transfer',            // 数据传输
  STATUS_UPDATE = 'status_update',            // 状态更新
  ERROR_REPORT = 'error_report',              // 错误报告
  HEARTBEAT = 'heartbeat',                    // 心跳
  COLLABORATION_REQUEST = 'collaboration_request', // 协作请求
  COLLABORATION_RESPONSE = 'collaboration_response', // 协作响应
}

/**
 * 消息优先级
 */
export enum MessagePriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  URGENT = 4,
}

/**
 * 消息状态
 */
export enum MessageStatus {
  PENDING = 'pending',        // 等待发送
  SENT = 'sent',             // 已发送
  DELIVERED = 'delivered',    // 已送达
  PROCESSING = 'processing',  // 处理中
  COMPLETED = 'completed',    // 已完成
  FAILED = 'failed',          // 失败
  TIMEOUT = 'timeout',        // 超时
}

/**
 * 消息结构
 */
export interface OrchestrationMessage {
  id: string;                          // 消息唯一标识
  from: string;                        // 发送方 Agent ID
  to: string | string[];               // 接收方 Agent ID（支持多播）
  type: MessageType;                   // 消息类型
  content: any;                        // 消息内容
  priority: MessagePriority;           // 优先级
  status: MessageStatus;               // 当前状态
  timestamp: number;                   // 创建时间戳
  deliveredAt?: number;                // 送达时间戳
  completedAt?: number;                // 完成时间戳
  retryCount?: number;                 // 重试次数
  maxRetries?: number;                 // 最大重试次数
  timeout?: number;                    // 超时时间（毫秒）
  correlationId?: string;              // 关联ID（用于追踪相关消息）
  parentId?: string;                   // 父消息ID（用于消息链）
  metadata?: Record<string, any>;      // 元数据
}

/**
 * 路由规则
 */
export interface RoutingRule {
  id: string;
  name: string;
  from: string;                        // 发送方匹配规则（支持通配符）
  to: string;                          // 接收方
  messageType: MessageType;            // 消息类型
  priority?: MessagePriority;          // 优先级筛选
  condition?: (message: OrchestrationMessage) => boolean; // 自定义条件
  transform?: (message: OrchestrationMessage) => OrchestrationMessage; // 消息转换
  enabled: boolean;
}

// ============================================================================
// 任务调度相关类型
// ============================================================================

/**
 * 任务状态
 */
export enum TaskStatus {
  PENDING = 'pending',        // 等待执行
  SCHEDULED = 'scheduled',    // 已调度
  RUNNING = 'running',        // 执行中
  COMPLETED = 'completed',    // 已完成
  FAILED = 'failed',          // 失败
  CANCELLED = 'cancelled',    // 已取消
  TIMEOUT = 'timeout',        // 超时
  PAUSED = 'paused',          // 已暂停
}

/**
 * 任务优先级
 */
export enum TaskPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  URGENT = 4,
  CRITICAL = 5,
}

/**
 * 任务结构
 */
export interface ScheduledTask {
  id: string;
  workflowId?: string;                 // 所属工作流 ID
  agentId: string;                     // 负责执行的 Agent ID
  taskType: string;                    // 任务类型
  title: string;                       // 任务标题
  description: string;                 // 任务描述
  payload: any;                        // 任务数据
  status: TaskStatus;                  // 当前状态
  priority: TaskPriority;              // 优先级
  createdAt: number;                   // 创建时间
  scheduledAt?: number;                // 调度时间
  startedAt?: number;                  // 开始时间
  completedAt?: number;                // 完成时间
  estimatedDuration?: number;          // 预计耗时（毫秒）
  actualDuration?: number;             // 实际耗时（毫秒）
  timeout?: number;                    // 超时时间（毫秒）
  retryCount?: number;                 // 重试次数
  maxRetries?: number;                 // 最大重试次数
  dependencies?: string[];             // 依赖的任务 ID
  nextTasks?: string[];                // 下一步任务 ID
  result?: any;                        // 执行结果
  error?: string;                      // 错误信息
  progress?: number;                   // 进度（0-100）
  metadata?: Record<string, any>;      // 元数据
}

/**
 * 调度策略
 */
export enum SchedulingStrategy {
  FIFO = 'fifo',                       // 先进先出
  PRIORITY = 'priority',               // 优先级
  ROUND_ROBIN = 'round_robin',         // 轮询
  LEAST_LOADED = 'least_loaded',       // 负载均衡
  EARLIEST_DEADLINE = 'earliest_deadline', // 最早截止时间
}

// ============================================================================
// 工作流执行相关类型
// ============================================================================

/**
 * 工作流节点类型
 */
export enum NodeType {
  START = 'start',                     // 开始节点
  AGENT = 'agent',                     // Agent 节点
  CONDITION = 'condition',             // 条件节点
  PARALLEL = 'parallel',               // 并行节点
  MERGE = 'merge',                     // 合并节点
  END = 'end',                         // 结束节点
  DELAY = 'delay',                     // 延迟节点
  HUMAN = 'human',                     // 人工节点
}

/**
 * 工作流状态
 */
export enum WorkflowStatus {
  DRAFT = 'draft',                     // 草稿
  ACTIVE = 'active',                   // 活跃
  RUNNING = 'running',                 // 运行中
  PAUSED = 'paused',                   // 暂停
  COMPLETED = 'completed',             // 已完成
  FAILED = 'failed',                   // 失败
  CANCELLED = 'cancelled',             // 已取消
}

/**
 * 工作流节点
 */
export interface WorkflowNode {
  id: string;
  type: NodeType;
  name: string;
  description?: string;
  agentId?: string;                    // Agent 节点专用
  condition?: (data: any) => boolean;  // 条件节点专用
  delay?: number;                      // 延迟节点专用（毫秒）
  next?: string | string[];            // 下一个节点 ID
  retryCount?: number;
  timeout?: number;
  metadata?: Record<string, any>;
}

/**
 * 工作流边（连接关系）
 */
export interface WorkflowEdge {
  from: string;                        // 源节点 ID
  to: string;                          // 目标节点 ID
  condition?: string;                  // 条件表达式
  label?: string;                      // 边标签
}

/**
 * 工作流定义
 */
export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables?: Record<string, any>;     // 工作流变量
  metadata?: Record<string, any>;
}

/**
 * 工作流实例
 */
export interface WorkflowInstance {
  id: string;
  definitionId: string;
  status: WorkflowStatus;
  currentNodes: string[];              // 当前执行的节点
  variables: Record<string, any>;      // 实例变量
  tasks: string[];                     // 关联的任务 ID
  messages: string[];                  // 关联的消息 ID
  startedAt: number;
  completedAt?: number;
  error?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// 对话状态管理相关类型
// ============================================================================

/**
 * 对话状态
 */
export enum ConversationState {
  ACTIVE = 'active',                   // 活跃
  PAUSED = 'paused',                   // 暂停
  CLOSED = 'closed',                   // 已关闭
  ARCHIVED = 'archived',               // 已归档
}

/**
 * 对话会话
 */
export interface ConversationSession {
  id: string;
  userId?: string;                     // 用户 ID
  agentId?: string;                    // 主要 Agent ID
  workflowId?: string;                 // 关联的工作流 ID
  state: ConversationState;
  messages: string[];                  // 消息 ID 列表
  variables: Record<string, any>;      // 会话变量
  context: Record<string, any>;        // 上下文信息
  currentStep?: string;                // 当前步骤
  startedAt: number;
  lastActiveAt: number;
  endedAt?: number;
  metadata?: Record<string, any>;
}

/**
 * 状态机状态
 */
export interface StateMachineState {
  id: string;
  name: string;
  initial: boolean;
  final: boolean;
  transitions: StateTransition[];
  onEnter?: (data: any) => void;       // 进入状态时的回调
  onExit?: (data: any) => void;        // 离开状态时的回调
}

/**
 * 状态转换
 */
export interface StateTransition {
  event: string;                       // 触发事件
  to: string;                          // 目标状态
  condition?: (data: any) => boolean;  // 转换条件
  action?: (data: any) => void;        // 转换时的动作
}

// ============================================================================
// 决策引擎相关类型
// ============================================================================

/**
 * 决策类型
 */
export enum DecisionType {
  RULE_BASED = 'rule_based',           // 规则引擎
  AI_BASED = 'ai_based',               // AI 决策
  HYBRID = 'hybrid',                   // 混合决策
}

/**
 * 决策规则
 */
export interface DecisionRule {
  id: string;
  name: string;
  priority: number;                    // 优先级
  condition: (data: any) => boolean;   // 条件判断
  action: (data: any) => any;          // 执行动作
  description?: string;
  enabled: boolean;
}

/**
 * 决策结果
 */
export interface DecisionResult {
  success: boolean;
  action?: string;
  data?: any;
  reasoning?: string;                  // 决策原因
  confidence?: number;                 // 置信度（0-1）
  matchedRules?: string[];             // 匹配的规则 ID
}

// ============================================================================
// 编排引擎配置
// ============================================================================

/**
 * 编排引擎配置
 */
export interface OrchestrationConfig {
  // 消息路由配置
  messageTimeout?: number;             // 消息超时时间（毫秒）
  messageMaxRetries?: number;          // 消息最大重试次数
  enableMessagePersistence?: boolean;  // 是否持久化消息

  // 任务调度配置
  schedulingStrategy?: SchedulingStrategy; // 调度策略
  taskTimeout?: number;                // 任务超时时间（毫秒）
  taskMaxRetries?: number;             // 任务最大重试次数
  maxConcurrentTasks?: number;         // 最大并发任务数

  // 工作流配置
  workflowTimeout?: number;            // 工作流超时时间（毫秒）
  enableWorkflowRecovery?: boolean;    // 是否启用工作流恢复

  // 对话管理配置
  conversationTimeout?: number;        // 对话超时时间（毫秒）
  maxConversationHistory?: number;     // 最大对话历史长度

  // 决策引擎配置
  enableDecisionLogging?: boolean;     // 是否启用决策日志
  decisionConfidenceThreshold?: number; // 决策置信度阈值
}

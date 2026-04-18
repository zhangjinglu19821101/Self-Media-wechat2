/**
 * 用户反馈流程 - 核心类型定义
 *
 * 本文件定义用户反馈流程中的所有类型、枚举、接口
 */

// ============================================================================
// 核心状态枚举
// ============================================================================

/**
 * 任务状态（扩展版）
 * 新增：user_feedback_received 状态
 */
export enum TaskStatusV2 {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  WAITING_USER = 'waiting_user',
  USER_FEEDBACK_RECEIVED = 'user_feedback_received', // 新增！
}

/**
 * Agent B 决策类型（扩展版）
 * 新增：RE_EXECUTE
 */
export enum AgentBDecisionType {
  COMPLETE = 'COMPLETE',
  NEED_USER = 'NEED_USER',
  FAILED = 'FAILED',
  EXECUTE_MCP = 'EXECUTE_MCP',
  RE_EXECUTE = 'RE_EXECUTE', // 新增！
}

// ============================================================================
// 交互记录类型
// ============================================================================

/**
 * 交互角色
 */
export enum InteractionRole {
  USER = 'user',
  AGENT_B = 'agent_b',
  EXECUTOR = 'executor',
  SYSTEM = 'system',
}

/**
 * 交互记录
 */
export interface InteractionRecord {
  id: string;
  role: InteractionRole;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

// ============================================================================
// MCP 执行历史记录
// ============================================================================

/**
 * MCP 执行状态
 */
export enum MCPExecutionStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * MCP 执行历史记录
 */
export interface MCPExecutionHistory {
  id: string;
  mcpServerName: string;
  toolName: string;
  arguments: Record<string, any>;
  status: MCPExecutionStatus;
  result?: any;
  error?: string;
  startedAt: number;
  completedAt?: number;
  metadata?: Record<string, any>;
}

// ============================================================================
// 执行 Agent 结果
// ============================================================================

/**
 * 执行 Agent 结果
 */
export interface ExecutorResult {
  success: boolean;
  output: string;
  error?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// 用户反馈相关类型
// ============================================================================

/**
 * 用户反馈请求 v2
 */
export interface UserFeedbackRequestV2 {
  dailyTaskId: string; // 优化：更清晰的命名（旧版：commandResultId）
  userFeedback: string;
  agentId: string;
  metadata?: Record<string, any>;
}

/**
 * 用户反馈响应 v2
 */
export interface UserFeedbackResponseV2 {
  success: boolean;
  data?: {
    taskId: string;
    status: TaskStatusV2;
    decision?: AgentBDecisionV2;
    message?: string;
  };
  error?: string;
}

// ============================================================================
// Agent B 决策相关类型
// ============================================================================

/**
 * Agent B 决策 v2
 */
export interface AgentBDecisionV2 {
  type: AgentBDecisionType;
  reasoning: string;
  data?: Record<string, any>;
}

/**
 * Agent B 决策上下文 v2（包含历史记录）
 */
export interface AgentBDecisionContextV2 {
  dailyTaskId: string;
  userFeedback: string;
  // 历史记录
  mcpExecutionHistory: MCPExecutionHistory[];
  userInteractions: InteractionRecord[];
  executorResult?: ExecutorResult;
  // 额外上下文
  metadata?: Record<string, any>;
}

// ============================================================================
// 历史记录恢复类型
// ============================================================================

/**
 * 历史记录恢复结果
 */
export interface HistoryRecoveryResult {
  success: boolean;
  mcpExecutionHistory: MCPExecutionHistory[];
  userInteractions: InteractionRecord[];
  executorResult?: ExecutorResult;
  metadata?: Record<string, any>;
}

// ============================================================================
// RE_EXECUTE 处理相关类型
// ============================================================================

/**
 * RE_EXECUTE 处理请求
 */
export interface ReExecuteRequest {
  dailyTaskId: string;
  decision: AgentBDecisionV2;
  metadata?: Record<string, any>;
}

/**
 * RE_EXECUTE 处理响应
 */
export interface ReExecuteResponse {
  success: boolean;
  data?: {
    taskId: string;
    status: TaskStatusV2;
    message?: string;
  };
  error?: string;
}

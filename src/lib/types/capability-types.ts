/**
 * MCP 能力类型定义
 * 
 * @docs /docs/详细设计文档agent智能交互MCP能力设计capability_type.md
 */

// ========== MCP 能力类型枚举 ==========

/**
 * MCP 能力类型枚举
 * 15个通用能力类型，支持扩展
 */
export enum MCP_CAPABILITY_TYPE {
  /** 信息获取类 */
  DATA_ACQUIRE = 'data_acquire',
  TOOL_USE = 'tool_use',
  SEARCH = 'search',
  
  /** 内容创作类 */
  CONTENT_GENERATION = 'content_generation',
  IMAGE_GENERATION = 'image_generation',
  VIDEO_GENERATION = 'video_generation',
  AUDIO_GENERATION = 'audio_generation',
  CODE_GENERATION = 'code_generation',
  
  /** 平台发布类 */
  PLATFORM_PUBLISH = 'platform_publish',
  SOCIAL_MEDIA_MANAGE = 'social_media_manage',
  EMAIL_SEND = 'email_send',
  
  /** 工具执行类 */
  TOOL_EXECUTE = 'tool_execute',
  API_CALL = 'api_call',
  DATABASE_OP = 'database_op',
  FILE_OP = 'file_op'
}

// ========== MCP 执行状态枚举 ==========

/**
 * MCP 执行状态
 */
export enum MCP_EXECUTION_STATUS {
  /** 待执行 */
  PENDING = 'pending',
  /** 执行中 */
  IN_PROGRESS = 'in_progress',
  /** 执行成功 */
  SUCCESS = 'success',
  /** 执行失败 */
  FAILED = 'failed',
  /** 需现场执行 */
  NEEDS_ON_SITE = 'needs_on_site',
  /** 现场执行完成待确认 */
  ON_SITE_COMPLETED = 'on_site_completed',
  /** 已取消 */
  CANCELLED = 'cancelled'
}

// ========== Agent B 解决方案状态枚举 ==========

/**
 * Agent B 解决方案状态
 */
export enum AGENT_B_SOLUTION_STATUS {
  /** 无解决方案 */
  NO_SOLUTION = 'no_solution',
  /** 非现场执行 */
  NON_ON_SITE = 'non_on_site',
  /** 需现场执行 */
  NEEDS_ON_SITE = 'needs_on_site'
}

// ========== 执行 Agent 输出规范 ==========

/**
 * 执行 Agent 输出规范
 */
export interface ExecutorAgentOutput {
  /** 是否需要 Agent B 介入 */
  isNeedAgentB: boolean;
  
  /** 仅当 isNeedAgentB=true 时有值 */
  problemDescription?: string;
  
  /** 问题历史记录（可选） */
  problemHistory?: Array<{
    timestamp: string;
    description: string;
  }>;
  
  /** 额外信息（可选，按需扩展） */
  extInfo?: Record<string, any>;
}

// ========== Agent B 输出规范 ==========

/**
 * Agent B 输出规范
 */
export interface AgentBOutput {
  /** 是否具备解决条件 */
  hasSolution: boolean;
  
  /** 仅当 hasSolution=true 时有值 */
  solutionStatus?: AGENT_B_SOLUTION_STATUS;
  
  /** 仅当 hasSolution=true 时有值 */
  solutionNum?: number;
  
  /** 仅当 hasSolution=true 时有值 */
  solutionName?: string;
  
  /** 仅当 hasSolution=true and solutionStatus='non_on_site' 时有值 */
  mcpArgs?: Record<string, any>;
  
  /** 仅当 hasSolution=true and solutionStatus='needs_on_site' 时有值 */
  onSiteWorkflow?: string;
  
  /** 仅当 hasSolution=false 时有值 */
  agentADecision?: 'report' | 'wait';
  
  /** 额外信息（可选，按需扩展） */
  extInfo?: Record<string, any>;
}

// ========== MCP 执行状态同步结构 ==========

/**
 * MCP 执行状态同步结构
 */
export interface MCPExecutionStatusSync {
  /** MCP 执行状态 */
  mcpExecutionStatus: MCP_EXECUTION_STATUS;
  
  /** 仅当 mcpExecutionStatus='success' 时有值 */
  mcpResult?: any;
  
  /** 仅当 mcpExecutionStatus='failed' 时有值 */
  mcpError?: {
    code: string;
    message: string;
    details?: any;
  };
  
  /** 仅当 mcpExecutionStatus='needs_on_site' 时有值 */
  onSiteExecutionUrl?: string;
  
  /** 仅当 mcpExecutionStatus='on_site_completed' 时有值 */
  onSiteExecutionResult?: any;
  
  /** 额外信息（可选，按需扩展） */
  extInfo?: Record<string, any>;
}

// ========== interact_content 扩展字段 ==========

/**
 * interact_content 的 MCP 相关扩展字段
 */
export interface InteractContentMCPFields {
  /** 能力类型 */
  capabilityType?: MCP_CAPABILITY_TYPE;
  
  /** 能力ID */
  capabilityId?: number;
  
  /** 能力名称 */
  capabilityName?: string;
  
  /** 是否需要 MCP */
  isNeedMcp?: boolean;
  
  /** 解决方案状态 */
  solutionStatus?: AGENT_B_SOLUTION_STATUS;
  
  /** MCP 执行状态 */
  mcpExecutionStatus?: MCP_EXECUTION_STATUS;
  
  /** MCP 执行结果 */
  mcpResult?: any;
  
  /** MCP 执行错误 */
  mcpError?: {
    code: string;
    message: string;
    details?: any;
  };
  
  /** MCP 参数 */
  mcpArgs?: Record<string, any>;
  
  /** 现场执行工作流 */
  onSiteWorkflow?: string;
  
  /** 现场执行 URL */
  onSiteExecutionUrl?: string;
  
  /** 现场执行结果 */
  onSiteExecutionResult?: any;
  
  /** Agent A 决策 */
  agentADecision?: 'report' | 'wait';
}

// ========== 能力清单查询条件 ==========

/**
 * 能力清单查询条件
 */
export interface CapabilityListQuery {
  /** 能力类型（可选） */
  capabilityType?: MCP_CAPABILITY_TYPE;
  
  /** 状态（可选，默认 active） */
  status?: 'active' | 'inactive';
  
  /** 是否需要现场执行（可选） */
  requiresOnSiteExecution?: boolean;
}

/**
 * 接口 Schema 定义（JSON Schema 格式）
 * Agent B 可据此分析和拼装参数
 */
export interface CapabilityInterfaceSchema {
  type: 'object';
  properties: Record<string, {
    type: string;
    description?: string;
    required?: boolean;
    enum?: string[];
    minimum?: number;
    maximum?: number;
  }>;
  required?: string[];
  description?: string;
}

/**
 * 扩展的 CapabilityList 类型（包含新增字段）
 */
export interface CapabilityListWithInterface {
  id: number;
  capabilityType: string;
  functionDesc: string;
  status: string;
  requiresOnSiteExecution: boolean;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  
  // 新增字段
  interfaceSchema?: CapabilityInterfaceSchema;
  toolName?: string;
  actionName?: string;
  paramExamples?: Record<string, any>;
}

// ========== Agent A 待办任务查询条件 ==========

/**
 * Agent A 待办任务查询条件
 */
export interface AgentATodoQuery {
  /** 状态（可选） */
  status?: 'pending' | 'processing' | 'completed' | 'cancelled';
  
  /** 执行Agent ID（可选） */
  executorAgentId?: string;
  
  /** 分页偏移（默认0） */
  offset?: number;
  
  /** 分页限制（默认20） */
  limit?: number;
}

// ========== Agent A 待办任务处理请求 ==========

/**
 * Agent A 待办任务处理请求
 */
export interface AgentATodoProcessRequest {
  /** 任务ID */
  todoId: string;
  
  /** 处理者 */
  processedBy: string;
  
  /** 解决方案内容 */
  solutionContent: string;
  
  /** 状态（默认 completed） */
  status?: 'completed' | 'cancelled';
}

// ========== 工具函数 ==========

/**
 * 验证 capability_type 是否有效
 * 
 * @param capabilityType - 待验证的能力类型
 * @returns 是否有效
 */
export function isValidCapabilityType(capabilityType: string): capabilityType is MCP_CAPABILITY_TYPE {
  return Object.values(MCP_CAPABILITY_TYPE).includes(capabilityType as MCP_CAPABILITY_TYPE);
}

/**
 * 验证 MCP 执行状态是否有效
 * 
 * @param status - 待验证的状态
 * @returns 是否有效
 */
export function isValidMCPExecutionStatus(status: string): status is MCP_EXECUTION_STATUS {
  return Object.values(MCP_EXECUTION_STATUS).includes(status as MCP_EXECUTION_STATUS);
}

/**
 * 验证 Agent B 解决方案状态是否有效
 * 
 * @param status - 待验证的状态
 * @returns 是否有效
 */
export function isValidAgentBSolutionStatus(status: string): status is AGENT_B_SOLUTION_STATUS {
  return Object.values(AGENT_B_SOLUTION_STATUS).includes(status as AGENT_B_SOLUTION_STATUS);
}

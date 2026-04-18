/**
 * Agent B 响应格式类型定义
 * 支持新旧格式的兼容性
 */

/**
 * Agent B 旧格式（当前使用）
 */
export interface AgentBOldFormat {
  type: 'EXECUTE_MCP' | 'COMPLETE' | 'NEED_USER' | 'FAILED' | 'REEXECUTE_EXECUTOR';
  reasonCode: string;
  reasoning: string;
  // 🔴 新增：decisionBasis 字段（判断依据）
  decisionBasis?: string;
  // 🔴 新增：notCompletedReason 字段（为什么不是 COMPLETE）
  notCompletedReason?: string;
  // 🔴🔴🔴 【新增】评审结论描述（不超过120字）
  reviewConclusion?: string;
  context: {
    executionSummary: string;
    riskLevel: 'low' | 'medium' | 'high';
    suggestedAction: string;
    suggestedExecutor?: string;  // 🔴 REEXECUTE_EXECUTOR 场景：新的执行者ID
  };
  data: {
    from_parents_executor?: string;  // 🔴 REEXECUTE_EXECUTOR 场景：指定新的执行者
    mcpParams?: {
      solutionNum: number;
      toolName: string;
      actionName: string;
      params: Record<string, any>;
    };
    completionResult?: any;
    pendingKeyFields?: Array<{
      fieldId: string;
      fieldName: string;
      fieldType: 'text' | 'number' | 'select' | 'date' | 'boolean';
      description: string;
      currentValue?: any;
      validationRules?: Record<string, any>;
    }>;
    availableSolutions?: Array<{
      solutionId: string;
      label: string;
      description: string;
      pros: string[];
      cons: string[];
    }>;
    promptMessage?: string | {
      title: string;
      description: string;
      priority?: string;
    };
    failedDetails?: {
      errorType: string;
      errorMessage: string;
      recoverable: boolean;
      suggestedFix?: string;
    };
  };
}

/**
 * Agent B 新格式（标准模板）
 */
export interface AgentBNewFormat {
  status: 'completed' | 'partial' | 'failed' | 'in_progress';
  result: any;
  message: string;
  confidence?: number;
  confidenceScale?: string;
  evidence?: Array<{
    type: 'data_point' | 'reference' | 'example' | 'calculation' | 'code_snippet' | 'chart_reference';
    value: string;
    source?: string;
    timestamp?: string;
    location?: string;
  }>;
  metadata?: {
    agentVersion?: string;
    timestamp?: string;
    [key: string]: any;
  };
  timestamp?: string;
  agentVersion?: string;
}

/**
 * 统一格式（内部使用）
 */
export interface AgentBUnifiedFormat {
  // 决策核心信息
  decisionType: 'EXECUTE_MCP' | 'COMPLETE' | 'NEED_USER' | 'FAILED' | 'REEXECUTE_EXECUTOR';
  reasoning: string;
  // 🔴 新增：decisionBasis 字段（判断依据）
  decisionBasis?: string;
  // 🔴 新增：notCompletedReason 字段（为什么不是 COMPLETE）
  notCompletedReason?: string;
  // 🔴🔴🔴 【新增】评审结论描述（不超过120字）
  reviewConclusion?: string;
  
  // 🔴 新增：执行上下文（用于 REEXECUTE_EXECUTOR 场景）
  context?: {
    executionSummary?: string;
    riskLevel?: 'low' | 'medium' | 'high';
    suggestedAction?: string;
    suggestedExecutor?: string;  // 🔴 新的执行者ID，如 "agent T"、"insurance-d"
  };
  
  // 🔴 新增：数据字段（用于 REEXECUTE_EXECUTOR 场景）
  data?: {
    from_parents_executor?: string;  // 🔴 指定新的执行者，如 "agent T"
    completionResult?: any;
    mcpParams?: {
      solutionNum: number;
      toolName: string;
      actionName: string;
      params: Record<string, any>;
    };
  };
  
  // MCP 相关
  mcpParams?: {
    solutionNum: number;
    toolName: string;
    actionName: string;
    params: Record<string, any>;
  };
  
  // 完成相关
  completionResult?: any;
  
  // 用户交互相关
  userPrompt?: {
    title: string;
    description: string;
    priority?: string;
  };
  
  // 元数据
  confidence?: number;
  evidence?: any[];
  metadata?: Record<string, any>;
}

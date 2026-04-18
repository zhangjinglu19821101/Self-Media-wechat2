/**
 * 交互类型
 * 
 * 定义了 agent_sub_tasks_step_history 表中可能的交互类型
 */
export type InteractType = 
  | 'agent_consult'      // Agent 咨询（insurance-d 发起咨询）
  | 'agent_response'     // Agent B 回应（agent B 回应咨询）
  | 'artificial_confirm' // 人工确认（用户确认结果）
  | 'artificial_question'// 用户提问（用户提出问题）
  | 'system_tip'         // 系统提示/超时/异常（系统提示）
  | 'agent_summary'      // Agent B 第5次交互总结（agent B 自动总结）
  | 'mcp_execution';     // MCP 执行状态同步

/**
 * 执行结果状态
 */
export type ExecutionResultStatus = 
  | 'success'    // 成功
  | 'failed'     // 失败
  | 'timeout'    // 超时
  | 'confirmed'  // 已确认
  | 'waiting'    // 等待中
  | 'executing';  // 执行中

/**
 * 交互内容接口（agent_sub_tasks_step_history.interact_content）
 * 
 * 用于存储结构化的交互内容，包括：
 * - 交互类型
 * - 咨询方和响应方
 * - 问题和响应（支持字符串或对象）
 * - 执行结果
 * - 扩展信息（含 MCP 相关字段）
 */
export interface InteractContent {
  /**
   * 交互类型
   */
  interact_type: InteractType;

  /**
   * 咨询方（发起方）
   * 例如：'insurance-d' | 'agent B' | '人工' | 'system'
   */
  consultant: string;

  /**
   * 响应方
   * 例如：'insurance-d' | 'agent B' | '人工' | 'system'
   */
  responder: string;

  /**
   * 咨询问题（支持字符串或对象）
   */
  question: string | Record<string, any>;

  /**
   * 响应内容（支持字符串或对象）
   */
  response: string | Record<string, any>;

  /**
   * 执行结果
   */
  execution_result: {
    /**
     * 状态
     */
    status: ExecutionResultStatus;
    
    /**
     * 上传 URL（可选）
     */
    upload_url?: string;
    
    /**
     * 错误信息（可选）
     */
    error_msg?: string | null;
    
    /**
     * 确认备注（可选）
     */
    confirm_note?: string;
  };

  /**
   * 扩展信息（按需补充）
   */
  ext_info: {
    /**
     * MCP 连接器（可选）
     */
    mcp_connector?: string;
    
    /**
     * 执行时间（可选）
     */
    execution_time?: string;
    
    /**
     * 建议（可选）
     */
    suggestion?: string;
    
    /**
     * 能力类型（capability_type）
     */
    capability_type?: string;
    
    /**
     * 是否需要 MCP（is_need_mcp）
     */
    is_need_mcp?: boolean;
    
    /**
     * 问题描述（problem）
     */
    problem?: string;
    
    /**
     * 是否需要查询能力清单（list_capabilities）
     */
    list_capabilities?: boolean;
    
    /**
     * 解决方案编号（solution_num）
     */
    solution_num?: number;
    
    /**
     * 解决方案描述（solution_desc）
     */
    solution_desc?: string;
    
    /**
     * 是否需要上报 Agent A（is_notify_agentA）
     */
    is_notify_agentA?: boolean;
    
    /**
     * 上报内容（report_content）
     */
    report_content?: Record<string, any>;
    
    /**
     * MCP 执行状态（mcp_execution_status）
     */
    mcp_execution_status?: string;
    
    /**
     * MCP 返回信息（mcp_return_info）
     */
    mcp_return_info?: Record<string, any> | null;
    
    /**
     * 对话历史（dialog_history）
     */
    dialog_history?: Array<{
      interact_num: number;
      consultant: string;
      content: string;
    }> | null;
    
    /**
     * 其他扩展字段
     */
    [key: string]: any;
  };
}

/**
 * 创建 Agent 咨询的 InteractContent
 * 
 * @param params - 参数
 * @returns InteractContent 对象
 */
export function createAgentConsultContent(params: {
  consultant: string;
  responder: string;
  question: string | Record<string, any>;
  response: string | Record<string, any>;
  executionResult: InteractContent['execution_result'];
  extInfo?: Record<string, any>;
}): InteractContent {
  return {
    interact_type: 'agent_consult',
    consultant: params.consultant,
    responder: params.responder,
    question: params.question,
    response: params.response,
    execution_result: params.executionResult,
    ext_info: params.extInfo || {},
  };
}

/**
 * 创建 Agent 回应的 InteractContent
 * 
 * @param params - 参数
 * @returns InteractContent 对象
 */
export function createAgentResponseContent(params: {
  consultant: string;
  responder: string;
  question: string | Record<string, any>;
  response: string | Record<string, any>;
  executionResult: InteractContent['execution_result'];
  extInfo?: Record<string, any>;
}): InteractContent {
  return {
    interact_type: 'agent_response',
    consultant: params.consultant,
    responder: params.responder,
    question: params.question,
    response: params.response,
    execution_result: params.executionResult,
    ext_info: params.extInfo || {},
  };
}

/**
 * 创建人工确认的 InteractContent
 * 
 * @param params - 参数
 * @returns InteractContent 对象
 */
export function createArtificialConfirmContent(params: {
  consultant: string;
  responder: string;
  question: string | Record<string, any>;
  response: string | Record<string, any>;
  executionResult: InteractContent['execution_result'];
  extInfo?: Record<string, any>;
}): InteractContent {
  return {
    interact_type: 'artificial_confirm',
    consultant: params.consultant,
    responder: params.responder,
    question: params.question,
    response: params.response,
    execution_result: params.executionResult,
    ext_info: params.extInfo || {},
  };
}

/**
 * 创建系统提示的 InteractContent
 * 
 * @param params - 参数
 * @returns InteractContent 对象
 */
export function createSystemTipContent(params: {
  consultant: string;
  responder: string;
  question: string | Record<string, any>;
  response: string | Record<string, any>;
  executionResult: InteractContent['execution_result'];
  extInfo?: Record<string, any>;
}): InteractContent {
  return {
    interact_type: 'system_tip',
    consultant: params.consultant,
    responder: params.responder,
    question: params.question,
    response: params.response,
    execution_result: params.executionResult,
    ext_info: params.extInfo || {},
  };
}

/**
 * 创建 MCP 执行状态的 InteractContent
 * 
 * @param params - 参数
 * @returns InteractContent 对象
 */
export function createMcpExecutionContent(params: {
  consultant: string;
  responder: string;
  question: string | Record<string, any>;
  response: string | Record<string, any>;
  executionResult: InteractContent['execution_result'];
  extInfo?: Record<string, any>;
}): InteractContent {
  return {
    interact_type: 'mcp_execution',
    consultant: params.consultant,
    responder: params.responder,
    question: params.question,
    response: params.response,
    execution_result: params.executionResult,
    ext_info: params.extInfo || {},
  };
}

/**
 * 创建 Agent 总结的 InteractContent
 * 
 * @param params - 参数
 * @returns InteractContent 对象
 */
export function createAgentSummaryContent(params: {
  consultant: string;
  responder: string;
  question: string | Record<string, any>;
  response: string | Record<string, any>;
  executionResult: InteractContent['execution_result'];
  extInfo?: Record<string, any>;
}): InteractContent {
  return {
    interact_type: 'agent_summary',
    consultant: params.consultant,
    responder: params.responder,
    question: params.question,
    response: params.response,
    execution_result: params.executionResult,
    ext_info: params.extInfo || {},
  };
}

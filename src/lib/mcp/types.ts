/**
 * MCP 能力类型定义
 * 所有 MCP 能力都基于这些类型实现
 */

// Agent B 返回的标准指令格式
export interface AgentBResponse {
  [key: string]: any;
  call_mcp_meth_status?: string;
}

// MCP 能力的 agent_response_spec 格式
export interface AgentResponseSpec {
  trigger_key: string;
  trigger_value: string;
  required_params: Array<{
    param_name: string;
    param_type: string;
    example_value: any;
    desc?: string;
    optional?: boolean;
  }>;
  response_example: Record<string, any>;
  constraints: string[];
}

// MCP 能力基础接口
export interface MCPCapability {
  id: number;
  capabilityType: string;
  functionDesc: string;
  agentResponseSpec: AgentResponseSpec;
  requiresOnSiteExecution: boolean;
  status: 'available' | 'unavailable';
}

// MCP 执行结果
export interface MCPExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime: string;
}

// MCP 调用上下文
export interface MCPCallContext {
  capabilityId: number;
  agentBResponse: AgentBResponse;
  businessData?: Record<string, any>;
}

// 参数校验结果
export interface ValidationResult {
  valid: boolean;
  msg: string;
}

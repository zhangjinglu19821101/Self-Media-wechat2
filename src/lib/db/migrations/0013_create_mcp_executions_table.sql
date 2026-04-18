-- 创建 agent_sub_tasks_mcp_executions 表
-- 用于存储 MCP（Model Context Protocol）工具执行的详细记录

CREATE TABLE IF NOT EXISTS agent_sub_tasks_mcp_executions (
  id SERIAL PRIMARY KEY,
  step_history_id UUID NOT NULL,
  command_result_id TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  attempt_id TEXT NOT NULL,
  attempt_number INTEGER NOT NULL,
  attempt_timestamp TIMESTAMP NOT NULL,
  solution_num INTEGER,
  tool_name TEXT,
  action_name TEXT,
  reasoning TEXT,
  strategy TEXT,
  params JSONB,
  result_status TEXT NOT NULL,
  result_data JSONB,
  error_code TEXT,
  error_message TEXT,
  error_type TEXT,
  execution_time_ms INTEGER NOT NULL,
  is_retryable BOOLEAN,
  failure_type TEXT,
  suggested_next_action TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_mcp_step_history_id ON agent_sub_tasks_mcp_executions(step_history_id);
CREATE INDEX IF NOT EXISTS idx_mcp_command_result ON agent_sub_tasks_mcp_executions(command_result_id, order_index);
CREATE INDEX IF NOT EXISTS idx_mcp_tool_action ON agent_sub_tasks_mcp_executions(tool_name, action_name);
CREATE INDEX IF NOT EXISTS idx_mcp_status ON agent_sub_tasks_mcp_executions(result_status);
CREATE INDEX IF NOT EXISTS idx_mcp_timestamp ON agent_sub_tasks_mcp_executions(attempt_timestamp);
CREATE INDEX IF NOT EXISTS idx_mcp_error_type ON agent_sub_tasks_mcp_executions(error_type);

-- 注释
COMMENT ON TABLE agent_sub_tasks_mcp_executions IS '存储 MCP 工具执行的详细记录，用于审计和追踪';
COMMENT ON COLUMN agent_sub_tasks_mcp_executions.step_history_id IS '关联的步骤历史ID（UUID）';
COMMENT ON COLUMN agent_sub_tasks_mcp_executions.attempt_id IS '尝试实例唯一标识';
COMMENT ON COLUMN agent_sub_tasks_mcp_executions.attempt_number IS '尝试次数编号';
COMMENT ON COLUMN agent_sub_tasks_mcp_executions.result_status IS '执行结果状态';
COMMENT ON COLUMN agent_sub_tasks_mcp_executions.execution_time_ms IS '执行耗时（毫秒）';
COMMENT ON COLUMN agent_sub_tasks_mcp_executions.is_retryable IS '是否可重试';

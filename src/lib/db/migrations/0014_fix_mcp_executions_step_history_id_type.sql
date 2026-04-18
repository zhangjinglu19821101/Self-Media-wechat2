-- 修复 agent_sub_tasks_mcp_executions 表的 step_history_id 字段类型
-- 从 uuid 改为 integer，与 agent_sub_tasks_step_history.id 保持一致

-- 首先删除外键约束（如果存在）
ALTER TABLE agent_sub_tasks_mcp_executions 
DROP CONSTRAINT IF EXISTS agent_sub_tasks_mcp_executions_step_history_id_fkey;

-- 修改字段类型
ALTER TABLE agent_sub_tasks_mcp_executions 
ALTER COLUMN step_history_id TYPE integer USING step_history_id::text::integer;

-- 重新添加外键约束
ALTER TABLE agent_sub_tasks_mcp_executions 
ADD CONSTRAINT agent_sub_tasks_mcp_executions_step_history_id_fkey 
FOREIGN KEY (step_history_id) 
REFERENCES agent_sub_tasks_step_history(id) 
ON DELETE CASCADE;

-- 重建索引
DROP INDEX IF EXISTS idx_mcp_step_history_id;
CREATE INDEX idx_mcp_step_history_id ON agent_sub_tasks_mcp_executions(step_history_id);

COMMENT ON TABLE agent_sub_tasks_mcp_executions IS '存储 MCP 工具执行的详细记录，用于审计和追踪';
COMMENT ON COLUMN agent_sub_tasks_mcp_executions.step_history_id IS '关联的步骤历史ID（整数类型，与 agent_sub_tasks_step_history.id 一致）';

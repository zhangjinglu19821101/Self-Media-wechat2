-- 为 agent_sub_tasks_mcp_executions 表添加 result_text 字段
-- 用于存储 MCP 执行结果的文本化格式，便于 Agent 理解

-- 第一步：添加字段
ALTER TABLE agent_sub_tasks_mcp_executions 
ADD COLUMN IF NOT EXISTS result_text TEXT;

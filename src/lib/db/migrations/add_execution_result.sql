-- 添加 executionResult 和 statusProof 字段到 agent_sub_tasks 表
ALTER TABLE agent_sub_tasks ADD COLUMN IF NOT EXISTS execution_result TEXT;
ALTER TABLE agent_sub_tasks ADD COLUMN IF NOT EXISTS status_proof TEXT;

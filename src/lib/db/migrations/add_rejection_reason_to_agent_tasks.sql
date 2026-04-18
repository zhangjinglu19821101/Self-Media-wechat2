-- 给 agent_tasks 表添加 rejection_reason 字段
-- 注意：这需要根据实际数据库情况执行

ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

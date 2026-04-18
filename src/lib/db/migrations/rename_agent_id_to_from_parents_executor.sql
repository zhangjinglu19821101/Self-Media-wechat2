-- 将 agent_sub_tasks 表的 agent_id 字段重命名为 from_parents_executor
-- 注意：这需要根据实际数据库情况执行

ALTER TABLE agent_sub_tasks RENAME COLUMN agent_id TO from_parents_executor;

-- 如果需要，可以更新索引名
DROP INDEX IF EXISTS idx_agent_sub_tasks_agent;
CREATE INDEX IF NOT EXISTS idx_agent_sub_tasks_from_parents_executor ON agent_sub_tasks(from_parents_executor);

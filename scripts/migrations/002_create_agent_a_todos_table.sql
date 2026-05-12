-- ========================================
-- 创建 agent_a_todos 表
-- Agent A 待办任务表
-- ========================================

CREATE TABLE IF NOT EXISTS agent_a_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_task_id UUID NOT NULL REFERENCES agent_sub_tasks(id) ON DELETE CASCADE,
  task_title TEXT NOT NULL,
  problem_description TEXT NOT NULL,
  problem_history JSONB NOT NULL DEFAULT '[]',
  executor_agent_id TEXT NOT NULL,
  solution_content TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by TEXT NOT NULL,
  processed_by TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_agent_a_todos_sub_task_id ON agent_a_todos(sub_task_id);
CREATE INDEX IF NOT EXISTS idx_agent_a_todos_status ON agent_a_todos(status);
CREATE INDEX IF NOT EXISTS idx_agent_a_todos_created_at ON agent_a_todos(created_at);

-- 添加注释
COMMENT ON TABLE agent_a_todos IS 'Agent A 待办任务表';
COMMENT ON COLUMN agent_a_todos.id IS '主键 ID';
COMMENT ON COLUMN agent_a_todos.sub_task_id IS '关联的子任务ID';
COMMENT ON COLUMN agent_a_todos.task_title IS '任务标题';
COMMENT ON COLUMN agent_a_todos.problem_description IS '执行Agent反馈的问题描述';
COMMENT ON COLUMN agent_a_todos.problem_history IS '问题历史记录';
COMMENT ON COLUMN agent_a_todos.executor_agent_id IS '执行Agent ID';
COMMENT ON COLUMN agent_a_todos.solution_content IS 'Agent A输入的解决方案';
COMMENT ON COLUMN agent_a_todos.status IS '状态：pending/processing/completed/cancelled';
COMMENT ON COLUMN agent_a_todos.created_by IS '创建者';
COMMENT ON COLUMN agent_a_todos.processed_by IS '处理者';
COMMENT ON COLUMN agent_a_todos.created_at IS '创建时间';
COMMENT ON COLUMN agent_a_todos.processed_at IS '处理时间';
COMMENT ON COLUMN agent_a_todos.completed_at IS '完成时间';

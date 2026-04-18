-- ==========================================
-- Agent 任务管理系统 - 数据库迁移
-- ==========================================

-- 1. 扩展 command_results 表，添加子任务管理字段
ALTER TABLE command_results ADD COLUMN IF NOT EXISTS completed_sub_tasks INTEGER DEFAULT 0;
ALTER TABLE command_results ADD COLUMN IF NOT EXISTS completed_sub_tasks_description TEXT;
ALTER TABLE command_results ADD COLUMN IF NOT EXISTS sub_task_count INTEGER DEFAULT 0;
ALTER TABLE command_results ADD COLUMN IF NOT EXISTS question_status TEXT DEFAULT 'none';
ALTER TABLE command_results ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMP;
ALTER TABLE command_results ADD COLUMN IF NOT EXISTS last_inspected_at TIMESTAMP;

-- 2. 创建 agent_sub_tasks 表
CREATE TABLE IF NOT EXISTS agent_sub_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  command_result_id UUID NOT NULL REFERENCES command_results(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  task_title TEXT NOT NULL,
  task_description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  order_index INTEGER NOT NULL,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_agent_sub_tasks_command_result ON agent_sub_tasks(command_result_id);
CREATE INDEX IF NOT EXISTS idx_agent_sub_tasks_agent ON agent_sub_tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_sub_tasks_status ON agent_sub_tasks(status);

-- 3. 创建 agent_interactions 表
CREATE TABLE IF NOT EXISTS agent_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  command_result_id UUID NOT NULL REFERENCES command_results(id) ON DELETE CASCADE,
  task_description TEXT,
  session_id TEXT NOT NULL,
  sender TEXT NOT NULL,
  receiver TEXT,
  message_type TEXT NOT NULL,
  content TEXT NOT NULL,
  round_number INTEGER,
  is_resolution BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_interactions_session ON agent_interactions(session_id);
CREATE INDEX IF NOT EXISTS idx_interactions_command_result ON agent_interactions(command_result_id);
CREATE INDEX IF NOT EXISTS idx_interactions_sender ON agent_interactions(sender);
CREATE INDEX IF NOT EXISTS idx_interactions_created_at ON agent_interactions(created_at);
CREATE INDEX IF NOT EXISTS idx_interactions_message_type ON agent_interactions(message_type);

-- ==========================================
-- 完成迁移
-- ==========================================

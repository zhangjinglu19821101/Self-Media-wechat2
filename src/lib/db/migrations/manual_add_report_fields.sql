-- 为 command_results 表添加对话相关字段
ALTER TABLE command_results
ADD COLUMN IF NOT EXISTS dialogue_session_id TEXT,
ADD COLUMN IF NOT EXISTS dialogue_rounds INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS dialogue_status TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS last_dialogue_at TIMESTAMP;

-- 为 command_results 表添加报告管理字段（latest_report_id 字段需要稍后添加外键）
ALTER TABLE command_results
ADD COLUMN IF NOT EXISTS latest_report_id UUID,
ADD COLUMN IF NOT EXISTS report_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS requires_intervention BOOLEAN DEFAULT FALSE;

-- 为 agent_sub_tasks 表添加对话相关字段
ALTER TABLE agent_sub_tasks
ADD COLUMN IF NOT EXISTS dialogue_session_id TEXT,
ADD COLUMN IF NOT EXISTS dialogue_rounds INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS dialogue_status TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS last_dialogue_at TIMESTAMP;

-- 为 agent_interactions 表添加 is_understand 字段
ALTER TABLE agent_interactions
ADD COLUMN IF NOT EXISTS is_understand BOOLEAN DEFAULT FALSE;

-- 创建 agent_reports 表（先不带外键）
CREATE TABLE IF NOT EXISTS agent_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL,
  command_result_id UUID NOT NULL,
  sub_task_id UUID,
  summary TEXT NOT NULL,
  conclusion TEXT NOT NULL,
  dialogue_process JSONB NOT NULL,
  suggested_actions JSONB NOT NULL,
  reported_to TEXT NOT NULL,
  reported_from TEXT NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL,
  reviewed_by TEXT,
  reviewed_at TIMESTAMP,
  processed_by TEXT,
  processed_at TIMESTAMP,
  processed_actions JSONB DEFAULT '[]'::jsonb,
  dismissed_reason TEXT,
  related_task_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_agent_reports_status ON agent_reports(status);
CREATE INDEX IF NOT EXISTS idx_agent_reports_command_result_id ON agent_reports(command_result_id);
CREATE INDEX IF NOT EXISTS idx_agent_reports_reported_to ON agent_reports(reported_to);

-- 添加外键约束（如果表已存在）
DO $$
BEGIN
    -- 添加 command_result_id 外键
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'agent_reports_command_result_id_fkey'
    ) THEN
        ALTER TABLE agent_reports
        ADD CONSTRAINT agent_reports_command_result_id_fkey
        FOREIGN KEY (command_result_id) REFERENCES command_results(id) ON DELETE CASCADE;
    END IF;

    -- 添加 sub_task_id 外键
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'agent_reports_sub_task_id_fkey'
    ) THEN
        ALTER TABLE agent_reports
        ADD CONSTRAINT agent_reports_sub_task_id_fkey
        FOREIGN KEY (sub_task_id) REFERENCES agent_sub_tasks(id) ON DELETE CASCADE;
    END IF;

    -- 添加 latest_report_id 外键
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'command_results_latest_report_id_fkey'
    ) THEN
        ALTER TABLE command_results
        ADD CONSTRAINT command_results_latest_report_id_fkey
        FOREIGN KEY (latest_report_id) REFERENCES agent_reports(id);
    END IF;
END $$;

-- 创建缺失的数据库表

-- 1. 创建 agent_sub_tasks_step_history 表
CREATE TABLE IF NOT EXISTS agent_sub_tasks_step_history (
  id SERIAL PRIMARY KEY,
  command_result_id UUID NOT NULL,
  step_no INTEGER NOT NULL,
  interact_type TEXT,
  interact_content JSONB NOT NULL,
  interact_user TEXT NOT NULL,
  interact_time TIMESTAMP NOT NULL DEFAULT NOW(),
  interact_num INTEGER NOT NULL DEFAULT 1
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_step_history_command_result_id 
  ON agent_sub_tasks_step_history(command_result_id);
CREATE INDEX IF NOT EXISTS idx_step_history_interact_time 
  ON agent_sub_tasks_step_history(interact_time);

-- 2. 创建 agent_sub_tasks_mcp_executions 表
CREATE TABLE IF NOT EXISTS agent_sub_tasks_mcp_executions (
  id SERIAL PRIMARY KEY,
  step_history_id INTEGER,
  command_result_id UUID,
  order_index INTEGER,
  attempt_id TEXT,
  attempt_number INTEGER,
  attempt_timestamp TIMESTAMP,
  solution_num INTEGER,
  tool_name TEXT,
  action_name TEXT,
  reasoning TEXT,
  strategy TEXT,
  params JSONB,
  result_status TEXT,
  result_data JSONB,
  result_text TEXT,
  error_code TEXT,
  error_message TEXT,
  error_type TEXT,
  execution_time_ms INTEGER,
  is_retryable BOOLEAN,
  failure_type TEXT,
  suggested_next_action TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_mcp_command_result 
  ON agent_sub_tasks_mcp_executions(command_result_id, order_index);

-- 3. 创建 article_content 表（如果不存在）
CREATE TABLE IF NOT EXISTS article_content (
  article_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  creator_agent TEXT NOT NULL,
  article_title TEXT NOT NULL,
  article_subtitle TEXT DEFAULT '',
  article_content TEXT NOT NULL,
  core_keywords JSONB DEFAULT '[]',
  create_time TIMESTAMP NOT NULL DEFAULT NOW(),
  update_time TIMESTAMP NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1,
  content_status TEXT NOT NULL DEFAULT 'draft',
  reject_reason TEXT DEFAULT '',
  wechat_mp_url TEXT DEFAULT '',
  wechat_mp_publish_time TIMESTAMP,
  ext_info JSONB DEFAULT '{}'
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_article_content_task_id 
  ON article_content(task_id);
CREATE INDEX IF NOT EXISTS idx_article_content_creator_status 
  ON article_content(creator_agent, content_status);

-- 4. 创建 article_review_records 表（如果不存在）
CREATE TABLE IF NOT EXISTS article_review_records (
  review_id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  review_round INTEGER NOT NULL DEFAULT 1,
  review_type TEXT NOT NULL DEFAULT 'automated',
  reviewer TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'pending',
  review_result TEXT,
  review_summary TEXT,
  compliance_score INTEGER,
  start_time TIMESTAMP NOT NULL DEFAULT NOW(),
  end_time TIMESTAMP,
  duration_seconds INTEGER,
  ext_info JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_article_review_article_id 
  ON article_review_records(article_id);
CREATE INDEX IF NOT EXISTS idx_article_review_status 
  ON article_review_records(review_status);

-- 5. 创建 article_review_comments 表（如果不存在）
CREATE TABLE IF NOT EXISTS article_review_comments (
  comment_id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL,
  article_id TEXT NOT NULL,
  comment_type TEXT NOT NULL DEFAULT 'compliance',
  severity TEXT NOT NULL DEFAULT 'medium',
  rule_id TEXT,
  rule_name TEXT,
  paragraph_index INTEGER,
  start_position INTEGER,
  end_position INTEGER,
  problematic_content TEXT,
  issue_description TEXT NOT NULL,
  suggestion TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_article_comment_review_id 
  ON article_review_comments(review_id);

-- 6. 创建 agent_reports 表（如果不存在）
CREATE TABLE IF NOT EXISTS agent_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id TEXT NOT NULL UNIQUE,
  task_id TEXT NOT NULL,
  report_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  generated_by TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 7. 创建 agent_a_todos 表（如果不存在）
CREATE TABLE IF NOT EXISTS agent_a_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_task_id UUID NOT NULL,
  task_title TEXT NOT NULL,
  problem_description TEXT NOT NULL,
  problem_history JSONB DEFAULT '[]',
  executor_agent_id TEXT NOT NULL,
  solution_content TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by TEXT NOT NULL,
  processed_by TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMP
);

-- 8. 创建 agent_capabilities 表（如果不存在）
CREATE TABLE IF NOT EXISTS agent_capabilities (
  id SERIAL PRIMARY KEY,
  agent_id TEXT NOT NULL UNIQUE,
  agent_name TEXT NOT NULL,
  description TEXT,
  native_capabilities JSONB DEFAULT '[]',
  preferred_mcp_capabilities JSONB DEFAULT '[]',
  auto_judge_rules JSONB DEFAULT '[]',
  default_account_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 9. 创建 domain_rule 表（如果不存在）
CREATE TABLE IF NOT EXISTS domain_rule (
  id SERIAL PRIMARY KEY,
  rule_id TEXT NOT NULL UNIQUE,
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  domain TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 10. 创建 domain_case 表（如果不存在）
CREATE TABLE IF NOT EXISTS domain_case (
  id SERIAL PRIMARY KEY,
  case_id TEXT NOT NULL UNIQUE,
  case_name TEXT NOT NULL,
  domain TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 11. 创建 domain_terminology 表（如果不存在）
CREATE TABLE IF NOT EXISTS domain_terminology (
  id SERIAL PRIMARY KEY,
  term_id TEXT NOT NULL UNIQUE,
  term_name TEXT NOT NULL,
  domain TEXT NOT NULL,
  definition TEXT NOT NULL,
  aliases JSONB DEFAULT '[]',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 12. 创建 agent_dev_principles 表（如果不存在）
CREATE TABLE IF NOT EXISTS agent_dev_principles (
  id SERIAL PRIMARY KEY,
  principle_id TEXT NOT NULL UNIQUE,
  principle_name TEXT NOT NULL,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

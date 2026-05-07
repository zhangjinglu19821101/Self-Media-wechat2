-- 迁移: 创建 admin_audit_logs 表
-- 适用于: dev_schema 和 public 两个 schema
-- 执行时机: 部署前执行

-- ============================================
-- DEV 环境: dev_schema
-- ============================================

CREATE TABLE IF NOT EXISTS dev_schema.admin_audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL,
  admin_email TEXT NOT NULL,
  target_account_id UUID,
  target_email TEXT,
  action TEXT NOT NULL,  -- disable, enable, reset_password, unlock, set_role
  action_detail TEXT,     -- JSON 格式的操作详情
  ip_address TEXT,
  user_agent TEXT,
  previous_value TEXT,    -- 操作前的值 (JSON)
  new_value TEXT,         -- 操作后的值 (JSON)
  created_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id ON dev_schema.admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target_account_id ON dev_schema.admin_audit_logs(target_account_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON dev_schema.admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON dev_schema.admin_audit_logs(created_at);

-- ============================================
-- PROD 环境: public
-- ============================================

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL,
  admin_email TEXT NOT NULL,
  target_account_id UUID,
  target_email TEXT,
  action TEXT NOT NULL,  -- disable, enable, reset_password, unlock, set_role
  action_detail TEXT,     -- JSON 格式的操作详情
  ip_address TEXT,
  user_agent TEXT,
  previous_value TEXT,    -- 操作前的值 (JSON)
  new_value TEXT,         -- 操作后的值 (JSON)
  created_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id ON public.admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target_account_id ON public.admin_audit_logs(target_account_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON public.admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON public.admin_audit_logs(created_at);

-- ============================================
-- 注释
-- ============================================
COMMENT ON TABLE dev_schema.admin_audit_logs IS '管理员操作审计日志（开发环境）';
COMMENT ON TABLE public.admin_audit_logs IS '管理员操作审计日志（生产环境）';

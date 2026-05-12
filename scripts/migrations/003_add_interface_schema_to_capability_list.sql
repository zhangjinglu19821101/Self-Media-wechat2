-- ========================================
-- 为 capability_list 表添加接口定义字段
-- 支持 Agent B 根据接口信息自主决策和拼装参数
-- ========================================

-- 1. 添加 interface_schema 字段（JSONB，存储工具的接口定义）
ALTER TABLE capability_list 
ADD COLUMN IF NOT EXISTS interface_schema JSONB;

-- 2. 添加 tool_name 字段（工具名称，用于通用调用）
ALTER TABLE capability_list 
ADD COLUMN IF NOT EXISTS tool_name TEXT;

-- 3. 添加 action_name 字段（动作名称，用于通用调用）
ALTER TABLE capability_list 
ADD COLUMN IF NOT EXISTS action_name TEXT;

-- 4. 添加参数示例字段（JSONB，存储参数示例）
ALTER TABLE capability_list 
ADD COLUMN IF NOT EXISTS param_examples JSONB;

-- ========================================
-- 添加注释
-- ========================================

COMMENT ON COLUMN capability_list.interface_schema IS '工具接口定义（JSON Schema格式，Agent B可据此分析和拼装参数）';
COMMENT ON COLUMN capability_list.tool_name IS '工具名称（用于通用调用：search/wechat/data_acquire等）';
COMMENT ON COLUMN capability_list.action_name IS '动作名称（用于通用调用：web_search/add_draft等）';
COMMENT ON COLUMN capability_list.param_examples IS '参数示例（JSON格式，Agent B可参考）';

-- ========================================
-- 创建索引
-- ========================================

CREATE INDEX IF NOT EXISTS idx_capability_list_tool_name ON capability_list(tool_name);
CREATE INDEX IF NOT EXISTS idx_capability_list_action_name ON capability_list(action_name);

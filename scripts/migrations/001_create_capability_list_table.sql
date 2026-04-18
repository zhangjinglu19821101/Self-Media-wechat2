-- ========================================
-- 创建 capability_list 表
-- MCP 能力清单表
-- ========================================

CREATE TABLE IF NOT EXISTS capability_list (
  id SERIAL PRIMARY KEY,
  capability_type TEXT NOT NULL,
  function_desc TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available',
  requires_on_site_execution BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_capability_list_type ON capability_list(capability_type);
CREATE INDEX IF NOT EXISTS idx_capability_list_status ON capability_list(status);

-- 添加注释
COMMENT ON TABLE capability_list IS 'MCP 能力清单表';
COMMENT ON COLUMN capability_list.id IS '主键 ID（序号）';
COMMENT ON COLUMN capability_list.capability_type IS '能力类型';
COMMENT ON COLUMN capability_list.function_desc IS '功能描述';
COMMENT ON COLUMN capability_list.status IS '状态：available/unavailable';
COMMENT ON COLUMN capability_list.requires_on_site_execution IS '是否需要现场执行';
COMMENT ON COLUMN capability_list.metadata IS '元数据';
COMMENT ON COLUMN capability_list.created_at IS '创建时间';
COMMENT ON COLUMN capability_list.updated_at IS '更新时间';

-- ========================================
-- 插入测试数据
-- ========================================

INSERT INTO capability_list (capability_type, function_desc, status, requires_on_site_execution, metadata) VALUES
-- platform_publish 类型
('platform_publish', '微信公众号文章上传（Coze MCP连接器）', 'available', FALSE, '{"mcp_connector": "wechat_mp"}'),
('platform_publish', '微信公众号文章上传（Coze MCP连接器，需现场执行）', 'available', TRUE, '{"mcp_connector": "wechat_mp", "requires_execution": true}'),
('platform_publish', '小红书文案发布（Coze MCP连接器）', 'available', FALSE, '{"mcp_connector": "xiaohongshu"}'),
-- data_acquire 类型
('data_acquire', '热点数据爬取（Coze MCP连接器）', 'available', FALSE, '{"mcp_connector": "hot_data_crawler"}'),
-- tool_execute 类型
('tool_execute', 'MCP连接器调用', 'available', FALSE, '{"mcp_connector": "general_mcp"}')
ON CONFLICT DO NOTHING;

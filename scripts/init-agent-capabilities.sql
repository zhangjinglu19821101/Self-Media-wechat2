/**
 * Agent 能力配置初始化脚本
 * 
 * 将原有硬编码的 CAPABILITY_RULES 迁移到数据库
 * 执行方式：在数据库中执行以下 SQL
 */

-- ============================================
-- 1. 创建 agent_capabilities 表（如不存在）
-- ============================================
CREATE TABLE IF NOT EXISTS agent_capabilities (
  id SERIAL PRIMARY KEY,
  agent_id TEXT NOT NULL UNIQUE,
  agent_name TEXT NOT NULL,
  description TEXT,
  native_capabilities JSONB DEFAULT '[]',
  preferred_mcp_capabilities JSONB DEFAULT '[]',
  auto_judge_rules JSONB DEFAULT '[]',
  default_account_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 2. 初始化 insurance-d Agent 配置
-- ============================================
INSERT INTO agent_capabilities (
  agent_id, 
  agent_name, 
  description,
  native_capabilities,
  preferred_mcp_capabilities,
  auto_judge_rules,
  default_account_id
) VALUES (
  'insurance-d',
  '保险自媒体Agent',
  '负责保险自媒体内容创作和发布的执行Agent',
  '["article_writing", "content_planning", "insurance_knowledge"]',  -- 固有能力
  '[
    {"capabilityType": "wechat_upload", "priority": 1},
    {"capabilityType": "web_search", "priority": 2}
  ]',  -- 偏好MCP能力
  '[
    {
      "ruleId": "insd_001",
      "ruleName": "文章创作任务",
      "keywords": ["科普", "文章", "撰写", "写", "内容创作", "分红险", "惠民保", "医保"],
      "matchMode": "any",
      "action": "native_complete",
      "confidence": 0.8,
      "priority": 10
    },
    {
      "ruleId": "insd_002",
      "ruleName": "搜索素材任务",
      "keywords": ["搜索", "查询", "最新", "热点", "素材", "数据", "查证", "案例", "产品"],
      "matchMode": "any",
      "action": "need_mcp",
      "suggestedCapabilityType": "search",
      "problemTemplate": "需要搜索最新的保险产品信息、热点案例或相关素材",
      "confidence": 0.75,
      "priority": 20
    },
    {
      "ruleId": "insd_003",
      "ruleName": "公众号发布任务",
      "keywords": ["发布", "公众号", "草稿", "微信", "合规", "审核"],
      "matchMode": "any",
      "action": "need_mcp",
      "suggestedCapabilityType": "platform_publish",
      "problemTemplate": "需要微信公众号相关的操作能力",
      "confidence": 0.8,
      "priority": 15
    }
  ]'::jsonb,
  'insurance-account'
) ON CONFLICT (agent_id) DO UPDATE SET
  agent_name = EXCLUDED.agent_name,
  description = EXCLUDED.description,
  native_capabilities = EXCLUDED.native_capabilities,
  preferred_mcp_capabilities = EXCLUDED.preferred_mcp_capabilities,
  auto_judge_rules = EXCLUDED.auto_judge_rules,
  default_account_id = EXCLUDED.default_account_id,
  updated_at = NOW();

-- ============================================
-- 3. 初始化 insurance-c Agent 配置
-- ============================================
INSERT INTO agent_capabilities (
  agent_id, 
  agent_name, 
  description,
  native_capabilities,
  preferred_mcp_capabilities,
  auto_judge_rules,
  default_account_id
) VALUES (
  'insurance-c',
  '保险运营Agent',
  '负责保险运营推广和数据分析的执行Agent',
  '["operation_planning", "data_analysis", "promotion_strategy"]',  -- 固有能力
  '[
    {"capabilityType": "data_query", "priority": 1},
    {"capabilityType": "web_search", "priority": 2}
  ]',  -- 偏好MCP能力
  '[
    {
      "ruleId": "insc_001",
      "ruleName": "运营分析任务",
      "keywords": ["运营", "推广", "引流", "私域", "数据分析", "复盘"],
      "matchMode": "any",
      "action": "native_complete",
      "confidence": 0.8,
      "priority": 10
    },
    {
      "ruleId": "insc_002",
      "ruleName": "素材搜索任务",
      "keywords": ["搜索", "素材", "内容", "案例"],
      "matchMode": "any",
      "action": "need_mcp",
      "suggestedCapabilityType": "search",
      "problemTemplate": "需要搜索运营素材和案例",
      "confidence": 0.75,
      "priority": 20
    }
  ]'::jsonb,
  'insurance-c-account'
) ON CONFLICT (agent_id) DO UPDATE SET
  agent_name = EXCLUDED.agent_name,
  description = EXCLUDED.description,
  native_capabilities = EXCLUDED.native_capabilities,
  preferred_mcp_capabilities = EXCLUDED.preferred_mcp_capabilities,
  auto_judge_rules = EXCLUDED.auto_judge_rules,
  default_account_id = EXCLUDED.default_account_id,
  updated_at = NOW();

-- ============================================
-- 4. 初始化 agent-d Agent 配置（示例）
-- ============================================
INSERT INTO agent_capabilities (
  agent_id, 
  agent_name, 
  description,
  native_capabilities,
  preferred_mcp_capabilities,
  auto_judge_rules,
  default_account_id
) VALUES (
  'agent-d',
  'AI科技Agent',
  '负责AI科技内容创作和分发的执行Agent',
  '["tech_writing", "ai_analysis", "trend_forecast"]',  -- 固有能力
  '[
    {"capabilityType": "web_search", "priority": 1},
    {"capabilityType": "multi_platform_publish", "priority": 2}
  ]',  -- 偏好MCP能力
  '[
    {
      "ruleId": "agentd_001",
      "ruleName": "科技文章创作",
      "keywords": ["科技", "AI", "人工智能", "大模型", "技术解读"],
      "matchMode": "any",
      "action": "native_complete",
      "confidence": 0.8,
      "priority": 10
    },
    {
      "ruleId": "agentd_002",
      "ruleName": "信息搜索任务",
      "keywords": ["搜索", "查询", "最新", "动态", "新闻"],
      "matchMode": "any",
      "action": "need_mcp",
      "suggestedCapabilityType": "search",
      "problemTemplate": "需要搜索最新的AI科技动态",
      "confidence": 0.75,
      "priority": 20
    }
  ]'::jsonb,
  'ai-tech-account'
) ON CONFLICT (agent_id) DO UPDATE SET
  agent_name = EXCLUDED.agent_name,
  description = EXCLUDED.description,
  native_capabilities = EXCLUDED.native_capabilities,
  preferred_mcp_capabilities = EXCLUDED.preferred_mcp_capabilities,
  auto_judge_rules = EXCLUDED.auto_judge_rules,
  default_account_id = EXCLUDED.default_account_id,
  updated_at = NOW();

-- ============================================
-- 5. 查询验证
-- ============================================
SELECT 
  agent_id,
  agent_name,
  jsonb_array_length(native_capabilities) as native_cap_count,
  jsonb_array_length(preferred_mcp_capabilities) as mcp_cap_count,
  jsonb_array_length(auto_judge_rules) as rule_count,
  default_account_id
FROM agent_capabilities
WHERE is_active = true
ORDER BY agent_id;

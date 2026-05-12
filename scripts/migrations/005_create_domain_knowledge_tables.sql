-- ========================================
-- 创建领域知识库表
-- 用于分支1智能化闭环学习
-- ========================================

-- 1. 结构化业务规则库
CREATE TABLE IF NOT EXISTS domain_rule (
  id SERIAL PRIMARY KEY,
  rule_type VARCHAR(50) NOT NULL, -- 'sensitive_word' | 'token_rule' | 'publish_rule' | 'mcp_best_practice'
  rule_content JSONB NOT NULL, -- 规则内容（JSON格式）
  scene VARCHAR(100), -- 适用场景：'wechat_public' | 'web_search' | 'data_acquire' | 'all'
  description TEXT, -- 规则描述
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2. 领域案例库（成功/失败案例）
CREATE TABLE IF NOT EXISTS domain_case (
  id SERIAL PRIMARY KEY,
  task_content TEXT NOT NULL, -- 任务内容描述
  capability_type VARCHAR(100) NOT NULL, -- 能力类型（对应 capability_list.capability_type）
  solution_num INTEGER, -- 对应 capability_list.id
  params JSONB, -- MCP调用参数
  result JSONB, -- 执行结果
  is_success BOOLEAN NOT NULL, -- 是否成功
  failure_reason TEXT, -- 失败原因（失败时必填）
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 3. 领域术语库
CREATE TABLE IF NOT EXISTS domain_terminology (
  id SERIAL PRIMARY KEY,
  term VARCHAR(100) NOT NULL, -- 术语
  explanation TEXT NOT NULL, -- 解释说明
  scene VARCHAR(100), -- 适用场景
  category VARCHAR(50), -- 分类：'insurance' | 'mcp'
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 4. 扩展 capability_list 表，添加参数模板和场景标签
ALTER TABLE capability_list 
ADD COLUMN IF NOT EXISTS param_template JSONB, -- 参数模板（JSON格式）
ADD COLUMN IF NOT EXISTS scene_tags TEXT[]; -- 适用场景标签数组

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_domain_rule_type ON domain_rule(rule_type);
CREATE INDEX IF NOT EXISTS idx_domain_rule_scene ON domain_rule(scene);
CREATE INDEX IF NOT EXISTS idx_domain_case_capability ON domain_case(capability_type);
CREATE INDEX IF NOT EXISTS idx_domain_case_solution ON domain_case(solution_num);
CREATE INDEX IF NOT EXISTS idx_domain_case_success ON domain_case(is_success);
CREATE INDEX IF NOT EXISTS idx_domain_terminology_category ON domain_terminology(category);
CREATE INDEX IF NOT EXISTS idx_domain_terminology_scene ON domain_terminology(scene);

-- ========================================
-- 初始化基础数据
-- ========================================

-- 初始化领域术语（保险相关）
INSERT INTO domain_terminology (term, explanation, category, scene) VALUES
('医疗险', '医疗费用报销型保险，用于报销因疾病或意外产生的医疗费用', 'insurance', 'wechat_public'),
('重疾险', '重大疾病保险，确诊约定重疾后一次性给付保险金', 'insurance', 'wechat_public'),
('意外险', '意外伤害保险，保障因意外导致的身故、伤残和医疗费用', 'insurance', 'wechat_public'),
('寿险', '人寿保险，以被保险人寿命为保险标的', 'insurance', 'wechat_public'),
('免赔额', '保险公司免赔的额度，超过部分才予赔付', 'insurance', 'wechat_public'),
('等待期', '保险合同生效后需要等待一段时间才能获得赔付', 'insurance', 'wechat_public'),
('media_id', '微信公众号素材的唯一标识，用于引用已上传的图片/视频', 'mcp', 'wechat_public'),
('access_token', 'API调用的身份凭证，通常有有效期限制', 'mcp', 'all');

-- 初始化业务规则（微信公众号发布相关）
INSERT INTO domain_rule (rule_type, rule_content, scene, description) VALUES
('sensitive_word', '{
  "words": ["违禁词1", "违禁词2", "最高", "第一", "首选"],
  "action": "filter",
  "description": "微信公众号敏感词过滤"
}', 'wechat_public', '微信公众号敏感词过滤规则'),
('token_rule', '{
  "expire_hours": 2,
  "refresh_before_minutes": 30,
  "description": "微信公众号access_token有效期"
}', 'wechat_public', '微信公众号token有效期规则'),
('publish_rule', '{
  "title_max_length": 64,
  "content_min_length": 300,
  "need_cover": true,
  "description": "微信公众号文章发布规范"
}', 'wechat_public', '微信公众号文章发布规范');

COMMENT ON TABLE domain_rule IS '领域业务规则库';
COMMENT ON TABLE domain_case IS '领域案例库（成功/失败案例）';
COMMENT ON TABLE domain_terminology IS '领域术语库';

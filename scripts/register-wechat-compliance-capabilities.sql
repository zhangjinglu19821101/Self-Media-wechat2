-- ============================================
-- 微信公众号合规审核 MCP 能力登记脚本
-- ============================================
-- 说明：将微信公众号合规审核能力登记到 capability_list 表
--       使 Agent B 能够自主决策调用合规校验功能
-- 
-- 对应代码文件：src/lib/mcp/wechat-compliance-auditor.ts
-- 能力 ID：20（完整审核）、21（快速检查）
-- ============================================

-- ============================================
-- 能力 1：微信公众号内容合规审核（完整审核）
-- 能力 ID：20
-- ============================================
INSERT INTO capability_list (
  id,
  capability_type,
  function_desc,
  status,
  requires_on_site_execution,
  metadata,
  interface_schema,
  agent_response_spec,
  tool_name,
  action_name,
  param_desc,
  param_examples,
  param_template,
  scene_tags,
  example_output,
  supported_agents,
  agent_specific_params
) VALUES (
  20,
  'content_audit',  -- 能力类型
  '微信公众号内容合规审核（RAG + LLM）- 基于向量库检索合规规则，对文章进行完整合规审核，适用于保险行业内容发布前的合规审查',  -- 功能描述
  'available',  -- 状态：可用
  false,  -- 不需要现场执行
  '{
    "category": "compliance",
    "industry": "insurance",
    "tech_stack": "rag_vector_search",
    "dataset_name": "compliance_rules",
    "description": "利用RAG向量库中的合规规则对微信公众号文章进行智能合规审核",
    "capability_id": 20,
    "audit_mode": "full"
  }'::jsonb,  -- 元数据
  '{
    "type": "object",
    "properties": {
      "articleTitle": {
        "type": "string",
        "description": "文章标题"
      },
      "articleContent": {
        "type": "string",
        "description": "文章内容（HTML或纯文本）"
      },
      "auditMode": {
        "type": "string",
        "enum": ["full", "simple"],
        "description": "审核模式，默认为 full",
        "default": "full"
      }
    },
    "required": ["articleTitle", "articleContent"]
  }'::jsonb,  -- 接口Schema
  '{
    "trigger_key": "call_mcp_meth_status",
    "trigger_value": "ready_to_execute",
    "required_params": [
      {
        "param_name": "articleTitle",
        "param_type": "string",
        "example_value": "保险知识科普：如何选择适合自己的重疾险",
        "desc": "文章标题"
      },
      {
        "param_name": "articleContent",
        "param_type": "string",
        "example_value": "<p>重疾险是重要的保障工具...</p>",
        "desc": "文章内容"
      },
      {
        "param_name": "auditMode",
        "param_type": "string",
        "example_value": "full",
        "desc": "审核模式，可选值为 full 或 simple",
        "optional": true
      }
    ],
    "response_example": {
      "approved": true,
      "riskLevel": "low",
      "issues": [],
      "suggestions": [],
      "referencedRules": ["合规规则1", "合规规则2"],
      "auditTime": "2024-01-15T10:30:00Z"
    },
    "constraints": ["文章标题不能为空", "文章内容不能为空"]
  }'::jsonb,  -- Agent B返回格式规范
  'wechat',  -- 工具名称
  'content_audit',  -- 动作名称
  '{
    "articleTitle": "文章标题，必填",
    "articleContent": "文章内容（HTML或纯文本格式），必填",
    "auditMode": "审核模式，可选值为 full（完整审核）或 simple（快速检查），默认为 full"
  }'::jsonb,  -- 参数含义说明
  '{
    "articleTitle": "保险理财产品推荐指南",
    "articleContent": "<p>本文介绍如何科学配置保险理财产品...</p>",
    "auditMode": "full"
  }'::jsonb,  -- 参数示例
  '{
    "articleTitle": "{{article_title}}",
    "articleContent": "{{article_content}}",
    "auditMode": "full"
  }'::jsonb,  -- 参数模板
  ARRAY['wechat', 'compliance', 'content_audit', 'insurance', 'pre_publish', 'risk_check'],  -- 场景标签
  '{
    "success": true,
    "data": {
      "approved": false,
      "riskLevel": "high",
      "issues": [
        "使用了保险行业敏感用语：保本、保证收益",
        "使用了绝对化用语：最佳、第一"
      ],
      "suggestions": [
        "建议避免使用违规承诺类用语，遵守保险行业监管规定",
        "建议避免使用绝对化用语，使用更客观的表述"
      ],
      "referencedRules": [
        "《保险营销宣传行为监管规定》第X条",
        "《广告法》第X条"
      ],
      "auditTime": "2024-01-15T10:30:00Z"
    },
    "executionTime": "2024-01-15T10:30:00Z"
  }'::jsonb,  -- 输出样例
  ARRAY['agent_b', 'Agent B', 'B', 'insurance-d', 'agent-d'],  -- 支持的Agent列表
  '{
    "agent_b": {
      "auto_invoke": true,
      "invoke_conditions": {
        "before_publish": "发布前必须调用",
        "risk_threshold": "medium"
      }
    }
  }'::jsonb  -- Agent专属参数配置
)
ON CONFLICT (id) DO UPDATE SET
  capability_type = EXCLUDED.capability_type,
  function_desc = EXCLUDED.function_desc,
  status = EXCLUDED.status,
  requires_on_site_execution = EXCLUDED.requires_on_site_execution,
  metadata = EXCLUDED.metadata,
  interface_schema = EXCLUDED.interface_schema,
  agent_response_spec = EXCLUDED.agent_response_spec,
  tool_name = EXCLUDED.tool_name,
  action_name = EXCLUDED.action_name,
  param_desc = EXCLUDED.param_desc,
  param_examples = EXCLUDED.param_examples,
  param_template = EXCLUDED.param_template,
  scene_tags = EXCLUDED.scene_tags,
  example_output = EXCLUDED.example_output,
  supported_agents = EXCLUDED.supported_agents,
  agent_specific_params = EXCLUDED.agent_specific_params,
  updated_at = NOW();

-- ============================================
-- 能力 2：微信公众号内容合规审核（快速检查）
-- 能力 ID：21
-- ============================================
INSERT INTO capability_list (
  id,
  capability_type,
  function_desc,
  status,
  requires_on_site_execution,
  metadata,
  interface_schema,
  agent_response_spec,
  tool_name,
  action_name,
  param_desc,
  param_examples,
  param_template,
  scene_tags,
  example_output,
  supported_agents,
  agent_specific_params
) VALUES (
  21,
  'content_audit_simple',  -- 能力类型
  '微信公众号内容合规审核（快速检查）- 基于关键词匹配快速检查文章合规性，适用于快速筛查场景',  -- 功能描述
  'available',  -- 状态：可用
  false,  -- 不需要现场执行
  '{
    "category": "compliance",
    "industry": "insurance",
    "tech_stack": "keyword_matching",
    "description": "基于关键词匹配快速检查微信公众号内容合规性",
    "capability_id": 21,
    "audit_mode": "simple"
  }'::jsonb,  -- 元数据
  '{
    "type": "object",
    "properties": {
      "articleContent": {
        "type": "string",
        "description": "文章内容（HTML或纯文本）"
      }
    },
    "required": ["articleContent"]
  }'::jsonb,  -- 接口Schema
  '{
    "trigger_key": "call_mcp_meth_status",
    "trigger_value": "ready_to_execute",
    "required_params": [
      {
        "param_name": "articleContent",
        "param_type": "string",
        "example_value": "<p>重疾险是重要的保障工具...</p>",
        "desc": "文章内容"
      }
    ],
    "response_example": {
      "approved": true,
      "riskLevel": "low",
      "summary": "文章内容合规，未发现明显违规问题",
      "auditTime": "2024-01-15T10:30:00Z"
    },
    "constraints": ["文章内容不能为空"]
  }'::jsonb,  -- Agent B返回格式规范
  'wechat',  -- 工具名称
  'content_audit_simple',  -- 动作名称
  '{
    "articleContent": "文章内容（HTML或纯文本格式），必填"
  }'::jsonb,  -- 参数含义说明
  '{
    "articleContent": "<p>本文介绍如何科学配置保险理财产品...</p>"
  }'::jsonb,  -- 参数示例
  '{
    "articleContent": "{{article_content}}"
  }'::jsonb,  -- 参数模板
  ARRAY['wechat', 'compliance', 'content_audit', 'quick_check', 'simple'],  -- 场景标签
  '{
    "success": true,
    "data": {
      "approved": false,
      "riskLevel": "medium",
      "summary": "发现 2 个潜在问题，请查看详细审核结果",
      "auditTime": "2024-01-15T10:30:00Z"
    },
    "executionTime": "2024-01-15T10:30:00Z"
  }'::jsonb,  -- 输出样例
  ARRAY['agent_b', 'Agent B', 'B', 'insurance-d', 'agent-d'],  -- 支持的Agent列表
  '{
    "agent_b": {
      "auto_invoke": false,
      "invoke_conditions": {
        "quick_screening": "快速筛查场景使用"
      }
    }
  }'::jsonb  -- Agent专属参数配置
)
ON CONFLICT (id) DO UPDATE SET
  capability_type = EXCLUDED.capability_type,
  function_desc = EXCLUDED.function_desc,
  status = EXCLUDED.status,
  requires_on_site_execution = EXCLUDED.requires_on_site_execution,
  metadata = EXCLUDED.metadata,
  interface_schema = EXCLUDED.interface_schema,
  agent_response_spec = EXCLUDED.agent_response_spec,
  tool_name = EXCLUDED.tool_name,
  action_name = EXCLUDED.action_name,
  param_desc = EXCLUDED.param_desc,
  param_examples = EXCLUDED.param_examples,
  param_template = EXCLUDED.param_template,
  scene_tags = EXCLUDED.scene_tags,
  example_output = EXCLUDED.example_output,
  supported_agents = EXCLUDED.supported_agents,
  agent_specific_params = EXCLUDED.agent_specific_params,
  updated_at = NOW();

-- ============================================
-- 验证插入结果
-- ============================================
SELECT 
  id,
  capability_type,
  function_desc,
  status,
  tool_name,
  action_name,
  scene_tags
FROM capability_list 
WHERE id IN (20, 21)
ORDER BY id;

-- ============================================
-- 添加表注释
-- ============================================
COMMENT ON TABLE capability_list IS 'Agent MCP能力列表，存储所有可用的MCP能力配置';

-- ============================================
-- 微信公众号合规审核 MCP 能力配置修正脚本
-- ============================================
-- 说明：修正 capability_list 表中 ID=20,21 的配置
--       使其与代码实现保持一致
-- 
-- 执行前检查：请先查询现有配置确认需要修正
-- SELECT id, capability_type, agent_response_spec FROM capability_list WHERE id IN (20, 21);
-- ============================================

-- ============================================
-- 修正能力 20：微信公众号内容合规审核（完整审核）
-- ============================================
UPDATE capability_list SET
  capability_type = 'content_audit',
  function_desc = '微信公众号内容合规审核（RAG + LLM）- 基于向量库检索合规规则，对文章进行完整合规审核，适用于保险行业内容发布前的合规审查',
  status = 'available',
  requires_on_site_execution = false,
  metadata = '{
    "category": "compliance",
    "industry": "insurance",
    "tech_stack": "rag_vector_search",
    "dataset_name": "compliance_rules",
    "description": "利用RAG向量库中的合规规则对微信公众号文章进行智能合规审核",
    "capability_id": 20,
    "audit_mode": "full"
  }'::jsonb,
  interface_schema = '{
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
  }'::jsonb,
  agent_response_spec = '{
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
        "example_value": "重疾险是重要的保障工具，建议根据个人需求选择...",
        "desc": "文章内容"
      },
      {
        "param_name": "auditMode",
        "param_type": "string",
        "example_value": "full",
        "desc": "审核模式：full（完整审核）或 simple（快速检查）",
        "optional": true
      }
    ],
    "response_example": {
      "call_mcp_meth_status": "ready_to_execute",
      "articleTitle": "保险知识科普：如何选择适合自己的重疾险",
      "articleContent": "重疾险是重要的保障工具...",
      "auditMode": "full"
    },
    "constraints": [
      "trigger_value 必须是字符串 'ready_to_execute'",
      "必须返回 articleTitle 和 articleContent 参数",
      "auditMode 可选，不传默认为 full"
    ]
  }'::jsonb,
  tool_name = 'wechat_compliance',
  action_name = 'content_audit',
  param_desc = '{
    "articleTitle": "文章标题，必填",
    "articleContent": "文章内容（HTML或纯文本格式），必填",
    "auditMode": "审核模式：full（完整审核）或 simple（快速检查），默认为 full"
  }'::jsonb,
  param_examples = '{
    "articleTitle": "保险理财产品推荐指南",
    "articleContent": "本文介绍如何科学配置保险理财产品...",
    "auditMode": "full"
  }'::jsonb,
  param_template = '{
    "articleTitle": "{{article_title}}",
    "articleContent": "{{article_content}}",
    "auditMode": "full"
  }'::jsonb,
  scene_tags = ARRAY['wechat', 'compliance', 'content_audit', 'insurance', 'pre_publish', 'risk_check'],
  example_output = '{
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
        "《保险营销宣传行为监管规定》",
        "《广告法》"
      ],
      "auditTime": "2024-01-15T10:30:00Z"
    },
    "executionTime": "2024-01-15T10:30:00Z"
  }'::jsonb,
  supported_agents = ARRAY['agent_b', 'Agent B', 'B', 'insurance-d', 'agent-d'],
  agent_specific_params = '{
    "agent_b": {
      "auto_invoke": true,
      "invoke_conditions": {
        "before_publish": "发布前必须调用",
        "risk_threshold": "medium"
      }
    }
  }'::jsonb,
  updated_at = NOW()
WHERE id = 20;

-- ============================================
-- 修正能力 21：微信公众号内容合规审核（快速检查）
-- ============================================
UPDATE capability_list SET
  capability_type = 'content_audit_simple',
  function_desc = '微信公众号内容合规审核（快速检查）- 基于关键词匹配快速检查文章合规性，适用于快速筛查场景',
  status = 'available',
  requires_on_site_execution = false,
  metadata = '{
    "category": "compliance",
    "industry": "insurance",
    "tech_stack": "keyword_matching",
    "description": "基于关键词匹配快速检查微信公众号内容合规性",
    "capability_id": 21,
    "audit_mode": "simple"
  }'::jsonb,
  interface_schema = '{
    "type": "object",
    "properties": {
      "articleContent": {
        "type": "string",
        "description": "文章内容（HTML或纯文本）"
      }
    },
    "required": ["articleContent"]
  }'::jsonb,
  agent_response_spec = '{
    "trigger_key": "call_mcp_meth_status",
    "trigger_value": "ready_to_execute",
    "required_params": [
      {
        "param_name": "articleContent",
        "param_type": "string",
        "example_value": "重疾险是重要的保障工具...",
        "desc": "文章内容"
      }
    ],
    "response_example": {
      "call_mcp_meth_status": "ready_to_execute",
      "articleContent": "重疾险是重要的保障工具..."
    },
    "constraints": [
      "trigger_value 必须是字符串 'ready_to_execute'",
      "必须返回 articleContent 参数"
    ]
  }'::jsonb,
  tool_name = 'wechat_compliance',
  action_name = 'content_audit_simple',
  param_desc = '{
    "articleContent": "文章内容（HTML或纯文本格式），必填"
  }'::jsonb,
  param_examples = '{
    "articleContent": "本文介绍如何科学配置保险理财产品..."
  }'::jsonb,
  param_template = '{
    "articleContent": "{{article_content}}"
  }'::jsonb,
  scene_tags = ARRAY['wechat', 'compliance', 'content_audit', 'quick_check', 'simple'],
  example_output = '{
    "success": true,
    "data": {
      "approved": false,
      "riskLevel": "medium",
      "summary": "发现 2 个潜在问题，请查看详细审核结果",
      "auditTime": "2024-01-15T10:30:00Z"
    },
    "executionTime": "2024-01-15T10:30:00Z"
  }'::jsonb,
  supported_agents = ARRAY['agent_b', 'Agent B', 'B', 'insurance-d', 'agent-d'],
  agent_specific_params = '{
    "agent_b": {
      "auto_invoke": false,
      "invoke_conditions": {
        "quick_screening": "快速筛查场景使用"
      }
    }
  }'::jsonb,
  updated_at = NOW()
WHERE id = 21;

-- ============================================
-- 验证更新结果
-- ============================================
SELECT 
  id,
  capability_type,
  function_desc,
  status,
  tool_name,
  action_name,
  scene_tags,
  agent_response_spec->>'trigger_key' as trigger_key,
  agent_response_spec->>'trigger_value' as trigger_value
FROM capability_list 
WHERE id IN (20, 21)
ORDER BY id;

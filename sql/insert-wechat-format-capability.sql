-- ============================================
-- 插入公众号文章格式化能力到 capability_list 表
-- ============================================

-- 公众号文章格式化能力
INSERT INTO capability_list (
  capability_type,
  function_desc,
  status,
  requires_on_site_execution,
  tool_name,
  action_name,
  param_desc,
  interface_schema,
  dedicated_task_type,
  dedicated_task_priority,
  is_primary_for_task,
  scene_tags,
  supported_agents,
  metadata
) VALUES (
  'content_generation',
  '公众号文章格式化：使用 wechat_article.html 模板将合规审核后的文章格式化为公众号适配的 HTML 格式，包含标题、作者、日期、正文等完整排版',
  'available',
  false,
  'wechat_format',
  'format_article',
  'map[
    accountId:string - 账户ID，必填
    title:string - 文章标题，必填
    content:string - 文章内容（纯文本），必填
    author:string - 作者，可选
    date:string - 日期，可选，格式如 "2026年2月1日"
  ]',
  '{
    "type": "object",
    "properties": {
      "accountId": {
        "type": "string",
        "description": "账户ID，必填",
        "required": true
      },
      "title": {
        "type": "string",
        "description": "文章标题，必填",
        "required": true
      },
      "content": {
        "type": "string",
        "description": "文章内容（纯文本），必填",
        "required": true
      },
      "author": {
        "type": "string",
        "description": "作者，可选",
        "required": false
      },
      "date": {
        "type": "string",
        "description": "日期，可选，格式如 \"2026年2月1日\"",
        "required": false
      }
    },
    "required": ["accountId", "title", "content"],
    "description": "公众号文章格式化：使用 wechat_article.html 模板将合规审核后的文章格式化为公众号适配的 HTML 格式"
  }'::jsonb,
  'wechat_format',
  1,
  true,
  ARRAY['公众号发布', '文章格式化', 'wechat_article', '自媒体'],
  ARRAY['agent-b', 'insurance-d'],
  '{
    "version": "1.0",
    "provider": "公众号运营专家",
    "template": "wechat_article.html",
    "apiEndpoint": "/api/tools/wechat/format",
    "notes": "在合规审核后、公众号发布前调用此能力"
  }'::jsonb
);

-- ============================================
-- 验证插入结果
-- ============================================

SELECT 
  id,
  capability_type,
  function_desc,
  tool_name,
  action_name,
  dedicated_task_type,
  is_primary_for_task
FROM capability_list 
WHERE tool_name = 'wechat_format'
ORDER BY id DESC
LIMIT 5;

-- ============================================
-- 插入 capability_list 表数据
-- 保险自媒体微信公众号文章上传功能
-- ============================================

-- 先清理已存在的测试数据（可选）
-- DELETE FROM capability_list WHERE id IN (10, 11);

-- ============================================
-- 1. 微信公众号素材上传（图片）- ID = 11
-- ============================================
INSERT INTO capability_list (
  id,
  capability_type,
  function_desc,
  status,
  requires_on_site_execution,
  tool_name,
  action_name,
  param_examples,
  param_template,
  interface_schema,
  agent_response_spec,
  metadata,
  scene_tags,
  created_at,
  updated_at
) VALUES (
  11,
  'platform_publish',
  '微信公众号素材上传（图片）- 保险自媒体专用',
  'available',
  true,
  'wechat',
  'wechatUploadMedia',
  '{
    "accountId": "insurance-account",
    "mediaType": "image",
    "fileUrl": "https://example.com/insurance-cover.jpg"
  }'::jsonb,
  '{
    "accountId": "{{accountId}}",
    "mediaType": "{{mediaType}}",
    "fileUrl": "{{fileUrl}}",
    "fileBase64": "{{fileBase64}}"
  }'::jsonb,
  '{
    "type": "object",
    "required": ["accountId", "mediaType"],
    "properties": {
      "accountId": {
        "type": "string",
        "description": "微信公众号账号 ID，保险自媒体固定为 insurance-account"
      },
      "mediaType": {
        "type": "string",
        "description": "素材类型，仅支持 image",
        "enum": ["image"]
      },
      "fileUrl": {
        "type": "string",
        "description": "图片文件 URL（fileUrl 和 fileBase64 二选一）"
      },
      "fileBase64": {
        "type": "string",
        "description": "图片文件 Base64 编码（fileUrl 和 fileBase64 二选一）"
      }
    }
  }'::jsonb,
  '{
    "solution_num": "{{id}}",
    "tool_name": "wechat",
    "action_name": "wechatUploadMedia",
    "params": {
      "accountId": "{{accountId}}",
      "mediaType": "{{mediaType}}",
      "fileUrl": "{{fileUrl}}",
      "fileBase64": "{{fileBase64}}"
    },
    "requires_on_site_execution": true,
    "mcp_execution_status": "waiting_execution"
  }'::jsonb,
  '{
    "default_params": {
      "mediaType": "image"
    },
    "business_rules": {
      "image_max_size": "10MB",
      "image_supported_formats": ["jpg", "jpeg", "png", "gif"]
    },
    "timeout": 30000,
    "retry_times": 3
  }'::jsonb,
  ARRAY['保险自媒体', '公众号上传', '素材上传', '封面图'],
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  capability_type = EXCLUDED.capability_type,
  function_desc = EXCLUDED.function_desc,
  status = EXCLUDED.status,
  requires_on_site_execution = EXCLUDED.requires_on_site_execution,
  tool_name = EXCLUDED.tool_name,
  action_name = EXCLUDED.action_name,
  param_examples = EXCLUDED.param_examples,
  param_template = EXCLUDED.param_template,
  interface_schema = EXCLUDED.interface_schema,
  agent_response_spec = EXCLUDED.agent_response_spec,
  metadata = EXCLUDED.metadata,
  scene_tags = EXCLUDED.scene_tags,
  updated_at = NOW();

-- ============================================
-- 2. 微信公众号文章上传（添加草稿）- ID = 10
-- ============================================
INSERT INTO capability_list (
  id,
  capability_type,
  function_desc,
  status,
  requires_on_site_execution,
  tool_name,
  action_name,
  param_examples,
  param_template,
  interface_schema,
  agent_response_spec,
  metadata,
  scene_tags,
  created_at,
  updated_at
) VALUES (
  10,
  'platform_publish',
  '微信公众号文章上传（添加草稿）- 保险自媒体专用',
  'available',
  true,
  'wechat',
  'wechatAddDraft',
  '{
    "accountId": "insurance-account",
    "articles": [
      {
        "title": "2026年保险科普：医疗险避坑指南",
        "author": "保险事业部",
        "digest": "本文详细介绍了医疗险的常见误区和正确选择方法。",
        "content": "<p>### 一、医疗险核心误区</p><p>很多人在购买医疗险时都会遇到一些误区...</p>",
        "content_source_url": "",
        "thumb_media_id": "media_id_789012",
        "show_cover_pic": 1,
        "need_open_comment": 1,
        "only_fans_can_comment": 0
      }
    ]
  }'::jsonb,
  '{
    "accountId": "{{accountId}}",
    "articles": [
      {
        "title": "{{title}}",
        "author": "{{author}}",
        "digest": "{{digest}}",
        "content": "{{content}}",
        "content_source_url": "{{content_source_url}}",
        "thumb_media_id": "{{thumb_media_id}}",
        "show_cover_pic": {{show_cover_pic}},
        "need_open_comment": {{need_open_comment}},
        "only_fans_can_comment": {{only_fans_can_comment}}
      }
    ]
  }'::jsonb,
  '{
    "type": "object",
    "required": ["accountId", "articles"],
    "properties": {
      "accountId": {
        "type": "string",
        "description": "微信公众号账号 ID，保险自媒体固定为 insurance-account"
      },
      "articles": {
        "type": "array",
        "description": "图文消息列表",
        "minItems": 1,
        "maxItems": 8,
        "items": {
          "type": "object",
          "required": ["title", "author", "content", "thumb_media_id"],
          "properties": {
            "title": {
              "type": "string",
              "description": "文章标题（不超过 64 字）",
              "maxLength": 64
            },
            "author": {
              "type": "string",
              "description": "作者（不超过 8 字）",
              "maxLength": 8
            },
            "digest": {
              "type": "string",
              "description": "摘要（不超过 120 字）",
              "maxLength": 120
            },
            "content": {
              "type": "string",
              "description": "正文内容（HTML 格式）"
            },
            "content_source_url": {
              "type": "string",
              "description": "原文链接（可选）"
            },
            "thumb_media_id": {
              "type": "string",
              "description": "封面图片 media_id（必须先调用 wechatUploadMedia 上传）"
            },
            "show_cover_pic": {
              "type": "integer",
              "description": "是否显示封面（0-不显示，1-显示）",
              "enum": [0, 1],
              "default": 1
            },
            "need_open_comment": {
              "type": "integer",
              "description": "是否开启评论（0-不开启，1-开启）",
              "enum": [0, 1],
              "default": 1
            },
            "only_fans_can_comment": {
              "type": "integer",
              "description": "是否只有粉丝可评论（0-否，1-是）",
              "enum": [0, 1],
              "default": 0
            }
          }
        }
      }
    }
  }'::jsonb,
  '{
    "solution_num": "{{id}}",
    "tool_name": "wechat",
    "action_name": "wechatAddDraft",
    "params": {
      "accountId": "{{accountId}}",
      "articles": [
        {
          "title": "{{title}}",
          "author": "{{author}}",
          "digest": "{{digest}}",
          "content": "{{content}}",
          "content_source_url": "{{content_source_url}}",
          "thumb_media_id": "{{thumb_media_id}}",
          "show_cover_pic": {{show_cover_pic}},
          "need_open_comment": {{need_open_comment}},
          "only_fans_can_comment": {{only_fans_can_comment}}
        }
      ]
    },
    "requires_on_site_execution": true,
    "mcp_execution_status": "waiting_execution"
  }'::jsonb,
  '{
    "default_params": {
      "accountId": "insurance-account",
      "articles": [
        {
          "author": "保险事业部",
          "show_cover_pic": 1,
          "need_open_comment": 1,
          "only_fans_can_comment": 0
        }
      ]
    },
    "business_rules": {
      "title_max_length": 64,
      "author_max_length": 8,
      "digest_max_length": 120,
      "content_max_length": 20000,
      "articles_max_count": 8
    },
    "dependencies": {
      "prerequisite_capability_ids": [11],
      "output_bindings": {
        "media_id": "articles[0].thumb_media_id"
      }
    },
    "execution_strategy": {
      "type": "sequential",
      "retry_on_failure": true,
      "max_retries": 3
    },
    "timeout": 30000,
    "retry_times": 3
  }'::jsonb,
  ARRAY['保险自媒体', '公众号上传', '文章发布', '草稿创建'],
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  capability_type = EXCLUDED.capability_type,
  function_desc = EXCLUDED.function_desc,
  status = EXCLUDED.status,
  requires_on_site_execution = EXCLUDED.requires_on_site_execution,
  tool_name = EXCLUDED.tool_name,
  action_name = EXCLUDED.action_name,
  param_examples = EXCLUDED.param_examples,
  param_template = EXCLUDED.param_template,
  interface_schema = EXCLUDED.interface_schema,
  agent_response_spec = EXCLUDED.agent_response_spec,
  metadata = EXCLUDED.metadata,
  scene_tags = EXCLUDED.scene_tags,
  updated_at = NOW();

-- ============================================
-- 查询确认插入结果
-- ============================================
SELECT 
  id,
  capability_type,
  function_desc,
  status,
  tool_name,
  action_name,
  scene_tags,
  created_at
FROM capability_list
WHERE id IN (10, 11)
ORDER BY id;

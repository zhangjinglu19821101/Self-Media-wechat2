-- ========================================
-- 更新 capability_list 表数据，添加接口定义
-- 让 Agent B 可以根据接口信息自主决策和拼装参数
-- ========================================

-- 1. 更新搜索相关能力
UPDATE capability_list SET
  tool_name = 'search',
  action_name = 'webSearch',
  interface_schema = '{
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "搜索查询词",
        "required": true
      },
      "count": {
        "type": "integer",
        "description": "结果数量（默认10，最大50）",
        "minimum": 1,
        "maximum": 50,
        "required": false
      },
      "needContent": {
        "type": "boolean",
        "description": "是否获取完整内容（默认false）",
        "required": false
      },
      "agentId": {
        "type": "string",
        "description": "Agent ID（可选，用于记录）",
        "required": false
      }
    },
    "required": ["query"],
    "description": "网页搜索工具，搜索互联网上的网页内容"
  }'::jsonb,
  param_examples = '{
    "query": "人工智能最新发展",
    "count": 10
  }'::jsonb
WHERE id = 16;

UPDATE capability_list SET
  tool_name = 'search',
  action_name = 'webSearchWithSummary',
  interface_schema = '{
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "搜索查询词",
        "required": true
      },
      "count": {
        "type": "integer",
        "description": "结果数量（默认10，最大50）",
        "minimum": 1,
        "maximum": 50,
        "required": false
      },
      "needContent": {
        "type": "boolean",
        "description": "是否获取完整内容（默认false）",
        "required": false
      },
      "agentId": {
        "type": "string",
        "description": "Agent ID（可选，用于记录）",
        "required": false
      }
    },
    "required": ["query"],
    "description": "网页搜索工具，带AI摘要，搜索互联网并提供摘要"
  }'::jsonb,
  param_examples = '{
    "query": "什么是机器学习",
    "count": 5
  }'::jsonb
WHERE id = 17;

UPDATE capability_list SET
  tool_name = 'search',
  action_name = 'imageSearch',
  interface_schema = '{
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "搜索查询词",
        "required": true
      },
      "count": {
        "type": "integer",
        "description": "结果数量（默认10，最大50）",
        "minimum": 1,
        "maximum": 50,
        "required": false
      },
      "agentId": {
        "type": "string",
        "description": "Agent ID（可选，用于记录）",
        "required": false
      }
    },
    "required": ["query"],
    "description": "图片搜索工具，搜索互联网上的图片"
  }'::jsonb,
  param_examples = '{
    "query": "可爱的猫咪",
    "count": 10
  }'::jsonb
WHERE id = 18;

-- 2. 更新微信公众号相关能力
UPDATE capability_list SET
  tool_name = 'wechat',
  action_name = 'getAccounts',
  interface_schema = '{
    "type": "object",
    "properties": {},
    "required": [],
    "description": "获取可用的微信公众号账号列表"
  }'::jsonb,
  param_examples = '{}'::jsonb
WHERE id = 15;

UPDATE capability_list SET
  tool_name = 'wechat',
  action_name = 'addDraft',
  interface_schema = '{
    "type": "object",
    "properties": {
      "accountId": {
        "type": "string",
        "description": "公众号账号ID",
        "required": true
      },
      "articles": {
        "type": "array",
        "description": "文章列表",
        "required": true,
        "items": {
          "type": "object",
          "properties": {
            "title": {
              "type": "string",
              "description": "文章标题",
              "required": true
            },
            "author": {
              "type": "string",
              "description": "作者（可选）",
              "required": false
            },
            "digest": {
              "type": "string",
              "description": "摘要（可选）",
              "required": false
            },
            "content": {
              "type": "string",
              "description": "文章内容（HTML格式）",
              "required": true
            },
            "contentSourceUrl": {
              "type": "string",
              "description": "原文链接（可选）",
              "required": false
            },
            "thumbMediaId": {
              "type": "string",
              "description": "封面素材ID（可选）",
              "required": false
            },
            "needOpenComment": {
              "type": "integer",
              "description": "是否开启评论（0/1，可选）",
              "required": false
            },
            "onlyFansCanComment": {
              "type": "integer",
              "description": "仅粉丝可评论（0/1，可选）",
              "required": false
            },
            "showCoverPic": {
              "type": "integer",
              "description": "是否显示封面（0/1，可选）",
              "required": false
            }
          },
          "required": ["title", "content"]
        }
      }
    },
    "required": ["accountId", "articles"],
    "description": "添加微信公众号草稿"
  }'::jsonb,
  param_examples = '{
    "accountId": "insurance-account",
    "articles": [
      {
        "title": "测试文章标题",
        "author": "保险科普",
        "digest": "这是文章摘要",
        "content": "<p>这是文章内容</p>",
        "showCoverPic": 0
      }
    ]
  }'::jsonb
WHERE id = 11;

UPDATE capability_list SET
  tool_name = 'wechat',
  action_name = 'getDraftList',
  interface_schema = '{
    "type": "object",
    "properties": {
      "accountId": {
        "type": "string",
        "description": "公众号账号ID",
        "required": true
      },
      "offset": {
        "type": "integer",
        "description": "偏移量（默认0）",
        "required": false
      },
      "count": {
        "type": "integer",
        "description": "数量（默认20）",
        "required": false
      }
    },
    "required": ["accountId"],
    "description": "获取微信公众号草稿列表"
  }'::jsonb,
  param_examples = '{
    "accountId": "insurance-account",
    "offset": 0,
    "count": 20
  }'::jsonb
WHERE id = 12;

UPDATE capability_list SET
  tool_name = 'wechat',
  action_name = 'deleteDraft',
  interface_schema = '{
    "type": "object",
    "properties": {
      "accountId": {
        "type": "string",
        "description": "公众号账号ID",
        "required": true
      },
      "mediaId": {
        "type": "string",
        "description": "草稿素材ID",
        "required": true
      }
    },
    "required": ["accountId", "mediaId"],
    "description": "删除微信公众号草稿"
  }'::jsonb,
  param_examples = '{
    "accountId": "insurance-account",
    "mediaId": "MEDIA_ID_HERE"
  }'::jsonb
WHERE id = 13;

UPDATE capability_list SET
  tool_name = 'wechat',
  action_name = 'uploadMedia',
  interface_schema = '{
    "type": "object",
    "properties": {
      "accountId": {
        "type": "string",
        "description": "公众号账号ID",
        "required": true
      },
      "mediaType": {
        "type": "string",
        "description": "素材类型（目前仅支持image）",
        "enum": ["image"],
        "required": true
      },
      "fileUrl": {
        "type": "string",
        "description": "文件URL（fileUrl或fileBase64二选一）",
        "required": false
      },
      "fileBase64": {
        "type": "string",
        "description": "文件Base64（fileUrl或fileBase64二选一）",
        "required": false
      }
    },
    "required": ["accountId", "mediaType"],
    "description": "上传微信公众号图片素材"
  }'::jsonb,
  param_examples = '{
    "accountId": "insurance-account",
    "mediaType": "image",
    "fileUrl": "https://example.com/image.jpg"
  }'::jsonb
WHERE id = 14;

-- 3. 更新数据获取相关能力
UPDATE capability_list SET
  tool_name = 'data_acquire',
  action_name = 'hotDataCrawler',
  interface_schema = '{
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "搜索查询词",
        "required": true
      },
      "count": {
        "type": "integer",
        "description": "结果数量",
        "required": false
      }
    },
    "required": ["query"],
    "description": "热点数据爬取工具"
  }'::jsonb,
  param_examples = '{
    "query": "今日热点",
    "count": 10
  }'::jsonb
WHERE id = 19;

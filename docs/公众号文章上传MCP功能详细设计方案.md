# 微信公众号文章上传 MCP 功能详细设计方案

## 一、现状分析

### 1.1 已有基础设施

✅ **capability_list 表结构完整**：
- `toolName`: 工具名称
- `actionName`: 动作名称
- `paramExamples`: 参数示例
- `paramTemplate`: 参数模板
- `interfaceSchema`: 接口 Schema（JSON Schema 格式）
- `agentResponseSpec`: Agent B 返回格式规范

✅ **MCP 调用层完整**：
- `genericMCPCall()`: 底层通用 MCP 调用
- `callMCPByCapabilityId()`: 根据 capability_id 调用
- `WechatMCPTools`: 微信公众号 MCP 工具封装

✅ **微信公众号 API 完整**：
- `addDraft()`: 添加草稿
- `uploadMedia()`: 上传素材
- `getDraftList()`: 获取草稿列表

---

## 二、capability_list 表记录设计

### 2.1 微信公众号文章上传（添加草稿）

#### SQL 插入语句

```sql
INSERT INTO capability_list (
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
  created_at,
  updated_at
) VALUES (
  'platform_publish',
  '微信公众号文章上传（添加草稿）',
  'available',
  true,
  'wechat',
  'wechatAddDraft',
  '{
    "accountId": "insurance-account",
    "articles": [
      {
        "title": "测试文章标题",
        "author": "保险事业部",
        "digest": "这是文章摘要",
        "content": "<p>这是文章正文内容</p>",
        "content_source_url": "",
        "thumb_media_id": "media_id_123456",
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
        "description": "微信公众号账号 ID"
      },
      "articles": {
        "type": "array",
        "description": "图文消息列表",
        "items": {
          "type": "object",
          "required": ["title", "author", "content", "thumb_media_id"],
          "properties": {
            "title": {
              "type": "string",
              "description": "文章标题（不超过 64 字）"
            },
            "author": {
              "type": "string",
              "description": "作者（不超过 8 字）"
            },
            "digest": {
              "type": "string",
              "description": "摘要（不超过 120 字）"
            },
            "content": {
              "type": "string",
              "description": "正文内容（HTML 格式，支持的标签：p, br, strong, em, a, img 等）"
            },
            "content_source_url": {
              "type": "string",
              "description": "原文链接"
            },
            "thumb_media_id": {
              "type": "string",
              "description": "封面图片 media_id（需要先调用 uploadMedia 上传）"
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
    "business_rules": {
      "title_max_length": 64,
      "author_max_length": 8,
      "digest_max_length": 120,
      "content_max_length": 20000,
      "articles_max_count": 8
    },
    "timeout": 30000,
    "retry_times": 3
  }'::jsonb,
  NOW(),
  NOW()
);
```

### 2.2 微信公众号素材上传

#### SQL 插入语句

```sql
INSERT INTO capability_list (
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
  created_at,
  updated_at
) VALUES (
  'platform_publish',
  '微信公众号素材上传（图片）',
  'available',
  true,
  'wechat',
  'wechatUploadMedia',
  '{
    "accountId": "insurance-account",
    "mediaType": "image",
    "fileUrl": "https://example.com/image.jpg"
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
        "description": "微信公众号账号 ID"
      },
      "mediaType": {
        "type": "string",
        "description": "素材类型",
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
    "business_rules": {
      "image_max_size": "10MB",
      "image_supported_formats": ["jpg", "jpeg", "png", "gif"]
    },
    "timeout": 30000,
    "retry_times": 3
  }'::jsonb,
  NOW(),
  NOW()
);
```

---

## 三、Agent B 参数传递完整流程

### 3.1 完整流程图

```
1. 执行 Agent 输出能力边界判定
   ↓
   {
     "is_need_mcp": true,
     "problem": "平台发布能力缺失，无微信公众号上传权限",
     "capability_type": "platform_publish"
   }
   ↓
2. SubtaskExecutionEngine 调用 Agent B
   ↓
3. Agent B 查询 capability_list 表
   ↓
4. 返回能力清单给 Agent B
   [
     {
       "id": 10,
       "function_desc": "微信公众号文章上传（添加草稿）",
       "tool_name": "wechat",
       "action_name": "wechatAddDraft",
       "param_examples": {...},
       "param_template": {...},
       "interface_schema": {...}
     },
     {
       "id": 11,
       "function_desc": "微信公众号素材上传（图片）",
       "tool_name": "wechat",
       "action_name": "wechatUploadMedia",
       "param_examples": {...},
       "param_template": {...},
       "interface_schema": {...}
     }
   ]
   ↓
5. Agent B 选定方案（先上传素材，再添加草稿）
   ↓
6. Agent B 根据上下文填充参数
   ↓
7. Agent B 输出选定方案（遵循 agentResponseSpec）

   // 第一步：上传素材
   {
     "solution_num": 11,
     "tool_name": "wechat",
     "action_name": "wechatUploadMedia",
     "params": {
       "accountId": "insurance-account",
       "mediaType": "image",
       "fileUrl": "https://example.com/cover.jpg"
     },
     "requires_on_site_execution": true,
     "mcp_execution_status": "waiting_execution"
   }
   ↓
8. SubtaskExecutionEngine 解析 Agent B 输出
   ↓
9. SubtaskExecutionEngine 调用 MCP 执行器（上传素材）
   ↓
10. 返回执行结果（获取 thumb_media_id）
    {
      "success": true,
      "data": {
        "media_id": "media_id_789012",
        "url": "https://mmbiz.qpic.cn/..."
      }
    }
   ↓
11. Agent B 使用返回的 media_id，继续调用添加草稿
   ↓
12. Agent B 输出添加草稿方案
    {
      "solution_num": 10,
      "tool_name": "wechat",
      "action_name": "wechatAddDraft",
      "params": {
        "accountId": "insurance-account",
        "articles": [
          {
            "title": "保险产品介绍文章",
            "author": "保险事业部",
            "digest": "本文介绍最新的保险产品...",
            "content": "<p>正文内容...</p>",
            "thumb_media_id": "media_id_789012",  // 使用上一步的结果
            "show_cover_pic": 1,
            "need_open_comment": 1,
            "only_fans_can_comment": 0
          }
        ]
      },
      "requires_on_site_execution": true,
      "mcp_execution_status": "waiting_execution"
    }
   ↓
13. SubtaskExecutionEngine 调用 MCP 执行器（添加草稿）
   ↓
14. 返回执行结果
   ↓
15. SubtaskExecutionEngine 更新任务状态为 completed
```

### 3.2 Agent B 输出示例

#### 场景 1：上传素材（第一步）

```json
{
  "solution_num": 11,
  "tool_name": "wechat",
  "action_name": "wechatUploadMedia",
  "params": {
    "accountId": "insurance-account",
    "mediaType": "image",
    "fileUrl": "https://example.com/cover.jpg"
  },
  "requires_on_site_execution": true,
  "mcp_execution_status": "waiting_execution",
  "mcp_return_info": null,
  "dialog_history": null,
  "is_notify_agentA": false
}
```

#### 场景 2：上传素材完成（获取 media_id）

```json
{
  "solution_num": 11,
  "mcp_execution_status": "success",
  "mcp_return_info": {
    "execution_log": "2026-03-02 00:30:00 触发MCP执行，2026-03-02 00:30:10 执行完成",
    "result": {
      "success": true,
      "data": {
        "media_id": "media_id_789012",
        "url": "https://mmbiz.qpic.cn/..."
      }
    },
    "error_msg": ""
  },
  "dialog_history": [
    {
      "interact_num": 1,
      "consultant": "insurance-d",
      "content": "平台发布能力缺失，无微信公众号上传权限"
    },
    {
      "interact_num": 2,
      "consultant": "Agent B",
      "content": "选定11号解决方案，先上传封面图片素材"
    }
  ],
  "is_notify_agentA": false
}
```

#### 场景 3：添加草稿（第二步，使用上一步的 media_id）

```json
{
  "solution_num": 10,
  "tool_name": "wechat",
  "action_name": "wechatAddDraft",
  "params": {
    "accountId": "insurance-account",
    "articles": [
      {
        "title": "保险产品介绍文章",
        "author": "保险事业部",
        "digest": "本文介绍最新的保险产品...",
        "content": "<p>正文内容...</p>",
        "thumb_media_id": "media_id_789012",
        "show_cover_pic": 1,
        "need_open_comment": 1,
        "only_fans_can_comment": 0
      }
    ]
  },
  "requires_on_site_execution": true,
  "mcp_execution_status": "waiting_execution",
  "mcp_return_info": null,
  "dialog_history": null,
  "is_notify_agentA": false
}
```

#### 场景 4：添加草稿完成

```json
{
  "solution_num": 10,
  "mcp_execution_status": "success",
  "mcp_return_info": {
    "execution_log": "2026-03-02 00:30:15 触发MCP执行，2026-03-02 00:30:30 执行完成",
    "result": {
      "success": true,
      "data": {
        "media_id": "media_id_123456",
        "create_time": 1709334630
      }
    },
    "error_msg": ""
  },
  "dialog_history": [
    {
      "interact_num": 1,
      "consultant": "insurance-d",
      "content": "平台发布能力缺失，无微信公众号上传权限"
    },
    {
      "interact_num": 2,
      "consultant": "Agent B",
      "content": "选定11号解决方案，先上传封面图片素材"
    },
    {
      "interact_num": 3,
      "consultant": "Agent B",
      "content": "素材上传成功，获取 media_id: media_id_789012"
    },
    {
      "interact_num": 4,
      "consultant": "Agent B",
      "content": "选定10号解决方案，使用获取的 media_id 添加文章草稿"
    }
  ],
  "is_notify_agentA": false
}
```

---

## 四、关键实现要点总结

### 4.1 capability_list 表设计要点

| 字段名 | 用途 | 公众号上传场景 |
|--------|------|----------------|
| `paramExamples` | 提供参数示例，帮助 Agent B 理解格式 | 展示完整的上传参数示例 |
| `paramTemplate` | 使用 Mustache 模板语法，方便 Agent B 填充参数 | 定义参数结构，使用 `{{variable}}` 占位符 |
| `interfaceSchema` | JSON Schema 格式，用于参数验证和文档生成 | 定义每个字段的类型、必填项、描述 |
| `agentResponseSpec` | 定义 Agent B 输出格式，SubtaskExecutionEngine 解析依据 | 规定返回必须包含 `solution_num`、`tool_name`、`action_name`、`params` |

### 4.2 Agent B 参数传递要点

1. **遵循 `agentResponseSpec` 格式**：Agent B 输出必须包含 `solution_num`、`tool_name`、`action_name`、`params`
2. **状态同步**：需现场执行时，必须包含 `mcp_execution_status`、`mcp_return_info`、`dialog_history`
3. **参数填充**：Agent B 根据上下文和 `paramTemplate` 填充 `params` 字段
4. **多步骤协作**：先上传素材获取 `media_id`，再使用 `media_id` 添加草稿

### 4.3 SubtaskExecutionEngine 解析要点

1. **查询 capability_list 表**：根据 `solution_num` 查询完整的能力定义
2. **提取执行参数**：从 Agent B 输出中提取 `tool_name`、`action_name`、`params`
3. **判断执行方式**：根据 `requires_on_site_execution` 决定同步还是异步执行
4. **状态跟踪**：需现场执行时，跟踪 `mcp_execution_status` 并存储交互记录
5. **结果传递**：将上一步的 MCP 执行结果传递给下一步，实现多步骤协作

---

## 五、下一步行动计划

1. ✅ **输出详细设计方案**（本文件）
2. 🔄 **等待评审确认**
3. 📝 **执行 SQL 插入**：在 capability_list 表中插入两条记录
4. 🧪 **验证功能**：测试 Agent B 是否能正确识别和调用

---

**以上就是完整的详细设计方案！请您评审，确认后我再进行代码改造！**

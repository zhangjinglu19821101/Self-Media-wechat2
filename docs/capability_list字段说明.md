# capability_list 表字段详细说明

## 问题 1：function_desc，action_name，interface_schema 都是方法名吗？

**回答：不是！三个字段的作用完全不同：**

| 字段名 | 作用 | 是不是方法名？ | 示例 |
|--------|------|--------------|------|
| `function_desc` | **功能描述**（给人看的文字说明） | ❌ 不是 | "微信公众号-添加草稿" |
| `action_name` | **MCP 方法名**（给程序调用的） | ✅ **是！** | "addDraft" |
| `interface_schema` | **参数规范**（JSON Schema 格式） | ❌ 不是 | `{ "type": "object", "required": [...] }` |

---

## 问题 2：哪条数据是上传微信公众号文章的？参数分别是什么？

### 答案：两条数据配合使用！

| ID | 功能 | action_name | 作用 |
|----|------|-------------|------|
| **14** | 上传图片素材 | `uploadMedia` | **第一步**：先上传封面图，获取 media_id |
| **11** | 添加文章草稿 | `addDraft` | **第二步**：使用 media_id 上传文章 |

---

## 详细数据说明

### 数据 1：ID = 14（上传图片素材）

```sql
SELECT * FROM capability_list WHERE id = 14;
```

**字段值**：
- `id`: 14
- `function_desc`: "微信公众号-上传图片素材"（描述，给人看）
- `tool_name`: "wechat"（工具名）
- `action_name`: "uploadMedia"（**方法名！** 对应 `WechatMCPTools.uploadMedia()`）
- `param_examples`: 参数示例
  ```json
  {
    "accountId": "insurance-account",
    "mediaType": "image",
    "fileUrl": "https://example.com/image.jpg"
  }
  ```
- `param_template`: 参数模板（省略）
- `interface_schema`: 参数规范（JSON Schema 格式）
- `agent_response_spec`: Agent B 返回格式规范
- `metadata`: 元数据（业务规则等）

---

### 数据 2：ID = 11（添加文章草稿）

```sql
SELECT * FROM capability_list WHERE id = 11;
```

**字段值**：
- `id`: 11
- `function_desc`: "微信公众号-添加草稿"（描述，给人看）
- `tool_name`: "wechat"（工具名）
- `action_name`: "addDraft"（**方法名！** 对应 `WechatMCPTools.addDraft()`）
- `param_examples`: 参数示例
  ```json
  {
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
  }
  ```
- `param_template`: 参数模板（省略）
- `interface_schema`: 参数规范（JSON Schema 格式）
- `agent_response_spec`: Agent B 返回格式规范
- `metadata`: 元数据（业务规则等）

---

## 完整调用流程

### 第一步：调用 ID=14 上传素材

```
Agent B 读取 capability_list (id=14)
    ↓
获取：
  - tool_name = "wechat"
  - action_name = "uploadMedia"
  - param_examples = { accountId, mediaType, fileUrl }
    ↓
生成参数：
  {
    "accountId": "insurance-account",
    "mediaType": "image",
    "fileUrl": "https://example.com/cover.jpg"
  }
    ↓
调用：WechatMCPTools.uploadMedia(params)
    ↓
返回：{ mediaId: "media_id_789012", url: "..." }
```

### 第二步：调用 ID=11 上传文章

```
Agent B 读取 capability_list (id=11)
    ↓
获取：
  - tool_name = "wechat"
  - action_name = "addDraft"
  - param_examples = { accountId, articles: [...] }
    ↓
生成参数（使用上一步的 mediaId）：
  {
    "accountId": "insurance-account",
    "articles": [
      {
        "title": "2026年保险科普：医疗险避坑指南",
        "author": "保险事业部",
        "digest": "...",
        "content": "...",
        "thumb_media_id": "media_id_789012"  ← 使用第一步的结果
      }
    ]
  }
    ↓
调用：WechatMCPTools.addDraft(params)
    ↓
返回：{ media_id: "media_id_123456", create_time: 1709334630 }
```

---

## 快速对照表

| 字段 | 作用 | 示例 |
|------|------|------|
| `id` | 记录 ID | 11, 14 |
| `function_desc` | **功能描述**（人读） | "微信公众号-添加草稿" |
| `tool_name` | 工具名 | "wechat" |
| `action_name` | **MCP 方法名**（程序调用） | "addDraft", "uploadMedia" |
| `param_examples` | **参数示例** | `{ accountId: "...", articles: [...] }` |
| `param_template` | 参数模板 | `{ accountId: "{{accountId}}", ... }` |
| `interface_schema` | **参数规范**（JSON Schema） | `{ type: "object", required: [...] }` |
| `agent_response_spec` | **Agent B 返回格式** | `{ solution_num, tool_name, ... }` |
| `metadata` | **元数据**（业务规则等） | `{ default_params, business_rules, ... }` |

---

## 总结

1. **`action_name` 才是方法名**：
   - ID=14: `action_name = "uploadMedia"` → `WechatMCPTools.uploadMedia()`
   - ID=11: `action_name = "addDraft"` → `WechatMCPTools.addDraft()`

2. **两条数据配合使用**：
   - **先调用 ID=14**（uploadMedia）上传封面图，获取 media_id
   - **再调用 ID=11**（addDraft）使用 media_id 上传文章

3. **其他字段的作用**：
   - `function_desc`: 给人看的描述
   - `param_examples`: 参数示例
   - `interface_schema`: 参数规范（JSON Schema）
   - `agent_response_spec`: Agent B 返回格式
   - `metadata`: 业务规则、默认参数等

# capability_list ID=11 和 ID=14 快速查看

## 📊 两条记录概览

| ID | 功能 | tool_name | action_name | 对应 MCP 方法 |
|----|------|-----------|-------------|--------------|
| **14** | 微信公众号-上传图片素材 | wechat | **uploadMedia** | `WechatMCPTools.uploadMedia()` |
| **11** | 微信公众号-添加草稿 | wechat | **addDraft** | `WechatMCPTools.addDraft()` |

---

## 🔍 ID=14（上传图片素材）详细信息

### 基本信息
- **id**: 14
- **function_desc**: "微信公众号-上传图片素材"
- **tool_name**: "wechat"
- **action_name**: "uploadMedia" ← **这是方法名！**
- **status**: "active"

### param_examples（参数示例）
```json
{
    "fileUrl": "https://example.com/image.jpg",
    "accountId": "insurance-account",
    "mediaType": "image"
}
```

### 调用示例
```typescript
const result = await WechatMCPTools.uploadMedia({
  accountId: "insurance-account",
  mediaType: "image",
  fileUrl: "https://example.com/cover.jpg"
});

// 返回：{ mediaId: "media_id_789012", url: "..." }
```

---

## 🔍 ID=11（添加草稿）详细信息

### 基本信息
- **id**: 11
- **function_desc**: "微信公众号-添加草稿"
- **tool_name**: "wechat"
- **action_name**: "addDraft" ← **这是方法名！**
- **status**: "active"

### param_examples（参数示例）
```json
{
    "articles": [
        {
            "title": "测试文章标题",
            "author": "保险科普",
            "digest": "这是文章摘要",
            "content": "<p>这是文章内容</p>",
            "showCoverPic": 0
        }
    ],
    "accountId": "insurance-account"
}
```

### 调用示例
```typescript
const result = await WechatMCPTools.addDraft({
  accountId: "insurance-account",
  articles: [
    {
      title: "2026年保险科普：医疗险避坑指南",
      author: "保险事业部",
      digest: "本文详细介绍...",
      content: "<p>### 一、医疗险核心误区</p>",
      thumbMediaId: "media_id_789012", // ← 用 ID=14 返回的 mediaId
      showCoverPic: 1,
      needOpenComment: 1,
      onlyFansCanComment: 0
    }
  ]
});

// 返回：{ media_id: "media_id_123456", create_time: 1709334630 }
```

---

## 🎯 完整两步流程

### 第一步：调用 ID=14 上传封面图
```typescript
// 1. 从 capability_list 读取 ID=14
//    tool_name = "wechat"
//    action_name = "uploadMedia"

// 2. 调用 MCP
const mediaResult = await WechatMCPTools.uploadMedia({
  accountId: "insurance-account",
  mediaType: "image",
  fileUrl: "https://example.com/cover.jpg"
});

// 3. 获取 media_id
const mediaId = mediaResult.data?.mediaId;
// mediaId = "media_id_789012"
```

### 第二步：调用 ID=11 上传文章
```typescript
// 1. 从 capability_list 读取 ID=11
//    tool_name = "wechat"
//    action_name = "addDraft"

// 2. 调用 MCP（使用第一步的 mediaId）
const draftResult = await WechatMCPTools.addDraft({
  accountId: "insurance-account",
  articles: [
    {
      title: "2026年保险科普：医疗险避坑指南",
      author: "保险事业部",
      content: "<p>### 一、医疗险核心误区</p>",
      thumbMediaId: mediaId, // ← 这里用第一步的结果！
      showCoverPic: 1
    }
  ]
});

// 3. 完成！
const draftMediaId = draftResult.data?.media_id;
```

---

## 📝 快速对照表

### capability_list 字段说明

| 字段 | 作用 | 示例 |
|------|------|------|
| `id` | 记录 ID | 11, 14 |
| `function_desc` | 功能描述（给人看） | "微信公众号-添加草稿" |
| `tool_name` | 工具名 | "wechat" |
| `action_name` | **MCP 方法名**（关键！） | "addDraft", "uploadMedia" |
| `param_examples` | 参数示例 | `{ accountId: "...", articles: [...] }` |
| `param_template` | 参数模板 | - |
| `interface_schema` | 参数规范 | - |
| `agent_response_spec` | Agent B 返回格式 | - |
| `metadata` | 元数据 | - |

---

## 🚀 如何查询

### 方法 1：用视图查询（推荐）
```sql
-- 查询两条记录的基本信息
SELECT id, function_desc, tool_name, action_name
FROM v_capability_list_pretty
WHERE id IN (11, 14)
ORDER BY id;

-- 查询单条记录的完整信息
SELECT * FROM v_capability_list_pretty WHERE id = 11;
SELECT * FROM v_capability_list_pretty WHERE id = 14;
```

### 方法 2：直接查询（如果想看原始 JSON）
```sql
SELECT * FROM capability_list WHERE id = 11;
SELECT * FROM capability_list WHERE id = 14;
```

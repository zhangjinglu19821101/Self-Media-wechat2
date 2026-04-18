# 网页搜索 & 公众号上传 MCP 结果数据过大问题解决方案

> 🎯 **目标**：解决网页搜索、公众号文章上传这两个 MCP 功能导致 interact_content 过大的问题

---

## 📊 问题分析

### 问题 1：网页搜索 MCP

**现状**：
- 完整搜索结果被保存到 `interact_content.response.mcp_attempts[0].result.data.results`
- 通常包含 10-50 条搜索结果，每条包含标题、URL、摘要、完整内容
- **单条记录可达 50-100KB**

**示例**：
```json
{
  "mcp_attempts": [{
    "result": {
      "status": "success",
      "data": {
        "query": "保险行业资讯",
        "total_results": 156,
        "results": [
          {
            "title": "2026年保险监管新政策解读",
            "url": "https://example.com/article1",
            "snippet": "银保监会发布2026年最新监管政策...",
            "full_content": "<html><body>完整的网页内容，可能几十KB...</body></html>"
          }
          // ... 10-50 条类似记录
        ],
        "summary": "根据搜索结果..."
      }
    }
  }]
}
```

---

### 问题 2：公众号文章上传 MCP

**现状**：
- 完整文章内容被保存到 `interact_content.response.mcp_attempts[0].params.articles`
- 包含标题、作者、摘要、完整 HTML 内容
- **单条记录可达 30-80KB**

**示例**：
```json
{
  "mcp_attempts": [{
    "params": {
      "account_id": "insurance-account",
      "articles": [
        {
          "title": "测试文章标题",
          "author": "保险事业部",
          "digest": "文章摘要内容",
          "content": "<h1>完整的文章HTML内容</h1><p>可能包含大量文本和图片...</p>",
          "show_cover_pic": 0
        }
      ]
    },
    "result": {
      "status": "success",
      "data": {
        "media_id": "123456",
        "article_url": "https://mp.weixin.qq.com/...",
        "full_response": { /* 微信API完整响应 */ }
      }
    }
  }]
}
```

---

## 💡 解决方案（3套方案）

---

### 方案 A：数据裁剪 + 元数据记录（推荐⭐ - 快速实施）

**核心理念**：只保存关键信息，裁剪冗余数据，记录元数据用于追溯

#### 实施步骤

**步骤 1：创建数据裁剪工具函数**

```typescript
// src/lib/utils/mcp-result-sanitizer.ts

/**
 * MCP 结果数据裁剪器
 * 针对不同 MCP 类型采用不同的裁剪策略
 */
export class McpResultSanitizer {
  
  /**
   * 裁剪网页搜索结果
   */
  static sanitizeWebSearchResult(rawResult: any): any {
    if (!rawResult) return undefined;

    const {
      query,
      total_results,
      results = [],
      summary
    } = rawResult;

    // 只保留前 3 条搜索结果（用于展示）
    const MAX_RESULTS = 3;
    const truncatedResults = results.slice(0, MAX_RESULTS).map((result: any) => ({
      title: result.title,
      url: result.url,
      snippet: result.snippet?.substring(0, 200) || '', // 限制摘要长度
      // ❌ 移除 full_content 等大字段
    }));

    return {
      query,
      total_results,
      results_truncated: true,
      results_count: results.length,
      results_sample: truncatedResults, // 只保留样本
      summary,
      _meta: {
        original_size_bytes: JSON.stringify(rawResult).length,
        truncated_fields: ['full_content', 'raw_html'],
        truncated_at: new Date().toISOString()
      }
    };
  }

  /**
   * 裁剪公众号上传参数
   */
  static sanitizeWechatUploadParams(rawParams: any): any {
    if (!rawParams) return undefined;

    const {
      account_id,
      articles = []
    } = rawParams;

    // 裁剪文章内容
    const truncatedArticles = articles.map((article: any) => ({
      title: article.title,
      author: article.author,
      digest: article.digest?.substring(0, 100) || '', // 限制摘要长度
      content_preview: article.content?.substring(0, 200) || '', // 只保留预览
      content_length: article.content?.length || 0, // 记录原文长度
      show_cover_pic: article.show_cover_pic,
      // ❌ 移除完整 content 字段
    }));

    return {
      account_id,
      articles: truncatedArticles,
      _meta: {
        original_size_bytes: JSON.stringify(rawParams).length,
        truncated_fields: ['articles[].content'],
        truncated_at: new Date().toISOString()
      }
    };
  }

  /**
   * 裁剪公众号上传结果
   */
  static sanitizeWechatUploadResult(rawResult: any): any {
    if (!rawResult) return undefined;

    const {
      media_id,
      article_url
    } = rawResult;

    return {
      media_id,
      article_url,
      _meta: {
        original_size_bytes: JSON.stringify(rawResult).length,
        truncated_fields: ['full_response', 'errcode', 'errmsg'],
        truncated_at: new Date().toISOString()
      }
    };
  }

  /**
   * 通用裁剪入口
   */
  static sanitize(toolName: string, actionName: string, data: any, type: 'params' | 'result'): any {
    // 根据 MCP 类型选择裁剪策略
    if (toolName === 'web_search') {
      if (type === 'result') {
        return this.sanitizeWebSearchResult(data);
      }
    }

    if (toolName === 'wechat_mp') {
      if (type === 'params') {
        return this.sanitizeWechatUploadParams(data);
      }
      if (type === 'result') {
        return this.sanitizeWechatUploadResult(data);
      }
    }

    // 其他 MCP 类型：默认不裁剪
    return data;
  }
}
```

**步骤 2：修改 subtask-execution-engine.ts**

修改 `executeMcpWithRetry()` 函数：

```typescript
// 导入裁剪器
import { McpResultSanitizer } from '@/lib/utils/mcp-result-sanitizer';

// 在 executeMcpWithRetry() 函数中
private async executeMcpWithRetry(...) {
  // ... 现有代码 ...

  try {
    // 执行 MCP
    const mcpResult = await this.executeCapabilityWithParams(...);

    // 🔥 新增：裁剪 params 和 result
    const sanitizedParams = McpResultSanitizer.sanitize(
      lastDecision.data.mcpParams.toolName,
      lastDecision.data.mcpParams.actionName,
      lastDecision.data.mcpParams.params,
      'params'
    );

    const sanitizedResult = McpResultSanitizer.sanitize(
      lastDecision.data.mcpParams.toolName,
      lastDecision.data.mcpParams.actionName,
      mcpResult.success ? mcpResult.mcpResult : undefined,
      'result'
    );

    // 构建 MCP 尝试记录（使用裁剪后的数据）
    const mcpAttempt: McpAttempt = {
      attemptId,
      attemptNumber: attemptCount,
      timestamp: getCurrentBeijingTime(),
      decision: {
        solutionNum: lastDecision.data.mcpParams.solutionNum,
        toolName: lastDecision.data.mcpParams.toolName,
        actionName: lastDecision.data.mcpParams.actionName,
        reasoning: lastDecision.reasoning,
        strategy: ...,
      },
      params: sanitizedParams,  // ✅ 使用裁剪后的 params
      result: {
        status: mcpResult.success ? 'success' : 'failed',
        data: mcpResult.success ? sanitizedResult : undefined,  // ✅ 使用裁剪后的 result
        error: !mcpResult.success ? { ... } : undefined,
        executionTime,
      },
    };

    // ... 后续代码 ...
  }
}
```

**步骤 3：预期效果**

| MCP 类型 | 裁剪前 | 裁剪后 | 减少比例 |
|---------|--------|--------|---------|
| 网页搜索 | 50-100KB | 5-8KB | **85-90%** ⬇️ |
| 公众号上传 | 30-80KB | 3-5KB | **90-94%** ⬇️ |

---

### 方案 B：分级存储（中期优化）

**核心理念**：
- interact_content 只存摘要（快查表）
- 按需加载完整数据

#### 实施步骤

**步骤 1：创建新表**

```sql
  id BIGSERIAL PRIMARY KEY,
  step_history_id BIGINT NOT NULL REFERENCES agent_sub_tasks_step_history(id),
  attempt_number INT NOT NULL,
  
  -- 数据类型标识
  tool_name VARCHAR(64) NOT NULL,
  action_name VARCHAR(64) NOT NULL,
  data_type VARCHAR(16) NOT NULL, -- 'params' | 'result'
  
  -- 完整数据（压缩存储）
  full_data BYTEA,  -- 使用 PostgreSQL TOAST 自动压缩
  data_format VARCHAR(16) DEFAULT 'json',
  
  -- 元数据
  original_size_bytes INT,
  stored_size_bytes INT,
  compression_ratio NUMERIC(5,2),
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_step_history FOREIGN KEY (step_history_id) 
    REFERENCES agent_sub_tasks_step_history(id) ON DELETE CASCADE
);

```

**步骤 2：修改数据存储逻辑**

```typescript
// 在 subtask-execution-engine.ts 中

// 1. 先保存 step_history（只存摘要）
const stepHistoryId = await this.createInteractionStep(...); // 返回新插入的 ID

await this.saveFullMcpResult(
  stepHistoryId,
  attemptCount,
  toolName,
  actionName,
  'params',
  rawParams  // 原始完整参数
);

await this.saveFullMcpResult(
  stepHistoryId,
  attemptCount,
  toolName,
  actionName,
  'result',
  rawResult  // 原始完整结果
);

// 新增保存完整数据的函数
private async saveFullMcpResult(
  stepHistoryId: number,
  attemptNumber: number,
  toolName: string,
  actionName: string,
  dataType: 'params' | 'result',
  fullData: any
) {
  const jsonData = JSON.stringify(fullData);
  const originalSize = jsonData.length;
  
  // PostgreSQL 会自动压缩 BYTEA
  await db.insert(mcpFullResults).values({
    stepHistoryId,
    attemptNumber,
    toolName,
    actionName,
    dataType,
    fullData: Buffer.from(jsonData),
    originalSizeBytes: originalSize,
    // storedSizeBytes 和 compression_ratio 可以通过触发器自动计算
  });
}
```

**步骤 3：提供按需加载 API**

```typescript
// src/app/api/mcp-full-result/[stepHistoryId]/route.ts

// 获取完整 MCP 结果的 API
export async function GET(
  request: Request,
  { params }: { params: { stepHistoryId: string } }
) {
  const stepHistoryId = parseInt(params.stepHistoryId);
  
  const fullResults = await db
    .select()
    .from(mcpFullResults)
    .where(eq(mcpFullResults.stepHistoryId, stepHistoryId));
  
  // 解压数据
  const results = fullResults.map(row => ({
    ...row,
    fullData: JSON.parse(row.fullData.toString())
  }));
  
  return Response.json({ success: true, data: results });
}
```

---

### 方案 C：对象存储（长期方案）

**核心理念**：
- interact_content 只存最小元数据
- 完整数据存到对象存储（如 S3、阿里云 OSS）
- 通过 URL 访问

#### 实施架构

```
interact_content (小数据)
    ↓ (只有引用)
mcp_result_reference (关联表)
    ↓ (URL)
对象存储 (完整大数据)
```

**优点**：
- ✅ 数据库最小化
- ✅ 无限扩展
- ✅ 支持 CDN 加速
- ✅ 成本低

**缺点**：
- ❌ 实施复杂度高
- ❌ 需要对象存储服务
- ❌ 网络依赖

---

## 🎯 推荐实施路径

### 第一阶段（立即执行）：方案 A
- 实现 `McpResultSanitizer` 裁剪器
- 修改 `subtask-execution-engine.ts`
- **预计收益**：体积减少 85-94%
- **实施时间**：1-2 天

### 第二阶段（1-2周）：方案 A + 监控
- 添加体积监控告警
- 建立数据体积统计
- 根据效果决定是否继续
- **实施时间**：2-3 天

### 第三阶段（可选）：方案 B 或 C
- 如果方案 A 仍不够，再考虑分级存储或对象存储
- **实施时间**：1-2 周

---

## 📊 方案对比总结

| 方案 | 实施难度 | 体积减少 | 成本 | 推荐度 |
|------|---------|---------|------|--------|
| **方案 A：数据裁剪** | ⭐ 简单 | 85-94% | 低 | ⭐⭐⭐⭐⭐ |
| **方案 B：分级存储** | ⭐⭐⭐ 中等 | 95%+ | 中 | ⭐⭐⭐ |
| **方案 C：对象存储** | ⭐⭐⭐⭐⭐ 复杂 | 99%+ | 高 | ⭐⭐ |

---

## ✅ 结论

**推荐立即实施方案 A（数据裁剪）**：
- 实施最快，成本最低
- 可以立即解决 85-94% 的问题
- 不影响现有架构
- 为后续优化留有余地

需要我帮您实施方案 A 的代码吗？

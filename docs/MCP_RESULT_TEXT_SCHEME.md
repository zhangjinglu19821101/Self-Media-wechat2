# MCP 结果文本化完整方案

## 📋 方案概述

采用 **JSON + Schema → LLM → 自然语言** 的完整方案，后续加缓存机制。

---

## 🎯 核心设计原则

1. **LLM 优先**：除特殊情况外，全部走 LLM 生成
2. **缓存优化**：避免重复的 LLM 调用，降低成本
3. **降级策略**：LLM 失败时，自动降级到 JSON 格式
4. **平滑迁移**：保留原有逻辑作为降级方案

---

## 🏗️ 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                    MCP 工具执行结果                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
         ┌───────────────────┴───────────────────┐
         │                                       │
         ▼                                       ▼
┌──────────────────┐                   ┌──────────────────┐
│  有 pre-         │                   │  无 pre-         │
│  formattedSummary│                   │  formattedSummary│
└────────┬─────────┘                   └────────┬─────────┘
         │                                       │
         ▼                                       ▼
┌──────────────────┐                   ┌──────────────────┐
│  直接使用        │                   │  检查缓存        │
└────────┬─────────┘                   └────────┬─────────┘
         │                                       │
         ▼                                       ▼
┌──────────────────┐                   ┌──────────────────┐
│  包装头部返回    │                   │  缓存命中？       │
└────────┬─────────┘                   └────────┬─────────┘
         │                              ┌───────┴───────┐
         │                              ▼               ▼
         │                    ┌──────────────┐ ┌──────────────┐
         │                    │  返回缓存    │ │  检查Schema  │
         │                    └───────┬──────┘ └───────┬──────┘
         │                            │                  │
         │                            ▼                  ▼
         │                    ┌──────────────┐ ┌──────────────┐
         │                    │  缓存结果    │ │  有Schema？   │
         │                    └───────┬──────┘ └───────┬──────┘
         │                            │          ┌───────┴───────┐
         │                            │          ▼               ▼
         │                            │ ┌──────────────┐ ┌──────────────┐
         │                            │ │  调用LLM     │ │  降级JSON    │
         │                            │ └───────┬──────┘ └───────┬──────┘
         │                            │         │                  │
         │                            │         ▼                  │
         │                            │ ┌──────────────┐          │
         │                            │ │  存入缓存    │          │
         │                            │ └───────┬──────┘          │
         │                            │         │                  │
         └────────────────────────────┴─────────┴──────────────────┘
                                                   │
                                                   ▼
                                          ┌──────────────────┐
                                          │  包装头部返回    │
                                          └──────────────────┘
```

---

## 📁 核心文件

| 文件 | 作用 |
|------|------|
| `src/lib/services/mcp-result-text-generator.ts` | 新的生成器核心逻辑 |
| `src/lib/services/subtask-execution-engine.ts` | 集成新生成器（保留降级逻辑） |
| `src/app/api/test/mcp-generator-demo/route.ts` | 测试 API |

---

## 🔧 核心功能

### 1. LLM 生成逻辑

**Prompt 设计：**

```typescript
System Prompt:
你是一个专业的数据解释专家。请将 MCP 工具执行结果转换为流畅、自然、易于理解的自然语言描述。

要求：
1. 用自然语言流畅描述，不要使用 JSON 格式
2. 包含所有关键信息，不要遗漏重要数据
3. 语言简洁明了，适合 AI 助手理解
4. 输出格式：一段连贯的文字，200-400字
5. 不要使用任何 Markdown 格式，纯文本即可

User Prompt:
【工具名称】
web_search

【工具说明】
网络搜索工具，用于获取最新的网络信息

【JSON Schema 说明】
{
  "query": string,              // 搜索关键词
  "totalResults": number,       // 总结果数
  ...
}

【实际 JSON 数据】
{
  "query": "2024年保险行业发展趋势",
  ...
}
```

### 2. 缓存机制

**缓存策略：**

| 配置项 | 值 |
|--------|-----|
| 缓存类型 | 内存 Map |
| 最大缓存条目 | 1000 |
| 过期时间 | 24 小时 |
| 缓存键 | `toolName:actionName:resultStatus:hash(data)` |

**缓存清理策略：**
- FIFO（先进先出）：超过 1000 条时删除最旧的
- TTL（过期时间）：24 小时自动清理

### 3. 降级策略

**降级触发场景：**
1. ❌ 无对应的 Tool Schema
2. ❌ LLM 调用失败
3. ❌ 任何异常错误

**降级逻辑：** 退回到原有的 `JSON.stringify()` 方案

---

## 📊 Tool Schema 定义

目前已配置的工具：

```typescript
{
  'wechat_compliance_auditor': {
    toolName: 'wechat_compliance_auditor',
    description: '微信文章合规审核工具...',
    jsonSchema: '{ ... }'
  },
  'web_search': {
    toolName: 'web_search',
    description: '网络搜索工具...',
    jsonSchema: '{ ... }'
  },
  'data_fetcher': {
    toolName: 'data_fetcher',
    description: '数据获取工具...',
    jsonSchema: '{ ... }'
  }
}
```

**新增工具时：** 在 `MCP_TOOL_SCHEMAS` 中添加配置即可

---

## 🎮 使用方式

### 在 subtask-execution-engine 中

```typescript
// 原来（同步）
const resultText = this.generateMcpResultText(attempt);

// 现在（异步）
const resultText = await this.generateMcpResultText(attempt);
```

### 直接使用生成器

```typescript
import { getMcpResultTextGenerator } from '@/lib/services/mcp-result-text-generator';

const generator = getMcpResultTextGenerator();

const result = await generator.generate({
  toolName: 'web_search',
  actionName: 'search',
  resultStatus: 'success',
  resultData: { ... }
});

if (result.success) {
  console.log(result.text);
  if (result.fromCache) {
    console.log('来自缓存！');
  }
}
```

---

## 📈 统计监控

生成器内置统计功能：

```typescript
const stats = generator.getStats();
/*
{
  totalRequests: 100,      // 总请求数
  cacheHits: 60,          // 缓存命中数
  llmCalls: 35,           // LLM 调用数
  fallbackToJson: 5,       // 降级次数
  cacheHitRate: '60%',     // 缓存命中率
  avgLlmLatencyMs: 1500,   // 平均 LLM 耗时
  cacheStats: {
    size: 80,             // 缓存大小
    hitRate: 2.5           // 平均每条命中次数
  }
}
*/
```

---

## 🔬 测试 API

**测试端点：** `/api/test/mcp-generator-demo`

测试覆盖：
1. ✅ 网络搜索工具（LLM 生成）
2. ✅ 合规校验工具（pre-formattedSummary）
3. ✅ 数据获取工具（LLM 生成）
4. ✅ 未知工具（降级 JSON）
5. ✅ 缓存命中测试

---

## ⚠️ 注意事项

### 性能考虑

| 场景 | 预期耗时 |
|------|---------|
| 缓存命中 | < 10ms |
| LLM 生成 | 1000-3000ms |
| 降级 JSON | < 5ms |

### 成本考虑

- 缓存命中率目标：> 60%
- 建议监控 LLM 调用量
- 可以考虑定期清理缓存

---

## 🚀 后续优化方向

1. **持久化缓存**：目前是内存缓存，重启丢失
   - 可选：Redis 或数据库缓存

2. **智能缓存策略**：
   - 根据工具类型差异化 TTL
   - 热门结果优先保留

3. **Schema 自动生成**：
   - 从 MCP 工具注册信息自动生成 Schema

---

## 📝 总结

| 维度 | 方案特性 |
|------|---------|
| **生成质量** | LLM 优化，自然流畅 |
| **成本控制** | 缓存机制，降低 LLM 调用 |
| **可靠性** | 多重降级策略，保证不失败 |
| **可扩展性** | 新增工具只需加 Schema |
| **可观测性** | 内置统计，便于监控 |

**方案评审完毕！请指示是否可以上线？**

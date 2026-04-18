# LLM 缓存功能详解与实现建议

## 核心答案

### 1. 当前 LLM 支持缓存吗？

**✅ 是的，支持！**

根据 `coze-coding-dev-sdk` 文档，LLM API 支持 **caching 功能**。

---

## 技术细节

### 1.1 API 配置

**参数**：`caching`（在 `LLMConfig` 中）

```typescript
interface LLMConfig {
  model?: string;
  thinking?: 'enabled' | 'disabled';
  caching?: 'enabled' | 'disabled';  // ← 缓存开关
  temperature?: number;
  streaming?: boolean;
}
```

**默认值**：`"disabled"`（默认不启用缓存）

---

### 1.2 使用方式

#### 基本用法

```typescript
import { LLMClient, Config } from 'coze-coding-dev-sdk';

const config = new Config();
const client = new LLMClient(config);

const messages = [
  { role: 'system', content: '你是一个保险专家' },
  { role: 'user', content: '解释一下重疾险' },
];

const response = await client.invoke(messages, {
  caching: 'enabled',  // ← 启用缓存
  temperature: 0.7,
});
```

#### 多轮对话（带 `previousResponseId`）

```typescript
const messages = [
  { role: 'system', content: systemPrompt },
  { role: 'user', content: '什么是 Python 装饰器？' },
];

let responseId: string | undefined;
let firstResponse = '';

// 第 1 轮对话
const stream1 = client.stream(messages, {
  caching: 'enabled',
  temperature: 0.7,
});

for await (const chunk of stream1) {
  if (chunk.content) {
    const text = chunk.content.toString();
    firstResponse += text;
  }
}

// 更新消息历史
messages.push({ role: 'assistant', content: firstResponse });
messages.push({ role: 'user', content: '给个实际例子' });

// 第 2 轮对话（传递 responseId）
const stream2 = client.stream(
  messages,
  {
    caching: 'enabled',
    temperature: 0.7,
  },
  responseId  // ← 这里传递第 1 轮的 responseId
);

for await (const chunk of stream2) {
  if (chunk.content) {
    process.stdout.write(chunk.content.toString());
  }
}
```

---

### 1.3 工作原理

```
第 1 轮调用（启用缓存）
┌─────────────────────────────────────┐
│  client.stream(messages, {          │
│    caching: 'enabled'               │
│  })                                │
└─────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────┐
│  LLM 服务端处理                      │
│  1. 处理请求                        │
│  2. 缓存上下文（system prompt）      │
│  3. 返回 responseId                 │
└─────────────────────────────────────┘
            │
            │ 返回 responseId
            ▼
       [保存 responseId]

第 2 轮调用（传递 responseId）
┌─────────────────────────────────────┐
│  client.stream(                     │
│    messages,                        │
│    { caching: 'enabled' },          │
│    responseId  // ← 使用缓存的上下文│
│  )                                 │
└─────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────┐
│  LLM 服务端处理                      │
│  1. 检查 responseId                 │
│  2. 查找缓存中的上下文               │
│  3. 如果找到：使用缓存（快、便宜）   │
│  4. 如果未找到：重新处理（慢、贵）   │
└─────────────────────────────────────┘
```

---

## 回答你的 3 个问题

### 问题 1：当前我们的这个 LLM 支持缓存吗？

**✅ 是的，支持！**

**证据**：

1. **SDK 文档明确支持**
   ```typescript
   interface LLMConfig {
     caching?: 'enabled' | 'disabled';  // ← 明确支持
   }
   ```

2. **官方示例代码**
   ```typescript
   // Caching for Multi-Turn Conversations
   const stream1 = client.stream(messages, {
     caching: 'enabled',
     temperature: 0.7,
   });
   ```

3. **功能描述**
   ```
   - `"enabled"`: Cache context for faster follow-up responses
   - `"disabled"`: No caching (default)
   ```

---

### 问题 2：缓存可以保存多久？

**⚠️ 文档中没有明确说明！**

**现状**：
- 文档中没有提到缓存的生命周期
- 文档中没有提到缓存失效的时间
- 文档中没有提到缓存的最大存储时间

**推测**：
根据常见的 LLM API 设计，缓存可能是：
1. **会话级别**：基于 `responseId` 的短时间缓存（几分钟到几小时）
2. **上下文级别**：缓存在多轮对话期间有效
3. **有限时间**：可能是 30 分钟到 24 小时不等

**建议**：
- **测试验证**：实际测试缓存持续时间
- **联系技术支持**：向 Coze 技术支持询问具体的缓存生命周期
- **保守假设**：假设缓存只在一个会话内有效（服务重启后失效）

---

### 问题 3：缓存失效了，我们调用的时候知道吗？

**⚠️ 文档中没有明确说明！**

**现状**：
- 文档中没有提到缓存失效的错误处理
- 文档中没有提到如何检测缓存是否命中
- 文档中只说 `previousResponseId` 用于缓存，但没有失败机制

**推测**：
基于常见的 API 设计，可能有以下情况：

#### 可能性 1：透明降级（最可能）
```typescript
// 缓存失效时，API 自动降级到完整处理
const response = await client.invoke(
  messages,
  { caching: 'enabled' },
  responseId  // ← 缓存失效时，自动忽略
);
// 缓存失效 = 完整处理，不会报错
```

#### 可能性 2：错误抛出（不太可能）
```typescript
try {
  const response = await client.invoke(
    messages,
    { caching: 'enabled' },
    expiredResponseId  // ← 缓存失效，抛出错误
  );
} catch (error) {
  // 捕获缓存失效错误
  console.error('缓存失效:', error.message);
}
```

#### 可能性 3：响应中包含缓存状态（不确定）
```typescript
const response = await client.invoke(
  messages,
  { caching: 'enabled' },
  responseId
);

// 检查响应中是否有缓存状态
if (response.cached) {
  console.log('使用了缓存');
} else {
  console.log('未使用缓存（可能是缓存失效或首次请求）');
}
```

**建议**：
1. **测试验证**：实际测试缓存失效时的行为
2. **错误处理**：无论是否抛出错误，都使用 try-catch 包裹
3. **降级机制**：实现本地缓存降级，确保系统稳定

---

## 实现建议

### 方案 1：使用 LLM 缓存 + 本地降级

**优点**：
- ✅ 降低 50-70% Token 消耗（缓存命中时）
- ✅ 提高响应速度（缓存命中时）
- ✅ 本地降级保证系统稳定

**缺点**：
- ⚠️ 缓存生命周期不明确
- ⚠️ 需要管理 `responseId`
- ⚠️ 缓存失效时的行为不确定

**实现代码**：

```typescript
import { LLMClient, Config } from 'coze-coding-dev-sdk';

const config = new Config();
const client = new LLMClient(config);

// 本地缓存（存储 responseId）
const responseIdCache = new Map<string, string>();

/**
 * Agent 自检（带缓存）
 */
export async function agentSelfCheck(agentId: string, task: any) {
  const cacheKey = `${agentId}:${task.taskTitle}`;

  // 加载提示词
  let agentPrompt = '';
  if (hasAgentPrompt(agentId)) {
    agentPrompt = loadAgentPrompt(agentId);
  }

  // 构建消息
  const messages = [
    {
      role: 'system',
      content: `# 你是 Agent ${agentId}\n\n${agentPrompt}`,
    },
    {
      role: 'user',
      content: `
## 当前任务
任务标题：${task.taskTitle}
任务内容：${task.commandContent}

## 你的任务
请基于你的身份和能力边界，检查你是否能执行这个任务。

## 返回格式
\`\`\`json
{
  "hasQuestions": true/false,
  "questions": "如果有疑问，详细描述",
  "resolution": "如果没有疑问，回复：没问题，可以开始"
}
\`\`\`
      `,
    },
  ];

  // 获取 responseId（如果有）
  const previousResponseId = responseIdCache.get(cacheKey);

  try {
    // 调用 LLM（启用缓存）
    const stream = client.stream(
      messages,
      {
        caching: 'enabled',
        temperature: 0.7,
      },
      previousResponseId
    );

    let response = '';
    let newResponseId: string | undefined;

    for await (const chunk of stream) {
      if (chunk.content) {
        response += chunk.content.toString();
        // TODO: 提取 responseId（如果响应中包含）
        // newResponseId = chunk.responseId;
      }
    }

    // 保存 responseId（如果提取成功）
    if (newResponseId) {
      responseIdCache.set(cacheKey, newResponseId);
    }

    return JSON.parse(response);
  } catch (error) {
    console.error('LLM 调用失败:', error);

    // 降级：不使用缓存重试
    try {
      const stream = client.stream(messages, {
        caching: 'disabled',  // ← 降级到不使用缓存
        temperature: 0.7,
      });

      let response = '';

      for await (const chunk of stream) {
        if (chunk.content) {
          response += chunk.content.toString();
        }
      }

      // 清除缓存（可能是缓存失效导致）
      responseIdCache.delete(cacheKey);

      return JSON.parse(response);
    } catch (retryError) {
      console.error('重试失败:', retryError);
      throw retryError;
    }
  }
}
```

---

### 方案 2：本地缓存响应（最简单）

**优点**：
- ✅ 完全可控的缓存生命周期
- ✅ 无需依赖 LLM 缓存机制
- ✅ 缓存命中时成本为 0

**缺点**：
- ❌ 提示词仍然每次都传（但响应不调用 LLM）
- ❌ 无法利用 LLM 的上下文缓存

**实现代码**：

```typescript
const responseCache = new Map<string, { response: any; timestamp: number }>();

const CACHE_TTL = 60 * 60 * 1000; // 1 小时

/**
 * Agent 自检（带本地缓存）
 */
export async function agentSelfCheck(agentId: string, task: any) {
  const cacheKey = `${agentId}:${task.taskTitle}:${task.commandContent}`;

  // 检查缓存
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`✅ 使用本地缓存: ${cacheKey}`);
    return cached.response;
  }

  // 缓存未命中，调用 LLM
  let agentPrompt = '';
  if (hasAgentPrompt(agentId)) {
    agentPrompt = loadAgentPrompt(agentId);
  }

  const messages = [
    {
      role: 'system',
      content: `# 你是 Agent ${agentId}\n\n${agentPrompt}`,
    },
    {
      role: 'user',
      content: `...`,
    },
  ];

  try {
    const stream = client.stream(messages, { temperature: 0.7 });

    let response = '';

    for await (const chunk of stream) {
      if (chunk.content) {
        response += chunk.content.toString();
      }
    }

    const result = JSON.parse(response);

    // 缓存结果
    responseCache.set(cacheKey, {
      response: result,
      timestamp: Date.now(),
    });

    console.log(`✅ 缓存结果: ${cacheKey}`);

    return result;
  } catch (error) {
    console.error('LLM 调用失败:', error);
    throw error;
  }
}
```

---

### 方案 3：混合方案（推荐）

**原理**：
- 第 1 层：本地缓存（最快）
- 第 2 层：LLM 缓存（次快）
- 第 3 层：完整 LLM 调用（最慢）

**实现代码**：

```typescript
// 第 1 层：本地缓存
const localCache = new Map<string, { response: any; timestamp: number }>();
const LOCAL_CACHE_TTL = 60 * 60 * 1000; // 1 小时

// 第 2 层：LLM 缓存 ID
const llmCacheId = new Map<string, string>();

export async function agentSelfCheck(agentId: string, task: any) {
  const cacheKey = `${agentId}:${task.taskTitle}`;

  // 1. 检查本地缓存
  const cached = localCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < LOCAL_CACHE_TTL) {
    console.log('✅ 命中本地缓存');
    return cached.response;
  }

  // 2. 准备 LLM 调用
  let agentPrompt = '';
  if (hasAgentPrompt(agentId)) {
    agentPrompt = loadAgentPrompt(agentId);
  }

  const messages = [
    {
      role: 'system',
      content: `# 你是 Agent ${agentId}\n\n${agentPrompt}`,
    },
    {
      role: 'user',
      content: `...`,
    },
  ];

  // 3. 调用 LLM（带缓存）
  const previousResponseId = llmCacheId.get(cacheKey);

  try {
    const stream = client.stream(
      messages,
      {
        caching: 'enabled',
        temperature: 0.7,
      },
      previousResponseId
    );

    let response = '';
    let newResponseId: string | undefined;

    for await (const chunk of stream) {
      if (chunk.content) {
        response += chunk.content.toString();
        // TODO: 提取 responseId
      }
    }

    const result = JSON.parse(response);

    // 4. 保存到本地缓存
    localCache.set(cacheKey, {
      response: result,
      timestamp: Date.now(),
    });

    // 5. 保存 LLM 缓存 ID
    if (newResponseId) {
      llmCacheId.set(cacheKey, newResponseId);
    }

    console.log(`✅ 缓存到本地 + LLM`);
    return result;
  } catch (error) {
    console.error('LLM 调用失败:', error);

    // 降级：清除缓存，重试
    localCache.delete(cacheKey);
    llmCacheId.delete(cacheKey);

    // 重试（不使用 LLM 缓存）
    const retryStream = client.stream(messages, {
      caching: 'disabled',
      temperature: 0.7,
    });

    let response = '';
    for await (const chunk of retryStream) {
      if (chunk.content) {
        response += chunk.content.toString();
      }
    }

    const result = JSON.parse(response);
    localCache.set(cacheKey, { response: result, timestamp: Date.now() });

    return result;
  }
}
```

---

## 对比总结

| 对比项 | LLM 缓存 | 本地缓存 | 混合缓存 |
|--------|---------|---------|---------|
| **Token 消耗** | 降低 50-70% | 降低 100% | 降低 50-70% |
| **响应速度** | 快（缓存命中） | 最快 | 最快 |
| **缓存生命周期** | ❓ 不明确 | ✅ 明确（可控） | ✅ 明确（可控） |
| **实现复杂度** | 中等 | 简单 | 复杂 |
| **稳定性** | ⚠️ 依赖 LLM 服务 | ✅ 完全可控 | ✅ 降级保证稳定 |
| **推荐度** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

---

## 最终建议

### 短期方案（1-2 天）
**使用本地缓存（方案 2）**

```typescript
const responseCache = new Map<string, { response: any; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 小时
```

**理由**：
- ✅ 简单可靠
- ✅ 完全可控
- ✅ 无需依赖 LLM 缓存机制
- ✅ 效果显著（100% 降本）

---

### 中期方案（1-2 周）
**联系技术支持 + 测试验证**

```typescript
// 1. 测试 LLM 缓存生命周期
// 2. 测试缓存失效时的行为
// 3. 确认 responseId 的提取方式
```

**理由**：
- 获取准确的技术信息
- 验证缓存的实际效果
- 为长期优化做准备

---

### 长期方案（1-2 月）
**实现混合缓存（方案 3）**

```typescript
// 1. 本地缓存（第一层）
// 2. LLM 缓存（第二层）
// 3. 完整调用（第三层）
```

**理由**：
- 最大程度降低成本
- 最快的响应速度
- 最高的系统稳定性

---

## 待确认问题

1. **LLM 缓存生命周期**：联系 Coze 技术支持确认
2. **responseId 提取方式**：查看 SDK 源码或文档
3. **缓存失效行为**：实际测试验证
4. **缓存命中率**：监控和分析

---

## 需要我帮你实现吗？

我可以帮你：
1. ✅ 实现本地缓存方案（方案 2）
2. ✅ 实现混合缓存方案（方案 3）
3. ✅ 编写测试脚本验证 LLM 缓存
4. ✅ 添加监控和日志

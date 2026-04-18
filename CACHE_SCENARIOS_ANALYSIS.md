# 缓存功能适用场景分析

## 📊 当前缓存集成情况

### ✅ 已集成缓存的函数

| 函数 | 缓存实例 | TTL | 用途 | 当前调用场景 |
|------|---------|-----|------|------------|
| `agentSelfCheck()` | `agentSelfCheckCache` | 5 分钟 | Agent 自检是否有疑问 | 定时任务 |
| `splitTaskForAgent()` | `agentTaskSplitCache` | 10 分钟 | Agent 拆分任务为子任务 | - |
| `agentProvideSolution()` | `agentSolutionCache` | 30 分钟 | Agent 提供解决方案 | - |
| `agentAnswerQuestion()` | `agentAnswerCache` | 10 分钟 | Agent 回答问题 | - |

---

## 🎯 当前可用的缓存场景

### 场景 1：定时任务（已使用）✅

**路由**: `/api/cron/check-pending-tasks`

**业务流程**:
1. 每 5 分钟扫描 `status = 'new'` 的任务
2. 调用 `agentSelfCheck()` 检查 Agent 是否有疑问
3. 如果有疑问，等待 Agent A 沟通
4. 如果没有疑问，进入工作状态

**缓存价值**:
- **降本**: 同一个任务可能在多个定时周期中被重复检查，缓存可避免重复调用
- **提速**: 缓存命中时响应时间从秒级降到毫秒级
- **预期降本**: 70-90%

**示例**:
```
00:00 - 任务 T1 状态是 'new' → 调用 agentSelfCheck → LLM 调用 1 次 → 缓存结果
05:00 - 任务 T1 状态仍是 'new' → 调用 agentSelfCheck → ✅ 命中缓存 → 0 次 LLM 调用
10:00 - 任务 T1 状态仍是 'new' → 调用 agentSelfCheck → ✅ 命中缓存 → 0 次 LLM 调用
...
30:00 - 任务 T1 状态变为 'confirmed' → 停止检查
```

---

### 场景 2：任务拆分（未使用，推荐）

**路由**: `/api/commands/split` (推测)

**业务流程**:
1. 任务确认后，需要拆分成具体的执行步骤
2. 调用 `splitTaskForAgent()` 将任务拆分为 3-5 个子任务
3. 子任务分配给不同的执行者

**缓存价值**:
- **降本**: 相同任务可能被多次拆分，缓存可避免重复拆分
- **提速**: 缓存命中时响应时间从秒级降到毫秒级
- **预期降本**: 60-80%

**适用场景**:
- 相同任务的重复拆分
- 批量任务拆分
- 模板化任务

**建议实现**:
```typescript
// 在任务拆分 API 中
export async function POST(request: NextRequest) {
  const { taskId, executorId } = await request.json();
  const task = await getTask(taskId);

  // 调用带缓存的任务拆分
  const subtasks = await splitTaskForAgent(executorId, task);

  return NextResponse.json({ subtasks });
}
```

---

### 场景 3：Agent 协作沟通（未使用，推荐）

**路由**: `/api/agents/B/intervene`

**业务流程**:
1. Agent A 或 Executor 遇到问题时，请求 Agent B 协助
2. Agent B 提供解决方案
3. 多轮沟通直到问题解决

**缓存价值**:
- **降本**: 相同问题的解决方案可以复用
- **提速**: 缓存命中时响应时间从秒级降到毫秒级
- **预期降本**: 50-70%

**适用场景**:
- 常见问题（素材缺失、合规疑问等）
- 标准化解决方案
- 频繁出现的业务问题

**建议实现**:
```typescript
// 在 Agent B 介入 API 中
export async function POST(request: NextRequest) {
  const { commandResultId, executorId } = await request.json();
  const problem = await extractProblem(commandResultId);

  // 调用带缓存的解决方案提供
  const solution = await agentProvideSolution('B', problem, roundNumber);

  return NextResponse.json({ solution });
}
```

---

### 场景 4：Agent 问答（未使用，推荐）

**路由**: `/api/agents/[id]/chat`

**业务流程**:
1. 用户向 Agent 提问
2. Agent 根据提示词回答问题
3. 相同问题可能被多次询问

**缓存价值**:
- **降本**: 常见问题的答案可以复用
- **提速**: 缓存命中时响应时间从秒级降到毫秒级
- **预期降本**: 40-60%

**适用场景**:
- FAQ 类问题
- 常见咨询
- 标准化回答

**建议实现**:
```typescript
// 在 Agent 问答 API 中
export async function POST(request: NextRequest) {
  const { agentId, question } = await request.json();

  // 调用带缓存的问答
  const answer = await agentAnswerQuestion(agentId, question);

  return NextResponse.json({ answer });
}
```

---

## 🔮 未来可扩展的缓存场景

### 场景 5：文章生成（推荐）

**路由**: `/api/articles/generate/trigger`

**业务流程**:
1. 触发文章生成
2. 收集素材、撰写内容、合规检查
3. 生成最终文章

**缓存价值**:
- **降本**: 相同主题的文章可以使用缓存的结构和模板
- **提速**: 缓存命中时响应时间从秒级降到毫秒级
- **预期降本**: 30-50%

**建议实现**:
```typescript
// 创建文章生成缓存
export const articleGenerationCache = new Cache({
  ttl: 30 * 60 * 1000, // 30 分钟
  maxSize: 500,
});

export async function generateArticle(topic: string, requirements: any) {
  const cacheKey = generateCacheKey('article', hashString(topic));
  const cached = articleGenerationCache.get(cacheKey);
  if (cached) return cached;

  const article = await callLLM(...);
  articleGenerationCache.set(cacheKey, article);
  return article;
}
```

---

### 场景 6：知识库搜索（推荐）

**路由**: `/api/knowledge-base/search`

**业务流程**:
1. 搜索知识库
2. 返回相关文档
3. 相同搜索请求可能重复出现

**缓存价值**:
- **降本**: 相同搜索结果可以复用
- **提速**: 缓存命中时响应时间从秒级降到毫秒级
- **预期降本**: 50-70%

**建议实现**:
```typescript
// 创建知识库搜索缓存
export const knowledgeSearchCache = new Cache({
  ttl: 10 * 60 * 1000, // 10 分钟
  maxSize: 1000,
});

export async function searchKnowledge(query: string) {
  const cacheKey = hashString(query);
  const cached = knowledgeSearchCache.get(cacheKey);
  if (cached) return cached;

  const results = await searchInRAG(query);
  knowledgeSearchCache.set(cacheKey, results);
  return results;
}
```

---

### 场景 7：命令执行结果（推荐）

**路由**: `/api/command-results/[resultId]`

**业务流程**:
1. 执行命令
2. 返回执行结果
3. 相同命令可能重复执行

**缓存价值**:
- **降本**: 幂等命令的结果可以复用
- **提速**: 缓存命中时响应时间从秒级降到毫秒级
- **预期降本**: 40-60%

**建议实现**:
```typescript
// 创建命令执行缓存
export const commandResultCache = new Cache({
  ttl: 15 * 60 * 1000, // 15 分钟
  maxSize: 2000,
});

export async function executeCommand(command: string) {
  const cacheKey = hashString(command);
  const cached = commandResultCache.get(cacheKey);
  if (cached) return cached;

  const result = await execute(command);
  commandResultCache.set(cacheKey, result);
  return result;
}
```

---

### 场景 8：规则检查（推荐）

**路由**: `/api/rules/check`

**业务流程**:
1. 检查内容是否符合规则
2. 返回违规点
3. 相同内容可能被多次检查

**缓存价值**:
- **降本**: 相同内容的检查结果可以复用
- **提速**: 缓存命中时响应时间从秒级降到毫秒级
- **预期降本**: 60-80%

**建议实现**:
```typescript
// 创建规则检查缓存
export const ruleCheckCache = new Cache({
  ttl: 5 * 60 * 1000, // 5 分钟
  maxSize: 1000,
});

export async function checkRules(content: string, ruleSet: string) {
  const cacheKey = generateCacheKey('rules', hashString(content), ruleSet);
  const cached = ruleCheckCache.get(cacheKey);
  if (cached) return cached;

  const violations = await checkAgainstRules(content, ruleSet);
  ruleCheckCache.set(cacheKey, violations);
  return violations;
}
```

---

## 📈 缓存优先级建议

### 高优先级（立即实现）

| 场景 | 优先级 | 降本潜力 | 实现难度 |
|------|-------|---------|---------|
| **定时任务** | ✅ 已实现 | 70-90% | 已完成 |
| **任务拆分** | ⭐⭐⭐⭐⭐ | 60-80% | 简单 |
| **Agent 协作沟通** | ⭐⭐⭐⭐⭐ | 50-70% | 简单 |

### 中优先级（近期实现）

| 场景 | 优先级 | 降本潜力 | 实现难度 |
|------|-------|---------|---------|
| **Agent 问答** | ⭐⭐⭐⭐ | 40-60% | 简单 |
| **规则检查** | ⭐⭐⭐⭐ | 60-80% | 中等 |

### 低优先级（可选实现）

| 场景 | 优先级 | 降本潜力 | 实现难度 |
|------|-------|---------|---------|
| **文章生成** | ⭐⭐⭐ | 30-50% | 中等 |
| **知识库搜索** | ⭐⭐⭐ | 50-70% | 中等 |
| **命令执行结果** | ⭐⭐ | 40-60% | 复杂 |

---

## 🚀 实施建议

### 短期计划（1-2 周）

1. **任务拆分缓存**
   - 在任务拆分 API 中集成 `splitTaskForAgent()`
   - 预期降本：60-80%
   - 实现难度：简单

2. **Agent 协作沟通缓存**
   - 在 Agent B 介入 API 中集成 `agentProvideSolution()`
   - 预期降本：50-70%
   - 实现难度：简单

### 中期计划（2-4 周）

3. **Agent 问答缓存**
   - 在 Agent 问答 API 中集成 `agentAnswerQuestion()`
   - 预期降本：40-60%
   - 实现难度：简单

4. **规则检查缓存**
   - 创建规则检查缓存实例
   - 预期降本：60-80%
   - 实现难度：中等

### 长期计划（1-2 月）

5. **文章生成缓存**
   - 创建文章生成缓存实例
   - 预期降本：30-50%
   - 实现难度：中等

6. **知识库搜索缓存**
   - 创建知识库搜索缓存实例
   - 预期降本：50-70%
   - 实现难度：中等

---

## 📊 总体降本预期

| 阶段 | 实现场景 | 预期降本 |
|------|---------|---------|
| **当前** | 定时任务 | 70-90% |
| **短期** | + 任务拆分 + Agent 协作沟通 | + 30-40% |
| **中期** | + Agent 问答 + 规则检查 | + 20-30% |
| **长期** | + 文章生成 + 知识库搜索 | + 10-20% |
| **总体** | 全部实现 | **80-95%** |

---

## ✅ 总结

### 当前可用场景

1. ✅ **定时任务**（已使用）
   - 降低 70-90% 的成本
   - 响应时间从秒级降到毫秒级

### 推荐立即实现

2. ⭐ **任务拆分**
   - 降低 60-80% 的成本
   - 实现难度：简单

3. ⭐ **Agent 协作沟通**
   - 降低 50-70% 的成本
   - 实现难度：简单

### 建议近期实现

4. ⭐ **Agent 问答**
   - 降低 40-60% 的成本
   - 实现难度：简单

5. ⭐ **规则检查**
   - 降低 60-80% 的成本
   - 实现难度：中等

**总体目标：通过缓存实现 80-95% 的降本效果！** 🎯

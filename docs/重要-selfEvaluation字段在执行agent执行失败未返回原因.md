# selfEvaluation 字段在 Agent 执行失败时未返回原因分析

## 问题现象

当 Agent（如 `deai-optimizer`）执行失败时，`agent_sub_tasks_step_history` 表中 `interact_content->'responseContent'->>'selfEvaluation'` 的值为兜底内容：
```
"任务未能完成：原因未知。需要检查任务要求或提供更多信息。"
```

而不是 LLM 实际返回的自我评价内容。

---

## 根因分析

### 数据流转链路

```
LLM 返回 JSON
    ↓
parseExecutorResponse() 解析
    ↓
fillLegacyFields() 字段提取
    ↓
directResult（ExecutorDirectResult）
    ↓
convertExecutorDirectToAgentResult() 转换
    ↓
storedResponseContent（存入数据库）
```

### 断裂点：fillLegacyFields()

**位置**：`src/lib/types/agent-execution-result.ts`

**问题描述**：

LLM 返回的数据结构为：
```json
{
  "isCompleted": false,
  "structuredResult": {
    "briefResponse": "去AI化优化失败，未找到需要优化的文章内容",
    "selfEvaluation": "任务执行失败，原因是前序任务的文章内容未能正确传递"
  }
}
```

`fillLegacyFields` 函数负责将 `structuredResult` 中的字段提取到顶层，但**遗漏了 `briefResponse` 和 `selfEvaluation` 字段**。

**修复前的代码**：
```typescript
export function fillLegacyFields(result: ExecutorDirectResult): ExecutorDirectResult {
  const { structuredResult } = result;
  if (!structuredResult) return result;

  return {
    ...result,
    // 只提取了 result、isCompleted、reason 等字段
    // 缺少 briefResponse 和 selfEvaluation 的提取
  };
}
```

**修复后的代码**：
```typescript
export function fillLegacyFields(result: ExecutorDirectResult): ExecutorDirectResult {
  const { structuredResult } = result;
  if (!structuredResult) return result;

  return {
    ...result,
    briefResponse: result.briefResponse ?? structuredResult.briefResponse,
    selfEvaluation: result.selfEvaluation ?? structuredResult.selfEvaluation,
  };
}
```

### 兜底逻辑触发

**位置**：`src/lib/services/subtask-execution-engine.ts` 的 `convertExecutorDirectToAgentResult()` 方法

当 `directResult.selfEvaluation` 为 `undefined` 且 `isTaskDown === false` 时，触发兜底逻辑：

```typescript
// 如果任务未完成且没有自我评价，添加默认评价
if (!agentResult.isTaskDown && !agentResult.selfEvaluation) {
  agentResult.selfEvaluation = '任务未能完成：原因未知。需要检查任务要求或提供更多信息。';
}
```

---

## 影响范围

此问题影响所有使用 `ExecutorDirectResult` 格式返回的 Agent，包括：
- `deai-optimizer`（去AI化优化）
- `content-writer`（内容撰写）
- `structure-optimizer`（结构优化）
- 其他执行类 Agent

当这些 Agent 执行失败（`isCompleted: false`）时，如果 LLM 在 `structuredResult` 中返回了 `selfEvaluation`，该值无法正确存入数据库。

---

## 修复方案

在 `fillLegacyFields()` 函数中补充 `briefResponse` 和 `selfEvaluation` 字段的提取逻辑：

```typescript
// src/lib/types/agent-execution-result.ts

export function fillLegacyFields(result: ExecutorDirectResult): ExecutorDirectResult {
  const { structuredResult } = result;
  if (!structuredResult) return result;

  return {
    ...result,
    result: result.result ?? structuredResult.result,
    isCompleted: result.isCompleted ?? structuredResult.isCompleted,
    isTaskDown: result.isTaskDown ?? structuredResult.isTaskDown,
    reason: result.reason ?? structuredResult.reason,
    // 新增：提取 briefResponse 和 selfEvaluation
    briefResponse: result.briefResponse ?? structuredResult.briefResponse,
    selfEvaluation: result.selfEvaluation ?? structuredResult.selfEvaluation,
  };
}
```

---

## 相关文件

| 文件路径 | 作用 |
|---------|------|
| `src/lib/types/agent-execution-result.ts` | 定义 ExecutorDirectResult 类型和 fillLegacyFields 函数 |
| `src/lib/services/subtask-execution-engine.ts` | Agent 执行引擎，包含 parseExecutorResponse、convertExecutorDirectToAgentResult |
| `src/lib/agents/prompts/executor-standard-result.md` | Agent 输出格式规范，定义 selfEvaluation 为必填字段 |

---

## 测试验证

修复后，当 Agent 执行失败时，`selfEvaluation` 字段应正确记录 LLM 返回的真实原因：

```sql
SELECT 
  h.id,
  h.interact_content->'responseContent'->>'isCompleted' as is_completed,
  h.interact_content->'responseContent'->>'selfEvaluation' as self_evaluation
FROM agent_sub_tasks_step_history h
WHERE h.interact_user = 'deai-optimizer'
ORDER BY h.interact_time DESC LIMIT 5;
```

预期结果：`self_evaluation` 应为 LLM 返回的具体原因，而非兜底文案。

---

## 记录信息

- **发现时间**：2026-05-03
- **修复时间**：2026-05-03
- **影响版本**：修复前的所有版本
- **修复状态**：已修复

---

## 补充：JSON 解析器提取数组而非对象的问题

### 问题现象（2026-05-03 第二次发现）

LLM 返回了正确的 JSON 对象：
```json
{
  "isCompleted": true,
  "result": "【执行结论】公众号文章去AI化优化已完成，符合所有规则要求",
  "structuredResult": {
    "briefResponse": "我将保留原文核心内容与HTML格式...",
    "selfEvaluation": "已完成去AI化优化..."
  }
}
```

但解析后 `has_isCompleted: false`，`raw_parsed_preview` 显示为数组：
```
["通读全文保留了原始HTML标签和内联样式...","加入了第一人称从业经历..."]
```

### 根因分析

**位置**：`src/lib/utils/json-parser-enhancer.ts` 的 `parseExecutorStandardFormat` 函数

**问题描述**：
`parseExecutorStandardFormat` 函数直接调用 `parseGenericJson`，而 `parseGenericJson` 内部的 `extractGenericJsonString` 可能在某些情况下匹配到响应内部的数组字段（如 `actionsTaken`），而非顶层对象。

**数据流转**：
```
LLM 返回 { isCompleted: true, ... }
    ↓
extractGenericJsonString() 提取
    ↓
错误地返回了 ["通读全文保留了原始HTML标签..."] (内部数组)
    ↓
JSON.parse() 解析出数组
    ↓
'isCompleted' in parsed → false (数组没有 isCompleted 字段)
    ↓
触发兜底逻辑
```

### 修复方案

在 `parseExecutorStandardFormat` 函数中，优先尝试直接解析整个文本为 JSON 对象：

```typescript
static parseExecutorStandardFormat(text: string): GenericParseResult {
  const trimmedText = text.trim();
  
  // 🔴 P0-修复：优先尝试直接解析顶层 JSON 对象
  if (trimmedText.startsWith('{')) {
    // 使用栈匹配找到第一个完整的 JSON 对象
    // ... 栈匹配逻辑 ...
    
    const jsonCandidate = trimmedText.substring(0, endPos + 1);
    const data = JSON.parse(jsonCandidate);
    
    if (typeof data === 'object' && !Array.isArray(data) && 'isCompleted' in data) {
      return { success: true, data };
    }
  }
  
  // 回退到通用解析
  return this.parseGenericJson(text);
}
```

### 关键改进

1. **优先级调整**：先尝试直接解析顶层对象，再回退到通用解析
2. **类型验证**：确保解析结果是对象而非数组
3. **字段检查**：验证 `isCompleted` 字段存在

### 相关文件

| 文件路径 | 作用 |
|---------|------|
| `src/lib/utils/json-parser-enhancer.ts` | JSON 解析增强器，包含 parseExecutorStandardFormat |

---

## 总结

`selfEvaluation` 字段未返回有两个原因：

1. **字段提取遗漏**：`fillLegacyFields()` 函数没有从 `structuredResult` 提取 `selfEvaluation` 到顶层
2. **JSON 解析错误**：`parseExecutorStandardFormat()` 在某些情况下提取到了内部数组而非顶层对象

两个问题均已修复。

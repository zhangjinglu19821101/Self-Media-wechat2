# 🔴 Agent B 决策问题分析报告

## 问题现象

用户反馈：
1. ✅ insurance-d（保险事业部执行 Agent 返回的格式是期望的
2. ❌ 但 Agent B 无法正确决策
3. ❌ Agent B 返回的提示词比 insurance-d 差太多
4. ❌ 怀疑是否因为降级导致的问题

## 问题数据示例：
```json
{
  "question": {
    "isNeedMcp": false,
    "isTaskDown": true
  },
  "response": {
    "decision": {
      "type": "NEED_USER",
      "reasoning": "当前任务是撰写《银行，保险年金险还是增额寿？》公众号文章初稿，但执行Agent未提供任何完成的文章内容...",
      "reason_code": "FORMAT_ADAPTER",
      "final_conclusion": "需要用户介入"
    }
  }
}
```

## 🔴 问题根源分析

### 数据流转链路：

```
insurance-d (执行 Agent)
    ↓ 返回 ExecutorDirectResult (新格式)
    ↓
convertExecutorDirectToAgentResult()  ← 🔴 问题在这里！
    ↓ 转换成 ExecutorAgentResult (旧格式)
    ↓
Agent B 接收到的是旧格式，而不是保险事业部执行 Agent 真正返回的新格式！
```

### 关键问题：

1. **保险事业部执行 Agent 返回了正确的新格式（含 `structuredResult.resultContent）
2. **但 Agent B 看到的是转换后的旧格式
3. **在转换过程中，`executorOutput.draftContent 可能没有正确提取出来
4. **Agent B 的提示词中看不到保险事业部执行 Agent 真正返回的内容！

## 代码位置分析

### 问题1：convertExecutorDirectToAgentResult() 函数

**位置：`src/lib/services/subtask-execution-engine.ts` 第 83-130 行

```typescript
function convertExecutorDirectToAgentResult(
  directResult: ExecutorDirectResult
): ExecutorAgentResult {
  // 🔴 问题：这里的转换逻辑可能有问题！
  // 特别是从 structuredResult 中提取 draftContent 的逻辑
  if (directResult.structuredResult) {
    structuredResult = directResult.structuredResult;
    draftContent = structuredResult.resultContent;  // 🔴 这里提取了
    suggestions = structuredResult.completionJudgment?.suggestions;
  }
  
  // 🔴 问题：最终返回的 agentResult.executorOutput 中确实有 draftContent
  // 但后续传递给 Agent B 时，可能没有正确传递！
}
```

### 问题2：Agent B 提示词构建

**位置**：`callAgentBWithDecision()` 函数中

```typescript
// 🔴 问题：这里构建 executorOutputText 的逻辑
let executorOutputText = '';
if (executionContext.executorFeedback.executorOutput) {
  const eo = executionContext.executorFeedback.executorOutput;
  const parts: string[] = [];
  
  if (eo.draftContent) {
    parts.push('- 初稿/产出内容: ' + eo.draftContent.substring(0, 500) + ...);
  }
  // ...
}
```

**但问题是：**`executionContext.executorFeedback.executorOutput` 这个路径上可能为空！**

## 🔴 根本原因

**数据在某个环节丢失了！让我追踪一下：

1. 执行 Agent 返回 → `ExecutorDirectResult` ✅
2. `convertExecutorDirectToAgentResult()` 转换成 `ExecutorAgentResult` 
3. **保存到 `task.resultData` 
4. **后续从 `task.resultData` 解析回来时，`executorOutput` 没有正确恢复！**

## 建议解决方案

### 方案1：跳过转换，直接用新格式（推荐）

**根本问题**：为什么还要转来转去？直接用保险事业部执行 Agent 返回的新格式不好吗？

**建议**：
- 让 Agent B 直接接收保险事业部执行 Agent 返回的原始新格式
- 跳过 `ExecutorDirectResult` 格式，不需要转换成旧格式
- 这样 Agent B 就能看到保险事业部执行 Agent 真正返回的完整内容了！

### 方案2：修复转换和恢复链路

如果必须保持向后兼容：
1. 确保 `convertExecutorDirectToAgentResult() 正确转换所有字段
2. 确保从 `task.resultData` 解析时，正确恢复 `executorOutput`
3. 添加详细的日志调试，追踪每个环节的数据

## 快速验证方法

添加详细的日志调试：

```typescript
// 在关键位置添加：
console.log('🔴 调试：convertExecutorDirectToAgentResult 输入:', directResult);
console.log('🔴 调试：convertExecutorDirectToAgentResult 输出:', agentResult);

// 以及：
console.log('🔴 调试：保存到 task.resultData 之前:', agentResult);
console.log('🔴 调试：从 task.resultData 解析之后:', parsedExecutorResult);
```

## 总结

**问题不是降级导致的，而是数据转换链路导致的！

保险事业部执行 Agent 返回了正确的格式，但在数据在转换成旧格式、保存、解析的过程中，关键的文章内容没有正确传递给 Agent B！

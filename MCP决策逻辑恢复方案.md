# MCP 决策逻辑恢复方案

## 📋 背景说明

当前我们实施了一个极简方案，修改了 `processGroup` 和 `executeStepTasks` 方法，新增了 `executeExecutorAgentWorkflow` 和 `executeAgentBReviewWorkflow` 方法。但是这个极简方案**缺少 MCP 调用逻辑**，导致：

1. ❌ MCP 合规检测（`wechat_compliance/content_audit`）没有被调用
2. ❌ 其他 MCP 能力也无法被调用

---

## 🎯 恢复目标

保留极简方案的优点（清晰的职责分离、三层验证机制），同时恢复 MCP 决策逻辑。

---

## 📊 当前代码结构分析

### ✅ 已有的好东西（保留）

1. **`executeExecutorAgentWorkflow`** - 执行Agent职责
   - pending → in_progress
   - 能力边界判定
   - 直接执行任务（如果可以）
   - pre_completed / pre_need_support

2. **`executeAgentBReviewWorkflow`** - Agent B 评审职责
   - 只在 pre_completed / pre_need_support 时介入

3. **`handlePreCompletedReview`** - pre_completed 状态评审
   - 三层验证（存在性、长度、关键词匹配）

### ❌ 当前的问题

在 `handlePreCompletedReview` 中，三层验证通过后，直接标记完成，**没有调用 Agent B 和 MCP**！

---

## 🔍 关键分析（用户问得对！）

### `executeCompleteWorkflow` 方法是什么？

`executeCompleteWorkflow` 是**从 `pending` 状态开始的完整端到端流程**，它包括：

1. ✅ 检查历史记录
2. ✅ **执行Agent能力边界判定**（`callExecutorAgent`）- ⚠️ 这步我们已经做了！
3. ✅ Agent B 循环决策
4. ✅ MCP 执行
5. ✅ 用户交互
6. ✅ ...等等

### 我们不需要完整的 `executeCompleteWorkflow`！

因为在我们的极简方案中：
- ✅ `executeExecutorAgentWorkflow` 已经做了执行Agent的工作（`pending` → `in_progress` → `pre_completed`/`pre_need_support`）
- ✅ 我们现在是在 `pre_completed`/`pre_need_support` 状态
- ❌ **我们不需要再从头执行一遍执行Agent的工作！**

---

## ✅ 我们真正需要的是什么？

我们只需要从 `pre_completed`/`pre_need_support` 状态开始的逻辑：

1. ✅ **查询 `capability_list`**
2. ✅ **Agent B 决策逻辑**（提示词中带着 `capability_list`）
3. ✅ **MCP 调用逻辑**
4. ✅ 重试机制
5. ✅ 用户交互

**不需要**：
- ❌ 执行Agent能力边界判定（已经做过了）
- ❌ 从 `pending` 开始的完整流程

---

## 🔧 恢复方案（最终版）

### 核心思路

1. 保留 `executeExecutorAgentWorkflow`（执行Agent职责）
2. 保留三层验证机制
3. **新增一个方法**：`executeAgentBDecisionAndMcp` - 只包含 Agent B 决策 + MCP 调用逻辑
4. 在 `handlePreCompletedReview` 和 `handlePreNeedSupportReview` 中调用这个新方法

---

### 具体修改方案

#### 修改 1：新增 `executeAgentBDecisionAndMcp` 方法

**位置**：`src/lib/services/subtask-execution-engine.ts`

**方法职责**：
- 从 `pre_completed`/`pre_need_support` 状态开始
- 查询 `capability_list`
- Agent B 循环决策（最多5次）
- MCP 执行（支持多次尝试）
- 用户交互处理

**伪代码**：
```typescript
private async executeAgentBDecisionAndMcp(task: typeof agentSubTasks.$inferSelect) {
  console.log('[SubtaskEngine] ========== 开始 Agent B 决策 + MCP 调用 ==========');
  
  const MAX_ITERATIONS = 5;
  const MAX_MCP_ATTEMPTS_PER_ITERATION = 3;
  let currentIteration = 0;
  let mcpExecutionHistory: McpAttempt[] = [];
  let userInteractions: UserInteraction[] = [];
  let capabilities: any[] = [];
  
  // 1. 从 task.executionResult 中解析 executorResult
  const executorResult = this.parseExecutorResult(task.executionResult);
  
  // 2. 查询 capability_list
  capabilities = await this.queryCapabilityList(executorResult.capabilityType);
  
  // 3. Agent B 循环决策（最多5次）
  while (currentIteration < MAX_ITERATIONS) {
    currentIteration++;
    
    // 构建执行上下文
    const executionContext = this.buildExecutionContext(
      task, 
      executorResult, 
      mcpExecutionHistory, 
      userInteractions, 
      capabilities,
      currentIteration,
      MAX_ITERATIONS
    );
    
    // 调用 Agent B 决策
    const agentBDecision = await this.callAgentBWithDecision(
      task, 
      executionContext, 
      capabilities
    );
    
    // 处理决策
    switch (agentBDecision.type) {
      case 'COMPLETE':
        await this.handleCompleteDecision(...);
        return;
      case 'NEED_USER':
        await this.handleNeedUserDecision(...);
        return;
      case 'FAILED':
        await this.handleFailedDecision(...);
        return;
      case 'EXECUTE_MCP':
        const mcpSuccess = await this.executeMcpWithRetry(...);
        if (mcpSuccess) {
          continue; // 继续下一轮决策
        } else {
          continue; // 继续下一轮决策
        }
    }
  }
  
  // 达到最大循环次数
  await this.handleMaxIterationsExceeded(...);
}
```

#### 修改 2：修改 `handlePreCompletedReview` 方法

**位置**：`src/lib/services/subtask-execution-engine.ts`

**修改逻辑**：
- 保留三层验证机制（作为前置检查）
- 三层验证通过后，**调用 `executeAgentBDecisionAndMcp`**（而不是直接标记完成）

**修改前**：
```typescript
// ✅ 所有检查都通过，才标记为 completed
console.log('[SubtaskEngine] 降级逻辑: ========== 所有验证通过！标记为 completed ==========');
const executionResult = task.executionResult ? JSON.parse(task.executionResult) : null;
await this.markTaskCompleted(task, executionResult);
```

**修改后**：
```typescript
// ✅ 所有检查都通过，调用 Agent B 决策 + MCP 调用
console.log('[SubtaskEngine] ========== 三层验证通过！调用 Agent B 决策 + MCP 调用 ==========');
await this.executeAgentBDecisionAndMcp(task);
```

#### 修改 3：修改 `handlePreNeedSupportReview` 方法

**位置**：`src/lib/services/subtask-execution-engine.ts`

**修改逻辑**：
- 直接调用 `executeAgentBDecisionAndMcp`（而不是调用 `executeCompleteWorkflow`）

**修改前**：
```typescript
private async handlePreNeedSupportReview(task: typeof agentSubTasks.$inferSelect) {
  console.log('[SubtaskEngine] Agent B: 调用原有的完整工作流程进行评审');
  await this.executeCompleteWorkflow(task);
}
```

**修改后**：
```typescript
private async handlePreNeedSupportReview(task: typeof agentSubTasks.$inferSelect) {
  console.log('[SubtaskEngine] Agent B: 调用 Agent B 决策 + MCP 调用');
  await this.executeAgentBDecisionAndMcp(task);
}
```

---

## 📝 修改清单

| 文件 | 修改内容 | 优先级 |
|------|---------|--------|
| `src/lib/services/subtask-execution-engine.ts` | 新增 `executeAgentBDecisionAndMcp` 方法 | 🔴 高 |
| `src/lib/services/subtask-execution-engine.ts` | 修改 `handlePreCompletedReview`，调用新方法 | 🔴 高 |
| `src/lib/services/subtask-execution-engine.ts` | 修改 `handlePreNeedSupportReview`，调用新方法 | 🔴 高 |

---

## 🧪 验证清单

修改完成后，需要验证：

1. ✅ `order_index=1` 任务：能正常执行，生成文章草稿
2. ✅ `order_index=2` 任务：能正确获取 `order_index=1` 的结果
3. ✅ **MCP 合规检测被调用**：`wechat_compliance/content_audit` 能被正确调用
4. ✅ 三层验证机制仍然有效：无效结果会被回滚到 `pending`
5. ✅ Agent B 决策逻辑正常工作（提示词中带着 `capability_list`）

---

## 🚨 风险提示

1. **兼容性风险**：修改可能影响现有任务的执行
2. **回滚方案**：如果出现问题，可以 revert 到修改前的版本
3. **测试建议**：先在测试环境验证，再在生产环境实施

---

## 📅 实施计划

1. **方案评审**：等待用户评审此方案
2. **代码修改**：评审通过后，按方案修改代码
3. **测试验证**：修改完成后，进行充分测试
4. **上线部署**：测试通过后，部署到生产环境






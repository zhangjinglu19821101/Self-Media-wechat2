
# executeExecutorAgentWorkflow 改动范围

## 🎯 改动目标

**去掉能力边界判定层，让执行 Agent 直接执行任务！**

---

## 📋 当前逻辑 vs 新逻辑对比

### 当前逻辑（约 130 行代码）

```typescript
private async executeExecutorAgentWorkflow(task) {
  // 1. pending → in_progress
  // 2. 获取 previousResult
  
  // ====== 能力边界判定层（要去掉！）======
  // 3. 先做能力边界判定
  const capabilityCheckResult = await this.callExecutorAgent(task, previousResult);
  
  let finalExecutionResult: any = null;
  
  // 4. 如果判定任务可以直接完成，则真正执行任务
  if (!capabilityCheckResult.isNeedMcp &amp;&amp; capabilityCheckResult.isTaskDown) {
    const directResult = await this.callExecutorAgentDirectly(task, previousResult);
    if (directResult.isCompleted) {
      finalExecutionResult = directResult.result;
    } else {
      // 降级逻辑
      capabilityCheckResult.isNeedMcp = true;
      capabilityCheckResult.isTaskDown = false;
      capabilityCheckResult.problem = directResult.suggestion;
    }
  }
  // ==========================================
  
  // 5. 保存结果到数据库
  let resultToSave: any;
  if (!capabilityCheckResult.isNeedMcp &amp;&amp; capabilityCheckResult.isTaskDown) {
    resultToSave = finalExecutionResult;
  } else {
    resultToSave = capabilityCheckResult;
  }
  
  // 6. 更新状态
  if (!capabilityCheckResult.isNeedMcp &amp;&amp; capabilityCheckResult.isTaskDown) {
    status: 'pre_completed'
  } else {
    status: 'pre_need_support'
  }
}
```

### 新逻辑（约 50 行代码）

```typescript
private async executeExecutorAgentWorkflow(task) {
  // 1. pending → in_progress（保持不变）
  // 2. 获取 previousResult（保持不变）
  
  // ====== 直接执行！（核心改动）======
  // 3. 直接调用执行 Agent 执行任务，不做能力判定！
  const executorResult = await this.callExecutorAgentDirectly(task, previousResult);
  // ==========================================
  
  // 4. 保存结果到数据库（简化）
  const resultToSave = executorResult;
  
  // 5. 更新状态（简化）
  if (executorResult.isCompleted) {
    status: 'pre_completed'
  } else {
    status: 'pre_need_support'
  }
}
```

---

## 🔧 具体改动清单

### 改动 1：去掉能力边界判定调用

**位置**：`src/lib/services/subtask-execution-engine.ts`

**删除代码**（约 30 行）：
```typescript
// ❌ 删除：先做能力边界判定
const capabilityCheckResult = await this.callExecutorAgent(task, previousResult);
console.log('[SubtaskEngine] 能力边界判定结果:', capabilityCheckResult);

let finalExecutionResult: any = null;

// ❌ 删除：如果判定任务可以直接完成，则真正执行任务
if (!capabilityCheckResult.isNeedMcp &amp;&amp; capabilityCheckResult.isTaskDown) {
  console.log('[SubtaskEngine] 任务可直接完成，调用执行Agent真正执行任务');
  const directResult = await this.callExecutorAgentDirectly(task, previousResult);
  console.log('[SubtaskEngine] 执行Agent直接执行结果:', directResult);
  
  if (directResult.isCompleted) {
    finalExecutionResult = directResult.result;
  } else {
    // 如果直接执行失败，则降级为需要帮助
    console.log('[SubtaskEngine] 执行Agent直接执行失败，降级为需要帮助');
    capabilityCheckResult.isNeedMcp = true;
    capabilityCheckResult.isTaskDown = false;
    capabilityCheckResult.problem = directResult.suggestion || '执行Agent无法完成任务';
  }
}
```

**新增代码**（约 5 行）：
```typescript
// ✅ 新增：直接调用执行 Agent 执行任务
console.log('[SubtaskEngine] 执行Agent: 直接执行任务（跳过能力判定）');
const executorResult = await this.callExecutorAgentDirectly(task, previousResult);
console.log('[SubtaskEngine] 执行Agent执行结果:', executorResult);
```

---

### 改动 2：简化结果保存逻辑

**删除代码**（约 10 行）：
```typescript
// ❌ 删除：根据不同情况保存不同的结果
let resultToSave: any;
if (!capabilityCheckResult.isNeedMcp &amp;&amp; capabilityCheckResult.isTaskDown) {
  // 任务完成：保存最终结果
  resultToSave = finalExecutionResult;
  console.log('[SubtaskEngine] 保存任务完成结果:', resultToSave);
} else {
  // 需要帮助：保存 capabilityCheckResult！
  resultToSave = capabilityCheckResult;
  console.log('[SubtaskEngine] 保存需要帮助结果:', resultToSave);
}
```

**新增代码**（约 3 行）：
```typescript
// ✅ 新增：直接保存执行结果
const resultToSave = executorResult;
console.log('[SubtaskEngine] 保存执行结果:', resultToSave);
```

---

### 改动 3：简化状态更新逻辑

**删除代码**（约 10 行）：
```typescript
// ❌ 删除：根据 capabilityCheckResult 更新状态
if (!capabilityCheckResult.isNeedMcp &amp;&amp; capabilityCheckResult.isTaskDown) {
  console.log('[SubtaskEngine] 执行Agent: 任务完成 → pre_completed');
  await db
    .update(agentSubTasks)
    .set({
      status: 'pre_completed',
      updatedAt: getCurrentBeijingTime(),
    })
    .where(eq(agentSubTasks.id, task.id));
} else {
  console.log('[SubtaskEngine] 执行Agent: 需要帮助 → pre_need_support');
  await db
    .update(agentSubTasks)
    .set({
      status: 'pre_need_support',
      updatedAt: getCurrentBeijingTime(),
    })
    .where(eq(agentSubTasks.id, task.id));
}
```

**新增代码**（约 10 行）：
```typescript
// ✅ 新增：根据 executorResult 更新状态
if (executorResult.isCompleted) {
  console.log('[SubtaskEngine] 执行Agent: 任务完成 → pre_completed');
  await db
    .update(agentSubTasks)
    .set({
      status: 'pre_completed',
      updatedAt: getCurrentBeijingTime(),
    })
    .where(eq(agentSubTasks.id, task.id));
} else {
  console.log('[SubtaskEngine] 执行Agent: 需要帮助 → pre_need_support');
  await db
    .update(agentSubTasks)
    .set({
      status: 'pre_need_support',
      updatedAt: getCurrentBeijingTime(),
    })
    .where(eq(agentSubTasks.id, task.id));
}
```

---

## 📊 改动统计

| 指标 | 数值 |
|-----|------|
| **删除代码行数** | ~50 行 |
| **新增代码行数** | ~18 行 |
| **净减少代码** | ~32 行 |
| **方法简化** | 从 ~130 行 → ~80 行 |
| **涉及文件** | 1 个文件 |

---

## ⚠️ 需要注意的依赖

### 1. `callExecutorAgentDirectly` 返回格式

**确保** `callExecutorAgentDirectly` 返回的格式包含：
```typescript
{
  isCompleted: boolean;  // ✅ 必须有
  result?: any;          // isCompleted = true 时
  suggestion?: string;   // isCompleted = false 时
}
```

### 2. Agent B 的处理逻辑

**确保** Agent B 能处理新的返回格式：
- `pre_completed` 状态：`executionResult` 包含 `isCompleted = true` 和 `result`
- `pre_need_support` 状态：`executionResult` 包含 `isCompleted = false` 和 `suggestion`

---

## 🧪 测试建议

### 测试用例 1：任务能正常完成
- **预期**：状态 → `pre_completed`，`executionResult` 包含结果
- **验证**：Agent B 能正常评审并通过

### 测试用例 2：任务需要帮助
- **预期**：状态 → `pre_need_support`，`executionResult` 包含建议
- **验证**：Agent B 能正常获取建议并决策

### 测试用例 3：执行 Agent 抛异常
- **预期**：catch 块捕获，状态 → `pre_need_support`
- **验证**：降级逻辑正常工作

---

## 📝 修改前备份

**建议**：修改前先备份当前方法：
```typescript
// 备份：executeExecutorAgentWorkflow_v1（旧版本）
private async executeExecutorAgentWorkflow_v1(task: typeof agentSubTasks.$inferSelect) {
  // ... 旧代码 ...
}
```

---

## ✅ 改动检查清单

- [ ] 删除 `capabilityCheckResult` 相关代码
- [ ] 删除 `finalExecutionResult` 相关代码
- [ ] 删除 `callExecutorAgent()` 调用
- [ ] 直接调用 `callExecutorAgentDirectly()`
- [ ] 简化结果保存逻辑
- [ ] 简化状态更新逻辑
- [ ] 测试任务完成场景
- [ ] 测试任务需要帮助场景
- [ ] 测试异常场景
- [ ] 验证 Agent B 能正常处理

---

**改动总结**：
- 🗑️ **删除**：能力边界判定层（约 50 行）
- ✨ **新增**：直接执行逻辑（约 18 行）
- 📉 **简化**：结果保存和状态更新逻辑
- 🎯 **目标**：让执行 Agent 直接执行，不做能力判定！


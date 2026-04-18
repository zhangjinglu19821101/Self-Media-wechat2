
# executeExecutorAgentWorkflow 手动修改指南

## 📋 修改目标

去掉能力边界判定层，让执行 Agent 直接执行！

---

## 🔍 当前文件状态

我发现当前文件已经被部分修改了，但还有旧代码残留。你需要：

1. **先从备份恢复**：`src/lib/services/subtask-execution-engine.ts.backup`
2. **然后手动修改**：按照下面的指南

---

## 📝 完整的新方法代码

**直接用下面的代码替换整个 `executeExecutorAgentWorkflow` 方法**：

```typescript
  /**
   * ========== 执行Agent职责 ==========
   * 接收任务，从 pending 开始
   * 更新状态为 in_progress
   * 直接执行任务（跳过能力判定！）
   * 判断结果：
   *   如果能完成 → 标记为 pre_completed
   *   如果需要帮助 → 标记为 pre_need_support
   */
  private async executeExecutorAgentWorkflow(task: typeof agentSubTasks.$inferSelect) {
    console.log('[SubtaskEngine] 执行Agent: pending → in_progress');
    
    await db
      .update(agentSubTasks)
      .set({
        status: 'in_progress',
        startedAt: getCurrentBeijingTime(),
        updatedAt: getCurrentBeijingTime(),
      })
      .where(eq(agentSubTasks.id, task.id));

    try {
      console.log('[SubtaskEngine] 执行Agent: 开始处理任务');
      
      const allTasksInGroup = await db
        .select()
        .from(agentSubTasks)
        .where(eq(agentSubTasks.commandResultId, task.commandResultId))
        .orderBy(agentSubTasks.orderIndex);
      
      const previousResult = this.getPreviousStepResult(allTasksInGroup, task.orderIndex);
      
      // ==========================================
      // ✅ 核心改动：直接执行，不做能力判定！
      // ==========================================
      console.log('[SubtaskEngine] 执行Agent: 直接执行任务（跳过能力判定）');
      const executorResult = await this.callExecutorAgentDirectly(task, previousResult);
      console.log('[SubtaskEngine] 执行Agent执行结果:', executorResult);

      // ==========================================
      // ✅ 简化：保存结果到数据库
      // ==========================================
      const resultToSave = executorResult;
      console.log('[SubtaskEngine] 保存执行结果:', resultToSave);

      await db
        .update(agentSubTasks)
        .set({
          executionResult: JSON.stringify(resultToSave),
          updatedAt: getCurrentBeijingTime(),
        })
        .where(eq(agentSubTasks.id, task.id));

      // ==========================================
      // ✅ 简化：更新状态
      // ==========================================
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
      
      console.log('[SubtaskEngine] ========== 执行Agent处理完成，等待Agent B评审 ==========');
    } catch (error) {
      console.error('[SubtaskEngine] 执行Agent执行失败:', error);
      await db
        .update(agentSubTasks)
        .set({
          status: 'pre_need_support',
          updatedAt: getCurrentBeijingTime(),
        })
        .where(eq(agentSubTasks.id, task.id));
    }
  }
```

---

## 🔄 修改步骤

### 步骤 1：恢复备份文件

```bash
cp /workspace/projects/src/lib/services/subtask-execution-engine.ts.backup /workspace/projects/src/lib/services/subtask-execution-engine.ts
```

### 步骤 2：找到方法位置

在文件中找到：
- 起始：`private async executeExecutorAgentWorkflow`
- 结束：方法的最后一个 `}`

### 步骤 3：替换整个方法

**删除** 从方法注释开始到方法结束的所有内容，**粘贴**上面的新代码。

---

## ✅ 修改验证

修改完成后，检查以下内容：

### 检查 1：删除的内容（应该看不到了）

- ❌ `capabilityCheckResult` 变量
- ❌ `finalExecutionResult` 变量
- ❌ `callExecutorAgent()` 调用
- ❌ "先做能力边界判定" 注释
- ❌ "如果判定任务可以直接完成" 注释
- ❌ 复杂的 `if (!capabilityCheckResult.isNeedMcp &amp;&amp; ...)` 判断

### 检查 2：新增的内容（应该能看到）

- ✅ "直接执行任务（跳过能力判定）" 注释
- ✅ 直接调用 `callExecutorAgentDirectly()`
- ✅ `const resultToSave = executorResult;`（简化保存）
- ✅ `if (executorResult.isCompleted)`（简化状态判断）

---

## 📊 改动对比

| 项目 | 改动前 | 改动后 |
|-----|-------|-------|
| 代码行数 | ~130 行 | ~80 行 |
| 能力判定 | 有 | ❌ 无 |
| 直接执行 | 条件调用 | ✅ 总是调用 |
| 变量数 | 4 个 | 2 个 |
| 复杂度 | 高 | 低 |

---

## 🎯 关键改动点总结

### 1. 删除的代码块（约 50 行）

```typescript
// ❌ 删除：能力边界判定
const capabilityCheckResult = await this.callExecutorAgent(task, previousResult);

let finalExecutionResult: any = null;

// ❌ 删除：条件执行
if (!capabilityCheckResult.isNeedMcp &amp;&amp; capabilityCheckResult.isTaskDown) {
  const directResult = await this.callExecutorAgentDirectly(...);
  // ...
}

// ❌ 删除：复杂的保存逻辑
let resultToSave: any;
if (!capabilityCheckResult.isNeedMcp &amp;&amp; ...) {
  resultToSave = finalExecutionResult;
} else {
  resultToSave = capabilityCheckResult;
}

// ❌ 删除：复杂的状态更新
if (!capabilityCheckResult.isNeedMcp &amp;&amp; ...) {
  status: 'pre_completed'
} else {
  status: 'pre_need_support'
}
```

### 2. 新增的代码块（约 18 行）

```typescript
// ✅ 新增：直接执行
console.log('[SubtaskEngine] 执行Agent: 直接执行任务（跳过能力判定）');
const executorResult = await this.callExecutorAgentDirectly(task, previousResult);

// ✅ 新增：简化保存
const resultToSave = executorResult;

// ✅ 新增：简化状态更新
if (executorResult.isCompleted) {
  status: 'pre_completed'
} else {
  status: 'pre_need_support'
}
```

---

## 🚨 注意事项

1. **缩进保持一致**：确保新代码的缩进和文件其他部分一致（通常是 2 或 4 个空格）
2. **备份先保留**：修改前确保备份文件存在
3. **测试验证**：修改后运行编译检查，确保没有语法错误

---

## ✅ 修改完成检查清单

- [ ] 从备份文件恢复
- [ ] 找到 `executeExecutorAgentWorkflow` 方法
- [ ] 删除整个旧方法
- [ ] 粘贴新方法代码
- [ ] 检查缩进正确
- [ ] 确认没有 `capabilityCheckResult` 变量
- [ ] 确认直接调用 `callExecutorAgentDirectly()`
- [ ] 运行编译检查（`npx tsc --noEmit`）
- [ ] 验证通过！


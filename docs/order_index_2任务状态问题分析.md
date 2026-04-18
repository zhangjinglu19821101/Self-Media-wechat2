
# 🔍 order_index = 2 任务状态问题分析

**发现时间**: 2026-03-18  
**问题描述**: agent_sub_tasks 表中 order_index = 2 的任务 status 一直是 in_progress

---

## 📋 问题现象

### 1. 日志中的关键线索

从 `/app/work/logs/bypass/app.log` 中发现：

```json
{
  "level": "info",
  "message": "2026-03-18 19:54:00 info: [InProgressTimeout] 任务超时处理: {",
  "taskId": "de8f9c33-aaaf-4929-a4aa-151b5c4d83b1",
  "elapsedMinutes": -471.9964166666667,
  "currentLevel": "level1"
}
```

**🚨 核心问题**: `elapsedMinutes` 是 **负数**！

### 2. 代码流程分析

从 `subtask-execution-engine.ts` 中看到的处理流程：

```
1. 处理 order_index = 2
   ↓
2. 发现有 in_progress 状态的任务
   ↓
3. 调用 checkAndHandleTimeout() 检查超时
   ↓
4. 计算 elapsedMinutes 得到负数
   ↓
5. 超时处理返回"还没到超时时间"
   ↓
6. 因为有 blocking status（in_progress），暂停处理后续步骤
   ↓
7. 任务一直卡在 in_progress 状态
```

---

## 🔎 根因分析

### 问题 1: 时区不一致导致时间计算错误

**位置**: `src/lib/services/in-progress-timeout-handler.ts`

```typescript
private getElapsedMinutes(task: typeof agentSubTasks.$inferSelect): number {
  if (!task.startedAt) return 0;
  const now = getCurrentBeijingTime();
  const elapsedMs = now.getTime() - task.startedAt.getTime();
  return elapsedMs / 1000 / 60;
}
```

**问题**:
1. `task.startedAt` 从数据库读取时可能被自动转换了时区
2. `getCurrentBeijingTime()` 返回的是本地时间
3. 如果数据库存储的是 UTC 时间，但读取时被错误转换，就会导致时间差为负数

### 问题 2: 缺少对负数 elapsedMinutes 的防护

即使时区有问题，代码也应该处理负数的情况：

```typescript
// 当前代码
if (elapsedMinutes &gt;= this.LEVEL1_THRESHOLD &amp;&amp; elapsedMinutes &lt; this.LEVEL2_THRESHOLD) {
  // ...
}
```

**应该添加防护**:
```typescript
if (elapsedMinutes &lt;= 0) {
  console.warn(`[InProgressTimeout] ⚠️ elapsedMinutes 为负数: ${elapsedMinutes}，可能是时区问题`);
  return { success: false, message: '时间计算异常，检查时区配置' };
}
```

### 问题 3: in_progress 任务缺少状态推进机制

从代码流程看：
- 如果任务是 in_progress 状态
- 且超时检查因为负数时间没有触发任何操作
- 任务就会一直卡在 in_progress 状态

---

## 💡 修复方案

### 方案 1: 修复时区问题（推荐）

#### Step 1: 统一时间处理

确保所有时间都使用 UTC 或都使用本地时间，不要混用。

**修改 `getCurrentBeijingTime()`**:
```typescript
export function getCurrentBeijingTime(): Date {
  // 强制使用 UTC 时间，避免时区问题
  const now = new Date();
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours(),
    now.getUTCMinutes(),
    now.getUTCSeconds()
  ));
}
```

或者，确保数据库存储和读取都使用相同的时区处理。

#### Step 2: 添加时间验证

在 `getElapsedMinutes()` 中添加防护：

```typescript
private getElapsedMinutes(task: typeof agentSubTasks.$inferSelect): number {
  if (!task.startedAt) return 0;
  
  const now = getCurrentBeijingTime();
  const elapsedMs = now.getTime() - task.startedAt.getTime();
  const elapsedMinutes = elapsedMs / 1000 / 60;
  
  // 🔴 新增：防护负数时间
  if (elapsedMinutes &lt; 0) {
    console.warn(`[InProgressTimeout] ⚠️  检测到负数执行时间: ${elapsedMinutes.toFixed(2)}分钟`, {
      now: now.toISOString(),
      startedAt: task.startedAt.toISOString(),
      taskId: task.id
    });
    // 返回 0，表示刚启动
    return 0;
  }
  
  return elapsedMinutes;
}
```

### 方案 2: 增加状态重置机制

如果任务卡在 in_progress 状态超过一定时间（即使计算出来的时间有问题），应该有机制重置或重新执行：

```typescript
// 在 processOrderIndexTasks 中添加
const suspiciousTasks = currentStepTasks.filter(t =&gt; 
  t.status === 'in_progress' &amp;&amp; 
  t.startedAt &amp;&amp; 
  (Date.now() - t.startedAt.getTime()) &gt; MAX_ALLOWED_IN_PROGRESS_MS
);

if (suspiciousTasks.length &gt; 0) {
  console.log(`[SubtaskEngine] ⚠️  发现 ${suspiciousTasks.length} 个可疑的 in_progress 任务，尝试重置...`);
  
  for (const task of suspiciousTasks) {
    console.log(`[SubtaskEngine] 重置任务 ${task.id} 从 in_progress 到 pending`);
    await db
      .update(agentSubTasks)
      .set({
        status: 'pending',
        startedAt: null,
        updatedAt: getCurrentBeijingTime(),
      })
      .where(eq(agentSubTasks.id, task.id));
  }
}
```

### 方案 3: 增加诊断日志

在关键位置增加更详细的日志，帮助定位时区问题：

```typescript
// 在 checkAndHandleTimeout 开始时添加
console.log(`[InProgressTimeout] 时间诊断:`, {
  taskId: task.id,
  status: task.status,
  startedAt: task.startedAt?.toISOString(),
  startedAtTimestamp: task.startedAt?.getTime(),
  now: getCurrentBeijingTime().toISOString(),
  nowTimestamp: getCurrentBeijingTime().getTime(),
  timezoneOffset: new Date().getTimezoneOffset()
});
```

---

## 🎯 推荐修复优先级

### P0 - 立即修复（防止任务卡住）
1. ✅ 在 `getElapsedMinutes()` 中添加负数时间防护
2. ✅ 添加时间诊断日志

### P1 - 高优先级（根因修复）
3. 🔧 统一时区处理逻辑
4. 🔧 确保数据库时间字段的读写时区一致

### P2 - 中优先级（健壮性增强）
5. 🔧 增加可疑任务检测和重置机制
6. 🔧 添加 in_progress 状态的监控告警

---

## 📝 验证步骤

修复后需要验证：

1. **时区检查**: 确认 `startedAt` 和 `now` 的时间差计算正确
2. **负数防护**: 故意制造时区问题，验证防护逻辑生效
3. **状态流转**: 确认任务能正常从 in_progress 流转到其他状态
4. **超时机制**: 确认超时机制在时间正确时能正常工作

---

## 📊 相关文件

需要检查/修改的文件：
- `src/lib/services/in-progress-timeout-handler.ts` - 主要修复
- `src/lib/utils/date-time.ts` - 时区统一
- `src/lib/services/subtask-execution-engine.ts` - 状态流转


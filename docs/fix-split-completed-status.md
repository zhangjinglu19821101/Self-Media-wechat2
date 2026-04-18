# 修复：弹框确认后应设置为 split_completed 状态

## 🐛 问题描述

**严重 Bug**：弹框确认 insurance-d 拆解结果后，状态直接设置为 `in_progress`，跳过了 `split_completed` 状态。

## 📊 当前状态流转（错误）

```
pending_review → in_progress
     ↑_____________|
      (定时任务重复触发拆解)
```

**问题**：
1. 弹框确认后直接设置 `executionStatus: 'in_progress'`
2. `schedule-daily-tasks` 定时任务查询 `pending_review` 状态
3. 由于状态没有正确更新，定时任务又会重复触发拆解
4. 导致同一个 daily_task 被重复拆解多次！

## ✅ 正确的状态流转

```
pending_review → split_completed → confirmed → in_progress
```

**状态说明**：
- `pending_review`：等待确认
- `split_completed`：拆解完成，等待确认
- `confirmed`：已确认，可以开始执行
- `in_progress`：执行中

## 🔧 修复方案

### 修改 1：insurance-d 拆解完成后设置为 split_completed

**文件**：`src/lib/services/task-assignment-service.ts`

**在 `insuranceDSplitTask` 函数中：**

```typescript
// 修改前
await db
  .update(dailyTasks)
  .set({
    executionStatus: 'pending_review', // 🔴 问题在这里
    retryStatus: 'pending_review',
    // ...
  });

// 修改后
await db
  .update(dailyTasks)
  .set({
    executionStatus: 'split_completed', // ✅ 改为 split_completed
    retryStatus: 'pending_review',
    // ...
  });
```

### 修改 2：弹框确认时先设置为 confirmed，再设置为 in_progress

**文件**：`src/app/api/insurance-d/confirm-split/route.ts`

```typescript
// 修改前
await db
  .update(dailyTasks)
  .set({
    executionStatus: 'in_progress', // 🔴 直接跳到 in_progress
    // ...
  });

// 修改后
// 第一步：设置为 confirmed
await db
  .update(dailyTasks)
  .set({
    executionStatus: 'confirmed', // ✅ 先设置为 confirmed
    retryStatus: null,
    isConfirmed: true,
    confirmedBy: 'A',
    confirmedAt: new Date(),
    updatedAt: new Date(),
    // ...
  });

// 第二步：设置为 in_progress（可以延迟或者立即设置）
await db
  .update(dailyTasks)
  .set({
    executionStatus: 'in_progress', // ✅ 再设置为 in_progress
    updatedAt: new Date(),
  });
```

### 修改 3：更新 BaseSplitter 的查询逻辑

**文件**：`src/lib/services/splitters/base-splitter.ts`

```typescript
// 修改前
const pendingTasks = await db
  .select()
  .from(dailyTasks)
  .where(
    and(
      eq(dailyTasks.executor, this.agentId),
      eq(dailyTasks.executionStatus, 'pending_review'), // 🔴 只查询 pending_review
      lte(dailyTasks.executionDate, today)
    )
  );

// 修改后
const pendingTasks = await db
  .select()
  .from(dailyTasks)
  .where(
    and(
      eq(dailyTasks.executor, this.agentId),
      // ✅ 查询 pending_review 或 split_completed（但需要检查是否已有子任务）
      or(
        eq(dailyTasks.executionStatus, 'pending_review'),
        eq(dailyTasks.executionStatus, 'split_completed')
      ),
      lte(dailyTasks.executionDate, today)
    )
  );

// 新增：在内存中过滤掉已有子任务的任务
const tasksWithoutSubTasks = [];
for (const task of pendingTasks) {
  const subTaskCount = await db
    .select({ count: count() })
    .from(agentSubTasks)
    .where(eq(agentSubTasks.commandResultId, task.id));
  
  if (subTaskCount[0].count === 0) {
    tasksWithoutSubTasks.push(task);
  }
}

return tasksWithoutSubTasks;
```

## 🧹 清理异常数据

### 步骤 1：备份数据

```sql
-- 备份异常数据
CREATE TABLE agent_sub_tasks_backup_20260218 AS 
SELECT * FROM agent_sub_tasks;

CREATE TABLE daily_tasks_backup_20260218 AS 
SELECT * FROM daily_tasks;
```

### 步骤 2：删除重复的子任务

```sql
-- 删除重复数据，只保留每个 daily_task 的第一个拆解版本
DELETE FROM agent_sub_tasks
WHERE id NOT IN (
  SELECT DISTINCT ON (command_result_id, order_index) id
  FROM agent_sub_tasks
  ORDER BY command_result_id, order_index, created_at ASC
);
```

### 步骤 3：修复 daily_task 状态

```sql
-- 将有子任务的 daily_task 状态设置为 split_completed 或 in_progress
UPDATE daily_tasks
SET execution_status = 'split_completed'
WHERE id IN (
  SELECT DISTINCT command_result_id
  FROM agent_sub_tasks
)
AND execution_status = 'pending_review';
```

## ✅ 验证修复

### 验证 1：状态流转正确

```
1. insurance-d 拆解完成 → execution_status = 'split_completed' ✅
2. Agent A 弹框确认 → execution_status = 'confirmed' → 'in_progress' ✅
3. 定时任务不会重复触发拆解 ✅
```

### 验证 2：数据不再重复

- 1 个 daily_task → 5-10 条子任务（正常）
- 不会再产生 715 条子任务 ✅

## 📝 总结

**问题根源**：
- 弹框确认后跳过了 `split_completed` 状态
- 直接从 `pending_review` → `in_progress`
- 导致定时任务重复触发拆解

**修复方案**：
1. insurance-d 拆解完成后设置为 `split_completed`
2. 弹框确认时先设置为 `confirmed`，再设置为 `in_progress`
3. 更新 BaseSplitter 的查询逻辑，过滤已有子任务的任务
4. 清理异常数据

# 流程澄清：正确的时序和状态设置

## 🤔 理解偏差澄清

### 用户描述的流程（有偏差）：
```
用户弹框确认
    ↓
/api/insurance-d/confirm-split
    ↓
保存子任务到 agent_sub_tasks 表  ❌（理解错误）
    ↓
设置 execution_status = 'split_completed'  ❌（理解错误）
```

### 实际代码流程（正确）：
```
┌─────────────────────────────────────────────────────────┐
│ 阶段 1：insurance-d 拆解（弹框确认之前！）           │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ insuranceDSplitTask()                                   │
│   ↓                                                     │
│ 1. 保存子任务到 agent_sub_tasks 表 ✅（已经在做了）│
│   ↓                                                     │
│ 2. 设置 execution_status = 'pending_review' 🔴（Bug）│
│   ↓                                                     │
│ 3. 创建通知给 Agent A                                    │
│                                                          │
└─────────────────────────────────────────────────────────┘
                            ↓
                            🕐 时间差
                            ↓
┌─────────────────────────────────────────────────────────┐
│ 阶段 2：用户弹框确认（现在）                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ /api/insurance-d/confirm-split                         │
│   ↓                                                     │
│ 1. 不保存子任务（已经保存了！）                          │
│   ↓                                                     │
│ 2. 设置 execution_status = 'in_progress' ✅          │
│   ↓                                                     │
│ 3. 启动第一个子任务                                       │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## 🎯 **关键澄清点**

### 1. 保存子任务的时机
| 问题 | 答案 |
|------|------|
| 子任务在什么时候保存？ | **insurance-d 拆解时**（不是弹框确认时） |
| 弹框确认时还要保存吗？ | **不用**，已经保存过了 |
| 在哪里保存的？ | `insuranceDSplitTask()` 函数中 |

### 2. `split_completed` 状态应该在什么时候设置？

| 问题 | 答案 |
|------|------|
| `split_completed` 在弹框确认时设置吗？ | **不应该** |
| 应该在什么时候设置？ | **insurance-d 拆解完成时** |
| 弹框确认时设置什么状态？ | **直接设置 `in_progress`** |

## 🔧 **修复方案（再次确认）**

### 修改 1：insurance-d 拆解完成时设置为 `split_completed`

**文件**：`src/lib/services/task-assignment-service.ts`

```typescript
// insuranceDSplitTask() 函数中

// ❌ 当前代码（Bug）
await db
  .update(dailyTasks)
  .set({
    executionStatus: 'pending_review', // 🔴 问题在这里
    retryStatus: 'pending_review',
    // ...
  });

// ✅ 修改后（修复）
await db
  .update(dailyTasks)
  .set({
    executionStatus: 'split_completed', // ✅ 改为 split_completed
    retryStatus: 'pending_review',
    // ...
  });
```

**位置**：在保存完 `agent_sub_tasks` 之后立即设置

---

### 修改 2：弹框确认时直接设置 `in_progress`（不需要 `split_completed`）

**文件**：`src/app/api/insurance-d/confirm-split/route.ts`

```typescript
// ❌ 当前代码（多余）
// 第一步：设置为 confirmed
await db.update(dailyTasks).set({ executionStatus: 'confirmed', ... });

// 第二步：设置为 in_progress
await db.update(dailyTasks).set({ executionStatus: 'in_progress', ... });

// ✅ 修改后（简化）
await db
  .update(dailyTasks)
  .set({
    executionStatus: 'in_progress', // ✅ 直接设置为 in_progress
    retryStatus: null,
    isConfirmed: true, // 🔥 保留确认记录字段
    confirmedBy: 'A',
    confirmedAt: new Date(),
    updatedAt: new Date(),
    // ...
  });
```

**说明**：
- 不需要先设置 `confirmed`，直接一步到位
- 保留 `isConfirmed`、`confirmedBy`、`confirmedAt` 字段（用于记录）

---

### 修改 3：BaseSplitter 查询时检查是否已有子任务

**文件**：`src/lib/services/splitters/base-splitter.ts`

```typescript
async getTasksToProcess(): Promise<any[]> {
  // 1. 查询 pending_review 或 split_completed 的任务
  const pendingTasks = await db
    .select()
    .from(dailyTasks)
    .where(
      and(
        eq(dailyTasks.executor, this.agentId),
        or(
          eq(dailyTasks.executionStatus, 'pending_review'),
          eq(dailyTasks.executionStatus, 'split_completed')
        ),
        lte(dailyTasks.executionDate, today)
      )
    );
  
  // 2. 🔥 关键：过滤掉已有子任务的任务！
  const tasksWithoutSubTasks = [];
  for (const task of pendingTasks) {
    const subTaskResult = await db
      .select({ count: count() })
      .from(agentSubTasks)
      .where(eq(agentSubTasks.commandResultId, task.id));
    
    if (subTaskResult[0].count === 0) {
      tasksWithoutSubTasks.push(task);
    } else {
      console.log(`⏭️ 任务 ${task.taskId} 已有子任务，跳过`);
    }
  }
  
  return tasksWithoutSubTasks;
}
```

## 📊 **最终的完整流程图**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. insurance-d 拆解任务                                    │
├─────────────────────────────────────────────────────────────┤
│ ✅ 保存 agent_sub_tasks                                     │
│ ✅ 设置 execution_status = 'split_completed'               │
│ ✅ 创建通知给 Agent A                                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Agent A 收到通知，显示弹框                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. 用户点击"确认"按钮                                       │
├─────────────────────────────────────────────────────────────┤
│ ✅ 直接设置 execution_status = 'in_progress'                │
│ ✅ 保留 isConfirmed、confirmedBy、confirmedAt 字段        │
│ ✅ 启动第一个子任务                                          │
└─────────────────────────────────────────────────────────────┘
```

## ✅ **总结确认**

| 问题 | 答案 |
|------|------|
| 子任务在弹框确认时保存吗？ | **不**，在 insurance-d 拆解时就保存了 |
| `split_completed` 在弹框确认时设置吗？ | **不**，在 insurance-d 拆解完成时就设置 |
| 弹框确认时设置什么状态？ | **直接设置 `in_progress`** |
| 如何防止重复拆分？ | 1. 状态控制（`split_completed`）<br>2. 数据检查（已有子任务就跳过） |

**你的思路方向是对的，但时序需要调整！** 🎯

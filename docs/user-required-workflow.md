# 用户要求的流程确认

## 📋 用户明确要求的流程

```
insurance-d 拆解完成，发起拆解结果确认弹框
    ↓
用户在弹框中点击"确认"按钮
    ↓
调用 /api/insurance-d/confirm-split
    ↓
保存子任务到 agent_sub_tasks 表  ← 用户要求在这里保存！
    ↓
daily_task更新状态: execution_status = 'split_completed'  ← 用户要求在这里设置！
```

## ✅ 确认理解

| 步骤 | 用户要求 | 当前代码 | 是否需要修改 |
|------|---------|---------|-------------|
| 1. insurance-d 拆解完成 | 发起弹框 | 发起弹框 | ✅ 一致 |
| 2. 用户点击"确认" | 调用 confirm-split | 调用 confirm-split | ✅ 一致 |
| 3. 保存子任务 | **在 confirm-split 中保存** | ❌ 在 insurance-d 拆解时保存 | 🔴 **需要改** |
| 4. 设置 split_completed | **在 confirm-split 中设置** | ❌ 在 insurance-d 拆解时设置（而且设置的是 pending_review） | 🔴 **需要改** |

## 🔧 按照用户要求的实现方案

### 修改 1：insurance-d 拆解时**不保存**子任务，**不设置**状态

**文件**：`src/lib/services/task-assignment-service.ts`

```typescript
// ❌ 删除或注释掉：保存子任务到 agent_sub_tasks 的代码
// for (const subTask of subTasks) {
//   await db.insert(agentSubTasks).values({...});
// }

// ❌ 删除或注释掉：更新 daily_task 状态的代码
// await db.update(dailyTasks).set({ executionStatus: 'pending_review', ... });

// ✅ 只保留：创建通知给 Agent A
await createNotification({...});
```

**说明**：
- insurance-d 拆解完成后，**不保存** agent_sub_tasks
- insurance-d 拆解完成后，**不更新** daily_task 状态
- 只创建通知，弹框给用户确认

---

### 修改 2：/api/insurance-d/confirm-split 中**保存**子任务，**设置** split_completed

**文件**：`src/app/api/insurance-d/confirm-split/route.ts`

```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { notificationId, splitResult, taskId } = body;

    // ... 前面的验证代码 ...

    // ==========================================
    // ✅ 用户要求：在这里保存子任务！
    // ==========================================
    console.log(`💾 保存子任务到 agent_sub_tasks 表...`);
    
    const subTasks = splitResult?.subtasks || splitResult?.subTasks || [];
    
    for (const subTask of subTasks) {
      await db.insert(agentSubTasks).values({
        commandResultId: dailyTask.id,
        agentId: subTask.executor,
        taskTitle: subTask.title,
        taskDescription: subTask.description,
        status: 'pending',
        orderIndex: subTask.orderIndex,
        metadata: {
          acceptanceCriteria: subTask.acceptanceCriteria,
          isCritical: subTask.isCritical,
          criticalReason: subTask.criticalReason,
          executor: subTask.executor,
        },
      });
      
      console.log(`✅ 子任务 ${subTask.orderIndex}: ${subTask.title} 已插入`);
    }

    // ==========================================
    // ✅ 用户要求：在这里设置 split_completed！
    // ==========================================
    console.log(`🔄 更新 daily_task 状态为 split_completed...`);
    
    await db
      .update(dailyTasks)
      .set({
        executionStatus: 'split_completed', // ✅ 用户要求在这里设置！
        retryStatus: null,
        isConfirmed: true,
        confirmedBy: 'A',
        confirmedAt: new Date(),
        subTaskCount: subTasks.length,
        completedSubTasks: 0,
        updatedAt: new Date(),
        metadata: {
          ...(dailyTask.metadata || {}),
          insuranceDSplitConfirmed: true,
          insuranceDSplitConfirmedAt: new Date().toISOString(),
          splitNotificationId: notificationId,
        },
      })
      .where(eq(dailyTasks.id, dailyTask.id));

    console.log(`✅ daily_task 状态已更新为 split_completed`);

    // ==========================================
    // 可选：后续是否要设置 in_progress？
    // （根据用户需求，这里只设置 split_completed）
    // ==========================================

    // ... 标记通知已读等代码 ...

    return NextResponse.json({
      success: true,
      message: '拆解结果已确认，子任务已保存',
      data: {
        taskId,
        subTaskCount: subTasks.length,
      },
    });
  } catch (error) {
    // ... 错误处理 ...
  }
}
```

---

### 修改 3：BaseSplitter 查询逻辑（配合用户需求）

**文件**：`src/lib/services/splitters/base-splitter.ts`

```typescript
async getTasksToProcess(): Promise<any[]> {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  console.log(`🔍 [${this.agentId}] 查询可执行任务...`);
  
  // ✅ 只查询 pending_review 的任务（因为 split_completed 是确认后的状态）
  const pendingTasks = await db
    .select()
    .from(dailyTasks)
    .where(
      and(
        eq(dailyTasks.executor, this.agentId),
        eq(dailyTasks.executionStatus, 'pending_review'), // ✅ 只查询 pending_review
        lte(dailyTasks.executionDate, today)
      )
    );
  
  // ✅ 过滤掉已有子任务的任务（防止重复）
  const tasksWithoutSubTasks = [];
  for (const task of pendingTasks) {
    const subTaskResult = await db
      .select({ count: count() })
      .from(agentSubTasks)
      .where(eq(agentSubTasks.commandResultId, task.id));
    
    if (subTaskResult[0].count === 0) {
      tasksWithoutSubTasks.push(task);
    } else {
      console.log(`⏭️ [${this.agentId}] 任务 ${task.taskId} 已有子任务，跳过`);
    }
  }
  
  console.log(`📋 [${this.agentId}] 找到 ${tasksWithoutSubTasks.length} 个可执行任务`);
  return tasksWithoutSubTasks;
}
```

## 📊 按照用户要求的完整流程图

```
┌─────────────────────────────────────────────────────────┐
│ 阶段 1：insurance-d 拆解                              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ✅ 拆解任务，生成子任务数据（在内存中）                  │
│ ✅ 不保存 agent_sub_tasks                               │
│ ✅ 不更新 daily_task 状态                               │
│ ✅ 创建通知给 Agent A                                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ 阶段 2：用户弹框确认                                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ✅ 用户点击"确认"按钮                                    │
│ ✅ 调用 /api/insurance-d/confirm-split                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ 阶段 3：confirm-split API 处理（用户要求的核心逻辑）│
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ✅ 保存子任务到 agent_sub_tasks 表  ← 用户要求！      │
│ ✅ 设置 execution_status = 'split_completed'  ← 用户要求！│
│ ✅ 标记通知已读                                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## ⚠️ 潜在问题提醒（供参考）

虽然按照用户要求实现，但有几点需要注意：

| 问题 | 说明 | 建议 |
|------|------|------|
| **子任务数据在哪里？** | insurance-d 拆解的子任务数据需要通过通知传递给 confirm-split API | 确保通知的 content.splitResult 包含完整的子任务数据 |
| **如果用户取消确认怎么办？** | 子任务数据只在内存中，取消就丢失了 | 这是用户要求的逻辑，接受这个trade-off |
| **split_completed 之后呢？** | 设置为 split_completed 后，是否需要自动设置为 in_progress？ | 根据用户需求，这里只设置 split_completed，后续逻辑可以再加 |

## ✅ 总结

**用户要求的逻辑已经明确，我将按照这个方案实现：**

1. ✅ insurance-d 拆解时**不保存**子任务，**不设置**状态
2. ✅ 弹框确认时，在 `/api/insurance-d/confirm-split` 中：
   - **保存**子任务到 agent_sub_tasks 表
   - **设置** execution_status = 'split_completed'
3. ✅ 其他逻辑在保证这个核心流程的基础上添加

**用户的逻辑务必要实现！** 🎯

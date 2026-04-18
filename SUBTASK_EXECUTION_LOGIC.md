# Agent 子任务执行逻辑分析

## 📊 当前状态

### ✅ 已实现的功能

1. **子任务表结构** (`agent_sub_tasks`)
   - 子任务信息存储
   - 状态字段：`'pending' | 'in_progress' | 'completed' | 'blocked'`
   - 执行顺序：`orderIndex`

2. **创建子任务 API** (`/api/agents/[id]/split-task`)
   - 调用 `splitTaskForAgent()` 拆分任务
   - 插入子任务到数据库
   - 更新主任务状态

3. **更新子任务状态 API** (`/api/agents/[id]/subtasks/:subtaskId`)
   - 更新单个子任务状态
   - 更新主任务进度

---

### ❌ 缺失的功能

**自动推动子任务执行的逻辑**

目前子任务创建后，状态是 `'pending'`，但是：
- ❌ 没有定时任务扫描 `status = 'pending'` 的子任务
- ❌ 没有自动将 `pending` → `in_progress` 的逻辑
- ❌ 没有自动触发子任务执行的机制

---

## 🔄 当前子任务流程（不完整）

```
1. 任务确认
    ↓
2. 调用 /api/agents/[id]/split-task（手动调用）
    ↓
3. 子任务创建，状态 = 'pending'（停在这里）
    ↓
4. ⚠️ 没有自动执行逻辑
    ↓
5. 需要手动调用 /api/agents/[id]/subtasks/:subtaskId 更新状态
```

---

## 💡 应该有的逻辑（缺失）

### 理想的子任务执行流程

```
1. 任务确认
    ↓
2. 拆分子任务
    ↓
3. 子任务状态 = 'pending'
    ↓
4. 【定时任务扫描】找到 status = 'pending' 的子任务
    ↓
5. 【自动执行】将 status = 'pending' → 'in_progress'
    ↓
6. 【通知 Agent】发送消息给 Agent 执行子任务
    ↓
7. 【Agent 执行】Agent 完成子任务
    ↓
8. 【更新状态】将 status = 'in_progress' → 'completed'
    ↓
9. 【检查完成度】检查是否所有子任务都完成
    ↓
10.【更新主任务】主任务状态 = 'completed'
```

---

## 🚀 建议的实现方案

### 方案 1：定时任务扫描子任务

**路由**: `/api/cron/check-pending-subtasks`

**逻辑**:

```typescript
export async function GET(request: NextRequest) {
  console.log('🕐 定时任务 - 扫描待执行的子任务...');

  // 1. 扫描所有 status = 'pending' 的子任务
  const pendingSubTasks = await db
    .select()
    .from(agentSubTasks)
    .where(eq(agentSubTasks.status, 'pending'))
    .orderBy(agentSubTasks.orderIndex);

  console.log(`📋 找到 ${pendingSubTasks.length} 个待执行子任务`);

  // 2. 遍历每个子任务
  for (const subTask of pendingSubTasks) {
    // 3. 检查是否有前置任务未完成
    const previousSubTasks = await db
      .select()
      .from(agentSubTasks)
      .where(
        and(
          eq(agentSubTasks.commandResultId, subTask.commandResultId),
          sql`${agentSubTasks.orderIndex} < ${subTask.orderIndex}`
        )
      );

    const allPreviousCompleted = previousSubTasks.every(
      st => st.status === 'completed'
    );

    // 4. 如果前置任务完成，则开始执行当前子任务
    if (allPreviousCompleted) {
      console.log(`▶️ 开始执行子任务 ${subTask.id}: ${subTask.taskTitle}`);

      // 更新状态为 in_progress
      await db.update(agentSubTasks)
        .set({
          status: 'in_progress',
          startedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(agentSubTasks.id, subTask.id));

      // 发送通知给 Agent
      await sendNotification(subTask.agentId, {
        type: 'subtask',
        subTaskId: subTask.id,
        title: `开始执行子任务`,
        content: subTask.taskTitle,
        description: subTask.taskDescription,
      });
    } else {
      console.log(`⏸️ 子任务 ${subTask.id} 等待前置任务完成`);
    }
  }

  return NextResponse.json({
    success: true,
    message: '子任务扫描完成',
  });
}
```

### 方案 2：子任务完成后自动触发下一个

**逻辑**:

```typescript
// 在更新子任务状态的 API 中
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; subtaskId: string } }
) {
  // ... 更新当前子任务状态 ...

  // 检查是否有下一个子任务
  const nextSubTask = await db
    .select()
    .from(agentSubTasks)
    .where(
      and(
        eq(agentSubTasks.commandResultId, subTask.commandResultId),
        sql`${agentSubTasks.orderIndex} = ${subTask.orderIndex + 1}`
      )
    )
    .then(rows => rows[0]);

  // 如果有下一个子任务且状态为 pending，则自动触发
  if (nextSubTask && nextSubTask.status === 'pending') {
    await db.update(agentSubTasks)
      .set({
        status: 'in_progress',
        startedAt: new Date(),
      })
      .where(eq(agentSubTasks.id, nextSubTask.id));

    // 发送通知
    await sendNotification(nextSubTask.agentId, {
      type: 'subtask',
      subTaskId: nextSubTask.id,
      title: `开始执行子任务`,
      content: nextSubTask.taskTitle,
    });
  }

  // ... 返回结果 ...
}
```

### 方案 3：混合方案（推荐）

**结合定时任务和事件驱动**：

1. **定时任务**：每 5 分钟扫描一次 `pending` 子任务
2. **事件驱动**：子任务完成后自动触发下一个子任务
3. **超时处理**：如果子任务长时间 `in_progress`，发送提醒

---

## 📋 实现优先级

### 高优先级（立即实现）

| 功能 | 描述 | 价值 |
|------|------|------|
| **定时任务扫描子任务** | 每 5 分钟扫描 `pending` 子任务 | 实现自动执行 |
| **前置任务检查** | 只有前置任务完成才执行当前任务 | 确保执行顺序 |

### 中优先级（近期实现）

| 功能 | 描述 | 价值 |
|------|------|------|
| **自动触发下一个** | 子任务完成后自动触发下一个 | 提高效率 |
| **超时提醒** | 子任务长时间未完成发送提醒 | 避免卡住 |

### 低优先级（可选实现）

| 功能 | 描述 | 价值 |
|------|------|------|
| **并行执行** | 部分子任务可并行执行 | 提升速度 |
| **重试机制** | 失败后自动重试 | 提高稳定性 |

---

## 🎯 总结

### 当前问题

❌ **子任务创建后不会自动执行**
- 子任务状态一直是 `'pending'`
- 没有定时任务扫描和推动执行
- 没有事件驱动机制

### 解决方案

✅ **需要添加以下逻辑**：

1. **定时任务扫描子任务**
   - 每 5 分钟扫描 `status = 'pending'` 的子任务
   - 检查前置任务是否完成
   - 更新状态为 `in_progress` 并通知 Agent

2. **子任务完成后的后续处理**
   - 检查是否有下一个子任务
   - 自动触发下一个子任务
   - 更新主任务进度

3. **超时处理机制**
   - 检测长时间 `in_progress` 的子任务
   - 发送提醒或超时标记

### 实现建议

**推荐方案**：混合方案（定时任务 + 事件驱动）
- 定时任务兜底，确保子任务不会遗漏
- 事件驱动提高效率，减少等待时间
- 超时处理避免任务卡住

---

**您希望我立即实现哪个方案？**
1. ⭐ 方案 1：定时任务扫描子任务（推荐，1-2 小时）
2. ⭐ 方案 2：子任务完成后自动触发下一个（推荐，1 小时）
3. 📋 方案 3：混合方案（完整实现，2-3 小时）

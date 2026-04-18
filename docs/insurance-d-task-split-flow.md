# insurance-d 任务拆解流程文档

## 流程概述

insurance-d 是任务拆分与管理 agent，主要负责将复杂任务拆分为多个可执行的子任务。

## 完整流程

### 阶段 1：Agent B 拆分总任务 → 生成 daily_tasks

**入口**：Agent A 发送拆解指令给 Agent B

**API**：`POST /api/split-insurance-d-task`

**处理流程**：
1. Agent B 接收来自 Agent A 的任务拆解指令
2. 调用 `splitTaskWithLLM` 函数，使用 LLM 智能拆解任务
3. 将任务按日分解为可执行的子任务
4. 生成 `daily_tasks` 记录，分配给 insurance-d

**生成的记录**：
- 表：`daily_tasks`（也叫 command_result）
- 字段：
  - `task_title`: 任务标题
  - `task_description`: 任务描述
  - `executor`: 执行者（insurance-d）
  - `execution_status`: 'new'（初始状态）
  - `sub_task_count`: 0（初始未拆分）
  - `related_task_id`: 关联的总任务 ID

**代码示例**：
```typescript
const dailySubtasks = await splitTaskWithLLM(task, totalDays, startDate, rejectionHistory);

// 插入到 daily_tasks 表
await db.insert(dailyTasks).values({
  taskTitle: subTask.taskTitle,
  taskDescription: subTask.commandContent,
  executor: subTask.executor,
  executionDate: subTask.deadline,
  executionStatus: 'new',
  subTaskCount: 0,
  // ...
});
```

---

### 阶段 2：insurance-d 接收任务 → 从 daily_tasks 拆分至 agent_sub_tasks

**入口**：Agent B 下发任务给 insurance-d，或 insurance-d 主动拆解

**API**：`POST /api/agents/insurance-d/split-task`

**处理流程**：
1. 查询 `daily_tasks` 表，获取任务详情
2. 检查是否已经拆分过（`sub_task_count > 0`）
3. 调用 `splitTaskForAgent` 函数，使用 LLM 拆解任务
4. 生成子任务列表
5. 插入子任务到 `agent_sub_tasks` 表
6. 更新 `daily_tasks` 表的 `sub_task_count`
7. **立即启动第一个子任务**（`order_index = 1`）

**生成的记录**：
- 表：`agent_sub_tasks`
- 字段：
  - `command_result_id`: 关联的 daily_tasks 记录 ID（外键）
  - `agent_id`: 所属 agent（insurance-d）
  - `task_title`: 子任务标题
  - `task_description`: 子任务描述
  - `status`: 'pending'（初始状态）
  - `order_index`: 执行顺序（1, 2, 3, ...）
  - `metadata`: 验收标准、是否关键、执行者等

**代码示例**：
```typescript
export async function insuranceDSplitTask(commandResultId: string) {
  // 1. 查询指令详情
  const task = await db
    .select()
    .from(dailyTasks)
    .where(eq(dailyTasks.id, commandResultId))
    .limit(1);

  const commandResult = task[0];

  // 2. 检查是否已经拆分过
  if (commandResult.subTaskCount > 0) {
    return { success: true, message: '指令已拆分' };
  }

  // 3. 调用任务拆解函数
  const subTasks = await splitTaskForAgent('insurance-d', commandResult);

  // 4. 插入子任务到数据库
  for (const subTask of subTasks) {
    await db.insert(agentSubTasks).values({
      commandResultId: commandResultId,
      agentId: subTask.executor,
      taskTitle: subTask.title,
      taskDescription: subTask.description,
      status: 'pending',
      orderIndex: subTask.orderIndex,
      metadata: {
        acceptanceCriteria: subTask.acceptanceCriteria,
        isCritical: subTask.isCritical,
        executor: subTask.executor,
      },
    });
  }

  // 5. 更新指令的子任务数量
  await db
    .update(dailyTasks)
    .set({
      subTaskCount: subTasks.length,
      completedSubTasks: 0,
    })
    .where(eq(dailyTasks.id, commandResultId));

  // 6. 立即启动第一个子任务
  const firstSubTask = subTasks.find(st => st.orderIndex === 1);
  if (firstSubTask) {
    await db
      .update(agentSubTasks)
      .set({
        status: 'in_progress',
        startedAt: new Date(),
      })
      .where(
        and(
          eq(agentSubTasks.commandResultId, commandResultId),
          eq(agentSubTasks.orderIndex, 1)
        )
      );

    // 更新父任务状态为 in_progress
    await db
      .update(dailyTasks)
      .set({
        executionStatus: 'in_progress',
      })
      .where(eq(dailyTasks.id, commandResultId));
  }

  return { success: true, subTaskCount: subTasks.length };
}
```

---

### 阶段 3：insurance-d 执行子任务

**入口**：insurance-d 按照 `agent_sub_tasks` 逐步执行

**处理流程**：
1. 获取当前需要执行的子任务（`status = 'in_progress'`）
2. 调用 LLM 执行子任务
3. 生成执行结果
4. 更新子任务状态为 'completed'
5. 启动下一个子任务
6. 重复直到所有子任务完成

**更新的记录**：
- 表：`agent_sub_tasks`
- 字段：
  - `status`: 'in_progress' → 'completed'
  - `execution_result`: 执行结果（JSON 字符串）
  - `completed_at`: 完成时间

- 表：`daily_tasks`
- 字段：
  - `completed_sub_tasks`: 已完成的子任务数量
  - `execution_status`: 'in_progress' → 'completed'

**API**：
- `PUT /api/subtasks/[id]/status` - 更新子任务状态

---

## 数据流向图

```
┌─────────────────────────────────────────────────────────────────┐
│                        Agent A                                    │
│  （总裁，负责下达任务）                                             │
└────────────────────────┬────────────────────────────────────────┘
                         │ 发送拆解指令
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                        Agent B                                    │
│  （技术负责人，负责拆分总任务）                                     │
│                                                                  │
│  POST /api/split-insurance-d-task                                │
│  ↓                                                              │
│  splitTaskWithLLM(task, totalDays, startDate)                     │
│  ↓                                                              │
│  生成 daily_tasks 记录                                            │
└────────────────────────┬────────────────────────────────────────┘
                         │ 下发任务给 insurance-d
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                    daily_tasks 表                                │
│  （每日任务表，也叫 command_result）                               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ - task_title: "第1天：完成《三口之家保险配置逻辑》科普..." │   │
│  │ - task_description: "围绕「三口之家保险配置逻辑」主题..."  │   │
│  │ - executor: "insurance-d"                               │   │
│  │ - execution_status: "new"                              │   │
│  │ - sub_task_count: 0                                    │   │
│  │ - related_task_id: "task-A-to-B-xxx"                   │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────────┘
                         │ insurance-d 接收任务
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                    insurance-d                                   │
│  （任务拆分与管理 agent，负责拆分任务为子任务）                       │
│                                                                  │
│  POST /api/agents/insurance-d/split-task                        │
│  ↓                                                              │
│  insuranceDSplitTask(commandResultId)                            │
│  ↓                                                              │
│  splitTaskForAgent('insurance-d', commandResult)                  │
│  ↓                                                              │
│  生成 agent_sub_tasks 记录                                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                  agent_sub_tasks 表                               │
│  （Agent 子任务表）                                                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ - command_result_id: xxx (关联 daily_tasks.id)          │   │
│  │ - agent_id: "insurance-d"                               │   │
│  │ - task_title: "步骤1：收集案例素材"                      │   │
│  │ - task_description: "收集1-2个生活化真实案例..."         │   │
│  │ - status: "in_progress"                                 │   │
│  │ - order_index: 1                                        │   │
│  │ - metadata.acceptance_criteria: "..."                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ - command_result_id: xxx (关联 daily_tasks.id)          │   │
│  │ - agent_id: "insurance-d"                               │   │
│  │ - task_title: "步骤2：撰写文章初稿"                      │   │
│  │ - task_description: "撰写科普文章初稿..."                │   │
│  │ - status: "pending"                                     │   │
│  │ - order_index: 2                                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ - command_result_id: xxx (关联 daily_tasks.id)          │   │
│  │ - agent_id: "insurance-d"                               │   │
│  │ - task_title: "步骤3：合规校验"                          │   │
│  │ - task_description: "完成内部合规校验..."                │   │
│  │ - status: "pending"                                     │   │
│  │ - order_index: 3                                        │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                    insurance-d                                   │
│  （按照 agent_sub_tasks 逐步执行）                                 │
│                                                                  │
│  执行步骤1：收集案例素材                                            │
│  ↓                                                              │
│  更新 agent_sub_tasks[order_index=1].status = 'completed'        │
│  ↓                                                              │
│  执行步骤2：撰写文章初稿                                            │
│  ↓                                                              │
│  更新 agent_sub_tasks[order_index=2].status = 'completed'        │
│  ↓                                                              │
│  执行步骤3：合规校验                                              │
│  ↓                                                              │
│  更新 agent_sub_tasks[order_index=3].status = 'completed'        │
└────────────────────────┬────────────────────────────────────────┘
                         │ 所有子任务完成
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                    daily_tasks 表                                │
│  （更新任务状态）                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ - execution_status: "completed"                         │   │
│  │ - completed_sub_tasks: 3                                │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 关键函数

### 1. splitTaskWithLLM

**作用**：Agent B 拆分总任务，生成 daily_tasks

**参数**：
- `task`: 总任务信息
- `totalDays`: 拆分天数
- `startDate`: 开始日期
- `rejectionHistory`: 拒绝历史（可选）

**返回**：每日子任务列表

**位置**：`src/lib/agent-llm.ts`

---

### 2. insuranceDSplitTask

**作用**：insurance-d 拆分 daily_tasks，生成 agent_sub_tasks

**参数**：
- `commandResultId`: daily_tasks 记录的 ID

**返回**：
```typescript
{
  success: true,
  subTaskCount: 3,
  firstSubTaskStarted: true,
  subTasks: [
    { orderIndex: 1, title: "步骤1：收集案例素材", executor: "insurance-d", isCritical: true },
    { orderIndex: 2, title: "步骤2：撰写文章初稿", executor: "insurance-d", isCritical: false },
    { orderIndex: 3, title: "步骤3：合规校验", executor: "insurance-d", isCritical: true },
  ],
}
```

**位置**：`src/lib/services/task-assignment-service.ts`

---

### 3. splitTaskForAgent

**作用**：通用任务拆分函数，使用 LLM 智能拆分任务

**参数**：
- `agentId`: Agent ID
- `commandResult`: 任务信息

**返回**：子任务列表

**位置**：`src/lib/agent-llm.ts`

---

## API 列表

| API | 方法 | 作用 | 调用者 |
|-----|------|------|--------|
| `/api/split-insurance-d-task` | POST | Agent B 拆分总任务，生成 daily_tasks | Agent B |
| `/api/agents/insurance-d/split-task` | POST | insurance-d 拆分任务，生成 agent_sub_tasks | insurance-d |
| `/api/agents/[id]/subtasks` | POST | Agent 拆分子任务（通用接口） | 任意 Agent |
| `/api/subtasks/[id]/status` | PUT | 更新子任务状态 | insurance-d |
| `/api/subtasks/list` | GET | 获取子任务列表 | 任意 Agent |

---

## 数据表结构

### daily_tasks（每日任务表，也叫 command_result）

| 字段 | 类型 | 说明 |
|-----|------|------|
| id | uuid | 主键 |
| task_id | text | 任务 ID（唯一） |
| related_task_id | text | 关联的总任务 ID |
| task_title | text | 任务标题 |
| task_description | text | 任务描述 |
| executor | text | 执行者 |
| execution_status | text | 执行状态：new/in_progress/completed |
| sub_task_count | integer | 子任务数量 |
| completed_sub_tasks | integer | 已完成子任务数量 |
| execution_result | text | 执行结果（JSON） |

---

### agent_sub_tasks（Agent 子任务表）

| 字段 | 类型 | 说明 |
|-----|------|------|
| id | uuid | 主键 |
| command_result_id | uuid | 关联的 daily_tasks 记录 ID（外键） |
| agent_id | text | 所属 agent：insurance-d |
| task_title | text | 子任务标题 |
| task_description | text | 子任务描述 |
| status | text | 执行状态：pending/in_progress/completed/blocked |
| order_index | integer | 执行顺序（1, 2, 3, ...） |
| execution_result | text | 执行结果（JSON） |
| status_proof | text | 状态证明（文本或附件路径） |
| metadata | jsonb | 元数据（验收标准、是否关键、执行者等） |

---

## 关键特性

### 1. 自动启动第一个子任务

insurance-d 拆分任务后，会立即将第一个子任务（`order_index = 1`）的状态设置为 `in_progress`，并更新父任务状态为 `in_progress`。

```typescript
const firstSubTask = subTasks.find(st => st.orderIndex === 1);
if (firstSubTask) {
  await db
    .update(agentSubTasks)
    .set({
      status: 'in_progress',
      startedAt: new Date(),
    })
    .where(
      and(
        eq(agentSubTasks.commandResultId, commandResultId),
        eq(agentSubTasks.orderIndex, 1)
      )
    );
}
```

### 2. 防止重复拆分

在拆分任务前，会检查 `sub_task_count > 0`，如果已经拆分过，则直接返回，避免重复拆分。

```typescript
if (commandResult.subTaskCount > 0) {
  return { success: true, message: '指令已拆分' };
}
```

### 3. 关键子任务标记

子任务可以标记为关键任务（`isCritical = true`），方便优先处理和监控。

```typescript
metadata: {
  acceptanceCriteria: subTask.acceptanceCriteria,
  isCritical: subTask.isCritical,
  criticalReason: subTask.criticalReason,
  executor: subTask.executor,
}
```

---

## 常见问题

### Q1: insurance-d 拆分任务的入口是什么？

A: 有两个入口：
1. **自动触发**：Agent B 下发任务给 insurance-d 后，自动调用 `/api/agents/insurance-d/split-task`
2. **手动触发**：通过前端页面或 API 直接调用 `/api/agents/insurance-d/split-task`

### Q2: 如何查看子任务的执行进度？

A: 可以通过以下方式：
1. 查询 `agent_sub_tasks` 表，按 `order_index` 排序
2. 调用 `/api/subtasks/list` 获取子任务列表
3. 查询 `daily_tasks` 表的 `completed_sub_tasks` 字段

### Q3: 子任务执行失败怎么办？

A: 子任务状态可以是 `blocked`，表示执行受阻。此时需要：
1. 查看子任务的 `execution_result` 了解失败原因
2. 修复问题后，将状态改回 `pending`，重新执行
3. 或者直接将状态设置为 `completed`，跳过此子任务

### Q4: 如何调整子任务的执行顺序？

A: 修改 `order_index` 字段即可。建议：
1. 先暂停任务（将状态设置为 `blocked`）
2. 修改 `order_index`
3. 恢复任务（将状态改回 `pending`）

---

## 示例

### 示例 1：完整的任务拆解流程

```typescript
// 1. Agent B 拆分总任务
const response1 = await fetch('/api/split-insurance-d-task', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    taskId: 'task-A-to-B-xxx',
    totalDays: 5,
    startDate: '2026-02-13',
  }),
});
const result1 = await response1.json();
// result1 包含 5 条 daily_tasks 记录

// 2. insurance-d 拆分第一条任务
const response2 = await fetch('/api/agents/insurance-d/split-task', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    commandResultId: result1.dailyTasks[0].id,
  }),
});
const result2 = await response2.json();
// result2.subTaskCount = 3
// result2 包含 3 条 agent_sub_tasks 记录
// 第一个子任务自动启动

// 3. 查询子任务列表
const response3 = await fetch('/api/subtasks/list');
const result3 = await response3.json();
// result3 包含所有状态为 in_progress 的子任务
```

---

## 相关文档

- [任务 ID 不匹配修复文档](./task-id-mismatch-fix.md)
- [累积拒绝原因功能实现文档](./cumulative-rejection-history.md)

# 第三阶段：后端支持 - 详细设计方案

## 📋 文档说明

本文档梳理第三阶段（后端支持）的实现方案，供评审使用。

---

## 📚 参考的设计文档和代码

### 1. 已参考的设计文档

| 文档名称 | 路径 | 参考内容 |
|---------|------|---------|
| Agent B 与执行Agent通用交互框架 | `assets/1、agent B推进执行agent的标准化流程-未来同样交互逻辑范本.md` | 整体交互流程、状态流转、历史记录规则 |
| 子任务执行逻辑分析 | `SUBTASK_EXECUTION_LOGIC.md` | 子任务执行逻辑、定时任务扫描思路 |
| executeCompleteWorkflow 代码梳理 | `EXECUTE_COMPLETE_WORKFLOW_CODE_WALKTHROUGH.md` | 完整工作流程代码实现 |

### 2. 已参考的代码

| 代码文件 | 参考内容 |
|---------|---------|
| `src/lib/services/subtask-execution-engine.ts` | SubtaskExecutionEngine 类、getPendingTasks() 方法 |
| `src/lib/cron/index.ts` | manuallyExecuteInProgressSubtasks() 函数 |
| `src/app/api/cron/execute-in-progress-subtasks/route.ts` | 定时任务触发 API |
| `src/app/api/agents/user-decision/route.ts`（原有） | 用户重新决策的实现逻辑 |

---

## 🎯 第三阶段功能设计方案

### 1. 功能概述

**目标**：实现 `waiting_user` 状态任务的用户决策提交和任务继续执行机制

**核心流程**：
```
任务执行到需要用户确认
    ↓
状态变为 waiting_user
    ↓
用户在 Agent A 对话页面看到待办任务
    ↓
用户点击任务进行交互（确认字段、选择方案等）
    ↓
提交用户决策到 API
    ↓
API 记录交互历史、更新状态、触发继续执行
    ↓
任务继续执行直至完成
```

---

### 2. 重要修复

#### 2.1 问题发现

用户提出了一个关键问题：
> **你有带着用户提供的信息或者提示词，让Agent B分析总结后载给执行agent处理吗？还是直接把用户提供的信息做为提示词给执行agent？**

**答案**：之前没有！我发现了一个重要的缺失：

- ❌ **之前的问题**：`executeCompleteWorkflow` 方法在开始时没有从 `agent_sub_tasks_step_history` 表中加载历史交互记录
- ❌ **之前的问题**：即使用户提交了决策，下次执行时也不会把用户交互带入到 Agent B 的决策上下文中

#### 2.2 修复方案

**已修复 `SubtaskExecutionEngine` 中的关键问题：

1. ✅ **新增 `parseHistoryRecords()` 方法
   - 从 `agent_sub_tasks_step_history` 表中解析历史记录
   - 恢复 `mcpExecutionHistory`、`userInteractions`、`executorResult`

2. ✅ **修改 `executeCompleteWorkflow()` 方法**
   - 在开始时检查是否有历史记录
   - 如果有历史记录，从历史中恢复状态
   - 如果没有历史记录，从头开始执行
   - 将恢复的用户交互正确地传递给 Agent B 的决策上下文

3. ✅ **验证 executorResult**
   - 确保在进入 Agent B 循环决策之前，executorResult 是有效的

---

### 3. 数据库表结构确认

#### 3.1 agent_sub_tasks_step_history 表

**核心字段**：

| 字段名 | 数据类型 | 说明 |
|--------|---------|------|
| `id` | serial | 主键 |
| `command_result_id` | uuid | 关联 agent_sub_tasks.command_result_id |
| `step_no` | integer | 步骤编号（对应 agent_sub_tasks.order_index）|
| `interact_type` | text | 交互类型：'request' \| 'response' |
| `interact_content` | jsonb | 结构化交互内容 |
| `interact_user` | text | 交互发起方：'insurance-d' \| 'agent B' \| 'human' |
| `interact_time` | timestamp | 交互发生时间 |
| `interact_num` | integer | 同 command_result_id + step_no 下的交流次数（从1开始）|

**唯一约束**：
- `idx_task_step_num_type_user`: (command_result_id, step_no, interact_num, interact_type, interact_user)

---

### 4. 用户决策 API 设计

#### 4.1 API 端点

**URL**: `POST /api/agents/user-decision`

**功能**：
- 接收用户决策
- 支持两种场景：
  1. `decisionType='redecision'`: 用户重新决策（原有功能）
  2. `decisionType='waiting_user'`: 用户确认 waiting_user 状态的任务（新增功能）

#### 4.2 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `subTaskId` | string | ✅ | 子任务 ID |
| `commandResultId` | string | ✅ | 指令结果 ID（daily_task ID）|
| `userDecision` | string | ✅ | 用户决策/建议内容 |
| `decisionType` | string | ❌ | 决策类型：'redecision' \| 'waiting_user'（默认 'redecision'）|
| `interactionData` | object | ❌ | 交互数据（waiting_user 场景专用）|

**interactionData 结构**（waiting_user 场景）：
```json
{
  "fieldValues": {
    "fieldId1": "value1",
    "fieldId2": "value2"
  },
  "selectedSolution": "solutionId",
  "notes": "用户备注"
}
```

#### 4.3 响应格式

**成功响应**：
```json
{
  "success": true,
  "message": "用户确认已记录，任务将继续执行",
  "data": {
    "subTaskId": "子任务ID",
    "commandResultId": "指令结果ID",
    "originalCommand": "原始指令",
    "userDecision": "用户决策内容",
    "decisionType": "waiting_user",
    "interactionHistoryCount": 5,
    "interactNum": 6,
    "executionTriggered": true
  }
}
```

**错误响应**：
```json
{
  "success": false,
  "error": "错误描述"
}
```

---

### 5. 核心处理流程

#### 5.1 步骤1：参数验证

```typescript
// 验证必填参数
if (!subTaskId || !commandResultId || !userDecision) {
  return 400 错误
}
```

#### 5.2 步骤2：查询子任务和任务信息

```typescript
// 查询子任务
const subTask = await db.query.agentSubTasks.findFirst({
  where: eq(agentSubTasks.id, subTaskId),
})

// 查询 daily_task
const task = await db.query.dailyTask.findFirst({
  where: eq(dailyTask.id, commandResultId),
})
```

#### 5.3 步骤3：查询交互历史并计算 nextInteractNum

```typescript
// 查询该子任务的所有交互历史
const interactionHistory = await db
  .select()
  .from(agentSubTasksStepHistory)
  .where(
    and(
      eq(agentSubTasksStepHistory.commandResultId, commandResultId),
      eq(agentSubTasksStepHistory.stepNo, subTask.orderIndex)
    )
  )
  .orderBy(agentSubTasksStepHistory.interactTime)

// 计算下一个交互编号
const nextInteractNum = interactionHistory.length > 0 
  ? Math.max(...interactionHistory.map(h => h.interactNum || 1)) + 1
  : 1
```

#### 5.4 步骤4：根据决策类型记录交互历史

**场景1：waiting_user 确认

```typescript
const interactContent = {
  type: 'user_decision',
  decisionType: 'waiting_user_confirm',
  userDecision: userDecision,
  interactionData: interactionData || {},
  timestamp: new Date().toISOString(),
}

await db.insert(agentSubTasksStepHistory).values({
  commandResultId: commandResultId,
  stepNo: subTask.orderIndex,
  interactType: 'response',
  interactContent: interactContent,
  interactUser: 'human',
  interactTime: new Date(),
  interactNum: nextInteractNum,
})
```

**场景2：用户重新决策（原有逻辑）

```typescript
const userQuestionContent = createArtificialQuestionContent({
  consultant: '人工',
  responder: subTask.fromParentsExecutor,
  question: userDecision,
  response: '',
  executionResult: { status: 'waiting' },
  extInfo: {
    originalCommand,
    interactionCount: interactionHistory.length,
  },
})

await db.insert(agentSubTasksStepHistory).values({
  commandResultId: commandResultId,
  stepNo: subTask.orderIndex,
  interactType: 'response',
  interactContent: userQuestionContent,
  interactUser: 'human',
  interactTime: new Date(),
  interactNum: nextInteractNum,
})
```

#### 5.5 步骤5：更新任务状态为 in_progress

```typescript
// 更新 agent_sub_tasks 状态
await db
  .update(agentSubTasks)
  .set({
    status: 'in_progress',
    updatedAt: new Date(),
  })
  .where(eq(agentSubTasks.id, subTaskId);

// 更新 daily_task（根据场景）
const updateData: any = {
  updatedAt: new Date(),
};

if (decisionType !== 'waiting_user') {
  // 只有重新决策场景才取消 requiresIntervention
  updateData.requiresIntervention = false
}

await db
  .update(dailyTask)
  .set(updateData)
  .where(eq(dailyTask.id, commandResultId));
```

#### 5.6 步骤6：触发任务继续执行

```typescript
// 异步触发，不阻塞 API 响应
manuallyExecuteInProgressSubtasks().catch(error => {
  console.error('[User Decision] 触发任务执行失败:', error)
})
```

---

### 6. SubtaskExecutionEngine 已支持 waiting_user 状态

**好消息**：在实现第三阶段之前，`SubtaskExecutionEngine` 已经支持 `waiting_user` 状态！

#### 6.1 getPendingTasks() 方法

```typescript
private async getPendingTasks() {
  const now = getCurrentBeijingTime()
  const today = formatDate(now)
  
  return await db
    .select()
    .from(agentSubTasks)
    .where(
      and(
        lte(agentSubTasks.executionDate, today),
        or(
          eq(agentSubTasks.status, 'pending'),
          eq(agentSubTasks.status, 'in_progress'),
          eq(agentSubTasks.status, 'waiting_user')  // ✅ 已包含 waiting_user
        )
      )
    )
    .orderBy(
      agentSubTasks.fromParentsExecutor, 
      agentSubTasks.executionDate, 
      agentSubTasks.orderIndex
    )
}
```

---

### 7. 触发任务继续执行的机制

#### 7.1 manuallyExecuteInProgressSubtasks() 函数

**位置**：`src/lib/cron/index.ts`

**功能**：实例化 `SubtaskExecutionEngine` 并调用其 `execute()` 方法

```typescript
export async function manuallyExecuteInProgressSubtasks() {
  console.log('🔔 [手动触发] 开始执行 in_progress 子任务...')
  
  try {
    // 1. 实例化子任务执行引擎
    const { SubtaskExecutionEngine } = await import('@/lib/services/subtask-execution-engine')
    const engine = new SubtaskExecutionEngine()
    
    // 2. 执行引擎
    await engine.execute()
    
    console.log('✅ [手动触发] in_progress 子任务执行完成')
  } catch (error) {
    console.error('❌ [手动触发] 执行失败:', error)
    throw error
  }
}
```

#### 7.2 SubtaskExecutionEngine.execute() 方法

**执行流程**：
1. 调用 `getPendingTasks()` 获取待执行任务（包含 waiting_user 状态）
2. 按 `fromParentsExecutor` + `executionDate` 分组
3. 对每个分组调用 `processGroup()`
4. `processGroup()` 按 `orderIndex` 顺序处理任务
5. 只有当前面的任务都完成了，才会执行下一个任务

---

### 8. 完整数据流图（已修复）

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. 用户在 Agent A 对话页面看到 waiting_user 状态的待办任务    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. 用户点击任务，进行交互（确认字段、选择方案等）              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. 前端调用 POST /api/agents/user-decision                     │
│    参数：{                                                      │
│      subTaskId, commandResultId, userDecision,                │
│      decisionType: 'waiting_user', interactionData             │
│    }                                                             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. API 验证参数、查询子任务和任务信息                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. 查询交互历史，计算 nextInteractNum                           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. 记录用户交互到 agent_sub_tasks_step_history                  │
│    - interactType: 'response'                                    │
│    - interactUser: 'human'                                       │
│    - interactNum: nextInteractNum                                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. 更新 agent_sub_tasks 状态为 'in_progress'                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. 异步调用 manuallyExecuteInProgressSubtasks()                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 9. SubtaskExecutionEngine.execute() 执行                         │
│    - 首先检查是否有历史记录                                  │
│    - 如果有历史，从历史恢复 mcpExecutionHistory, userInteractions │
│    - 将用户交互正确传递给 Agent B 的决策上下文                  │
│    - Agent B 基于用户交互继续执行直至完成                        │
└─────────────────────────────────────────────────────────────────┘
```

---

### 9. 关键设计决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 决策类型参数 | `decisionType` | 支持两种场景，向后兼容 |
| 交互历史记录 | 复用 `agent_sub_tasks_step_history` | 统一历史记录管理 |
| 交互编号计算 | `Math.max(历史.interactNum) + 1` | 确保交互编号递增 |
| 触发执行方式 | 异步调用，不阻塞 API | 提升用户体验 |
| waiting_user 状态查询 | 已在 `getPendingTasks()` 中支持 | 无需额外修改 |
| **历史记录加载** | **在 executeCompleteWorkflow 开始时加载** | **确保用户交互能被 Agent B 正确处理** |

---

### 10. 修改的文件清单

| 文件路径 | 操作 | 说明 |
|---------|------|------|
| `src/lib/services/subtask-execution-engine.ts` | ✏️ 修改 | 添加历史记录加载和解析逻辑 |
| `src/app/api/agents/user-decision/route.ts` | ✏️ 修改 | 完善用户决策 API，支持 waiting_user 场景 |

---

## ✅ 总结

### 已实现的功能

1. ✅ **用户决策 API 增强**：支持 `decisionType='waiting_user'` 场景
2. ✅ **交互历史记录**：正确记录用户交互到 `agent_sub_tasks_step_history`
3. ✅ **状态更新**：将任务状态更新为 `in_progress`
4. ✅ **触发继续执行**：异步调用 `manuallyExecuteInProgressSubtasks()`
5. ✅ **复用现有引擎**：`SubtaskExecutionEngine` 已支持 `waiting_user` 状态
6. ✅ **🔧 **重要修复**：修复了历史记录加载逻辑，确保用户交互能被 Agent B 正确处理

### 与现有系统的集成

- ✅ **与第二阶段待办任务列表无缝集成
- ✅ **与 SubtaskExecutionEngine 无缝集成
- ✅ **与定时任务系统无缝集成

---

**文档生成时间**：2026-03-08  
**文档版本**：v1.1（已修复历史记录加载问题）

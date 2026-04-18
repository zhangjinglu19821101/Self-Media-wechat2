# 完善后的状态机改造方案（方案B）

## 📋 概述

基于现有代码，参考备份代码进行状态机改造。

**核心要求**：
1. ✅ 删除 `executeCompleteWorkflow` 方法
2. ✅ 保留 MCP 调用的日志登记逻辑：`agent_sub_tasks_mcp_executions`
3. ✅ 采用方案B：记录执行Agent的求助 + Agent B的回应

---

## 🎯 核心改造要点

### 1. 删除的方法
- ❌ `executeCompleteWorkflow()` - 完整工作流程方法
- ❌ `executeCompleteWorkflowLegacy()` -  legacy 工作流程方法

### 2. 保留的方法
- ✅ `createInteractionStep()` - 包含 MCP 执行日志登记逻辑
- ✅ `agent_sub_tasks_mcp_executions` 表的写入逻辑

### 3. 新增/恢复的方法
- ✅ `handlePendingStatus()` - 处理 pending 状态（执行Agent，**记录执行Agent的求助**）
- ✅ `handlePreCompletedStatus()` - 处理 pre_completed 状态（Agent B评审）
- ✅ `handlePreNeedSupportStatus()` - 处理 pre_need_support 状态（Agent B评审，**记录Agent B的回应**）
- ✅ 相关的辅助方法

---

## 📊 状态机设计

### 完整状态列表

| 状态 | 说明 | 责任方 |
|--------|------|--------|
| `pending` | 待执行 | - |
| `in_progress` | 执行Agent正在处理 | 执行Agent |
| `pre_completed` | 执行Agent完成，等待Agent B评审 | 等待Agent B |
| `pre_need_support` | 执行Agent需要帮助，等待Agent B评审 | 等待Agent B |
| `completed` | 已完成 | - |
| `waiting_user` | 等待用户 | - |
| `need_support` | 需要支持（兜底） | - |

### 状态流转图

```
阶段1：执行Agent独立处理
  ↓
pending → in_progress
  ↓
  ├─ 能独立完成 → pre_completed → 等待Agent B评审
  │   ↓
  │   ✅ 记录：执行Agent完成（request）
  │
  └─ 需要帮助 → pre_need_support → 等待Agent B评审
      ↓
      ✅ 记录：执行Agent求助（request）

阶段2：Agent B评审
  ↓
pre_completed → Agent B评审
  ↓
  ✅ 记录：Agent B回应（response）
  ├─ APPROVE → completed
  ├─ NEED_REVISE → pending（回到执行Agent重新执行）
  └─ NEED_USER → waiting_user

pre_need_support → Agent B评审
  ↓
  ✅ 记录：Agent B回应（response）
  ├─ CAN_HELP → pending（回到执行Agent，带着Agent B的帮助）
  └─ NEED_USER → waiting_user
```

---

## 🏗️ 核心方法设计（方案B）

### 方法1：`handlePendingStatus` - 执行Agent处理（方案B）

**职责**：处理 `pending` 状态，执行Agent独立处理任务，**记录执行Agent的求助**

**流程（方案B）**：
```
步骤1：更新状态为 in_progress
步骤2：获取前序结果（链式传递）
步骤3：调用执行Agent直接处理
步骤4：根据结果更新状态
  ├─ 能完成 → pre_completed
  │   ↓
  │   ✅ 记录：执行Agent完成（request）
  │
  └─ 需要帮助 → pre_need_support
      ↓
      ✅ 记录：执行Agent求助（request）
```

**输入参数**：
- `task`: 当前任务
- `allTasksInGroup`: 同一组的所有任务（用于链式传递）

**关键改动（方案B）**：
- ✅ 在步骤4中，记录执行Agent的完成或求助到 `agent_sub_tasks_step_history`

---

### 方法2：`handlePreCompletedStatus` - Agent B评审

**职责**：处理 `pre_completed` 状态，Agent B评审执行Agent的完成结果

**流程（6步严谨设计）**：
```
第一步：准备阶段（验证）
  - 验证任务存在
  - 验证状态正确
  - 验证执行者信息

第二步：调用 Agent B
  - 调用 Agent B 进行评审
  - 捕获网络错误、超时错误等

第三步：解析响应
  - 提取 JSON 格式的响应
  - 验证必要字段
  - 验证决策类型

第四步：处理评审结果并记录 response
  - ✅ 记录：Agent B回应（response）
  - 根据决策类型处理
    ├─ APPROVE → 标记为 completed
    ├─ NEED_REVISE → 回到 pending
    └─ NEED_USER → 标记为 waiting_user

第五步：最后更新状态
  - 所有逻辑都成功了，才更新数据库
  - 确保数据一致性
```

**Agent B决策类型（pre_completed）**：
- `APPROVE`：批准，直接标记为完成
- `NEED_REVISE`：需要修改，让执行Agent重新执行
- `NEED_USER`：需要用户确认

**关键改动（方案B）**：
- ❌ 不需要第二步的"记录 Agent B request"（因为执行Agent的request已经在 `handlePendingStatus` 中记录了）
- ✅ 第四步：记录 Agent B response

---

### 方法3：`handlePreNeedSupportStatus` - Agent B评审（方案B）

**职责**：处理 `pre_need_support` 状态，Agent B评审执行Agent的求助请求

**流程（方案B，6步严谨设计）**：
```
第一步：准备阶段（验证）
  - 验证任务存在
  - 验证状态正确
  - 验证执行者信息

第二步：调用 Agent B
  - 调用 Agent B 进行评审
  - 捕获网络错误、超时错误等

第三步：解析响应
  - 提取 JSON 格式的响应
  - 验证必要字段
  - 验证决策类型

第四步：处理评审结果并记录 response
  - ✅ 记录：Agent B回应（response）
  - 根据决策类型处理
    ├─ CAN_HELP → 回到 pending（带着Agent B的帮助）
    └─ NEED_USER → 标记为 waiting_user

第五步：最后更新状态
  - 所有逻辑都成功了，才更新数据库
  - 确保数据一致性
```

**Agent B决策类型（pre_need_support）**：
- `CAN_HELP`：可以提供帮助，回到执行Agent
- `NEED_USER`：需要用户确认

**关键改动（方案B）**：
- ❌ 不需要第二步的"记录 Agent B request"（因为执行Agent的request已经在 `handlePendingStatus` 中记录了）
- ✅ 第四步：记录 Agent B response

---

### 方法4：`createInteractionStep` - 保留（包含MCP日志登记）

**职责**：创建交互记录，包含 MCP 执行日志登记

**核心逻辑（保留）**：
```typescript
// 插入 agent_sub_tasks_step_history
const [stepHistory] = await tx.insert(agentSubTasksStepHistory)
  .values({...})
  .returning({ id: agentSubTasksStepHistory.id });

// 插入 agent_sub_tasks_mcp_executions（保留！）
const mcpAttempts = content?.response?.mcp_attempts;
if (mcpAttempts && Array.isArray(mcpAttempts) && mcpAttempts.length > 0) {
  for (const attempt of mcpAttempts) {
    await tx.insert(agentSubTasksMcpExecutions)
      .values({...});
  }
}
```

**关键点**：
- ✅ 保留 `agent_sub_tasks_mcp_executions` 表的写入逻辑
- ✅ 这个方法不需要修改，直接保留

---

## 📋 详细交互记录设计（方案B）

### 场景1：执行Agent完成，Agent B批准

**交互记录**：
```
1. request（interactNum=1）
   - interactType: 'request'
   - interactUser: 执行Agent
   - question: { status_type: 'pre_completed', executor_result: ... }
   - ext_info: { step: 'executor_completed' }

2. response（interactNum=1）
   - interactType: 'response'
   - interactUser: 'agent B'
   - response: { decision: { type: 'APPROVE', ... } }
   - ext_info: { step: 'agent_b_review_completed' }
```

---

### 场景2：执行Agent求助，Agent B提供帮助

**交互记录**：
```
1. request（interactNum=1）
   - interactType: 'request'
   - interactUser: 执行Agent
   - question: { status_type: 'pre_need_support', suggestion: ... }
   - ext_info: { step: 'executor_need_help' }

2. response（interactNum=1）
   - interactType: 'response'
   - interactUser: 'agent B'
   - response: { decision: { type: 'CAN_HELP', ... } }
   - ext_info: { step: 'agent_b_review_need_help' }
```

---

## 📝 详细改造清单（方案B）

### 阶段1：修改状态机主流程

#### 改造1.1：修改 `processGroup()` 方法

**现有代码**：
```typescript
// 处理 pre_completed 和 pre_need_support 状态（兼容旧数据）
for (const task of currentStepTasks) {
  if (task.status === 'pre_completed' || task.status === 'pre_need_support') {
    console.log('[SubtaskEngine] 兼容处理旧状态: ' + task.status + ', 切换为完整工作流程');
    await this.executeCompleteWorkflow(task);
    return;
  }
}
```

**改造后**：
```typescript
// 处理 pre_completed 和 pre_need_support 状态（Agent B评审）
for (const task of currentStepTasks) {
  if (task.status === 'pre_completed') {
    console.log('[SubtaskEngine] 处理 pre_completed 状态: Agent B评审');
    await this.handlePreCompletedStatus(task);
    return;
  }
  if (task.status === 'pre_need_support') {
    console.log('[SubtaskEngine] 处理 pre_need_support 状态: Agent B评审');
    await this.handlePreNeedSupportStatus(task);
    return;
  }
}
```

---

#### 改造1.2：修改 `executeStepTasks()` 方法

**现有代码**：
```typescript
private async executeStepTasks(tasks: typeof agentSubTasks.$inferSelect[]) {
  for (const task of tasks) {
    if (task.status === 'pending') {
      console.log(`[SubtaskEngine] 启动任务: ${task.id}, order_index = ${task.orderIndex}`);
      
      await db
        .update(agentSubTasks)
        .set({
          status: 'in_progress',
          startedAt: getCurrentBeijingTime(),
          updatedAt: getCurrentBeijingTime(),
        })
        .where(eq(agentSubTasks.id, task.id));

      await this.executeCompleteWorkflow(task);
    }
  }
}
```

**改造后**：
```typescript
private async executeStepTasks(tasks: typeof agentSubTasks.$inferSelect[]) {
  for (const task of tasks) {
    if (task.status === 'pending') {
      console.log(`[SubtaskEngine] 启动任务: ${task.id}, order_index = ${task.orderIndex}`);
      await this.handlePendingStatus(task, tasks);
    }
  }
}
```

---

### 阶段2：从备份代码中恢复核心方法（方案B）

#### 需要从备份代码中恢复的方法清单：

| 方法名 | 备份代码行号 | 说明 | 方案B改动 |
|---------|-------------|------|-----------|
| `handlePendingStatus()` | 499-557 | 处理 pending 状态 | ✅ 增加记录执行Agent的request |
| `handlePreCompletedStatus()` | 560-650 | 处理 pre_completed 状态 | ❌ 删除第二步的记录request，只记录response |
| `handlePreNeedSupportStatus()` | 653-743 | 处理 pre_need_support 状态 | ❌ 删除第二步的记录request，只记录response |
| `getNextInteractNum()` | - | 获取历史记录并计算下一个交互编号 | - |
| `validateTaskBeforeReview()` | - | 任务验证 | - |
| `callAgentBForReview()` | - | 调用 Agent B | - |
| `parseAgentBResponse()` | - | 解析响应 | - |
| `processReviewResult()` | - | 处理评审结果并记录 response | - |
| `processPreCompletedReviewResult()` | - | 处理 pre_completed 的评审结果 | - |
| `processPreNeedSupportReviewResult()` | - | 处理 pre_need_support 的评审结果 | - |
| `updateTaskStatus()` | - | 最后更新状态 | - |
| `handlePreCompletedException()` | - | 处理 pre_completed 异常 | - |
| `handlePreNeedSupportException()` | - | 处理 pre_need_support 异常 | - |
| `callExecutorAgentDirectly()` | - | 直接调用执行Agent处理任务 | - |
| `parseExecutorResponse()` | - | 解析执行Agent的响应 | - |
| `getPreviousStepResult()` | - | 获取前序任务的执行结果（链式传递） | - |

---

### 阶段3：删除旧方法

#### 需要删除的方法：

| 方法名 | 说明 |
|---------|------|
| `executeCompleteWorkflow()` | 完整工作流程方法 |
| `executeCompleteWorkflowLegacy()` | legacy 工作流程方法 |

---

### 阶段4：保留的方法（不需要修改）

#### 需要保留的方法：

| 方法名 | 说明 |
|---------|------|
| `createInteractionStep()` | 包含 MCP 执行日志登记逻辑（保留！） |
| `markTaskCompleted()` | 标记任务完成 |
| `markTaskWaitingUser()` | 标记任务等待用户 |
| `updateDailyTaskProgress()` | 更新 dailyTask 进度 |
| `checkAndHandleTimeout()` | 检查并处理超时 |
| `executeTimeoutWorkflow()` | 执行超时工作流程 |
| 其他现有辅助方法 | - |

---

## 🎯 关键设计亮点（方案B）

### 1. 完整的交互记录
- ✅ 记录执行Agent的完成或求助（request）
- ✅ 记录Agent B的回应（response）
- ✅ 成对的request-response，便于审计和追溯

### 2. 职责清晰
- 执行Agent：`pending` → `in_progress` → `pre_completed`/`pre_need_support`
- Agent B：`pre_completed`/`pre_need_support` → 评审 → 最终状态

### 3. 6步严谨流程
- 确保数据一致性
- 所有逻辑都成功了，才更新状态
- 异常处理：不同异常不同处理，状态不回退

### 4. 保留 MCP 日志登记
- ✅ 保留 `createInteractionStep()` 方法
- ✅ 保留 `agent_sub_tasks_mcp_executions` 表的写入逻辑
- ✅ 不需要修改这个方法

### 5. 删除旧方法
- ❌ 删除 `executeCompleteWorkflow()` 方法
- ❌ 删除 `executeCompleteWorkflowLegacy()` 方法

---

## 📋 改造步骤详细清单（方案B）

### 步骤1：备份现有代码
- [ ] 备份 `src/lib/services/subtask-execution-engine.ts`
- [ ] 确认备份成功

### 步骤2：修改状态机主流程
- [ ] 修改 `processGroup()` 方法
- [ ] 修改 `executeStepTasks()` 方法

### 步骤3：从备份代码中恢复核心方法（方案B）
- [ ] 恢复 `handlePendingStatus()` 方法（**增加记录执行Agent的request**）
- [ ] 恢复 `handlePreCompletedStatus()` 方法（**删除第二步的记录request，只记录response**）
- [ ] 恢复 `handlePreNeedSupportStatus()` 方法（**删除第二步的记录request，只记录response**）
- [ ] 恢复 `getNextInteractNum()` 方法
- [ ] 恢复 `validateTaskBeforeReview()` 方法
- [ ] 恢复 `callAgentBForReview()` 方法
- [ ] 恢复 `parseAgentBResponse()` 方法
- [ ] 恢复 `processReviewResult()` 方法
- [ ] 恢复 `processPreCompletedReviewResult()` 方法
- [ ] 恢复 `processPreNeedSupportReviewResult()` 方法
- [ ] 恢复 `updateTaskStatus()` 方法
- [ ] 恢复 `handlePreCompletedException()` 方法
- [ ] 恢复 `handlePreNeedSupportException()` 方法
- [ ] 恢复 `callExecutorAgentDirectly()` 方法
- [ ] 恢复 `parseExecutorResponse()` 方法
- [ ] 恢复 `getPreviousStepResult()` 方法（如果需要）

### 步骤4：删除旧方法
- [ ] 删除 `executeCompleteWorkflow()` 方法
- [ ] 删除 `executeCompleteWorkflowLegacy()` 方法

### 步骤5：验证代码语法
- [ ] 运行 TypeScript 类型检查
- [ ] 修复语法错误

### 步骤6：测试验证
- [ ] 单元测试
- [ ] 集成测试
- [ ] 端到端测试

---

## ⚠️ 注意事项

### 1. 数据兼容性
- ✅ 现有状态已经支持，不需要迁移
- ✅ `pre_completed` 和 `pre_need_support` 状态已经在使用

### 2. MCP 日志登记
- ✅ 保留 `createInteractionStep()` 方法
- ✅ 保留 `agent_sub_tasks_mcp_executions` 表的写入逻辑
- ✅ 不需要修改这个方法

### 3. 交互记录（方案B）
- ✅ 记录执行Agent的完成或求助（request）
- ✅ 记录Agent B的回应（response）
- ✅ 成对的request-response

### 4. 异常处理
- 不同异常不同处理
- 状态不随意回退
- 确保数据一致性

---

## ✅ 改造后的优势（方案B）

1. **完整的交互记录**：记录执行Agent的求助 + Agent B的回应
2. **职责清晰**：执行Agent和Agent B的职责边界明确
3. **流程严谨**：6步流程确保数据一致性
4. **数据兼容**：现有状态已经支持，不需要迁移
5. **代码清晰**：基于备份代码，设计思路清晰
6. **保留 MCP 日志**：保留 `agent_sub_tasks_mcp_executions` 表的写入逻辑
7. **删除旧方法**：删除 `executeCompleteWorkflow()` 方法

---

**设计方案完成（方案B），请评审！** 🎉

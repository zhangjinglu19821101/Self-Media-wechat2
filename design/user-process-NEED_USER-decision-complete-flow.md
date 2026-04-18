# Agent B NEED_USER 决策 - 完整业务流程文档

## 📋 概述

本文档详细描述从 **Agent B 判断需要用户处理** 到 **用户处理完成、任务继续执行** 的完整业务流程。

---

## 🔄 完整业务流程图

```
┌─────────────────────────────────────────────────────────────────┐
│  阶段 1: Agent B 执行任务与决策                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  1.1 SubtaskExecutionEngine 执行任务                             │
│     - 调用执行 Agent (Insurance C/D)                              │
│     - 收集执行结果和交互历史                                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  1.2 Agent B 做出 NEED_USER 决策                                 │
│     - 分析执行反馈，判断需要用户介入                              │
│     - 返回 decision.type = 'NEED_USER'                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  1.3 调用 handleNeedUserDecision()                               │
│     - SubtaskExecutionEngine.handleNeedUserDecision()            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  阶段 2: 更新数据库状态 (写入端)                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  2.1 更新 agent_sub_tasks 表                                      │
│     UPDATE agent_sub_tasks                                        │
│     SET status = 'waiting_user',                                  │
│         updatedAt = NOW()                                         │
│     WHERE id = {subTaskId};                                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  2.2 插入 agent_sub_tasks_step_history 表                        │
│     INSERT INTO agent_sub_tasks_step_history                     │
│     (commandResultId, stepNo, interactType,                      │
│      interactContent, interactUser, interactTime, interactNum)   │
│     VALUES (                                                       │
│       {commandResultId},                                          │
│       {orderIndex},                                               │
│       'response',                                                 │
│       {NEED_USER 响应内容},                                       │
│       'agent B',                                                  │
│       NOW(),                                                      │
│       {interactNum}                                               │
│     );                                                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  阶段 3: 前端轮询/展示待办任务 (读取端)                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  3.1 前端调用 waiting-tasks API                                   │
│     GET /api/agents/{agentId}/waiting-tasks                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  3.2 查询 agent_sub_tasks 表                                      │
│     SELECT * FROM agent_sub_tasks                                 │
│     WHERE fromParentsExecutor = {agentId}                         │
│       AND status = 'waiting_user'                                 │
│     ORDER BY createdAt DESC;                                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  3.3 关联查询 agent_sub_tasks_step_history 表                    │
│     SELECT * FROM agent_sub_tasks_step_history                   │
│     WHERE commandResultId = {commandResultId}                     │
│       AND stepNo = {orderIndex}                                   │
│     ORDER BY interactTime DESC                                    │
│     LIMIT 1;                                                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  3.4 前端展示待办任务列表                                         │
│     - 显示任务标题、描述、优先级                                   │
│     - 显示待确认字段 (pending_key_fields)                         │
│     - 显示可选方案 (available_solutions)                          │
│     - 显示提示消息 (prompt_message)                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  阶段 4: 用户点击任务，打开对话框                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  4.1 用户点击待办任务                                             │
│     - 前端触发 handleWaitingTaskClick()                           │
│     - 设置 showUserInteractionDialog = true                       │
│     - 设置 selectedWaitingTask = {task}                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  4.2 渲染 UserInteractionDialog 组件                             │
│     - 显示任务详情                                                 │
│     - 显示待确认字段表单                                           │
│     - 显示可选方案单选按钮                                         │
│     - 显示确认/取消按钮                                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  阶段 5: 用户填写信息，提交决策                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  5.1 用户填写表单信息                                             │
│     - 填写待确认字段 (pending_key_fields)                         │
│     - 选择可选方案 (available_solutions)                          │
│     - 或输入自定义决策                                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  5.2 前端验证输入                                                 │
│     - 必填字段检查                                                 │
│     - 数据类型验证                                                 │
│     - 范围验证                                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  5.3 调用 user-decision API                                       │
│     POST /api/agents/user-decision                                │
│     BODY: {                                                       │
│       subTaskId: {subTaskId},                                     │
│       commandResultId: {commandResultId},                         │
│       userDecision: {userDecision},                               │
│       decisionType: 'waiting_user',                               │
│       interactionData: {                                           │
│         filledFields: {...},                                      │
│         selectedSolution: {...}                                   │
│       }                                                           │
│     }                                                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  阶段 6: 后端处理用户决策 (写入端)                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  6.1 验证参数                                                     │
│     - 检查 subTaskId, commandResultId, userDecision              │
│     - 查询子任务是否存在                                           │
│     - 查询 daily_task 是否存在                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  6.2 查询沟通历史                                                 │
│     SELECT * FROM agent_sub_tasks_step_history                   │
│     WHERE commandResultId = {commandResultId}                     │
│       AND stepNo = {orderIndex}                                   │
│     ORDER BY interactTime;                                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  6.3 计算下一个交互编号                                           │
│     nextInteractNum = MAX(interactNum) + 1                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  6.4 插入 agent_sub_tasks_step_history 表                        │
│     INSERT INTO agent_sub_tasks_step_history                     │
│     (commandResultId, stepNo, interactType,                      │
│      interactContent, interactUser, interactTime, interactNum)   │
│     VALUES (                                                       │
│       {commandResultId},                                          │
│       {orderIndex},                                               │
│       'response',                                                 │
│       {                                                           │
│         type: 'user_decision',                                    │
│         decisionType: 'waiting_user_confirm',                    │
│         userDecision: {userDecision},                             │
│         interactionData: {interactionData},                       │
│         timestamp: NOW()                                          │
│       },                                                          │
│       'human',                                                    │
│       NOW(),                                                      │
│       {nextInteractNum}                                           │
│     );                                                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  6.5 更新 agent_sub_tasks 表                                      │
│     UPDATE agent_sub_tasks                                        │
│     SET status = 'in_progress',                                   │
│         updatedAt = NOW()                                         │
│     WHERE id = {subTaskId};                                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  6.6 更新 daily_task 表 (可选)                                    │
│     UPDATE daily_task                                             │
│     SET updatedAt = NOW()                                         │
│     WHERE id = {commandResultId};                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  阶段 7: 触发任务继续执行                                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  7.1 调用 manuallyExecuteInProgressSubtasks()                    │
│     - 异步触发，不阻塞 API 响应                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  7.2 SubtaskExecutionEngine.execute()                            │
│     - 扫描 status = 'in_progress' 的任务                         │
│     - 继续执行任务                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  7.3 任务继续执行                                                 │
│     - 读取 agent_sub_tasks_step_history 中的用户决策              │
│     - 根据用户决策继续处理任务                                     │
│     - 直到任务完成或再次需要用户介入                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  ✅ 流程完成！                                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 详细阶段说明

### 阶段 1: Agent B 执行任务与决策

#### 1.1 SubtaskExecutionEngine 执行任务

**文件位置**: `src/lib/services/subtask-execution-engine.ts`

**核心逻辑**:
```typescript
// SubtaskExecutionEngine 执行主流程
async execute() {
  // 1. 获取 in_progress 状态的任务
  // 2. 对每个任务执行处理
  // 3. 调用执行 Agent
  // 4. 获取 Agent B 决策
  // 5. 根据决策处理
}
```

#### 1.2 Agent B 做出 NEED_USER 决策

**文件位置**: `src/lib/agents/agent-b/decision-maker.ts`

**决策逻辑**:
```typescript
export async function makeDecision(context: DecisionContext): Promise<DecisionResult> {
  // 1. 检查交互次数是否达到上限
  if (context.currentInteractionCount >= MAX_INTERACTIONS) {
    return {
      shouldContinue: false,
      shouldReport: true,
      reason: `交互次数达到上限 (${MAX_INTERACTIONS})，需要用户介入`,
    };
  }

  // 2. 分析执行 Agent 的反馈内容
  const feedbackAnalysis = analyzeExecutorFeedback(context.executorFeedback);

  // 3. 检查是否需要用户决策
  if (feedbackAnalysis.needsUserDecision) {
    return {
      shouldContinue: false,
      shouldReport: true,
      reason: '需要用户决策，上报 Agent A',
    };
  }

  // ... 其他决策逻辑
}

function analyzeExecutorFeedback(feedback: string): {
  isProblemSolved: boolean;
  needsMoreClarification: boolean;
  needsUserDecision: boolean;
} {
  const lowerFeedback = feedback.toLowerCase();

  // 检查是否需要用户决策
  const userDecisionKeywords = [
    '需要用户', '需要人工', '请用户', '请人工', '无法决定',
    '超出能力', '需要审批', '需要确认'
  ];
  const needsUserDecision = userDecisionKeywords.some(
    keyword => lowerFeedback.includes(keyword)
  );

  return {
    isProblemSolved,
    needsMoreClarification,
    needsUserDecision,
  };
}
```

#### 1.3 调用 handleNeedUserDecision()

**文件位置**: `src/lib/services/subtask-execution-engine.ts`

**调用时机**: 当 Agent B 返回 `decision.type = 'NEED_USER'` 时

---

### 阶段 2: 更新数据库状态 (写入端)

#### 2.1 更新 agent_sub_tasks 表

**SQL 示例**:
```sql
UPDATE agent_sub_tasks
SET status = 'waiting_user',
    updatedAt = '2024-01-15 10:30:00'
WHERE id = 'subtask-001';
```

**代码位置**: `src/lib/services/subtask-execution-engine.ts:912-918`

```typescript
await db
  .update(agentSubTasks)
  .set({
    status: 'waiting_user',
    updatedAt: getCurrentBeijingTime(),
  })
  .where(eq(agentSubTasks.id, task.id));
```

#### 2.2 插入 agent_sub_tasks_step_history 表

**SQL 示例**:
```sql
INSERT INTO agent_sub_tasks_step_history (
  commandResultId,
  stepNo,
  interactType,
  interactContent,
  interactUser,
  interactTime,
  interactNum
) VALUES (
  'daily-001',
  1,
  'response',
  '{
    "interact_type": "response",
    "consultant": "Insurance C",
    "responder": "agent B",
    "question": {...},
    "response": {
      "decision": {
        "type": "NEED_USER",
        "reason_code": "MISSING_INFO",
        "reasoning": "缺少客户预算信息",
        "final_conclusion": "等待用户处理"
      },
      "mcp_attempts": [...],
      "available_solutions": [
        {
          "id": "sol-1",
          "title": "按标准方案处理",
          "description": "使用默认预算范围"
        }
      ],
      "user_interactions": [...],
      "pending_key_fields": [
        {
          "name": "budget",
          "label": "客户预算",
          "type": "number",
          "required": true,
          "description": "请输入客户的预算范围"
        }
      ],
      "prompt_message": "请确认客户预算信息"
    },
    "execution_result": { "status": "waiting_user" },
    "ext_info": {
      "step": "agent_b_decision_need_user",
      "iteration": 1,
      "pending_key_fields": [...],
      "available_solutions": [...]
    }
  }',
  'agent B',
  '2024-01-15 10:30:00',
  2
);
```

**代码位置**: `src/lib/services/subtask-execution-engine.ts:920-946`

---

### 阶段 3: 前端轮询/展示待办任务 (读取端)

#### 3.1 前端调用 waiting-tasks API

**API 端点**: `GET /api/agents/{agentId}/waiting-tasks`

**文件位置**: `src/app/api/agents/[id]/waiting-tasks/route.ts`

#### 3.2 查询 agent_sub_tasks 表

**SQL 示例**:
```sql
SELECT * FROM agent_sub_tasks
WHERE fromParentsExecutor = 'agent-B'
  AND status = 'waiting_user'
ORDER BY createdAt DESC
LIMIT 50;
```

**代码位置**: `src/app/api/agents/[id]/waiting-tasks/route.ts:20-27`

#### 3.3 关联查询 agent_sub_tasks_step_history 表

**SQL 示例**:
```sql
SELECT * FROM agent_sub_tasks_step_history
WHERE commandResultId = 'daily-001'
  AND stepNo = 1
ORDER BY interactTime DESC
LIMIT 1;
```

**代码位置**: `src/app/api/agents/[id]/waiting-tasks/route.ts:45-61`

#### 3.4 前端展示待办任务列表

**组件位置**: `src/components/waiting-user-tasks.tsx`

**展示内容**:
- 任务标题、描述、优先级
- 待确认字段 (pending_key_fields)
- 可选方案 (available_solutions)
- 提示消息 (prompt_message)

---

### 阶段 4: 用户点击任务，打开对话框

#### 4.1 用户点击待办任务

**文件位置**: `src/app/agents/[id]/page.tsx`

**代码逻辑**:
```typescript
const handleWaitingTaskClick = (task: any) => {
  setSelectedWaitingTask(task);
  setShowUserInteractionDialog(true);
};
```

#### 4.2 渲染 UserInteractionDialog 组件

**组件位置**: `src/components/user-interaction-dialog.tsx`

**组件内容**:
- 任务详情展示
- 待确认字段表单
- 可选方案单选按钮
- 确认/取消按钮

---

### 阶段 5: 用户填写信息，提交决策

#### 5.1 用户填写表单信息

**用户操作**:
- 填写待确认字段 (pending_key_fields)
- 选择可选方案 (available_solutions)
- 或输入自定义决策

#### 5.2 前端验证输入

**验证规则**:
- 必填字段检查
- 数据类型验证
- 范围验证

#### 5.3 调用 user-decision API

**API 端点**: `POST /api/agents/user-decision`

**文件位置**: `src/app/api/agents/user-decision/route.ts`

**请求示例**:
```json
{
  "subTaskId": "subtask-001",
  "commandResultId": "daily-001",
  "userDecision": "客户预算为5000-10000元",
  "decisionType": "waiting_user",
  "interactionData": {
    "filledFields": {
      "budget": 8000
    },
    "selectedSolution": null
  }
}
```

---

### 阶段 6: 后端处理用户决策 (写入端)

#### 6.1 验证参数

**验证内容**:
- 检查 subTaskId, commandResultId, userDecision
- 查询子任务是否存在
- 查询 daily_task 是否存在

**代码位置**: `src/app/api/agents/user-decision/route.ts:40-65`

#### 6.2 查询沟通历史

**SQL 示例**:
```sql
SELECT * FROM agent_sub_tasks_step_history
WHERE commandResultId = 'daily-001'
  AND stepNo = 1
ORDER BY interactTime;
```

**代码位置**: `src/app/api/agents/user-decision/route.ts:67-78`

#### 6.3 计算下一个交互编号

**逻辑**:
```typescript
const nextInteractNum = interactionHistory.length > 0
  ? Math.max(...interactionHistory.map(h => h.interactNum || 1)) + 1
  : 1;
```

**代码位置**: `src/app/api/agents/user-decision/route.ts:80-85`

#### 6.4 插入 agent_sub_tasks_step_history 表

**SQL 示例**:
```sql
INSERT INTO agent_sub_tasks_step_history (
  commandResultId,
  stepNo,
  interactType,
  interactContent,
  interactUser,
  interactTime,
  interactNum
) VALUES (
  'daily-001',
  1,
  'response',
  '{
    "type": "user_decision",
    "decisionType": "waiting_user_confirm",
    "userDecision": "客户预算为5000-10000元",
    "interactionData": {
      "filledFields": {
        "budget": 8000
      },
      "selectedSolution": null
    },
    "timestamp": "2024-01-15T11:00:00.000Z"
  }',
  'human',
  '2024-01-15 11:00:00',
  3
);
```

**代码位置**: `src/app/api/agents/user-decision/route.ts:87-118`

#### 6.5 更新 agent_sub_tasks 表

**SQL 示例**:
```sql
UPDATE agent_sub_tasks
SET status = 'in_progress',
    updatedAt = '2024-01-15 11:00:00'
WHERE id = 'subtask-001';
```

**代码位置**: `src/app/api/agents/user-decision/route.ts:120-127`

#### 6.6 更新 daily_task 表 (可选)

**SQL 示例**:
```sql
UPDATE daily_task
SET updatedAt = '2024-01-15 11:00:00'
WHERE id = 'daily-001';
```

**代码位置**: `src/app/api/agents/user-decision/route.ts:129-142`

---

### 阶段 7: 触发任务继续执行

#### 7.1 调用 manuallyExecuteInProgressSubtasks()

**文件位置**: `src/lib/cron/index.ts`

**代码逻辑**:
```typescript
export async function manuallyExecuteInProgressSubtasks() {
  console.log('🔔 [手动触发] 开始执行 in_progress 子任务...');

  try {
    // 1. 实例化子任务执行引擎
    const { SubtaskExecutionEngine } = await import('@/lib/services/subtask-execution-engine');
    const engine = new SubtaskExecutionEngine();

    // 2. 执行引擎
    await engine.execute();

    console.log('✅ [手动触发] in_progress 子任务执行完成');
  } catch (error) {
    console.error('❌ [手动触发] 执行失败:', error);
    throw error;
  }
}
```

**代码位置**: `src/app/api/agents/user-decision/route.ts:144-154`

#### 7.2 SubtaskExecutionEngine.execute()

**文件位置**: `src/lib/services/subtask-execution-engine.ts`

**执行逻辑**:
- 扫描 status = 'in_progress' 的任务
- 继续执行任务

#### 7.3 任务继续执行

**执行逻辑**:
- 读取 agent_sub_tasks_step_history 中的用户决策
- 根据用户决策继续处理任务
- 直到任务完成或再次需要用户介入

---

## 📁 涉及的核心文件清单

| 文件路径 | 功能描述 |
|---------|---------|
| `src/lib/services/subtask-execution-engine.ts` | 子任务执行引擎，核心业务逻辑 |
| `src/lib/agents/agent-b/decision-maker.ts` | Agent B 决策逻辑 |
| `src/app/api/agents/[id]/waiting-tasks/route.ts` | 获取待办任务列表 API |
| `src/app/api/agents/user-decision/route.ts` | 用户决策 API |
| `src/components/user-interaction-dialog.tsx` | 用户交互对话框组件 |
| `src/components/waiting-user-tasks.tsx` | 待办任务列表组件 |
| `src/app/agents/[id]/page.tsx` | Agent 详情页面 |
| `src/lib/cron/index.ts` | 定时任务和手动触发函数 |

---

## 🗄️ 数据库表变更总结

### 表 1: agent_sub_tasks

| 操作 | 字段变更 | 说明 |
|-----|---------|------|
| UPDATE | `status`: `in_progress` → `waiting_user` | Agent B 决策后 |
| UPDATE | `status`: `waiting_user` → `in_progress` | 用户提交决策后 |
| UPDATE | `updatedAt` | 两次更新都会修改 |

### 表 2: agent_sub_tasks_step_history

| 操作 | 说明 |
|-----|------|
| INSERT | 记录 Agent B 的 NEED_USER 响应 |
| INSERT | 记录用户的决策确认 |

### 表 3: daily_task

| 操作 | 字段变更 | 说明 |
|-----|---------|------|
| UPDATE | `updatedAt` | 用户提交决策后 (可选) |

---

## ✅ 功能验证清单

- [x] Agent B 能够正确判断需要用户处理
- [x] agent_sub_tasks 状态正确更新为 waiting_user
- [x] agent_sub_tasks_step_history 正确记录 NEED_USER 响应
- [x] waiting-tasks API 能正确查询待办任务
- [x] 前端能正确展示待办任务列表
- [x] 用户能点击任务打开对话框
- [x] 用户能填写表单并提交决策
- [x] user-decision API 能正确处理用户决策
- [x] agent_sub_tasks_step_history 正确记录用户决策
- [x] agent_sub_tasks 状态正确更新回 in_progress
- [x] 任务能正确触发继续执行

---

## 📝 总结

本文档完整描述了从 **Agent B 判断需要用户处理** 到 **用户处理完成、任务继续执行** 的 7 个阶段业务流程，涵盖了：

1. ✅ Agent B 执行任务与决策
2. ✅ 更新数据库状态 (写入端)
3. ✅ 前端轮询/展示待办任务 (读取端)
4. ✅ 用户点击任务，打开对话框
5. ✅ 用户填写信息，提交决策
6. ✅ 后端处理用户决策 (写入端)
7. ✅ 触发任务继续执行

所有核心代码文件、数据库操作、API 端点都已详细列出，可以作为开发、测试和运维的参考文档。

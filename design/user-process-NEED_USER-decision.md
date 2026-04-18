# Agent B NEED_USER 决策用户处理完整数据流

## 📋 概述

本文档详细描述从 Agent B 输出 NEED_USER 决策，到用户处理完成的完整数据流向，包括所有涉及的数据库表变化。

**版本**: v1.0
**日期**: 2026-03-08
**状态**: 完整实现

---

## 🔄 完整数据流图

```
┌─────────────────────────────────────────────────────────────────────────┐
│  阶段 1: Agent B 输出 NEED_USER 决策                               │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  1.1 Agent B 调用 LLM，输出 NEED_USER 决策                          │
│     - type: "NEED_USER"                                               │
│     - reasonCode: "USER_CONFIRM" or "USER_SELECT"                   │
│     - data.pendingKeyFields: [] (待确认字段)                         │
│     - data.availableSolutions: [] (可选方案)                          │
│     - data.promptMessage: {} (提示信息)                               │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  阶段 2: handleNeedUserDecision() 处理                              │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  2.1 更新     │   │  2.2 记录到    │   │  (无其他表    │
│  agent_sub_   │   │  agent_sub_    │   │   更新)       │
│  tasks 表     │   │  tasks_step_   │   │               │
│               │   │  history 表    │   │               │
└───────────────┘   └───────────────┘   └───────────────┘
        │                    │
        └────────────────────┼────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  阶段 3: 待办任务展示 (WaitingUserTasks 组件)                      │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  3.1 /api/agents/[id]/waiting-tasks API 读取                       │
│     - 从 agent_sub_tasks 表查询 status='waiting_user'               │
│     - 从 agent_sub_tasks_step_history 表读取详细数据                │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  阶段 4: 用户交互处理 (UserInteractionDialog 组件)                  │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  4.1 用户填写信息/选择方案                                          │
│     - 填写 pendingKeyFields                                           │
│     - 选择 availableSolutions (如果有)                               │
│     - 添加备注 (可选)                                                  │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  阶段 5: 提交用户决策 (/api/agents/user-decision API)              │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  5.1 记录到   │   │  5.2 更新     │   │  5.3 触发任务  │
│  agent_sub_   │   │  agent_sub_   │   │  继续执行      │
│  tasks_step_  │   │  tasks 表     │   │  (异步)        │
│  history 表   │   │               │   │               │
└───────────────┘   └───────────────┘   └───────────────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  阶段 6: 任务继续执行 (manuallyExecuteInProgressSubtasks)         │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  6.1 从历史记录读取用户交互数据                                    │
│  6.2 Agent B 继续决策                                               │
│  6.3 任务执行直至完成或失败                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 涉及的数据库表

### 表 1: `agent_sub_tasks`

**用途**: 存储子任务的基本信息和状态

**涉及的字段变化**:

| 字段 | 阶段 1 (初始) | 阶段 2 (NEED_USER) | 阶段 5 (用户处理后) | 说明 |
|------|---------------|-------------------|-------------------|------|
| `id` | ✓ | - | - | 子任务 ID (主键) |
| `taskTitle` | ✓ | - | - | 任务标题 |
| `taskDescription` | ✓ | - | - | 任务描述 |
| `status` | `in_progress` | ➡️ `waiting_user` | ➡️ `in_progress` | 任务状态 |
| `fromParentsExecutor` | ✓ | - | - | 来源执行者 |
| `commandResultId` | ✓ | - | - | 关联的 daily_task ID |
| `orderIndex` | ✓ | - | - | 顺序索引 |
| `metadata` | ✓ | - | - | 元数据 |
| `createdAt` | ✓ | - | - | 创建时间 |
| `startedAt` | ✓ | - | - | 开始时间 |
| `updatedAt` | ✓ | ➡️ 更新 | ➡️ 更新 | 更新时间 |

**SQL 更新示例 (阶段 2)**:
```sql
UPDATE agent_sub_tasks
SET status = 'waiting_user',
    updatedAt = '2026-03-08 12:00:00'
WHERE id = 'subtask-123';
```

**SQL 更新示例 (阶段 5)**:
```sql
UPDATE agent_sub_tasks
SET status = 'in_progress',
    updatedAt = '2026-03-08 12:05:00'
WHERE id = 'subtask-123';
```

---

### 表 2: `agent_sub_tasks_step_history`

**用途**: 存储每一步的交互历史记录，包括 Agent B 的决策和用户的交互

**涉及的字段变化**:

| 字段 | 阶段 2 (记录 Agent B 决策) | 阶段 5 (记录用户交互) | 说明 |
|------|---------------------------|---------------------|------|
| `id` | ✓ (新增) | ✓ (新增) | 记录 ID (主键) |
| `commandResultId` | ✓ | ✓ | 关联的 daily_task ID |
| `stepNo` | ✓ | ✓ | 步骤号 (orderIndex) |
| `interactType` | `'response'` | `'response'` | 交互类型 |
| `interactNum` | ✓ (计算) | ✓ (计算) | 交互编号 |
| `interactContent` | ✓ (Agent B 决策) | ✓ (用户交互) | 交互内容 (JSON) |
| `interactUser` | `'agent B'` | `'human'` | 交互用户 |
| `interactTime` | ✓ | ✓ | 交互时间 |

**阶段 2: 记录 Agent B NEED_USER 决策的 interactContent 结构**:
```json
{
  "interact_type": "response",
  "consultant": "insurance-d",
  "responder": "agent B",
  "question": {
    "isNeedMcp": true,
    "problem": "需要用户确认发布时间",
    "capabilityType": "wechat_upload"
  },
  "response": {
    "decision": {
      "type": "NEED_USER",
      "reason_code": "USER_CONFIRM",
      "reasoning": "需要用户确认发布时间",
      "final_conclusion": "等待用户处理"
    },
    "mcp_attempts": [],
    "available_solutions": [
      {
        "solutionId": "sol-1",
        "label": "立即发布",
        "description": "立即发布到公众号",
        "pros": ["时效性强"],
        "cons": ["可能错过最佳发布时间"]
      }
    ],
    "user_interactions": [],
    "pending_key_fields": [
      {
        "fieldId": "publish_time",
        "fieldName": "发布时间",
        "fieldType": "datetime",
        "description": "请选择文章发布时间",
        "currentValue": null,
        "validationRules": { "required": true }
      }
    ],
    "prompt_message": {
      "title": "请确认发布时间",
      "description": "为了获得最佳传播效果，请选择合适的发布时间",
      "priority": "medium"
    }
  },
  "execution_result": { "status": "waiting_user" },
  "ext_info": {
    "step": "agent_b_decision_need_user",
    "iteration": 1,
    "pending_key_fields": [...],
    "available_solutions": [...]
  }
}
```

**阶段 5: 记录用户交互的 interactContent 结构**:
```json
{
  "type": "user_decision",
  "decisionType": "waiting_user_confirm",
  "userDecision": "confirm",
  "interactionData": {
    "fieldValues": {
      "publish_time": "2026-03-09 09:00:00"
    },
    "selectedSolution": "sol-1",
    "notes": "用户选择了明早9点发布",
    "submittedAt": "2026-03-08T12:05:00.000Z"
  },
  "timestamp": "2026-03-08T12:05:00.000Z"
}
```

**SQL 插入示例 (阶段 2)**:
```sql
INSERT INTO agent_sub_tasks_step_history (
  commandResultId,
  stepNo,
  interactType,
  interactNum,
  interactContent,
  interactUser,
  interactTime
) VALUES (
  'daily-task-456',
  1,
  'response',
  1,
  '{"interact_type":"response",...}',  -- JSON 字符串
  'agent B',
  '2026-03-08 12:00:00'
);
```

**SQL 插入示例 (阶段 5)**:
```sql
INSERT INTO agent_sub_tasks_step_history (
  commandResultId,
  stepNo,
  interactType,
  interactNum,
  interactContent,
  interactUser,
  interactTime
) VALUES (
  'daily-task-456',
  1,
  'response',
  2,
  '{"type":"user_decision",...}',  -- JSON 字符串
  'human',
  '2026-03-08 12:05:00'
);
```

---

### 表 3: `daily_task` (只读)

**用途**: 存储原始的日常任务信息（此流程中只读取，不更新）

**读取的字段**:
- `id`: 任务 ID
- `taskTitle`: 任务标题
- `taskDescription`: 任务描述
- `taskPriority`: 任务优先级
- `executor`: 执行者
- `executionDate`: 执行日期

---

## 🔍 详细阶段说明

### 阶段 1: Agent B 输出 NEED_USER 决策

**触发条件**:
- Agent B 分析任务后认为需要用户确认或选择
- 缺少关键信息无法继续执行
- 有多个方案需要用户选择

**LLM 提示词中的相关部分**:
```typescript
'3. NEED_USER - 需要用户介入确认/选择\n' +
'- NEED_USER类型: USER_CONFIRM, USER_SELECT\n' +

// data 部分包含:
"pendingKeyFields": [  // 待确认字段
  {
    "fieldId": "字段ID",
    "fieldName": "字段名称",
    "fieldType": "text|number|select|date|boolean",
    "description": "字段说明",
    "currentValue": "当前值",
    "validationRules": { "required": true }
  }
],
"availableSolutions": [  // 可选方案
  {
    "solutionId": "方案ID",
    "label": "方案名称",
    "description": "方案描述",
    "pros": ["优点1"],
    "cons": ["缺点1"]
  }
],
"promptMessage": {  // 提示信息
  "title": "提示标题",
  "description": "详细说明",
  "priority": "medium"
}
```

---

### 阶段 2: handleNeedUserDecision() 处理

**位置**: `src/lib/services/subtask-execution-engine.ts`

**主要操作**:
1. ✅ 更新 `agent_sub_tasks.status` = `'waiting_user'`
2. ✅ 更新 `agent_sub_tasks.updatedAt`
3. ✅ 记录决策到 `agent_sub_tasks_step_history` 表

**代码片段**:
```typescript
private async handleNeedUserDecision(...) {
  // 1. 更新任务状态为 waiting_user
  await db
    .update(agentSubTasks)
    .set({
      status: 'waiting_user',
      updatedAt: getCurrentBeijingTime(),
    })
    .where(eq(agentSubTasks.id, task.id));

  // 2. 记录到历史表
  await this.createInteractionStep(
    task.commandResultId,
    task.orderIndex,
    'response',
    iteration,
    'agent B',
    { /* 完整的决策数据 */ }
  );
}
```

---

### 阶段 3: 待办任务展示

**API 端点**: `GET /api/agents/[id]/waiting-tasks`

**主要操作**:
1. 从 `agent_sub_tasks` 表查询 `status = 'waiting_user'` 的任务
2. 关联查询 `daily_task` 表获取更多信息
3. 从 `agent_sub_tasks_step_history` 表读取最新的交互记录
4. 提取 `pendingKeyFields`、`availableSolutions`、`promptMessage`

**返回数据结构**:
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": "subtask-123",
        "taskTitle": "发布保险产品文章",
        "taskDescription": "...",
        "status": "waiting_user",
        "priority": "normal",
        "pendingKeyFields": [...],
        "availableSolutions": [...],
        "promptMessage": {...},
        "relatedDailyTask": {...}
      }
    ],
    "stats": {
      "total": 1,
      "waitingUser": 1,
      "withKeyFields": 1,
      "withSolutions": 0
    }
  }
}
```

---

### 阶段 4: 用户交互处理

**组件**: `UserInteractionDialog`

**支持的功能**:
1. ✅ 待确认字段填写 (text, number, select, date, boolean)
2. ✅ 可选方案选择 (单选)
3. ✅ 备注输入 (可选)
4. ✅ 表单验证
5. ✅ 提交按钮

---

### 阶段 5: 提交用户决策

**API 端点**: `POST /api/agents/user-decision`

**请求参数**:
```json
{
  "subTaskId": "subtask-123",
  "commandResultId": "daily-task-456",
  "userDecision": "confirm",
  "decisionType": "waiting_user",
  "interactionData": {
    "fieldValues": {
      "publish_time": "2026-03-09 09:00:00"
    },
    "selectedSolution": "sol-1",
    "notes": "用户选择了明早9点发布"
  }
}
```

**主要操作**:
1. ✅ 验证参数
2. ✅ 查询子任务和关联的 daily_task
3. ✅ 查询历史记录计算交互编号
4. ✅ 记录用户交互到 `agent_sub_tasks_step_history` 表
5. ✅ 更新 `agent_sub_tasks.status` = `'in_progress'`
6. ✅ 触发任务继续执行 (异步)

---

### 阶段 6: 任务继续执行

**触发函数**: `manuallyExecuteInProgressSubtasks()`

**主要操作**:
1. 查询 `status = 'in_progress'` 的子任务
2. 从历史记录读取用户交互数据
3. 重新调用 Agent B，带上用户交互数据
4. Agent B 继续决策和执行
5. 任务执行直至完成或失败

---

## 📝 完整示例数据

### 示例场景: 公众号文章发布需要用户确认发布时间

#### 初始状态
```sql
-- agent_sub_tasks 表
INSERT INTO agent_sub_tasks (
  id,
  taskTitle,
  taskDescription,
  status,
  fromParentsExecutor,
  commandResultId,
  orderIndex,
  createdAt,
  startedAt,
  updatedAt
) VALUES (
  'subtask-001',
  '发布保险产品介绍文章',
  '请发布一篇关于新产品的公众号文章',
  'in_progress',
  'insurance-d',
  'daily-001',
  1,
  '2026-03-08 11:00:00',
  '2026-03-08 11:00:00',
  '2026-03-08 11:00:00'
);
```

#### 阶段 2 后: Agent B 输出 NEED_USER 决策
```sql
-- agent_sub_tasks 表更新
UPDATE agent_sub_tasks
SET status = 'waiting_user',
    updatedAt = '2026-03-08 12:00:00'
WHERE id = 'subtask-001';

-- agent_sub_tasks_step_history 表新增记录
INSERT INTO agent_sub_tasks_step_history (...)
VALUES (
  'daily-001',
  1,
  'response',
  1,
  '{"interact_type":"response","response":{"decision":{"type":"NEED_USER",...}}}',
  'agent B',
  '2026-03-08 12:00:00'
);
```

#### 阶段 5 后: 用户提交决策
```sql
-- agent_sub_tasks 表更新
UPDATE agent_sub_tasks
SET status = 'in_progress',
    updatedAt = '2026-03-08 12:05:00'
WHERE id = 'subtask-001';

-- agent_sub_tasks_step_history 表新增记录
INSERT INTO agent_sub_tasks_step_history (...)
VALUES (
  'daily-001',
  1,
  'response',
  2,
  '{"type":"user_decision","interactionData":{"fieldValues":{"publish_time":"2026-03-09 09:00:00"}}}',
  'human',
  '2026-03-08 12:05:00'
);
```

---

## ✅ 功能验证清单

| 功能模块 | 状态 | 说明 |
|---------|------|------|
| Agent B 输出 NEED_USER 决策 | ✅ | 提示词包含完整选项和数据结构 |
| handleNeedUserDecision() 处理 | ✅ | 更新状态 + 记录历史 |
| waiting-tasks API | ✅ | 从两张表关联查询数据 |
| WaitingUserTasks 组件 | ✅ | 展示任务列表和统计 |
| UserInteractionDialog 组件 | ✅ | 支持字段填写和方案选择 |
| user-decision API | ✅ | 支持 waiting_user 场景 |
| 页面集成 | ✅ | 已完成 (2026-03-08) |

---

## 📚 相关文件

| 文件路径 | 说明 |
|---------|------|
| `src/lib/services/subtask-execution-engine.ts` | 核心执行引擎，包含 handleNeedUserDecision() |
| `src/app/api/agents/[id]/waiting-tasks/route.ts` | 待办任务列表 API |
| `src/app/api/agents/user-decision/route.ts` | 用户决策 API |
| `src/components/waiting-user-tasks.tsx` | 待办任务列表组件 |
| `src/components/user-interaction-dialog.tsx` | 用户交互对话框组件 |
| `src/app/agents/[id]/page.tsx` | Agent 详情页面（集成组件） |

---

**文档结束**

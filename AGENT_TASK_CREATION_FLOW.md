## Agent A 指令入库流程分析

### 📋 完整流程

```
Agent A 下发指令
      │
      ▼
┌─────────────────────────────────────────────────┐
│  Step 1: API 接口接收                          │
│  POST /api/agents/tasks                        │
│                                                 │
│  文件: src/app/api/agents/tasks/route.ts      │
│                                                 │
│  接收参数:                                      │
│  - fromAgentId: 'A'                            │
│  - toAgentId: 'agent B'                       │
│  - command: "执行主体：insurance-d..."         │
│  - metadata: {...}                            │
└─────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────┐
│  Step 2: 参数验证与检查                        │
│                                                 │
│  1. 验证参数完整性                             │
│  2. 验证只有 Agent A 可以下达任务             │
│  3. 验证目标 Agent 有效性                       │
│  4. 检测重复任务（可选）                       │
└─────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────┐
│  Step 3: 调用任务创建服务                      │
│                                                 │
│  agentTask.createTask({                        │
│    fromAgentId,                                │
│    toAgentId,                                  │
│    command,                                    │
│    commandType,                                │
│    priority,                                   │
│    metadata                                    │
│  })                                            │
│                                                 │
│  调用的文件:                                    │
│  src/lib/services/agent-task.ts                │
└─────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────┐
│  Step 4: 字段匹配与入库 ⭐ 核心                │
│                                                 │
│  AgentTaskService.createTask() 方法负责:       │
│                                                 │
│  ┌─────────────────────────────────────────┐  │
│  │ 接收的参数                              │  │
│  ├─────────────────────────────────────────┤  │
│  │ params.fromAgentId      → fromAgentId │  │
│  │ params.toAgentId        → toAgentId   │  │
│  │ params.command          → coreCommand │  │
│  │ params.metadata.taskName → taskName   │  │
│  │ params.priority         → taskPriority│  │
│  └─────────────────────────────────────────┘  │
│                                                 │
│  ┌─────────────────────────────────────────┐  │
│  │ 自动生成的字段                          │  │
│  ├─────────────────────────────────────────┤  │
│  │ taskId = `task-${timestamp}-${random}` │  │
│  │ executor = params.toAgentId            │  │
│  │ taskType = 'master'                     │  │
│  │ splitStatus = 'pending_split'          │  │
│  │ taskStatus = 'pending'                  │  │
│  │ taskDurationStart = now()              │  │
│  │ taskDurationEnd = now() + 3天         │  │
│  │ creator = params.fromAgentId           │  │
│  │ updater = 'TS'                         │  │
│  │ createdAt = now()                      │  │
│  │ updatedAt = now()                      │  │
│  └─────────────────────────────────────────┘  │
│                                                 │
│  db.insert(agentTasks).values({...}).returning()
│                                                 │
│  插入到: agent_tasks 表                        │
└─────────────────────────────────────────────────┘
      │
      ▼
  ✅ 任务入库成功
```

---

### 🎯 核心答案

**是谁负责把指令匹配数据库字段并入库到 `agent_tasks` 表？**

答：**`AgentTaskService.createTask()` 方法**

---

### 📁 关键文件

#### 1. API 接口层
**文件**: `src/app/api/agents/tasks/route.ts`

**作用**: 接收 Agent A 下发的指令，进行参数验证，调用任务创建服务

**关键代码**:
```typescript
const task = await agentTask.createTask({
  fromAgentId,
  toAgentId,
  command,
  commandType: commandType || 'instruction',
  priority: priority || 'normal',
  metadata: metadata || {},
});
```

#### 2. 服务层（核心）
**文件**: `src/lib/services/agent-task.ts`

**作用**: 负责字段匹配、生成任务ID、设置默认值、执行数据库插入

**关键代码**:
```typescript
async createTask(params: {
  fromAgentId: string;
  toAgentId: string;
  command: string;
  commandType?: string;
  priority?: string;
  metadata?: Record<string, any>;
}) {
  const db = getDatabase();
  const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date();

  // 从 metadata 中提取任务名称
  const taskName = params.metadata?.taskName || `任务 ${taskId}`;
  const acceptanceCriteria = params.metadata?.acceptanceCriteria || '待补充';
  const totalDeliverables = params.metadata?.totalDeliverables || '0';

  const [task] = await db
    .insert(agentTasks)
    .values({
      taskId,
      taskName,
      coreCommand: params.command,
      executor: params.toAgentId, // 接收方即执行方
      acceptanceCriteria,
      taskType: 'master',
      splitStatus: 'pending_split',
      taskDurationStart: now,
      taskDurationEnd: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      totalDeliverables,
      taskPriority: params.priority || 'normal',
      taskStatus: 'pending',
      creator: params.fromAgentId,
      updater: 'TS',
      fromAgentId: params.fromAgentId,
      toAgentId: params.toAgentId,
      commandType: params.commandType || 'instruction',
      metadata: params.metadata || {},
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return task;
}
```

---

### 🔄 字段映射关系

| 参数 | 数据库字段 | 说明 |
|------|-----------|------|
| `params.fromAgentId` | `fromAgentId` | 下发任务的 Agent ID |
| `params.toAgentId` | `toAgentId`, `executor` | 接收任务的 Agent ID，同时作为执行者 |
| `params.command` | `coreCommand` | 核心指令内容 |
| `params.metadata.taskName` | `taskName` | 任务名称（从 metadata 提取） |
| `params.priority` | `taskPriority` | 任务优先级 |
| **自动生成** | `taskId` | 任务ID（格式：task-{timestamp}-{random}） |
| **自动生成** | `taskType` | 任务类型（固定为 'master'） |
| **自动生成** | `splitStatus` | 拆解状态（固定为 'pending_split'） |
| **自动生成** | `taskStatus` | 任务状态（固定为 'pending'） |
| **自动生成** | `taskDurationStart` | 任务开始时间（当前时间） |
| **自动生成** | `taskDurationEnd` | 任务结束时间（当前时间 + 3天） |
| **自动生成** | `creator` | 创建人（fromAgentId） |
| **自动生成** | `updater` | 更新人（固定为 'TS'） |
| **自动生成** | `createdAt` | 创建时间 |
| **自动生成** | `updatedAt` | 更新时间 |

---

### ❓ 今天的错误原因

根据之前的分析，今天的任务创建时出现了问题：

**错误**:
- 指令中明确写着：`执行主体：「insurance-d」`
- 但创建任务时，`toAgentId` 被设置为 `'agent B'`
- 导致 `executor` 也被错误地设置为 `'agent B'`

**应该做的**:
```typescript
// 正确的做法
const executorMatch = command.match(/执行主体[：:]\s*「([^\"]+)」/);
const actualExecutor = executorMatch ? executorMatch[1] : toAgentId;

// 使用实际执行主体
toAgentId: actualExecutor,  // 'insurance-d'
executor: actualExecutor,   // 'insurance-d'
```

**实际做的**:
```typescript
// 错误的做法
executor: params.toAgentId,  // 'agent B'（错误！）
```

---

### 💡 总结

**答案**: `AgentTaskService.createTask()` 方法负责把指令匹配数据库字段并入库到 `agent_tasks` 表

**调用链**:
```
Agent A
  ↓
POST /api/agents/tasks
  ↓
agentTask.createTask()
  ↓
INSERT INTO agent_tasks
```

**问题根源**: `createTask()` 方法没有解析指令中的"执行主体"，直接使用了 `toAgentId` 参数，导致执行主体错误。

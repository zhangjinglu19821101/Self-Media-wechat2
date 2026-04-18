# 任务状态流转文档

## 三张表关系概览

```
agentTasks (总任务)
    ↓ relatedTaskId
commandResults (拆分指令)
    ↓ commandResultId
agentSubTasks (子任务)
```

- **agentTasks**: 总任务表，存储 Agent 间下达的任务
- **commandResults**: 指令执行结果表，存储拆分后的指令
- **agentSubTasks**: 子任务表，存储 Agent 自己拆分的执行步骤

---

## 1. agentTasks 表状态

### 状态字段

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `taskStatus` | enum | 任务执行状态 |
| `splitStatus` | enum | 任务拆解状态 |

### taskStatus 状态枚举

| 状态值 | 中文名称 | 说明 |
|--------|----------|------|
| `unsplit` | 未拆分 | 任务刚创建，尚未拆分 |
| `splitting` | 拆分中 | Agent B 正在拆分任务 |
| `split_completed` | 拆分完成 | 任务已拆分为多个指令 |
| `in_progress` | 执行中 | 任务正在执行 |
| `completed` | 已完成 | 任务执行完成 |
| `failed` | 失败 | 任务执行失败 |

### splitStatus 状态枚举

| 状态值 | 中文名称 | 说明 |
|--------|----------|------|
| `pending_split` | 待拆解 | 任务创建后，等待 Agent B 拆解 |
| `splitting` | 拆解中 | Agent B 正在拆解任务 |
| `split_pending_review` | 拆解待审核 | 任务拆解完成，等待确认 |
| `split_confirmed` | 拆解已确认 | 拆解已确认，开始执行 |
| `split_rejected` | 拆解已拒绝 | 拆解被拒绝，需要重新拆解 |

---

## 2. commandResults 表状态

### 状态字段

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `executionStatus` | enum | 指令执行状态 |

### executionStatus 状态枚举

| 状态值 | 中文名称 | 说明 |
|--------|----------|------|
| `new` | 新建 | 指令刚创建 |
| `in_progress` | 执行中 | 指令正在执行 |
| `completed` | 执行完成 | 指令执行完成，等待审核 |
| `feedback_completed` | 反馈完成 | 指令审核通过 |
| `helping_tech_expert` | 执行求助中（技术专家） | 遇到技术问题，寻求专家协助 |
| `helping_president` | 执行求助中（总裁） | 遇到决策问题，寻求总裁协助 |
| `failed` | 执行失败 | 指令执行失败 |

---

## 3. agentSubTasks 表状态

### 状态字段

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `status` | enum | 子任务执行状态 |

### status 状态枚举

| 状态值 | 中文名称 | 说明 |
|--------|----------|------|
| `pending` | 待执行 | 子任务已创建，等待执行 |
| `in_progress` | 执行中 | 子任务正在执行 |
| `completed` | 已完成 | 子任务执行完成 |
| `blocked` | 阻塞 | 子任务被阻塞，等待前置任务完成 |

---

## 4. 状态流转图

### 4.1 agentTasks 任务全流程状态流转

```
┌─────────────────────────────────────────────────────────────────────┐
│                        agentTasks 任务全流程                          │
└─────────────────────────────────────────────────────────────────────┘

1. 任务创建阶段
   ┌─────────────┐
   │   unsplit   │ ◄── 初始状态
   │  (未拆分)   │
   └──────┬──────┘
          │
          ├──────────────────────────────────────┐
          │ taskStatus                           │ splitStatus
          │                                      │
          ▼                                      ▼
   ┌─────────────┐                    ┌──────────────────┐
   │  splitting  │                    │  pending_split   │
   │  (拆分中)   │                    │    (待拆解)      │
   └──────┬──────┘                    └────────┬─────────┘
          │                                     │
          │                                     ▼
          │                            ┌──────────────────┐
          │                            │    splitting     │
          │                            │    (拆解中)      │
          │                            └────────┬─────────┘
          │                                     │
          ▼                                     ▼
   ┌───────────────────────────────────────────────────┐
   │              split_completed                       │
   │                 (拆分完成)                         │
   └──────────────────────────┬────────────────────────┘
                              │
                              │ splitStatus
                              │
                              ▼
                    ┌──────────────────┐
                    │split_pending_    │
                    │     review       │
                    │   (拆解待审核)   │
                    └────────┬─────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
                    │ 确认/拒绝       │
                    │                 │
                    ▼                 ▼
         ┌──────────────────┐  ┌──────────────────┐
         │ split_confirmed  │  │ split_rejected   │
         │  (拆解已确认)    │  │  (拆解已拒绝)    │
         └────────┬─────────┘  └────────┬─────────┘
                  │                     │
                  │ 重新拆解            │
                  │                     │
                  ▼                     │
         ┌──────────────────┐           │
         │   in_progress    │ ◄─────────┘
         │    (执行中)      │
         └────────┬─────────┘
                  │
         ┌────────┴────────┐
         │                 │
         ▼                 ▼
   ┌─────────────┐  ┌─────────────┐
   │  completed  │  │   failed    │
   │  (已完成)   │  │   (失败)    │
   └─────────────┘  └─────────────┘
```

### 4.2 commandResults 指令执行状态流转

```
┌─────────────────────────────────────────────────────────────────────┐
│                      commandResults 指令执行                         │
└─────────────────────────────────────────────────────────────────────┘

┌──────────┐
│   new    │ ◄── 初始状态
│  (新建)  │
└────┬─────┘
     │
     ▼
┌──────────────┐
│ in_progress  │ ◄── Agent 开始执行
│  (执行中)    │
└──────┬───────┘
       │
       ├──────────────────────────┬──────────────────────┬──────────────────┐
       │                          │                      │                  │
       ▼                          ▼                      ▼                  ▼
┌──────────────┐      ┌──────────────────────┐ ┌──────────────────┐ ┌─────────────┐
│  completed   │      │ helping_tech_expert  │ │ helping_president│ │   failed    │
│ (执行完成)   │      │ (执行求助中-技术)     │ │ (执行求助中-总裁) │ │  (执行失败) │
└──────┬───────┘      └──────────┬───────────┘ └────────┬─────────┘ └─────────────┘
       │                          │                      │
       │                         │ 恢复/失败           │ 恢复/失败
       │                         │                      │
       │                    ┌────┴─────┐          ┌────┴─────┐
       │                    │          │          │          │
       │                    ▼          ▼          ▼          ▼
       │             ┌──────────┐  ┌──────────┐ ┌──────────┐
       │             │completed │  │  failed  │ │completed │
       │             │          │  │          │ │          │
       │             └──────────┘  └──────────┘ └──────────┘
       │
       │ 审核通过
       ▼
┌──────────────────┐
│ feedback_        │ ◄── 终态
│ completed        │
│ (反馈完成)       │
└──────────────────┘
```

### 4.3 agentSubTasks 子任务执行状态流转

```
┌─────────────────────────────────────────────────────────────────────┐
│                      agentSubTasks 子任务执行                         │
└─────────────────────────────────────────────────────────────────────┘

┌──────────┐
│ pending  │ ◄── 初始状态（子任务创建时）
└────┬─────┘
     │
     ▼
┌──────────────┐
│ in_progress  │ ◄── Agent 开始执行子任务
│  (执行中)    │
└──────┬───────┘
       │
       ├──────────────────┬──────────────────────┐
       │                  │                      │
       ▼                  ▼                      ▼
┌─────────────┐  ┌─────────────┐     ┌─────────────┐
│  completed  │  │   blocked   │     │   failed    │
│  (已完成)   │  │   (阻塞)    │     │   (失败)    │
└─────────────┘  └──────┬──────┘     └─────────────┘
                        │
                        │ 前置任务完成
                        │
                        ▼
                 ┌──────────────┐
                 │ in_progress  │ ◄── 恢复执行
                 └──────────────┘
```

---

## 5. 表间状态联动关系

### 5.1 状态依赖关系总览

```
┌─────────────────────────────────────────────────────────────────────┐
│                        三表状态依赖关系                              │
└─────────────────────────────────────────────────────────────────────┘

agentSubTasks (子任务)
    ↓ 完成状态向上传递
commandResults (指令)
    ↓ 完成状态向上传递
agentTasks (总任务)
```

**状态流转方向说明：**
- **向上传递**（完成）：agentSubTasks → commandResults → agentTasks
- **向下传递**（失败/拒绝）：agentTasks → commandResults → agentSubTasks
- **双向同步**（执行中）：agentSubTasks ↔ commandResults ↔ agentTasks

---

### 5.2 核心联动规则

```
┌─────────────────────────────────────────────────────────────────────┐
│                      向上传递（完成状态）                             │
└─────────────────────────────────────────────────────────────────────┘

agentSubTasks 全部 'completed'
  → commandResults.executionStatus = 'completed'
  → commandResults.completedSubTasks = 子任务总数

commandResults 全部 'completed'
  → agentTasks.taskStatus = 'completed'
  → agentTasks.completedAt = 当前时间

commandResults.executionStatus = 'feedback_completed'
  → agentTasks.taskStatus = 'completed'
```

```
┌─────────────────────────────────────────────────────────────────────┐
│                      向下传递（失败状态）                             │
└─────────────────────────────────────────────────────────────────────┘

agentTasks.taskStatus = 'failed'
  → 所有关联 commandResults.executionStatus = 'failed'
  → 所有关联 agentSubTasks.status = 'failed'

commandResults.executionStatus = 'failed'
  → 所有关联 agentSubTasks.status = 'failed'
```

```
┌─────────────────────────────────────────────────────────────────────┐
│                      双向同步（执行状态）                             │
└─────────────────────────────────────────────────────────────────────┘

agentTasks.taskStatus = 'in_progress'
  → 未完成 commandResults.executionStatus = 'in_progress'

commandResults.executionStatus = 'in_progress'
  → 未完成 agentSubTasks.status = 'in_progress'

commandResults.executionStatus = 'helping_tech_expert' 或 'helping_president'
  → 所有关联 agentSubTasks.status = 'blocked'

commandResults.executionStatus 从 'helping_*' → 'in_progress'
  → 所有关联 agentSubTasks.status = 'in_progress'
```

```
┌─────────────────────────────────────────────────────────────────────┐
│                      数据清理（拒绝状态）                             │
└─────────────────────────────────────────────────────────────────────┘

agentTasks.splitStatus = 'split_rejected'
  → 删除所有关联 commandResults 记录
  → 删除所有关联 agentSubTasks 记录
  → agentTasks.taskStatus = 'unsplit'
  → agentTasks.splitStatus = 'pending_split'
```

---

### 5.3 状态字段计数联动

```
agentSubTasks.status 从 'in_progress' → 'completed'
  → commandResults.completedSubTasks = 已完成子任务数
  → commandResults.completedSubTasksDescription = 最新完成的子任务描述

commandResults.executionStatus = 'new'
  → commandResults.subTaskCount = 子任务总数
  → commandResults.completedSubTasks = 0
```

---

### 5.4 拆解状态联动

```
agentTasks.splitStatus = 'pending_split'
  → (等待创建 commandResults)

agentTasks.splitStatus = 'splitting'
  → 创建 commandResults 记录

agentTasks.splitStatus = 'split_pending_review'
  → commandResults.executionStatus = 'new' (等待确认)

agentTasks.splitStatus = 'split_confirmed'
  → commandResults.executionStatus = 'in_progress'
  → agentTasks.taskStatus = 'in_progress'
  → 所有关联 agentSubTasks.status = 'pending'
```

---

### 5.5 完整状态转换矩阵

```
┌─────────────────────────────────────────────────────────────────────┐
│                     触发条件 → 级联更新操作                           │
├─────────────────────────────────────────────────────────────────────┤
│ agentSubTasks 全部 completed      │ commandResults.executionStatus   │
│                                  │   = 'completed'                  │
├──────────────────────────────────┼──────────────────────────────────┤
│ commandResults 全部 completed    │ agentTasks.taskStatus            │
│                                  │   = 'completed'                  │
│                                  │ agentTasks.completedAt          │
│                                  │   = 当前时间                     │
├──────────────────────────────────┼──────────────────────────────────┤
│ agentTasks.taskStatus = 'failed' │ 关联 commandResults              │
│                                  │   .executionStatus = 'failed'    │
│                                  │ 关联 agentSubTasks               │
│                                  │   .status = 'failed'             │
├──────────────────────────────────┼──────────────────────────────────┤
│ commandResults.executionStatus   │ agentTasks.taskStatus            │
│   = 'failed'                     │   = 'failed'                     │
│                                  │ 关联 agentSubTasks.status        │
│                                  │   = 'failed'                     │
├──────────────────────────────────┼──────────────────────────────────┤
│ agentTasks.splitStatus           │ 删除关联 commandResults           │
│   = 'split_rejected'             │ 删除关联 agentSubTasks           │
│                                  │ agentTasks.taskStatus            │
│                                  │   = 'unsplit'                    │
│                                  │ agentTasks.splitStatus           │
│                                  │   = 'pending_split'              │
├──────────────────────────────────┼──────────────────────────────────┤
│ commandResults.executionStatus   │ 关联 agentSubTasks.status         │
│   = 'helping_tech_expert'        │   = 'blocked'                    │
│   或 'helping_president'         │                                  │
├──────────────────────────────────┼──────────────────────────────────┤
│ commandResults.executionStatus   │ 关联 agentSubTasks.status         │
│   'helping_*' → 'in_progress'    │   = 'in_progress'                │
├──────────────────────────────────┼──────────────────────────────────┤
│ agentTasks.taskStatus            │ 未完成 commandResults             │
│   = 'in_progress'                │   .executionStatus               │
│                                  │   = 'in_progress'                │
├──────────────────────────────────┼──────────────────────────────────┤
│ agentTasks.splitStatus           │ commandResults.executionStatus   │
│   = 'split_confirmed'            │   = 'in_progress'                │
│                                  │ agentTasks.taskStatus            │
│                                  │   = 'in_progress'                │
└──────────────────────────────────┴──────────────────────────────────┘
```

---

## 6. 关键业务场景状态流转

### 6.1 场景一：正常任务执行流程

```
1. 创建任务
   agentTasks.taskStatus = 'unsplit'
   agentTasks.splitStatus = 'pending_split'

2. Agent B 拆分任务
   agentTasks.taskStatus = 'splitting'
   agentTasks.splitStatus = 'splitting'
   → 创建 commandResults (executionStatus = 'new')

3. 拆分完成，等待确认
   agentTasks.taskStatus = 'split_completed'
   agentTasks.splitStatus = 'split_pending_review'

4. 确认拆分
   agentTasks.taskStatus = 'in_progress'
   agentTasks.splitStatus = 'split_confirmed'
   commandResults.executionStatus = 'in_progress'

5. Agent 执行子任务
   agentSubTasks.status = 'in_progress'

6. 子任务完成
   agentSubTasks.status = 'completed'
   → 所有子任务完成后：
   commandResults.executionStatus = 'completed'
   → 所有指令完成后：
   agentTasks.taskStatus = 'completed'
```

### 6.2 场景二：任务拆解被拒绝

```
1. 拆分待审核
   agentTasks.splitStatus = 'split_pending_review'

2. 拒绝拆分
   agentTasks.splitStatus = 'split_rejected'
   → 删除所有 commandResults
   → 删除所有 agentSubTasks

3. 重新拆解
   agentTasks.splitStatus = 'splitting'
   → 重新创建 commandResults 和 agentSubTasks
```

### 6.3 场景三：执行中遇到问题求助

```
1. 子任务执行中
   agentSubTasks.status = 'in_progress'
   commandResults.executionStatus = 'in_progress'

2. 遇到技术问题
   commandResults.executionStatus = 'helping_tech_expert'
   agentSubTasks.status = 'blocked'

3. 技术专家协助解决
   commandResults.executionStatus = 'in_progress'
   agentSubTasks.status = 'in_progress'

4. 继续执行完成
   agentSubTasks.status = 'completed'
   commandResults.executionStatus = 'completed'
```

### 6.4 场景四：任务执行失败

```
1. 子任务执行失败
   agentSubTasks.status = 'failed'
   commandResults.executionStatus = 'failed'
   agentTasks.taskStatus = 'failed'

2. 标记终态
   所有相关子任务和指令状态不再变化
```

---

## 7. 状态更新 API

### 7.1 agentTasks 状态更新

| API 方法 | 描述 | 状态字段 |
|----------|------|----------|
| `TaskStateMachine.updateTaskStatus()` | 更新任务状态 | taskStatus |
| `TaskManager.updateTaskSplitStatus()` | 更新拆解状态 | splitStatus |

### 7.2 commandResults 状态更新

| API 方法 | 描述 | 状态字段 |
|----------|------|----------|
| `TaskStateMachine.updateCommandStatus()` | 更新指令状态 | executionStatus |

### 7.3 agentSubTasks 状态更新

| API 方法 | 描述 | 状态字段 |
|----------|------|----------|
| `PUT /api/agents/[id]/subtasks/:subtaskId` | 更新子任务状态 | status |

---

## 8. 状态一致性保证

### 8.1 事务性更新

所有跨表的状态更新必须在一个数据库事务中完成，确保数据一致性。

### 8.2 状态校验

在更新状态前，必须校验：
1. 当前状态是否合法
2. 状态流转是否符合规则
3. 关联数据是否存在

### 8.3 补偿机制

当状态更新失败时，必须有补偿机制回滚已修改的状态。

---

## 9. 附录

### 9.1 状态枚举定义

```typescript
// agentTasks.taskStatus
enum TaskStatus {
  UNSPLIT = 'unsplit',
  SPLITTING = 'splitting',
  SPLIT_COMPLETED = 'split_completed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// agentTasks.splitStatus
enum SplitStatus {
  PENDING_SPLIT = 'pending_split',
  SPLITTING = 'splitting',
  SPLIT_PENDING_REVIEW = 'split_pending_review',
  SPLIT_CONFIRMED = 'split_confirmed',
  SPLIT_REJECTED = 'split_rejected'
}

// commandResults.executionStatus
enum CommandStatus {
  NEW = 'new',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FEEDBACK_COMPLETED = 'feedback_completed',
  HELPING_TECH_EXPERT = 'helping_tech_expert',
  HELPING_PRESIDENT = 'helping_president',
  FAILED = 'failed'
}

// agentSubTasks.status
enum SubTaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  BLOCKED = 'blocked'
}
```

### 9.2 数据库表关联关系

```sql
-- agentTasks → commandResults
agentTasks.taskId → commandResults.relatedTaskId

-- commandResults → agentSubTasks
commandResults.id → agentSubTasks.commandResultId
```

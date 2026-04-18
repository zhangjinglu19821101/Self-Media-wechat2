# agent_sub_tasks 状态流转设计

## 1. 状态定义

### 1.1 核心状态

| 状态 | 含义 | 说明 |
|------|------|------|
| `pending` | 待执行 | 任务已创建，等待分发 |
| `dispatched` | 已分发 | 任务已分发，等待执行 |
| `in_progress` | 执行中 | 任务正在执行 |
| `completed` | 已完成 | 任务执行成功 |
| `blocked` | 阻塞 | 任务执行失败，等待处理 |
| `timeout` | 超时 | 任务执行超时 |
| `escalated` | 已升级 | 任务已升级，需要人工干预 |

### 1.2 辅助字段

| 字段 | 类型 | 含义 |
|------|------|------|
| `isDispatched` | Boolean | 是否已分发（用于区分 pending 状态的子阶段） |
| `startedAt` | Timestamp | 开始执行时间 |
| `completedAt` | Timestamp | 完成时间 |

## 2. 状态流转图

```
                    ┌─────────────┐
                    │   pending   │
                    │isDispatched=│
                    │    false    │
                    └──────┬──────┘
                           │ [dispatch-agent-subtasks]
                           │ 标记 isDispatched=true
                           ↓
                    ┌─────────────┐
                    │   pending   │
                    │isDispatched=│
                    │    true     │
                    └──────┬──────┘
                           │ [execute-agent-subtasks]
                           │ 开始执行
                           ↓
                    ┌─────────────┐
                    │ in_progress  │←─────────────┐
                    └──────┬──────┘              │
                           │                       │
           ┌───────────────┼───────────────┐     │
           │               │               │     │ [重试]
           ↓               ↓               ↓     │
    ┌──────────┐   ┌──────────┐   ┌──────────┐ │
    │completed │   │ blocked  │   │ timeout  │ │
    └──────────┘   └────┬─────┘   └────┬─────┘ │
                        │               │       │
                        └───────────────┴───────┘
                                        │
                                        ↓
                                 ┌──────────┐
                                 │escalated │
                                 └──────────┘
```

## 3. 详细流转规则

### 3.1 创建 → 待分发

**触发条件**：任务拆解完成，创建 agent_sub_tasks 记录

**状态变更**：
- `status`: `pending`
- `isDispatched`: `false`

**相关字段**：
- `createdAt`: 当前时间

### 3.2 待分发 → 已分发

**触发条件**：`dispatch-agent-subtasks` 定时任务执行

**筛选条件**：
- `status` = `pending`
- `isDispatched` = `false`

**状态变更**：
- `isDispatched`: `true`
- `updatedAt`: 当前时间

### 3.3 已分发 → 执行中

**触发条件**：`execute-agent-subtasks` 定时任务执行

**筛选条件**：
- `status` = `pending`
- `isDispatched` = `true`
- （可选）依赖的前置任务已完成

**状态变更**：
- `status`: `in_progress`
- `startedAt`: 当前时间
- `updatedAt`: 当前时间

**操作**：
1. 根据 `agentId` 获取对应的 Executor
2. 调用 `executor.validate()` 验证任务
3. 调用 `executor.execute()` 执行任务

### 3.4 执行中 → 已完成

**触发条件**：任务执行成功

**状态变更**：
- `status`: `completed`
- `result`: 执行结果
- `completedAt`: 当前时间
- `updatedAt`: 当前时间

### 3.5 执行中 → 阻塞

**触发条件**：任务执行失败（验证失败、执行错误等）

**状态变更**：
- `status`: `blocked`
- `errorMessage`: 错误信息
- `updatedAt`: 当前时间

**后续处理**：
- 可人工重试：将状态重置为 `pending`，`isDispatched` = `true`
- 超过重试次数：升级为 `escalated`

### 3.6 执行中 → 超时

**触发条件**：`monitor-subtasks-timeout` 定时任务检测到超时

**筛选条件**：
- `status` = `in_progress`
- `startedAt` < (当前时间 - 超时阈值，默认 1 小时)

**状态变更**：
- `status`: `timeout`
- `errorMessage`: "任务执行超时"
- `updatedAt`: 当前时间

**后续处理**：
- 可人工重试：将状态重置为 `pending`，`isDispatched` = `true`
- 超过重试次数：升级为 `escalated`

### 3.7 阻塞/超时 → 已升级

**触发条件**：超过重试次数（默认 3 次）

**状态变更**：
- `status`: `escalated`
- `updatedAt`: 当前时间

**后续处理**：
- 需要人工干预
- 人工处理后可重置状态或标记为完成

## 4. 定时任务详细设计

### 4.1 dispatch-agent-subtasks

**执行频率**：每分钟

**职责**：
1. 查询 `status` = `pending` AND `isDispatched` = `false` 的任务
2. 批量更新 `isDispatched` = `true`

**SQL 示例**：
```sql
UPDATE agent_sub_tasks
SET is_dispatched = true, updated_at = NOW()
WHERE status = 'pending' AND is_dispatched = false;
```

### 4.2 execute-agent-subtasks

**执行频率**：每分钟

**职责**：
1. 查询 `status` = `pending` AND `isDispatched` = `true` 的任务（待执行）
2. 查询 `status` = `in_progress` 的任务（执行中，用于断点续传）
3. 对于每个任务：
   - 获取对应的 Executor
   - 执行任务
   - 更新状态

**并发控制**：
- 每次最多处理 N 个任务（如 10 个）
- 避免重复执行：使用分布式锁或标记 "正在处理"

### 4.3 monitor-subtasks-timeout

**执行频率**：每 5 分钟

**职责**：
1. 查询 `status` = `in_progress` 且 `startedAt` < (NOW() - INTERVAL '1 hour') 的任务
2. 将这些任务标记为 `timeout`

**SQL 示例**：
```sql
UPDATE agent_sub_tasks
SET status = 'timeout', 
    error_message = '任务执行超时',
    updated_at = NOW()
WHERE status = 'in_progress' 
  AND started_at < NOW() - INTERVAL '1 hour';
```

## 5. 与 daily_task 状态的对比

| 特性 | daily_task | agent_sub_tasks |
|------|-----------|-----------------|
| 状态数量 | 9 个 | 7 个 |
| 分发标记 | 无 | `isDispatched` 字段 |
| 超时处理 | 有 | 有 |
| 升级机制 | 有 | 有 |
| 状态流转 | 线性为主 | 支持重试 |

**相同点**：
- 都有 pending、in_progress、completed、blocked、timeout、escalated
- 都有超时监控和升级机制

**不同点**：
- agent_sub_tasks 增加了 `isDispatched` 字段，区分"已创建"和"已分发"
- agent_sub_tasks 没有 rejected、pending_review、approved 等审核相关状态

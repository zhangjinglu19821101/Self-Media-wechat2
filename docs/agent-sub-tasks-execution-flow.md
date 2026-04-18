# agent_sub_tasks 任务执行完整方案

## 📋 现状分析

### 当前 agent_sub_tasks 状态字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | text | 状态：'pending' \| 'in_progress' \| 'completed' \| 'blocked' \| 'timeout' \| 'escalated' |
| `isDispatched` | boolean | 是否已分发 |
| `dispatchedAt` | timestamp | 分发时间 |
| `startedAt` | timestamp | 开始执行时间 |
| `completedAt` | timestamp | 完成时间 |

---

## 🎯 用户要求的执行流程

### 核心状态流转

```
pending_review (status)
    ↓ [agent 开始执行]
in_progress (status)
    ↓ [执行完成]
completed (status)
```

### 超时重试机制

```
in_progress (status)
    ↓ [startedAt 超时 30 分钟，定时任务重试]
in_progress (更新 startedAt = 当前时间)
```

---

## 📊 完整方案设计

### 方案一：简化版（推荐，按用户要求）

#### 状态定义

| 状态 | 含义 | 触发条件 |
|------|------|---------|
| `pending` | 待执行（已创建，未分发） | 任务刚创建 |
| `pending_review` | 待执行（已分发，等待执行） | `isDispatched = true` 后 |
| `in_progress` | 执行中 | Agent 开始执行 |
| `completed` | 已完成 | 执行成功 |
| `blocked` | 阻塞 | 执行失败 |
| `timeout` | 超时 | 超时未完成 |
| `escalated` | 已升级 | 需要人工干预 |

#### 状态流转图

```
┌─────────────────────────────────────────────────────────┐
│ 创建阶段                                              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ pending (isDispatched = false)                          │
│     ↓ [dispatch-agent-subtasks 定时任务]               │
│ pending_review (isDispatched = true)                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ 执行阶段                                              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ pending_review                                          │
│     ↓ [execute-agent-subtasks 定时任务]                 │
│ in_progress (设置 startedAt = NOW())                   │
│     ↓                                                   │
│     ├─────────────┬─────────────┬───────────────┤    │
│     ↓             ↓             ↓               ↓    │
│ completed      blocked       timeout        escalated  │
│                                                         │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ 超时重试机制（用户要求）                              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ in_progress                                              │
│     ↓ [monitor-subtasks-timeout 定时任务]              │
│     ↓ [startedAt 超过 30 分钟]                        │
│ in_progress (更新 startedAt = NOW()) ← 用户要求！      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### 详细的状态流转规则

| 当前状态 | 事件 | 下一状态 | 说明 |
|---------|------|---------|------|
| `pending` | 分发任务 | `pending_review` | 设置 `isDispatched = true`, `dispatchedAt = NOW()` |
| `pending_review` | 开始执行 | `in_progress` | 设置 `startedAt = NOW()` |
| `in_progress` | 执行成功 | `completed` | 设置 `completedAt = NOW()`, `executionResult` |
| `in_progress` | 执行失败 | `blocked` | 记录错误信息 |
| `in_progress` | 超时 30 分钟 | `in_progress` | **用户要求**：只更新 `startedAt = NOW()`，重试 |
| `in_progress` | 多次超时 | `timeout` | 超过重试次数后 |
| `blocked` / `timeout` | 升级 | `escalated` | 需要人工干预 |

---

### 方案二：完整版（增加更多状态）

如果需要更精细的控制，可以使用这个版本。

#### 状态定义

| 状态 | 含义 |
|------|------|
| `pending` | 待执行（未分发） |
| `dispatched` | 已分发 |
| `pending_review` | 待执行（已分发，等待执行） |
| `in_progress` | 执行中 |
| `completed` | 已完成 |
| `blocked` | 阻塞 |
| `timeout` | 超时 |
| `escalated` | 已升级 |

#### 状态流转

```
pending → dispatched → pending_review → in_progress → completed
                                    ↓
                                blocked/timeout
                                    ↓
                                escalated
```

---

## 🔧 定时任务设计

### 1. dispatch-agent-subtasks（分发任务）

**执行频率**：每分钟

**职责**：
- 查询 `status = 'pending'` AND `isDispatched = false` 的任务
- 标记为 `isDispatched = true`
- 设置 `status = 'pending_review'`（可选，或者保持 pending）
- 记录 `dispatchedAt = NOW()`

**SQL 示例**：
```sql
UPDATE agent_sub_tasks
SET 
  is_dispatched = true,
  dispatched_at = NOW(),
  status = 'pending_review',  -- 可选
  updated_at = NOW()
WHERE status = 'pending' 
  AND is_dispatched = false;
```

---

### 2. execute-agent-subtasks（执行任务）

**执行频率**：每分钟

**职责**：
- 查询 `status = 'pending_review'` 的任务
- 查询 `status = 'in_progress'` 的任务（断点续传）
- 调用对应的 Executor 执行
- 更新状态

**执行逻辑**：
```typescript
for each task in pending_review:
    executor = ExecutorFactory.create(task.agentId)
    executor.validate(task)
    executor.execute(task)
    update status to in_progress, startedAt = NOW()

for each task in in_progress:
    check if completed
    if completed:
        update status to completed, completedAt = NOW()
```

---

### 3. monitor-subtasks-timeout（监控超时，用户要求的核心）

**执行频率**：每 5 分钟

**职责**：
- 查询 `status = 'in_progress'` 的任务
- 检查 `startedAt` 是否超过 30 分钟
- 如果超时：**只更新 `startedAt = NOW()`，不改变状态**（用户要求！）
- 记录重试次数

**SQL 示例**：
```sql
UPDATE agent_sub_tasks
SET 
  started_at = NOW(),  -- 用户要求：只更新 startedAt
  timeout_handling_count = timeout_handling_count + 1,
  updated_at = NOW()
WHERE status = 'in_progress'
  AND started_at < NOW() - INTERVAL '30 minutes';
```

**注意**：
- ✅ **用户要求**：超时后仍然保持 `status = 'in_progress'`
- ✅ **用户要求**：只更新 `startedAt = NOW()`
- 可以用 `timeoutHandlingCount` 记录重试次数

---

## 📊 字段使用说明

### 关键字段

| 字段 | 用途 | 示例 |
|------|------|------|
| `status` | 主状态 | `'pending'` \| `'pending_review'` \| `'in_progress'` \| `'completed'` |
| `isDispatched` | 是否已分发 | `true` / `false` |
| `dispatchedAt` | 分发时间 | `2026-02-18 14:45:00` |
| `startedAt` | 开始执行时间 | `2026-02-18 14:46:00` |
| `completedAt` | 完成时间 | `2026-02-18 15:00:00` |
| `timeoutHandlingCount` | 超时重试次数 | `0`, `1`, `2`, `3` |
| `executionResult` | 执行结果 | JSON 字符串 |

---

## 🎯 推荐实施方案

### 按用户要求的简化方案

**核心要点**：
1. ✅ 状态：`pending` → `pending_review` → `in_progress` → `completed`
2. ✅ 超时：`in_progress` 超时 30 分钟后，**只更新 `startedAt = NOW()`**，保持 `status = 'in_progress'`
3. ✅ 用 `timeoutHandlingCount` 记录重试次数

**不需要的复杂状态**：
- ❌ 不需要 `dispatched` 状态（用 `isDispatched` 字段即可）
- ❌ 不需要 `timeout` 状态（除非重试次数超限）

---

## ✅ 总结

| 项目 | 方案 |
|------|------|
| **状态流转** | `pending` → `pending_review` → `in_progress` → `completed` |
| **超时处理** | `in_progress` 超时 30 分钟 → 更新 `startedAt = NOW()`，保持 `in_progress` |
| **重试记录** | 用 `timeoutHandlingCount` 字段 |
| **分发标记** | 用 `isDispatched` 字段和 `dispatchedAt` 时间 |

**这个方案完全符合你的要求！** 🎯

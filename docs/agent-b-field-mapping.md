# Agent B 拆解结果字段映射文档

本文档详细说明了 Agent B 返回的 `SubTaskSplitResult` 格式如何映射到 `daily_task` 表字段。

## 1. Agent B 返回的数据格式（SubTaskSplitResult）

```typescript
export interface SubTaskSplitResult {
  orderIndex: number;           // 执行顺序，从 1 开始
  title: string;                // 子任务标题
  description: string;          // 子任务描述
  executor: string;             // 执行该子任务的 agent ID（如：insurance-a, insurance-b 等）
  acceptanceCriteria: string;   // 验收标准
  isCritical: boolean;          // 是否为关键子任务
  criticalReason: string;       // 关键原因
}
```

## 2. 字段映射关系

### 2.1 格式转换逻辑

在 `saveSplitResultToDailyTasks` 函数中，首先将 `SubTaskSplitResult` 转换为内部格式：

```typescript
subTasks.map((st: any, index: number) => ({
  taskTitle: st.title,                                    // 原 title
  commandContent: st.description,                        // 原 description
  executor: st.executor,                                 // 原 executor
  taskType: 'daily',                                     // 固定值
  priority: st.isCritical ? '高' : 'normal',             // 根据 isCritical 转换
  deadline: `第${st.orderIndex || index + 1}天`,         // 根据 orderIndex 生成
  estimatedHours: '8',                                   // 固定值（8小时）
  acceptanceCriteria: st.acceptanceCriteria || '未指定', // 原 acceptanceCriteria
  isCritical: st.isCritical || false,                    // 原 isCritical
  criticalReason: st.criticalReason || '',               // 原 criticalReason
}))
```

### 2.2 daily_task 表字段映射

| SubTaskSplitResult 字段 | 转换后字段 | daily_task 表字段 | 说明 |
|------------------------|-----------|------------------|------|
| `title` | `taskTitle` | `task_title` | 子任务标题 |
| `description` | `commandContent` | `task_description`, `command_content` | 子任务描述 |
| `executor` | `executor` | `executor`, `to_agent_id` | 执行者（通过 mapExecutorId 映射） |
| `isCritical` | `priority` | `task_priority`, `command_priority` | 优先级（高/normal） |
| `orderIndex` | `deadline` | `execution_date` | 执行日期（从 deadline 解析） |
| `acceptanceCriteria` | `acceptanceCriteria` | `deliverables` | 交付物/验收标准 |
| `isCritical` | `isCritical` | `metadata.isCritical` | 是否关键任务 |
| `criticalReason` | `criticalReason` | `metadata.criticalReason` | 关键原因 |
| - | `taskType` | `task_type` | 固定为 'daily' |
| - | `estimatedHours` | `metadata.estimatedHours` | 固定为 '8' |

### 2.3 自动生成的字段

| 字段 | 生成规则 | 示例 |
|------|---------|------|
| `task_id` | `daily-task-${executorId}-${date}-${序号}` | `daily-task-insurance-d-2026-02-16-001` |
| `command_id` | `${taskId}-${executorId}-${序号}` | `task-A-to-B-xxx-insurance-d-1` |
| `related_task_id` | 从 agent_tasks 表获取 | `task-A-to-B-xxx` |
| `execution_deadline_start` | `${executionDate} 09:00:00` | `2026-02-16 09:00:00` |
| `execution_deadline_end` | `${executionDate} 18:00:00` | `2026-02-16 18:00:00` |
| `sort_order` | `${index + 1}` | `1, 2, 3, ...` |

### 2.4 固定值字段

| 字段 | 固定值 | 说明 |
|------|-------|------|
| `execution_status` | `pending_review` | 执行状态 |
| `splitter` | `agent B` | 拆分者 |
| `entry_user` | `task.creator \|\| 'B'` | 录入用户 |
| `from_agent_id` | `task.from_agent_id \|\| 'A'` | 发起 Agent |
| `is_confirmed` | `false` | 是否确认 |
| `requires_intervention` | `false` | 是否需要干预 |
| `trigger_source` | `agent-b-split` | 触发源 |
| `scenario_type` | `agent-b-daily` | 场景类型 |
| `retry_status` | `pending` | 重试状态 |

## 3. 示例数据

### 3.1 Agent B 返回的 SubTaskSplitResult

```json
[
  {
    "orderIndex": 1,
    "title": "完成《年终奖到手，存年金险还是增额寿？》文章创作与合规交付",
    "description": "结合年终奖真实案例对比年金险与增额寿，突出适用场景，无偏向性引导，控制字数在1200字以内，语言通俗，完成合规自查并标注结论",
    "executor": "insurance-d",
    "acceptanceCriteria": "1. 字数≤1200字，语言通俗无专业术语堆砌；2. 包含年终奖真实案例对比，明确两种储蓄工具适用场景，无偏向性；3. 合规自查无违规收益承诺、无虚假对比，文末标注合规自查结论；4. 17:00前交付",
    "isCritical": true,
    "criticalReason": "是任务要求的首篇交付内容，直接影响后续内容节奏，且为储蓄类核心内容，失败会导致整体任务交付进度滞后"
  }
]
```

### 3.2 转换后的格式

```json
[
  {
    "taskTitle": "完成《年终奖到手，存年金险还是增额寿？》文章创作与合规交付",
    "commandContent": "结合年终奖真实案例对比年金险与增额寿，突出适用场景，无偏向性引导，控制字数在1200字以内，语言通俗，完成合规自查并标注结论",
    "executor": "insurance-d",
    "taskType": "daily",
    "priority": "高",
    "deadline": "第1天",
    "estimatedHours": "8",
    "acceptanceCriteria": "1. 字数≤1200字，语言通俗无专业术语堆砌；2. 包含年终奖真实案例对比，明确两种储蓄工具适用场景，无偏向性；3. 合规自查无违规收益承诺、无虚假对比，文末标注合规自查结论；4. 17:00前交付",
    "isCritical": true,
    "criticalReason": "是任务要求的首篇交付内容，直接影响后续内容节奏，且为储蓄类核心内容，失败会导致整体任务交付进度滞后"
  }
]
```

### 3.3 保存到 daily_task 表

```sql
INSERT INTO daily_task (
  task_id,                           -- 'daily-task-insurance-d-2026-02-16-001'
  related_task_id,                   -- 'task-A-to-B-xxx'
  task_title,                        -- '完成《年终奖到手，存年金险还是增额寿？》文章创作与合规交付'
  task_description,                  -- '结合年终奖真实案例对比...'
  executor,                          -- 'insurance-d'
  task_priority,                     -- 'high'
  execution_date,                    -- '2026-02-16'
  execution_deadline_start,          -- '2026-02-16 09:00:00'
  execution_deadline_end,            -- '2026-02-16 18:00:00'
  deliverables,                      -- '1. 字数≤1200字...'
  execution_status,                  -- 'pending_review'
  splitter,                          -- 'agent B'
  entry_user,                        -- 'A'
  from_agent_id,                     -- 'A'
  to_agent_id,                       -- 'insurance-d'
  task_type,                         -- 'daily'
  is_confirmed,                      -- false
  dependencies,                      -- '{}'
  sort_order,                        -- 1
  metadata,                          -- '{"estimatedHours":"8","acceptanceCriteria":"...","isCritical":true,"criticalReason":"...","splitSource":"agent-b"}'
  command_id,                        -- 'task-A-to-B-xxx-insurance-d-1'
  command_content,                   -- '结合年终奖真实案例对比...'
  command_priority,                  -- 'high'
  original_command,                  -- '结合年终奖真实案例对比...'
  task_name,                         -- '完成《年终奖到手，存年金险还是增额寿？》文章创作与合规交付'
  trigger_source,                    -- 'agent-b-split'
  retry_status,                      -- 'pending'
  scenario_type,                     -- 'agent-b-daily'
  created_at,                        -- 当前时间
  updated_at,                        -- 当前时间
  -- 其他字段为 null 或默认值
) VALUES (...)
```

## 4. 字段映射总结

### 4.1 直接映射的字段
- `title` → `task_title`
- `description` → `task_description`、`command_content`
- `executor` → `executor`、`to_agent_id`
- `acceptanceCriteria` → `deliverables`

### 4.2 需要转换的字段
- `isCritical` → `priority`（boolean → '高'/'normal'）
- `orderIndex` → `deadline`（number → '第N天'）→ `execution_date`（string → date）
- `isCritical`、`criticalReason` → `metadata.isCritical`、`metadata.criticalReason`

### 4.3 固定值字段
- `taskType` = 'daily'
- `estimatedHours` = '8'
- `execution_status` = 'pending_review'
- `splitter` = 'agent B'
- `trigger_source` = 'agent-b-split'
- `scenario_type` = 'agent-b-daily'

### 4.4 自动生成的字段
- `task_id` = `daily-task-${executorId}-${date}-${序号}`
- `command_id` = `${taskId}-${executorId}-${序号}`
- `execution_deadline_start` = `${date} 09:00:00`
- `execution_deadline_end` = `${date} 18:00:00`
- `sort_order` = `${index + 1}`

## 5. 注意事项

1. **executor 映射**：`executor` 字段需要通过 `mapExecutorId` 函数进行映射，将文本形式的 agent 名称转换为标准的 agent ID。
2. **日期解析**：`deadline` 字段使用相对描述（如"第1天"），需要解析为具体的日期。
3. **优先级转换**：`isCritical` 字段需要转换为 `priority` 字段（true → '高'，false → 'normal'）。
4. **metadata 存储**：`isCritical` 和 `criticalReason` 字段存储在 `metadata` JSONB 字段中，方便后续查询和使用。
5. **唯一性保证**：`task_id` 字段由 `executorId`、`date` 和 `序号` 组合生成，保证唯一性。
6. **重复检查**：在插入前会检查 `task_id` 是否已存在，避免重复插入。

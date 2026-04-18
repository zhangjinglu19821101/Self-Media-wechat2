# 数据库结构参考文档

> ⚠️  重要：本文档反映数据库的**实际**结构，代码中必须使用这些字段名！
> 生成时间: 2026-02-24T15:58:53.408Z

---

## 🔑 关键表快速参考

| 表名 | 说明 |
|------|------|
| `daily_task` | 每日任务表（不是 daily_tasks）|
| `agent_notifications` | Agent 通知表 |
| `agent_sub_tasks` | Agent 子任务表 |

---

## 表: `agent_dev_principles`

| 字段名 | 数据类型 | 可空 | 默认值 |
|--------|----------|------|--------|
| `id` | uuid | ✗ | `gen_random_uuid()` |
| `insight_category` | text | ✗ | - |
| `insight_title` | text | ✗ | - |
| `problem_scenario` | text | ✗ | - |
| `solution_approach` | text | ✗ | - |
| `principles` | text | ✗ | - |
| `created_at` | timestamp without time zone | ✗ | `now()` |
| `updated_at` | timestamp without time zone | ✗ | `now()` |

---

## 表: `agent_feedbacks`

| 字段名 | 数据类型 | 可空 | 默认值 |
|--------|----------|------|--------|
| `id` | uuid | ✗ | `gen_random_uuid()` |
| `feedback_id` | text | ✗ | - |
| `task_id` | text | ✗ | - |
| `from_agent_id` | text | ✗ | - |
| `to_agent_id` | text | ✗ | - |
| `original_command` | text | ✗ | - |
| `feedback_content` | text | ✗ | - |
| `feedback_type` | text | ✗ | `'question'::text` |
| `status` | text | ✗ | `'pending'::text` |
| `resolution` | text | ✓ | - |
| `resolved_command` | text | ✓ | - |
| `metadata` | jsonb | ✓ | `'{}'::jsonb` |
| `created_at` | timestamp without time zone | ✗ | `now()` |
| `updated_at` | timestamp without time zone | ✗ | `now()` |
| `resolved_at` | timestamp without time zone | ✓ | - |

---

## 表: `agent_interactions`

| 字段名 | 数据类型 | 可空 | 默认值 |
|--------|----------|------|--------|
| `id` | uuid | ✗ | `gen_random_uuid()` |
| `command_result_id` | uuid | ✗ | - |
| `task_description` | text | ✓ | - |
| `session_id` | text | ✗ | - |
| `sender` | text | ✗ | - |
| `receiver` | text | ✓ | - |
| `message_type` | text | ✗ | - |
| `content` | text | ✗ | - |
| `round_number` | integer | ✓ | - |
| `is_resolution` | boolean | ✗ | `false` |
| `created_at` | timestamp without time zone | ✗ | `now()` |
| `metadata` | jsonb | ✓ | `'{}'::jsonb` |
| `is_understand` | boolean | ✓ | `false` |

---

## 表: `agent_memories`

| 字段名 | 数据类型 | 可空 | 默认值 |
|--------|----------|------|--------|
| `id` | uuid | ✗ | `gen_random_uuid()` |
| `agent_id` | text | ✗ | - |
| `memory_type` | text | ✗ | - |
| `title` | text | ✗ | - |
| `content` | text | ✗ | - |
| `tags` | jsonb | ✓ | `'[]'::jsonb` |
| `importance` | integer | ✗ | `0` |
| `source` | text | ✓ | - |
| `metadata` | jsonb | ✓ | `'{}'::jsonb` |
| `created_at` | timestamp without time zone | ✗ | `now()` |
| `updated_at` | timestamp without time zone | ✗ | `now()` |

---

## 表: `agent_notifications`

| 字段名 | 数据类型 | 可空 | 默认值 |
|--------|----------|------|--------|
| `id` | uuid | ✗ | `gen_random_uuid()` |
| `notification_id` | text | ✗ | - |
| `from_agent_id` | text | ✗ | - |
| `to_agent_id` | text | ✗ | - |
| `notification_type` | text | ✗ | - |
| `title` | text | ✗ | - |
| `content` | text | ✗ | - |
| `related_task_id` | text | ✓ | - |
| `status` | text | ✗ | `'unread'::text` |
| `priority` | text | ✗ | `'normal'::text` |
| `metadata` | jsonb | ✓ | `'{}'::jsonb` |
| `is_read` | boolean | ✗ | `false` |
| `read_at` | timestamp without time zone | ✓ | - |
| `created_at` | timestamp without time zone | ✗ | `now()` |

**实际字段列表**:
```typescript
// 从数据库实际读取的字段
[
  "id",
  "notification_id",
  "from_agent_id",
  "to_agent_id",
  "notification_type",
  "title",
  "content",
  "related_task_id",
  "status",
  "priority",
  "metadata",
  "is_read",
  "read_at",
  "created_at"
]
```

---

## 表: `agent_notifications_backup_20260218_v2`

| 字段名 | 数据类型 | 可空 | 默认值 |
|--------|----------|------|--------|
| `id` | uuid | ✓ | - |
| `notification_id` | text | ✓ | - |
| `from_agent_id` | text | ✓ | - |
| `to_agent_id` | text | ✓ | - |
| `notification_type` | text | ✓ | - |
| `title` | text | ✓ | - |
| `content` | text | ✓ | - |
| `related_task_id` | text | ✓ | - |
| `status` | text | ✓ | - |
| `priority` | text | ✓ | - |
| `metadata` | jsonb | ✓ | - |
| `is_read` | boolean | ✓ | - |
| `read_at` | timestamp without time zone | ✓ | - |
| `created_at` | timestamp without time zone | ✓ | - |

**实际字段列表**:
```typescript
// 从数据库实际读取的字段
[
  "id",
  "notification_id",
  "from_agent_id",
  "to_agent_id",
  "notification_type",
  "title",
  "content",
  "related_task_id",
  "status",
  "priority",
  "metadata",
  "is_read",
  "read_at",
  "created_at"
]
```

---

## 表: `agent_notifications_backup_20260218_v3`

| 字段名 | 数据类型 | 可空 | 默认值 |
|--------|----------|------|--------|
| `id` | uuid | ✓ | - |
| `notification_id` | text | ✓ | - |
| `from_agent_id` | text | ✓ | - |
| `to_agent_id` | text | ✓ | - |
| `notification_type` | text | ✓ | - |
| `title` | text | ✓ | - |
| `content` | text | ✓ | - |
| `related_task_id` | text | ✓ | - |
| `status` | text | ✓ | - |
| `priority` | text | ✓ | - |
| `metadata` | jsonb | ✓ | - |
| `is_read` | boolean | ✓ | - |
| `read_at` | timestamp without time zone | ✓ | - |
| `created_at` | timestamp without time zone | ✓ | - |

**实际字段列表**:
```typescript
// 从数据库实际读取的字段
[
  "id",
  "notification_id",
  "from_agent_id",
  "to_agent_id",
  "notification_type",
  "title",
  "content",
  "related_task_id",
  "status",
  "priority",
  "metadata",
  "is_read",
  "read_at",
  "created_at"
]
```

---

## 表: `agent_reports`

| 字段名 | 数据类型 | 可空 | 默认值 |
|--------|----------|------|--------|
| `id` | uuid | ✗ | `gen_random_uuid()` |
| `report_type` | text | ✗ | - |
| `command_result_id` | uuid | ✗ | - |
| `sub_task_id` | uuid | ✓ | - |
| `summary` | text | ✗ | - |
| `conclusion` | text | ✗ | - |
| `dialogue_process` | jsonb | ✗ | - |
| `suggested_actions` | jsonb | ✗ | - |
| `reported_to` | text | ✗ | - |
| `reported_from` | text | ✗ | - |
| `status` | text | ✗ | `'pending'::text` |
| `reviewed_by` | text | ✓ | - |
| `reviewed_at` | timestamp without time zone | ✓ | - |
| `processed_by` | text | ✓ | - |
| `processed_at` | timestamp without time zone | ✓ | - |
| `processed_actions` | jsonb | ✓ | `'[]'::jsonb` |
| `dismissed_reason` | text | ✓ | - |
| `related_task_id` | text | ✓ | - |
| `created_at` | timestamp without time zone | ✓ | `CURRENT_TIMESTAMP` |
| `updated_at` | timestamp without time zone | ✓ | `CURRENT_TIMESTAMP` |

---

## 表: `agent_sub_tasks`

| 字段名 | 数据类型 | 可空 | 默认值 |
|--------|----------|------|--------|
| `id` | uuid | ✗ | `gen_random_uuid()` |
| `command_result_id` | uuid | ✗ | - |
| `from_parents_executor` | text | ✗ | - |
| `task_title` | text | ✗ | - |
| `task_description` | text | ✓ | - |
| `status` | text | ✗ | `'pending'::text` |
| `order_index` | integer | ✗ | - |
| `started_at` | timestamp without time zone | ✓ | - |
| `completed_at` | timestamp without time zone | ✓ | - |
| `metadata` | jsonb | ✓ | `'{}'::jsonb` |
| `created_at` | timestamp without time zone | ✗ | `now()` |
| `updated_at` | timestamp without time zone | ✗ | `now()` |
| `dialogue_session_id` | text | ✓ | - |
| `dialogue_rounds` | integer | ✓ | `0` |
| `dialogue_status` | text | ✓ | `'none'::text` |
| `last_dialogue_at` | timestamp without time zone | ✓ | - |
| `execution_result` | text | ✓ | - |
| `status_proof` | text | ✓ | - |
| `is_dispatched` | boolean | ✓ | `false` |
| `dispatched_at` | timestamp without time zone | ✓ | - |
| `timeout_handling_count` | integer | ✓ | `0` |
| `feedback_history` | jsonb | ✓ | `'[]'::jsonb` |
| `last_feedback_at` | timestamp without time zone | ✓ | - |
| `escalated` | boolean | ✓ | `false` |
| `escalated_at` | timestamp without time zone | ✓ | - |
| `escalated_reason` | text | ✓ | - |

**实际字段列表**:
```typescript
// 从数据库实际读取的字段
[
  "id",
  "command_result_id",
  "from_parents_executor",
  "task_title",
  "task_description",
  "status",
  "order_index",
  "started_at",
  "completed_at",
  "metadata",
  "created_at",
  "updated_at",
  "dialogue_session_id",
  "dialogue_rounds",
  "dialogue_status",
  "last_dialogue_at",
  "execution_result",
  "status_proof",
  "is_dispatched",
  "dispatched_at",
  "timeout_handling_count",
  "feedback_history",
  "last_feedback_at",
  "escalated",
  "escalated_at",
  "escalated_reason"
]
```

---

## 表: `agent_sub_tasks_backup_20260218_v2`

| 字段名 | 数据类型 | 可空 | 默认值 |
|--------|----------|------|--------|
| `id` | uuid | ✓ | - |
| `command_result_id` | uuid | ✓ | - |
| `agent_id` | text | ✓ | - |
| `task_title` | text | ✓ | - |
| `task_description` | text | ✓ | - |
| `status` | text | ✓ | - |
| `order_index` | integer | ✓ | - |
| `started_at` | timestamp without time zone | ✓ | - |
| `completed_at` | timestamp without time zone | ✓ | - |
| `metadata` | jsonb | ✓ | - |
| `created_at` | timestamp without time zone | ✓ | - |
| `updated_at` | timestamp without time zone | ✓ | - |
| `dialogue_session_id` | text | ✓ | - |
| `dialogue_rounds` | integer | ✓ | - |
| `dialogue_status` | text | ✓ | - |
| `last_dialogue_at` | timestamp without time zone | ✓ | - |
| `execution_result` | text | ✓ | - |
| `status_proof` | text | ✓ | - |
| `is_dispatched` | boolean | ✓ | - |
| `dispatched_at` | timestamp without time zone | ✓ | - |
| `timeout_handling_count` | integer | ✓ | - |
| `feedback_history` | jsonb | ✓ | - |
| `last_feedback_at` | timestamp without time zone | ✓ | - |
| `escalated` | boolean | ✓ | - |
| `escalated_at` | timestamp without time zone | ✓ | - |
| `escalated_reason` | text | ✓ | - |

**实际字段列表**:
```typescript
// 从数据库实际读取的字段
[
  "id",
  "command_result_id",
  "agent_id",
  "task_title",
  "task_description",
  "status",
  "order_index",
  "started_at",
  "completed_at",
  "metadata",
  "created_at",
  "updated_at",
  "dialogue_session_id",
  "dialogue_rounds",
  "dialogue_status",
  "last_dialogue_at",
  "execution_result",
  "status_proof",
  "is_dispatched",
  "dispatched_at",
  "timeout_handling_count",
  "feedback_history",
  "last_feedback_at",
  "escalated",
  "escalated_at",
  "escalated_reason"
]
```

---

## 表: `agent_sub_tasks_backup_20260218_v3`

| 字段名 | 数据类型 | 可空 | 默认值 |
|--------|----------|------|--------|
| `id` | uuid | ✓ | - |
| `command_result_id` | uuid | ✓ | - |
| `agent_id` | text | ✓ | - |
| `task_title` | text | ✓ | - |
| `task_description` | text | ✓ | - |
| `status` | text | ✓ | - |
| `order_index` | integer | ✓ | - |
| `started_at` | timestamp without time zone | ✓ | - |
| `completed_at` | timestamp without time zone | ✓ | - |
| `metadata` | jsonb | ✓ | - |
| `created_at` | timestamp without time zone | ✓ | - |
| `updated_at` | timestamp without time zone | ✓ | - |
| `dialogue_session_id` | text | ✓ | - |
| `dialogue_rounds` | integer | ✓ | - |
| `dialogue_status` | text | ✓ | - |
| `last_dialogue_at` | timestamp without time zone | ✓ | - |
| `execution_result` | text | ✓ | - |
| `status_proof` | text | ✓ | - |
| `is_dispatched` | boolean | ✓ | - |
| `dispatched_at` | timestamp without time zone | ✓ | - |
| `timeout_handling_count` | integer | ✓ | - |
| `feedback_history` | jsonb | ✓ | - |
| `last_feedback_at` | timestamp without time zone | ✓ | - |
| `escalated` | boolean | ✓ | - |
| `escalated_at` | timestamp without time zone | ✓ | - |
| `escalated_reason` | text | ✓ | - |

**实际字段列表**:
```typescript
// 从数据库实际读取的字段
[
  "id",
  "command_result_id",
  "agent_id",
  "task_title",
  "task_description",
  "status",
  "order_index",
  "started_at",
  "completed_at",
  "metadata",
  "created_at",
  "updated_at",
  "dialogue_session_id",
  "dialogue_rounds",
  "dialogue_status",
  "last_dialogue_at",
  "execution_result",
  "status_proof",
  "is_dispatched",
  "dispatched_at",
  "timeout_handling_count",
  "feedback_history",
  "last_feedback_at",
  "escalated",
  "escalated_at",
  "escalated_reason"
]
```

---

## 表: `agent_tasks`

| 字段名 | 数据类型 | 可空 | 默认值 |
|--------|----------|------|--------|
| `id` | uuid | ✗ | `gen_random_uuid()` |
| `task_id` | text | ✗ | - |
| `task_name` | text | ✗ | - |
| `core_command` | text | ✗ | - |
| `executor` | text | ✗ | - |
| `acceptance_criteria` | text | ✗ | - |
| `task_type` | text | ✗ | `'master'::text` |
| `split_status` | text | ✗ | `'pending'::text` |
| `task_duration_start` | timestamp without time zone | ✗ | - |
| `task_duration_end` | timestamp without time zone | ✗ | - |
| `total_deliverables` | text | ✗ | - |
| `task_priority` | text | ✗ | `'normal'::text` |
| `task_status` | text | ✗ | `'pending'::text` |
| `creator` | text | ✗ | - |
| `updater` | text | ✗ | `'TS'::text` |
| `remarks` | text | ✓ | - |
| `from_agent_id` | text | ✗ | - |
| `command_type` | text | ✗ | `'instruction'::text` |
| `result` | text | ✓ | - |
| `metadata` | jsonb | ✓ | `'{}'::jsonb` |
| `created_at` | timestamp without time zone | ✗ | `now()` |
| `updated_at` | timestamp without time zone | ✗ | `now()` |
| `completed_at` | timestamp without time zone | ✓ | - |
| `to_agent_id` | text | ✗ | `'agent B'::text` |
| `split_start_time` | timestamp without time zone | ✓ | - |
| `rejection_reason` | text | ✓ | - |

**实际字段列表**:
```typescript
// 从数据库实际读取的字段
[
  "id",
  "task_id",
  "task_name",
  "core_command",
  "executor",
  "acceptance_criteria",
  "task_type",
  "split_status",
  "task_duration_start",
  "task_duration_end",
  "total_deliverables",
  "task_priority",
  "task_status",
  "creator",
  "updater",
  "remarks",
  "from_agent_id",
  "command_type",
  "result",
  "metadata",
  "created_at",
  "updated_at",
  "completed_at",
  "to_agent_id",
  "split_start_time",
  "rejection_reason"
]
```

---

## 表: `agent_tasks_backup_20260218_v2`

| 字段名 | 数据类型 | 可空 | 默认值 |
|--------|----------|------|--------|
| `id` | uuid | ✓ | - |
| `task_id` | text | ✓ | - |
| `task_name` | text | ✓ | - |
| `core_command` | text | ✓ | - |
| `executor` | text | ✓ | - |
| `acceptance_criteria` | text | ✓ | - |
| `task_type` | text | ✓ | - |
| `split_status` | text | ✓ | - |
| `task_duration_start` | timestamp without time zone | ✓ | - |
| `task_duration_end` | timestamp without time zone | ✓ | - |
| `total_deliverables` | text | ✓ | - |
| `task_priority` | text | ✓ | - |
| `task_status` | text | ✓ | - |
| `creator` | text | ✓ | - |
| `updater` | text | ✓ | - |
| `remarks` | text | ✓ | - |
| `from_agent_id` | text | ✓ | - |
| `command_type` | text | ✓ | - |
| `result` | text | ✓ | - |
| `metadata` | jsonb | ✓ | - |
| `created_at` | timestamp without time zone | ✓ | - |
| `updated_at` | timestamp without time zone | ✓ | - |
| `completed_at` | timestamp without time zone | ✓ | - |
| `to_agent_id` | text | ✓ | - |

**实际字段列表**:
```typescript
// 从数据库实际读取的字段
[
  "id",
  "task_id",
  "task_name",
  "core_command",
  "executor",
  "acceptance_criteria",
  "task_type",
  "split_status",
  "task_duration_start",
  "task_duration_end",
  "total_deliverables",
  "task_priority",
  "task_status",
  "creator",
  "updater",
  "remarks",
  "from_agent_id",
  "command_type",
  "result",
  "metadata",
  "created_at",
  "updated_at",
  "completed_at",
  "to_agent_id"
]
```

---

## 表: `agent_tasks_backup_20260218_v3`

| 字段名 | 数据类型 | 可空 | 默认值 |
|--------|----------|------|--------|
| `id` | uuid | ✓ | - |
| `task_id` | text | ✓ | - |
| `task_name` | text | ✓ | - |
| `core_command` | text | ✓ | - |
| `executor` | text | ✓ | - |
| `acceptance_criteria` | text | ✓ | - |
| `task_type` | text | ✓ | - |
| `split_status` | text | ✓ | - |
| `task_duration_start` | timestamp without time zone | ✓ | - |
| `task_duration_end` | timestamp without time zone | ✓ | - |
| `total_deliverables` | text | ✓ | - |
| `task_priority` | text | ✓ | - |
| `task_status` | text | ✓ | - |
| `creator` | text | ✓ | - |
| `updater` | text | ✓ | - |
| `remarks` | text | ✓ | - |
| `from_agent_id` | text | ✓ | - |
| `command_type` | text | ✓ | - |
| `result` | text | ✓ | - |
| `metadata` | jsonb | ✓ | - |
| `created_at` | timestamp without time zone | ✓ | - |
| `updated_at` | timestamp without time zone | ✓ | - |
| `completed_at` | timestamp without time zone | ✓ | - |
| `to_agent_id` | text | ✓ | - |

**实际字段列表**:
```typescript
// 从数据库实际读取的字段
[
  "id",
  "task_id",
  "task_name",
  "core_command",
  "executor",
  "acceptance_criteria",
  "task_type",
  "split_status",
  "task_duration_start",
  "task_duration_end",
  "total_deliverables",
  "task_priority",
  "task_status",
  "creator",
  "updater",
  "remarks",
  "from_agent_id",
  "command_type",
  "result",
  "metadata",
  "created_at",
  "updated_at",
  "completed_at",
  "to_agent_id"
]
```

---

## 表: `conversation_histories`

| 字段名 | 数据类型 | 可空 | 默认值 |
|--------|----------|------|--------|
| `id` | character varying | ✗ | `gen_random_uuid()` |
| `agent_id` | character varying | ✗ | - |
| `session_id` | character varying | ✗ | - |
| `role` | character varying | ✗ | - |
| `content` | text | ✗ | - |
| `timestamp` | timestamp with time zone | ✗ | `now()` |
| `metadata` | jsonb | ✓ | - |

**实际字段列表**:
```typescript
// 从数据库实际读取的字段
[
  "id",
  "agent_id",
  "session_id",
  "role",
  "content",
  "timestamp",
  "metadata"
]
```

---

## 表: `conversations`

| 字段名 | 数据类型 | 可空 | 默认值 |
|--------|----------|------|--------|
| `id` | uuid | ✗ | `gen_random_uuid()` |
| `session_id` | text | ✗ | - |
| `user_id` | text | ✓ | - |
| `agent_id` | text | ✗ | - |
| `state` | text | ✗ | `'active'::text` |
| `variables` | jsonb | ✓ | `'{}'::jsonb` |
| `context` | jsonb | ✓ | `'{}'::jsonb` |
| `metadata` | jsonb | ✓ | `'{}'::jsonb` |
| `started_at` | timestamp without time zone | ✗ | `now()` |
| `ended_at` | timestamp without time zone | ✓ | - |
| `last_active_at` | timestamp without time zone | ✗ | `now()` |
| `created_at` | timestamp without time zone | ✗ | `now()` |
| `updated_at` | timestamp without time zone | ✗ | `now()` |

**实际字段列表**:
```typescript
// 从数据库实际读取的字段
[
  "id",
  "session_id",
  "user_id",
  "agent_id",
  "state",
  "variables",
  "context",
  "metadata",
  "started_at",
  "ended_at",
  "last_active_at",
  "created_at",
  "updated_at"
]
```

---

## 表: `daily_task`

| 字段名 | 数据类型 | 可空 | 默认值 |
|--------|----------|------|--------|
| `id` | uuid | ✗ | `gen_random_uuid()` |
| `command_id` | text | ✗ | - |
| `related_task_id` | text | ✗ | - |
| `task_description` | text | ✗ | - |
| `executor` | text | ✗ | - |
| `task_priority` | text | ✗ | `'normal'::text` |
| `execution_deadline_start` | timestamp without time zone | ✗ | - |
| `execution_deadline_end` | timestamp without time zone | ✗ | - |
| `deliverables` | text | ✗ | - |
| `execution_status` | text | ✗ | `'new'::text` |
| `status_proof` | text | ✓ | - |
| `help_record` | text | ✓ | - |
| `audit_opinion` | text | ✓ | - |
| `splitter` | text | ✗ | `'agent B'::text` |
| `entry_user` | text | ✗ | `'TS'::text` |
| `remarks` | text | ✓ | - |
| `last_ts_check_time` | timestamp without time zone | ✓ | - |
| `last_ts_awakening_time` | timestamp without time zone | ✓ | - |
| `ts_awakening_count` | integer | ✗ | `0` |
| `last_inspection_time` | timestamp without time zone | ✓ | - |
| `last_consult_time` | timestamp without time zone | ✓ | - |
| `awakening_count` | integer | ✗ | `0` |
| `task_id` | text | ✓ | - |
| `from_agent_id` | text | ✗ | - |
| `to_agent_id` | text | ✗ | - |
| `original_command` | text | ✗ | - |
| `execution_result` | text | ✓ | - |
| `output_data` | jsonb | ✓ | `'{}'::jsonb` |
| `metrics` | jsonb | ✓ | `'{}'::jsonb` |
| `attachments` | jsonb | ✓ | `'[]'::jsonb` |
| `completed_at` | timestamp without time zone | ✓ | - |
| `scenario_type` | text | ✓ | - |
| `task_name` | text | ✓ | - |
| `trigger_source` | text | ✓ | - |
| `retry_status` | text | ✓ | - |
| `metadata` | jsonb | ✓ | `'{}'::jsonb` |
| `created_at` | timestamp without time zone | ✗ | `now()` |
| `updated_at` | timestamp without time zone | ✗ | `now()` |
| `task_type` | text | ✓ | `'daily'::text` |
| `execution_date` | date | ✓ | - |
| `rejection_reason` | text | ✓ | - |
| `dependencies` | jsonb | ✓ | `'{}'::jsonb` |
| `sort_order` | integer | ✓ | `0` |
| `completed_sub_tasks` | integer | ✓ | `0` |
| `completed_sub_tasks_description` | text | ✓ | - |
| `sub_task_count` | integer | ✓ | `0` |
| `question_status` | text | ✓ | `'none'::text` |
| `last_checked_at` | timestamp without time zone | ✓ | - |
| `last_inspected_at` | timestamp without time zone | ✓ | - |
| `dialogue_session_id` | text | ✓ | - |
| `dialogue_rounds` | integer | ✓ | `0` |
| `dialogue_status` | text | ✓ | `'none'::text` |
| `last_dialogue_at` | timestamp without time zone | ✓ | - |
| `latest_report_id` | uuid | ✓ | - |
| `report_count` | integer | ✓ | `0` |
| `requires_intervention` | boolean | ✓ | `false` |
| `task_title` | text | ✗ | `''::text` |
| `command_content` | text | ✓ | - |
| `command_priority` | text | ✓ | - |
| `split_start_time` | timestamp without time zone | ✓ | - |

**实际字段列表**:
```typescript
// 从数据库实际读取的字段
[
  "id",
  "command_id",
  "related_task_id",
  "task_description",
  "executor",
  "task_priority",
  "execution_deadline_start",
  "execution_deadline_end",
  "deliverables",
  "execution_status",
  "status_proof",
  "help_record",
  "audit_opinion",
  "splitter",
  "entry_user",
  "remarks",
  "last_ts_check_time",
  "last_ts_awakening_time",
  "ts_awakening_count",
  "last_inspection_time",
  "last_consult_time",
  "awakening_count",
  "task_id",
  "from_agent_id",
  "to_agent_id",
  "original_command",
  "execution_result",
  "output_data",
  "metrics",
  "attachments",
  "completed_at",
  "scenario_type",
  "task_name",
  "trigger_source",
  "retry_status",
  "metadata",
  "created_at",
  "updated_at",
  "task_type",
  "execution_date",
  "rejection_reason",
  "dependencies",
  "sort_order",
  "completed_sub_tasks",
  "completed_sub_tasks_description",
  "sub_task_count",
  "question_status",
  "last_checked_at",
  "last_inspected_at",
  "dialogue_session_id",
  "dialogue_rounds",
  "dialogue_status",
  "last_dialogue_at",
  "latest_report_id",
  "report_count",
  "requires_intervention",
  "task_title",
  "command_content",
  "command_priority",
  "split_start_time"
]
```

---

## 表: `daily_task_backup_20260218_v2`

| 字段名 | 数据类型 | 可空 | 默认值 |
|--------|----------|------|--------|
| `id` | uuid | ✓ | - |
| `command_id` | text | ✓ | - |
| `related_task_id` | text | ✓ | - |
| `task_description` | text | ✓ | - |
| `executor` | text | ✓ | - |
| `task_priority` | text | ✓ | - |
| `execution_deadline_start` | timestamp without time zone | ✓ | - |
| `execution_deadline_end` | timestamp without time zone | ✓ | - |
| `deliverables` | text | ✓ | - |
| `execution_status` | text | ✓ | - |
| `status_proof` | text | ✓ | - |
| `help_record` | text | ✓ | - |
| `audit_opinion` | text | ✓ | - |
| `splitter` | text | ✓ | - |
| `entry_user` | text | ✓ | - |
| `remarks` | text | ✓ | - |
| `last_ts_check_time` | timestamp without time zone | ✓ | - |
| `last_ts_awakening_time` | timestamp without time zone | ✓ | - |
| `ts_awakening_count` | integer | ✓ | - |
| `last_inspection_time` | timestamp without time zone | ✓ | - |
| `last_consult_time` | timestamp without time zone | ✓ | - |
| `awakening_count` | integer | ✓ | - |
| `task_id` | text | ✓ | - |
| `from_agent_id` | text | ✓ | - |
| `to_agent_id` | text | ✓ | - |
| `original_command` | text | ✓ | - |
| `execution_result` | text | ✓ | - |
| `output_data` | jsonb | ✓ | - |
| `metrics` | jsonb | ✓ | - |
| `attachments` | jsonb | ✓ | - |
| `completed_at` | timestamp without time zone | ✓ | - |
| `scenario_type` | text | ✓ | - |
| `task_name` | text | ✓ | - |
| `trigger_source` | text | ✓ | - |
| `retry_status` | text | ✓ | - |
| `metadata` | jsonb | ✓ | - |
| `created_at` | timestamp without time zone | ✓ | - |
| `updated_at` | timestamp without time zone | ✓ | - |
| `task_type` | text | ✓ | - |
| `execution_date` | date | ✓ | - |
| `is_confirmed` | boolean | ✓ | - |
| `confirmed_by` | text | ✓ | - |
| `confirmed_at` | timestamp without time zone | ✓ | - |
| `rejection_reason` | text | ✓ | - |
| `dependencies` | jsonb | ✓ | - |
| `sort_order` | integer | ✓ | - |
| `completed_sub_tasks` | integer | ✓ | - |
| `completed_sub_tasks_description` | text | ✓ | - |
| `sub_task_count` | integer | ✓ | - |
| `question_status` | text | ✓ | - |
| `last_checked_at` | timestamp without time zone | ✓ | - |
| `last_inspected_at` | timestamp without time zone | ✓ | - |
| `dialogue_session_id` | text | ✓ | - |
| `dialogue_rounds` | integer | ✓ | - |
| `dialogue_status` | text | ✓ | - |
| `last_dialogue_at` | timestamp without time zone | ✓ | - |
| `latest_report_id` | uuid | ✓ | - |
| `report_count` | integer | ✓ | - |
| `requires_intervention` | boolean | ✓ | - |
| `task_title` | text | ✓ | - |
| `command_content` | text | ✓ | - |
| `command_priority` | text | ✓ | - |

**实际字段列表**:
```typescript
// 从数据库实际读取的字段
[
  "id",
  "command_id",
  "related_task_id",
  "task_description",
  "executor",
  "task_priority",
  "execution_deadline_start",
  "execution_deadline_end",
  "deliverables",
  "execution_status",
  "status_proof",
  "help_record",
  "audit_opinion",
  "splitter",
  "entry_user",
  "remarks",
  "last_ts_check_time",
  "last_ts_awakening_time",
  "ts_awakening_count",
  "last_inspection_time",
  "last_consult_time",
  "awakening_count",
  "task_id",
  "from_agent_id",
  "to_agent_id",
  "original_command",
  "execution_result",
  "output_data",
  "metrics",
  "attachments",
  "completed_at",
  "scenario_type",
  "task_name",
  "trigger_source",
  "retry_status",
  "metadata",
  "created_at",
  "updated_at",
  "task_type",
  "execution_date",
  "is_confirmed",
  "confirmed_by",
  "confirmed_at",
  "rejection_reason",
  "dependencies",
  "sort_order",
  "completed_sub_tasks",
  "completed_sub_tasks_description",
  "sub_task_count",
  "question_status",
  "last_checked_at",
  "last_inspected_at",
  "dialogue_session_id",
  "dialogue_rounds",
  "dialogue_status",
  "last_dialogue_at",
  "latest_report_id",
  "report_count",
  "requires_intervention",
  "task_title",
  "command_content",
  "command_priority"
]
```

---

## 表: `daily_task_backup_20260218_v3`

| 字段名 | 数据类型 | 可空 | 默认值 |
|--------|----------|------|--------|
| `id` | uuid | ✓ | - |
| `command_id` | text | ✓ | - |
| `related_task_id` | text | ✓ | - |
| `task_description` | text | ✓ | - |
| `executor` | text | ✓ | - |
| `task_priority` | text | ✓ | - |
| `execution_deadline_start` | timestamp without time zone | ✓ | - |
| `execution_deadline_end` | timestamp without time zone | ✓ | - |
| `deliverables` | text | ✓ | - |
| `execution_status` | text | ✓ | - |
| `status_proof` | text | ✓ | - |
| `help_record` | text | ✓ | - |
| `audit_opinion` | text | ✓ | - |
| `splitter` | text | ✓ | - |
| `entry_user` | text | ✓ | - |
| `remarks` | text | ✓ | - |
| `last_ts_check_time` | timestamp without time zone | ✓ | - |
| `last_ts_awakening_time` | timestamp without time zone | ✓ | - |
| `ts_awakening_count` | integer | ✓ | - |
| `last_inspection_time` | timestamp without time zone | ✓ | - |
| `last_consult_time` | timestamp without time zone | ✓ | - |
| `awakening_count` | integer | ✓ | - |
| `task_id` | text | ✓ | - |
| `from_agent_id` | text | ✓ | - |
| `to_agent_id` | text | ✓ | - |
| `original_command` | text | ✓ | - |
| `execution_result` | text | ✓ | - |
| `output_data` | jsonb | ✓ | - |
| `metrics` | jsonb | ✓ | - |
| `attachments` | jsonb | ✓ | - |
| `completed_at` | timestamp without time zone | ✓ | - |
| `scenario_type` | text | ✓ | - |
| `task_name` | text | ✓ | - |
| `trigger_source` | text | ✓ | - |
| `retry_status` | text | ✓ | - |
| `metadata` | jsonb | ✓ | - |
| `created_at` | timestamp without time zone | ✓ | - |
| `updated_at` | timestamp without time zone | ✓ | - |
| `task_type` | text | ✓ | - |
| `execution_date` | date | ✓ | - |
| `is_confirmed` | boolean | ✓ | - |
| `confirmed_by` | text | ✓ | - |
| `confirmed_at` | timestamp without time zone | ✓ | - |
| `rejection_reason` | text | ✓ | - |
| `dependencies` | jsonb | ✓ | - |
| `sort_order` | integer | ✓ | - |
| `completed_sub_tasks` | integer | ✓ | - |
| `completed_sub_tasks_description` | text | ✓ | - |
| `sub_task_count` | integer | ✓ | - |
| `question_status` | text | ✓ | - |
| `last_checked_at` | timestamp without time zone | ✓ | - |
| `last_inspected_at` | timestamp without time zone | ✓ | - |
| `dialogue_session_id` | text | ✓ | - |
| `dialogue_rounds` | integer | ✓ | - |
| `dialogue_status` | text | ✓ | - |
| `last_dialogue_at` | timestamp without time zone | ✓ | - |
| `latest_report_id` | uuid | ✓ | - |
| `report_count` | integer | ✓ | - |
| `requires_intervention` | boolean | ✓ | - |
| `task_title` | text | ✓ | - |
| `command_content` | text | ✓ | - |
| `command_priority` | text | ✓ | - |

**实际字段列表**:
```typescript
// 从数据库实际读取的字段
[
  "id",
  "command_id",
  "related_task_id",
  "task_description",
  "executor",
  "task_priority",
  "execution_deadline_start",
  "execution_deadline_end",
  "deliverables",
  "execution_status",
  "status_proof",
  "help_record",
  "audit_opinion",
  "splitter",
  "entry_user",
  "remarks",
  "last_ts_check_time",
  "last_ts_awakening_time",
  "ts_awakening_count",
  "last_inspection_time",
  "last_consult_time",
  "awakening_count",
  "task_id",
  "from_agent_id",
  "to_agent_id",
  "original_command",
  "execution_result",
  "output_data",
  "metrics",
  "attachments",
  "completed_at",
  "scenario_type",
  "task_name",
  "trigger_source",
  "retry_status",
  "metadata",
  "created_at",
  "updated_at",
  "task_type",
  "execution_date",
  "is_confirmed",
  "confirmed_by",
  "confirmed_at",
  "rejection_reason",
  "dependencies",
  "sort_order",
  "completed_sub_tasks",
  "completed_sub_tasks_description",
  "sub_task_count",
  "question_status",
  "last_checked_at",
  "last_inspected_at",
  "dialogue_session_id",
  "dialogue_rounds",
  "dialogue_status",
  "last_dialogue_at",
  "latest_report_id",
  "report_count",
  "requires_intervention",
  "task_title",
  "command_content",
  "command_priority"
]
```

---

## 表: `messages`

| 字段名 | 数据类型 | 可空 | 默认值 |
|--------|----------|------|--------|
| `id` | uuid | ✗ | `gen_random_uuid()` |
| `conversation_id` | uuid | ✗ | - |
| `role` | text | ✗ | - |
| `content` | text | ✗ | - |
| `metadata` | jsonb | ✓ | `'{}'::jsonb` |
| `tokens` | integer | ✓ | - |
| `model` | text | ✓ | - |
| `created_at` | timestamp without time zone | ✗ | `now()` |

**实际字段列表**:
```typescript
// 从数据库实际读取的字段
[
  "id",
  "conversation_id",
  "role",
  "content",
  "metadata",
  "tokens",
  "model",
  "created_at"
]
```

---

## 表: `split_failures`

| 字段名 | 数据类型 | 可空 | 默认值 |
|--------|----------|------|--------|
| `id` | uuid | ✗ | `gen_random_uuid()` |
| `failure_id` | text | ✗ | - |
| `task_id` | text | ✗ | - |
| `task_name` | text | ✗ | - |
| `core_command` | text | ✗ | - |
| `failure_reason` | text | ✗ | - |
| `retry_count` | integer | ✗ | `0` |
| `agent_b_responses` | jsonb | ✓ | `'[]'::jsonb` |
| `exception_status` | text | ✗ | `'pending'::text` |
| `exception_priority` | text | ✗ | `'normal'::text` |
| `assigned_to` | text | ✓ | - |
| `assigned_at` | timestamp without time zone | ✓ | - |
| `manual_split_result` | jsonb | ✓ | `'{}'::jsonb` |
| `processing_notes` | text | ✓ | - |
| `resolved_by` | text | ✓ | - |
| `resolved_at` | timestamp without time zone | ✓ | - |
| `resolution_method` | text | ✓ | - |
| `resolution_result` | jsonb | ✓ | `'{}'::jsonb` |
| `from_agent_id` | text | ✗ | - |
| `to_agent_id` | text | ✗ | - |
| `conversation_id` | text | ✓ | - |
| `metadata` | jsonb | ✓ | `'{}'::jsonb` |
| `created_at` | timestamp without time zone | ✗ | `now()` |
| `updated_at` | timestamp without time zone | ✗ | `now()` |

---

## ⚠️  重要提醒

### 常见错误字段对照

| ❌ 错误的字段名 | ✅ 正确的字段名 | 所在表 |
|------------------|-----------------|--------|
| `daily_tasks` | `daily_task` | 表名 |
| `notificationId` | `id` 或 `notification_id` | `agent_notifications` |
| `task_id` (在 agent_sub_tasks 中) | 不存在，使用 `command_result_id` | `agent_sub_tasks` |
| `task_name` (在 agent_sub_tasks 中) | `task_title` | `agent_sub_tasks` |
| `execution_status` (在 agent_sub_tasks 中) | `status` | `agent_sub_tasks` |
| `sort_order` (在 agent_sub_tasks 中) | `order_index` | `agent_sub_tasks` |
| `read` (在 agent_notifications 中) | `is_read` | `agent_notifications` |


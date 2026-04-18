# daily_task 表结构核心要素说明

## 📋 概述

`daily_task` 表是系统的核心数据表，用于存储每日可执行的子任务。本文档详细说明表结构的核心要素和使用规范。

---

## 🔑 两个关键标识字段（极易混淆！）

### 1. `id` - 数据库主键（UUID）
- **类型**: `uuid`
- **特点**: 数据库自动生成的随机 UUID
- **格式示例**: `c19b6d37-babb-4ea0-aad5-20941ef72885`
- **用途**:
  - 数据库内部关联（外键引用）
  - 子任务表 `agent_sub_tasks.commandResultId` 的外键
  - 通知表 `metadata.dailyTaskId` 存储的值
- **使用场景**:
  - 查询单个记录（唯一性最高）
  - 关联查询（子任务、通知等）
  - 更新操作（确保操作正确记录）

### 2. `task_id` - 业务标识符（字符串）
- **类型**: `text` (unique)
- **特点**: 人工可读的业务 ID，有明确格式规则
- **格式规则**: `daily-task-{executor}-{date}-{seq}`
- **格式示例**: `daily-task-insurance-d-2026-02-14-001`
- **组成部分**:
  - `daily-task`: 固定前缀，表示是每日任务
  - `{executor}`: 执行者（如 insurance-d, insurance-c）
  - `{date}`: 执行日期（YYYY-MM-DD）
  - `{seq}`: 序号（3位数字，001-999）
- **用途**:
  - 业务逻辑识别（同一任务在不同阶段）
  - 日志记录和调试（可读性强）
  - 唯一性约束（防止重复插入）
- **使用场景**:
  - 业务逻辑判断（如按执行者、日期分组）
  - 去重检测（防止重复插入）
  - 日志和监控（人类可读）

---

## ⚠️ 核心使用规范

### 1. 插入数据时
```typescript
// ✅ 正确：task_id 使用业务格式，id 自动生成
await db.insert(dailyTasks).values({
  taskId: 'daily-task-insurance-d-2026-02-14-001', // 业务 ID
  taskTitle: '第1天：完成保险内容创作',
  executor: 'insurance-d',
  // id 会自动生成 UUID，无需手动指定
});

// ❌ 错误：手动指定 id
await db.insert(dailyTasks).values({
  id: 'some-uuid', // 不要手动指定！
  taskId: 'daily-task-insurance-d-2026-02-14-001',
  // ...
});
```

### 2. 查询数据时
```typescript
// ✅ 正确：已知 UUID 时使用 id（性能最优）
const task = await db.select().from(dailyTasks)
  .where(eq(dailyTasks.id, 'c19b6d37-babb-4ea0-aad5-20941ef72885'))
  .limit(1);

// ✅ 正确：已知业务 ID 时使用 task_id
const task = await db.select().from(dailyTasks)
  .where(eq(dailyTasks.taskId, 'daily-task-insurance-d-2026-02-14-001'))
  .limit(1);

// ✅ 最佳实践：同时支持两种查询（兼容性最好）
let task;
try {
  task = await db.select().from(dailyTasks)
    .where(eq(dailyTasks.id, taskId))
    .limit(1);
  if (task.length === 0) {
    task = await db.select().from(dailyTasks)
      .where(eq(dailyTasks.taskId, taskId))
      .limit(1);
  }
} catch (error) {
  task = await db.select().from(dailyTasks)
    .where(eq(dailyTasks.taskId, taskId))
    .limit(1);
}

// ❌ 错误：混淆使用
const task = await db.select().from(dailyTasks)
  .where(eq(dailyTasks.id, 'daily-task-insurance-d-2026-02-14-001')) // 类型不匹配！
  .limit(1);
```

### 3. 关联查询时（外键）
```typescript
// ✅ 正确：agent_sub_tasks 关联 daily_tasks 使用 id（UUID）
await db.insert(agentSubTasks).values({
  commandResultId: 'c19b6d37-babb-4ea0-aad5-20941ef72885', // UUID
  // ...
});

// ❌ 错误：使用 task_id 作为外键
await db.insert(agentSubTasks).values({
  commandResultId: 'daily-task-insurance-d-2026-02-14-001', // 错误！
  // ...
});
```

### 4. 更新数据时
```typescript
// ✅ 正确：使用 UUID 精确更新
await db.update(dailyTasks)
  .set({ executionStatus: 'in_progress' })
  .where(eq(dailyTasks.id, 'c19b6d37-babb-4ea0-aad5-20941ef72885'));

// ✅ 正确：使用 task_id 更新（但可能影响多条记录？不，task_id 是 unique）
await db.update(dailyTasks)
  .set({ executionStatus: 'in_progress' })
  .where(eq(dailyTasks.taskId, 'daily-task-insurance-d-2026-02-14-001'));

// ⚠️ 注意：两者效果相同（因为 task_id 是 unique），但 id 查询性能更好
```

---

## 🔄 数据流转示例

### 场景：Agent B 拆解任务 → Agent A 确认 → 创建子任务

```typescript
// 步骤 1: Agent B 拆解任务，保存到 daily_tasks
const insertResult = await db.insert(dailyTasks).values({
  taskId: 'daily-task-insurance-d-2026-02-14-001', // 业务 ID
  taskTitle: '第1天：完成保险内容创作',
  executor: 'insurance-d',
  // id 自动生成: c19b6d37-babb-4ea0-aad5-20941ef72885
});

// 步骤 2: 创建通知，传递 UUID
await createNotification({
  type: 'insurance_d_split_result',
  metadata: {
    dailyTaskId: 'c19b6d37-babb-4ea0-aad5-20941ef72885', // ✅ 传递 UUID
    splitResult: { /* ... */ }
  }
});

// 步骤 3: Agent A 确认拆解，前端传递 UUID
await fetch('/api/insurance-d/confirm-split', {
  method: 'POST',
  body: JSON.stringify({
    notificationId: 'xxx',
    taskId: 'c19b6d37-babb-4ea0-aad5-20941ef72885', // ✅ 从通知中获取 UUID
    splitResult: { /* ... */ }
  })
});

// 步骤 4: 后端查询 daily_task（使用 UUID）
const task = await db.select().from(dailyTasks)
  .where(eq(dailyTasks.id, 'c19b6d37-babb-4ea0-aad5-20941ef72885'))
  .limit(1);

// 步骤 5: 创建子任务，关联 UUID
await db.insert(agentSubTasks).values({
  commandResultId: task.id, // ✅ 使用 UUID
  // ...
});
```

---

## 📊 字段分类速查

### 核心标识字段
| 字段名 | 类型 | 说明 | 示例值 |
|--------|------|------|--------|
| `id` | uuid | 数据库主键（UUID） | `c19b6d37-babb-4ea0-aad5-20941ef72885` |
| `task_id` | text (unique) | 业务标识符 | `daily-task-insurance-d-2026-02-14-001` |
| `related_task_id` | text | 关联总任务 ID | `task-A-to-B-1771007838542-xxg` |

### 任务内容字段
| 字段名 | 类型 | 说明 | 示例值 |
|--------|------|------|--------|
| `task_title` | text | 任务标题 | `第1天：完成保险内容创作` |
| `task_description` | text | 任务描述 | `撰写符合要求的科普内容...` |
| `executor` | text | 执行者 | `insurance-d` |
| `execution_date` | date | 执行日期 | `2026-02-14` |
| `deliverables` | text | 交付物描述 | `1. 内容终稿 2. 发布截图` |

### 状态字段
| 字段名 | 类型 | 说明 | 取值范围 |
|--------|------|------|----------|
| `execution_status` | text | 执行状态 | `new` \| `pending_review` \| `in_progress` \| `completed` |
| `task_priority` | text | 任务优先级 | `high` \| `normal` \| `low` |
| `is_confirmed` | boolean | 是否已确认 | `true` \| `false` |

### 子任务管理字段
| 字段名 | 类型 | 说明 | 示例值 |
|--------|------|------|--------|
| `sub_task_count` | integer | 拆分的子任务总数 | `5` |
| `completed_sub_tasks` | integer | 已完成子任务数 | `2` |
| `completed_sub_tasks_description` | text | 当前子任务描述 | `已完成选题和初稿` |

---

## 🐛 常见错误排查

### 错误 1: 查询失败 "Failed query: where daily_task.id = $1 params: daily-task-insurance-d-2026-02-14-006"
**原因**: 使用字符串 task_id 查询 UUID 字段 id
**解决**: 使用 `task_id` 字段查询，或传递正确的 UUID
```typescript
// ❌ 错误
.where(eq(dailyTasks.id, 'daily-task-insurance-d-2026-02-14-006'))

// ✅ 正确
.where(eq(dailyTasks.taskId, 'daily-task-insurance-d-2026-02-14-006'))
// 或
.where(eq(dailyTasks.id, 'c19b6d37-babb-4ea0-aad5-20941ef72885'))
```

### 错误 2: 外键约束失败 "foreign key violation"
**原因**: 使用 task_id 而非 UUID 作为外键
**解决**: 确保使用 daily_task.id（UUID）作为外键
```typescript
// ❌ 错误
await db.insert(agentSubTasks).values({
  commandResultId: 'daily-task-insurance-d-2026-02-14-001'
});

// ✅ 正确
await db.insert(agentSubTasks).values({
  commandResultId: 'c19b6d37-babb-4ea0-aad5-20941ef72885'
});
```

### 错误 3: 插入失败 "unique constraint violation"
**原因**: 重复插入相同 task_id
**解决**: 插入前检查 task_id 是否已存在
```typescript
const existing = await db.select().from(dailyTasks)
  .where(eq(dailyTasks.taskId, 'daily-task-insurance-d-2026-02-14-001'))
  .limit(1);

if (existing.length > 0) {
  console.log('⚠️ 任务已存在，跳过插入');
  return;
}
```

---

## 📌 最佳实践总结

1. **永远不要手动指定 `id`**：让数据库自动生成 UUID
2. **使用 `task_id` 作为业务标识**：格式统一，易于理解
3. **关联查询优先使用 `id`**：性能最优，类型安全
4. **去重检测使用 `task_id`**：唯一约束，语义明确
5. **日志记录使用 `task_id`**：人类可读，便于调试
6. **API 响应同时返回两者**：`{ id, taskId }`，兼容性最好

---

## 🔗 相关文档

- [数据库 Schema 定义](../../src/lib/db/schema.ts)
- [Agent B 任务拆解流程](./agent-b-task-splitting.md)
- [通知系统使用指南](./notification-system-guide.md)

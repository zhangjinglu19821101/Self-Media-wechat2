# ⚠️  数据库开发必读指南

## 🔥 最重要的规则

**在写任何数据库代码之前，先看这个文件！**

---

## 🚫 不要再犯的错误

### 1. 表名错误
| ❌ 错误 | ✅ 正确 |
|---------|---------|
| `daily_tasks` | `daily_task` |

### 2. agent_notifications 表字段错误
| ❌ 错误 | ✅ 正确 |
|---------|---------|
| `notificationId` | `id` (主键) **或** `notification_id` |
| `read` | `is_read` |
| `updated_at` | ❌ 这个字段不存在！|

### 3. agent_sub_tasks 表字段错误
| ❌ 错误 | ✅ 正确 |
|---------|---------|
| `task_id` | ❌ 不存在，用 `command_result_id` |
| `task_name` | `task_title` |
| `execution_status` | `status` |
| `sort_order` | `order_index` |

---

## ✅ 正确的使用方式

### 使用正确的 Schema 文件

```typescript
// ✅ 导入正确的 schema
import { dailyTask, agentNotifications, agentSubTasks } from '@/lib/db/schema/correct-schema';

// ❌ 不要用旧的 schema 文件！
// import { dailyTasks } from '@/lib/db/schema'; // 错误！
```

### 查询示例

```typescript
// ✅ 正确的 daily_task 查询
const tasks = await db
  .select()
  .from(dailyTask)  // 注意是 dailyTask，不是 dailyTasks
  .where(eq(dailyTask.id, taskId));

// ✅ 正确的通知查询
const notifications = await db
  .select()
  .from(agentNotifications)
  .where(eq(agentNotifications.id, notificationId)); // 用 id 或 notification_id

// ✅ 正确的子任务插入
await db.insert(agentSubTasks).values({
  id: crypto.randomUUID(),
  commandResultId: taskId,  // ✅ 正确
  taskTitle: '子任务标题',   // ✅ 正确，不是 task_name
  status: 'pending',         // ✅ 正确，不是 execution_status
  orderIndex: 1,             // ✅ 正确，不是 sort_order
  // ...
});
```

---

## 📚 参考文档

1. **[DATABASE_SCHEMA_REFERENCE.md](./DATABASE_SCHEMA_REFERENCE.md)** - 完整的数据库结构文档
2. **[database-schema.json](./database-schema.json)** - JSON 格式的 schema
3. **[src/lib/db/schema/correct-schema.ts](./src/lib/db/schema/correct-schema.ts)** - 正确的 Drizzle schema 定义

---

## 🧪 快速检查

在写数据库代码前，问自己三个问题：

1. 📋 表名对吗？（`daily_task` 不是 `daily_tasks`）
2. 🔑 字段名对吗？（对照上面的错误表）
3. 📖 查参考文档了吗？（看 `DATABASE_SCHEMA_REFERENCE.md`）

如果有任何疑问，先查文档再写代码！

---

## 💡 记住

> **写数据库代码慢一点，查文档仔细一点，Bug 就会少一点。**

---
*最后更新：2026-02-24*

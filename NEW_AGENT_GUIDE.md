# 新 Agent 开发指南 - 重要教训记录

## 🚨 绝对禁止：跳过业务逻辑来隐藏错误

### 典型错误案例

#### ❌ 错误做法：跳过业务逻辑

**问题场景**：
- 遇到 UUID 格式错误：`notificationId = "notification-xxx"` 不是标准 UUID
- 数据库表 `agent_notifications` 有两个字段：
  - `id` (uuid 类型)
  - `notification_id` (text 类型) - 这才是应该用的！

**错误的代码**：
```typescript
// ❌ 错误：直接跳过业务逻辑
let notifications: any[] = [];
console.log(`⚠️ 跳过通知查询，避免 UUID 格式问题`);

// ... 后续也跳过标记通知已读 ...
```

**后果**：
- ✅ 确实避免了 UUID 错误
- ❌ **但丢失了重要的业务功能**：
  - 无法查询通知记录
  - 无法标记通知为已读
  - 业务流程不完整

---

#### ✅ 正确做法：先查数据库 schema，再修复问题

**第一步：查询数据库表结构**
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'agent_notifications' 
ORDER BY ordinal_position;
```

**查询结果**：
| column_name | data_type |
|-------------|-----------|
| id | uuid |
| notification_id | text |  ← 找到了！用这个！
| ... | ... |

**第二步：使用正确的字段修复代码**
```typescript
// ✅ 正确：使用 notification_id (text 类型)
let notifications = await sql`
  SELECT * FROM agent_notifications
  WHERE notification_id = ${notificationId}  -- 用这个！
  LIMIT 1;
`;

// ✅ 正确：更新时也用 notification_id
await sql`
  UPDATE agent_notifications
  SET is_read = ${'true'}, read_at = NOW(), updated_at = NOW()
  WHERE notification_id = ${notificationId}  -- 用这个！
`;
```

---

## 📋 问题解决检查清单

当遇到数据库相关错误时，**按以下顺序操作**：

| 步骤 | 操作 | 说明 |
|------|------|------|
| 1 | **查询数据库 schema** | 先看表结构，确认字段名和类型 |
| 2 | **分析错误原因** | 理解为什么报错，不要猜 |
| 3 | **使用正确字段** | 找到对应的字段，调整代码 |
| 4 | **保留业务逻辑** | 绝对不能跳过任何业务功能 |
| 5 | **测试验证** | 确保业务流程完整 |

---

## 🎯 核心原则

### 1. **业务逻辑完整性 > 避免错误**
- 宁可报错，也不能跳过业务流程
- 报错可以修复，但跳过业务逻辑会导致数据不一致

### 2. **先调查，再动手**
- 遇到数据库错误，先 `SELECT` 看表结构
- 不要凭猜测写代码

### 3. **字段名很重要**
- 注意 `id` vs `xxx_id` 的区别
- 注意 snake_case (`notification_id`) vs camelCase (`notificationId`)

---

## 📚 相关参考文档

- [Database Schema Guide](./DATABASE_SCHEMA.md)
- [Database Field Comparison](./DB_FIELD_COMPARISON.md)
- [Agent Sub-tasks Execution Flow](./docs/agent-sub-tasks-execution-flow.md)

---

## 📝 记录日期

- **首次记录**: 2026-02-25
- **问题类型**: UUID 格式错误处理
- **影响范围**: insurance-d 拆解确认流程
- **教训等级**: 🔴 严重 (绝对禁止)


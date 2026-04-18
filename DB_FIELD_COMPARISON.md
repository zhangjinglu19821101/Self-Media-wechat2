# 📊 数据库字段对照与调试指南

## 🔍 问题现象

```
invalid input syntax for type uuid: "daily-task-insurance-d-2026-02-24-001"
```

## 📋 字段对照说明

### 1. daily_task 表

| 字段 | 类型 | 说明 | 示例值 |
|------|------|------|--------|
| `id` | UUID | **主键**，真正的 UUID | `6097a118-0b4d-47e4-899b-17f73ce9d875` |
| `task_id` | TEXT | 业务 ID，人类可读 | `daily-task-insurance-d-2026-02-25-004` |

### 2. agent_notifications 表（insurance-d 通知）

| 字段/位置 | 类型 | 说明 | 示例值 |
|-----------|------|------|--------|
| `notification.taskId` | TEXT | 业务 ID（不能用于数据库查询！） | `daily-task-insurance-d-2026-02-25-004` |
| `notification.metadata.taskId` | TEXT | 业务 ID（不能用于数据库查询！） | `daily-task-insurance-d-2026-02-25-004` |
| `notification.metadata.dailyTaskIds` | Array | **真正的 UUID 数组**（用于数据库查询！） | `["6097a118-0b4d-47e4-899b-17f73ce9d875"]` |

## 🎯 正确的取值逻辑

### 前端取值逻辑

```typescript
let taskIdToUse = '';

if (displayExecutor === 'insurance-d') {
  // 🔥 insurance-d 特殊逻辑
  try {
    const meta = typeof notification.metadata === 'string' 
      ? JSON.parse(notification.metadata) 
      : notification.metadata;
    
    // ✅ 正确：从 metadata.dailyTaskIds[0] 获取 UUID
    if (meta?.dailyTaskIds && Array.isArray(meta.dailyTaskIds) && meta.dailyTaskIds.length > 0) {
      taskIdToUse = meta.dailyTaskIds[0];
      console.log(`✅ 从 metadata.dailyTaskIds 获取 UUID: ${taskIdToUse}`);
    } else {
      // ⚠️ 兜底：使用业务 ID（会失败！）
      console.warn(`⚠️ dailyTaskIds 不存在，使用 fallback`);
      taskIdToUse = notification.taskId || '';
    }
  } catch (e) {
    console.error(`❌ 解析 metadata 失败:`, e);
    taskIdToUse = notification.taskId || '';
  }
} else {
  // Agent B 逻辑：使用 notification.taskId
  taskIdToUse = notification.taskId || '';
}
```

### 后端查询逻辑

```typescript
// 查询时同时支持 UUID 和业务 ID
let tasks = await sql`
  SELECT * FROM daily_task
  WHERE id = ${taskId} OR task_id = ${taskId}
  LIMIT 1;
`;
```

## 🐛 调试日志

### 前端日志（点击确认时）

```
🔴🔴🔴 [insurance-d 拆解] ===== 即将发送的完整参数 =====
🔴🔴🔴 [insurance-d 拆解] 1. notificationId: notification-xxx
🔴🔴🔴 [insurance-d 拆解] 2. taskId: 6097a118-0b4d-47e4-899b-17f73ce9d875
🔴🔴🔴 [insurance-d 拆解] 3. taskId 类型: string
🔴🔴🔴 [insurance-d 拆解] 4. taskId 长度: 36
🔴🔴🔴 [insurance-d 拆解] 5. splitResult 完整结构: {...}
🔴🔴🔴 [insurance-d 拆解] ===== 参数打印完毕 =====
```

### 后端日志（接收到请求时）

```
🔴🔴🔴 [修复版] ===== 接收到的完整参数 =====
🔴🔴🔴 [修复版] 1. notificationId: notification-xxx
🔴🔴🔴 [修复版] 2. notificationId 类型: string
🔴🔴🔴 [修复版] 3. taskId: 6097a118-0b4d-47e4-899b-17f73ce9d875
🔴🔴🔴 [修复版] 4. taskId 类型: string
🔴🔴🔴 [修复版] 5. taskId 长度: 36
🔴🔴🔴 [修复版] 6. splitResult 完整结构: {...}
🔴🔴🔴 [修复版] ===== 参数接收完毕 =====
```

### 后端日志（查询数据库后）

```
🔴🔴🔴 [修复版] ===== daily_task 实际字段对比 =====
🔴🔴🔴 [修复版] daily_task 所有字段: ["id", "task_id", "execution_status", ...]
🔴🔴🔴 [修复版] daily_task.id (UUID): 6097a118-0b4d-47e4-899b-17f73ce9d875
🔴🔴🔴 [修复版] daily_task.task_id (业务ID): daily-task-insurance-d-2026-02-25-004
🔴🔴🔴 [修复版] ===== 字段对比完毕 =====
```

## ✅ 验证清单

- [ ] 前端日志显示 `taskId` 是 36 位 UUID（不是业务 ID）
- [ ] 后端日志显示接收到的 `taskId` 是 UUID
- [ ] 后端日志显示 `daily_task.id` 与传入的 `taskId` 匹配
- [ ] 没有 UUID 格式错误

## 📌 关键点

1. **notification.taskId** = 业务 ID ❌（不能用于查询）
2. **notification.metadata.dailyTaskIds[0]** = 真正的 UUID ✅（用于查询）
3. 前端必须判断 `displayExecutor === 'insurance-d'` 来走特殊逻辑
4. 后端查询同时支持 `id` 和 `task_id` 字段

---
*最后更新：2026-02-24*

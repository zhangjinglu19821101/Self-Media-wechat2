# 通知系统设计文档

## 📋 概述

本文档记录了通知系统的设计规范，确保未来开发时不会忘记当前的设计。

---

## 🎯 核心设计原则

### 1. 统一数据结构

**所有通知类型必须使用相同的顶层字段结构：**

```typescript
{
  // 基础字段
  type: NotificationType;
  notificationId: string;
  timestamp: Date;
  isRead: boolean;
  
  // 身份字段（🔥 必须从数据库顶层字段获取）
  fromAgentId: AgentId;  // ❌ 禁止从 content.fromAgentId 获取
  toAgentId: AgentId;    // ❌ 禁止从 content.toAgentId 获取
  
  // 关联字段
  taskId?: string;
  relatedTaskId?: string;
  
  // 内容字段
  content: NotificationContent;
  
  // 元数据
  metadata: Record<string, any>;
  
  // 类型特定字段（可选）
  result?: any;
  status?: string;
  command?: string;
  message?: string;
}
```

### 2. 统一通知类型

**所有拆解结果通知统一使用 `type: 'task_result'`，通过标记区分：**

| Agent | type | 标记字段 |
|-------|------|---------|
| insurance-d | `'task_result'` | `isInsuranceDSplit: true` |
| Agent B | `'task_result'` | `isAgentBSplit: true` |
| Insurance-C | `'task_result'` | `isInsuranceCSplit: true` |

**❌ 禁止使用：**
- `type: 'insurance_d_split_result'`
- `type: 'agent_b_split_result'`
- `type: 'insurance_c_split_result'`

---

## 🚀 创建通知的标准流程

### 示例 1：创建 insurance-d 拆解结果通知

```typescript
// ✅ 正确写法
await fetch('/api/agents/A/notifications', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'task_result',           // 🔥 统一用 'task_result'
    fromAgentId: 'insurance-d',
    toAgentId: 'A',
    taskId: taskId,
    result: splitResult,
    status: 'completed',
    isInsuranceDSplit: true,        // 🔥 通过标记区分
  }),
});
```

### 示例 2：创建 Agent B 拆解结果通知

```typescript
// ✅ 正确写法
await fetch('/api/agents/A/notifications', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'task_result',           // 🔥 统一用 'task_result'
    fromAgentId: 'B',
    toAgentId: 'A',
    taskId: taskId,
    result: splitResult,
    status: 'completed',
    isAgentBSplit: true,            // 🔥 通过标记区分
  }),
});
```

### 示例 3：创建 Insurance-C 拆解结果通知（未来）

```typescript
// ✅ 正确写法
await fetch('/api/agents/A/notifications', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'task_result',           // 🔥 统一用 'task_result'
    fromAgentId: 'insurance-c',
    toAgentId: 'A',
    taskId: taskId,
    result: splitResult,
    status: 'completed',
    isInsuranceCSplit: true,        // 🔥 通过标记区分
  }),
});
```

---

## ❌ 常见错误（避免重蹈覆辙）

### 错误 1：从 content 获取 fromAgentId/toAgentId

```typescript
// ❌ 错误写法
const displayExecutor = notification.content.fromAgentId === 'insurance-d' 
  ? 'insurance-d' 
  : 'Agent B';

// ✅ 正确写法
const displayExecutor = notification.fromAgentId === 'insurance-d' 
  ? 'insurance-d' 
  : 'Agent B';
```

### 错误 2：使用不统一的通知类型

```typescript
// ❌ 错误写法
await fetch('/api/agents/A/notifications', {
  method: 'POST',
  body: JSON.stringify({
    type: 'insurance_d_split_result',  // ❌ 不要用这个
    ...
  }),
});

// ✅ 正确写法
await fetch('/api/agents/A/notifications', {
  method: 'POST',
  body: JSON.stringify({
    type: 'task_result',           // ✅ 统一用这个
    isInsuranceDSplit: true,        // ✅ 通过标记区分
    ...
  }),
});
```

### 错误 3：忘记添加类型标记

```typescript
// ❌ 错误写法
await fetch('/api/agents/A/notifications', {
  method: 'POST',
  body: JSON.stringify({
    type: 'task_result',
    fromAgentId: 'insurance-d',
    ...
    // ❌ 忘记添加 isInsuranceDSplit: true
  }),
});

// ✅ 正确写法
await fetch('/api/agents/A/notifications', {
  method: 'POST',
  body: JSON.stringify({
    type: 'task_result',
    fromAgentId: 'insurance-d',
    isInsuranceDSplit: true,  // ✅ 必须添加
    ...
  }),
});
```

---

## 📁 相关文件

### 类型定义
- `src/types/notification.ts` - 统一的通知类型定义

### API 接口
- `src/app/api/agents/[id]/notifications/route.ts` - 通知接口（使用模块化处理器）

### 数据库 Schema
- `src/lib/db/schema.ts` - 数据库表结构

---

## 🎯 开发检查清单

创建新通知前，请检查：

- [ ] 是否使用 `type: 'task_result'`？
- [ ] 是否添加了对应的标记字段（`isInsuranceDSplit`、`isAgentBSplit` 等）？
- [ ] `fromAgentId`、`toAgentId` 是否从数据库顶层字段获取？
- [ ] 有没有阅读本文档？
- [ ] 有没有查看 `src/types/notification.ts` 的类型定义？

---

## 📞 遇到问题？

如果忘记了设计规范，请：

1. 先阅读本文档
2. 查看 `src/types/notification.ts` 的类型定义
3. 查看 `src/app/api/agents/[id]/notifications/route.ts` 的实现
4. 查看数据库中已有的通知数据作为参考

---

## 📅 历史记录

- **2025-02-21**: 初始版本，统一数据结构，使用模块化处理器

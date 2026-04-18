# 通知开发检查清单

## 📋 创建新通知前的检查清单

在创建新通知代码前，请逐项检查：

### 基础检查
- [ ] 我已经阅读了 `docs/notification-system-design.md` 文档
- [ ] 我已经查看了 `src/types/notification.ts` 的类型定义
- [ ] 我已经查看了数据库中已有的通知数据作为参考

### 数据结构检查
- [ ] 我使用了统一的顶层字段结构
- [ ] `fromAgentId` 从数据库顶层字段获取（不是从 content）
- [ ] `toAgentId` 从数据库顶层字段获取（不是从 content）
- [ ] 所有必需的字段都包含了

### 通知类型检查
- [ ] 拆解结果统一使用 `type: 'task_result'`
- [ ] 添加了对应的标记字段（`isInsuranceDSplit`、`isAgentBSplit` 等）
- [ ] **没有**使用 `type: 'insurance_d_split_result'` 等单独类型
- [ ] **没有**使用 `type: 'agent_b_split_result'` 等单独类型

### 代码质量检查
- [ ] 添加了必要的注释
- [ ] 使用了 TypeScript 类型
- [ ] 代码逻辑清晰，易于理解

---

## 📝 代码模板

### 模板 1：创建 insurance-d 拆解结果通知

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

### 模板 2：创建 Agent B 拆解结果通知

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

### 模板 3：创建 Insurance-C 拆解结果通知（未来）

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

## ❌ 错误示例（避免重蹈覆辙）

### 错误 1：从 content 获取 fromAgentId

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

---

## 📞 遇到问题？

如果忘记了设计规范，请按以下顺序查找：

1. 🔍 先看这个检查清单
2. 📖 阅读 `docs/notification-system-design.md` 文档
3. 📝 查看 `src/types/notification.ts` 的类型定义
4. 💻 查看 `src/app/api/agents/[id]/notifications/route.ts` 的实现
5. 📊 查看数据库中已有的通知数据作为参考

---

## ⚠️ 最后的警告

**在创建新通知代码前，请确保你已完成以上检查清单的所有项目！**

**不要重蹈 insurance-d 的覆辙！**

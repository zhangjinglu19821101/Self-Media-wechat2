# Agent A 通过通知确认拆解方案（优化版）

## 🎯 核心设计理念

**不需要新增 agentTodos 表，直接使用 agentNotifications 通知表。**

Agent A 在对话框中查询未读通知，即可看到待确认的拆解方案。

---

## 📋 为什么不需要 agentTodos 表？

### 1. 避免数据冗余
- agentNotifications 已经有所有必要字段
- 不需要重复存储待办事项

### 2. 更符合 AI 交互方式
- Agent A 在对话框中就能看到通知
- 不需要单独的待办列表页面

### 3. 简化系统复杂度
- 少一张表，少维护成本
- 通知本身就是待办提醒

---

## 🔌 完整流程

### 1. Agent B 提交拆解结果

```bash
POST /api/tasks/{taskId}/split
{
  "commands": [...]
}
```

**系统自动执行**：
1. 更新任务状态为"拆分完成"
2. 创建通知给 Agent A：
   ```json
   {
     "notificationId": "notify-split-task-xxx",
     "fromAgentId": "agent B",
     "toAgentId": "agent A",
     "notificationType": "system",
     "title": "任务拆解完成，请确认",
     "content": "任务「保险合规文案创作及校验」已拆解为 3 条指令，请确认是否入库。",
     "relatedTaskId": "task-xxx",
     "status": "unread",
     "priority": "high",
     "metadata": {
       "splitDraft": [...],
       "actionUrl": "/tasks/task-xxx/confirm"
     }
   }
   ```

---

### 2. Agent A 在对话框中查看

**Agent A 对话**：
```
Agent A: 今天有什么需要处理的？

系统: 您有以下未读通知：
  1. 【高优先级】任务拆解完成，请确认
     任务：保险合规文案创作及校验
     已拆解为 3 条指令
     详情：/tasks/task-xxx/confirm
     点击：http://localhost:5000/tasks/task-xxx/confirm
```

**后端实现**：
```typescript
// Agent A 查询未读通知
const unreadNotifications = await db
  .select()
  .from(agentNotifications)
  .where(
    and(
      eq(agentNotifications.toAgentId, 'agent A'),
      isNull(agentNotifications.readAt)
    )
  );

// 格式化通知内容，在对话框中展示
const formattedNotifications = unreadNotifications.map(notif => {
  return {
    priority: notif.priority,
    title: notif.title,
    content: notif.content,
    actionUrl: notif.metadata?.actionUrl
  };
});

// 返回给 Agent A
return formattedNotifications;
```

---

### 3. Agent A 查看拆解详情

```bash
GET /api/tasks/{taskId}/split
```

**返回**：
```json
{
  "success": true,
  "data": {
    "taskId": "task-xxx",
    "splitDraft": [...],
    "taskStatus": "split_completed"
  }
}
```

---

### 4. Agent A 确认拆解方案

```bash
POST /api/tasks/{taskId}/confirm
{
  "approved": true,
  "comments": "拆解方案合理，确认入库"
}
```

**系统自动执行**：
1. 批量创建指令（入库 `commandResults` 表）
2. 更新任务状态为"拆分完成"
3. 通知执行主体
4. 将通知标记为已读

---

### 5. Agent A 拒绝拆解方案

```bash
POST /api/tasks/{taskId}/confirm
{
  "approved": false,
  "comments": "拆解指令数量过少，建议增加"
}
```

**系统自动执行**：
1. 更新任务状态为"拆分中"
2. 通知 Agent B 重新拆解
3. 通知保持未读状态（等待新的拆解方案）

---

## 📊 通知类型

| notificationType | 说明 | metadata.actionUrl |
|---|---|---|
| `system` | 系统通知（拆解确认、指令审核等） | `/tasks/:id/confirm` 或 `/commands/:id/review` |
| `command` | 指令通知 | - |
| `result` | 结果通知 | - |
| `feedback` | 反馈通知 | - |

---

## 🎯 Agent A 在对话框中的体验

### 场景 1：Agent A 主动查询

```
Agent A: 今天有什么需要处理的？

系统: 您有以下未读通知（共 3 条）：

  【高优先级】
  1. 任务拆解完成，请确认
     任务：保险合规文案创作及校验
     已拆解为 3 条指令，请确认是否入库。
     操作：查看详情 /tasks/task-001/confirm

  【普通优先级】
  2. 指令执行完成
     任务：保险合规文案创作及校验
     指令：收集用户需求，整理需求文档
     状态：执行完成，等待审核
     操作：查看详情 /commands/cmd-001/review

  3. 系统通知
     内容：TS 定时任务已启动
     时间：2026-02-22 10:00:00
```

### 场景 2：Agent A 直接确认

```
Agent A: 确认任务 task-001 的拆解方案，批准入库

系统: 已确认任务「保险合规文案创作及校验」的拆解方案
  - 已创建 3 条指令
  - 已通知执行主体 agent insurance-d
  - 通知已标记为已读
```

---

## 🔔 通知状态流转

```
unread（未读）
  ↓
  ├─ read（已读）→ 确认或拒绝后自动标记
  └─ processed（已处理）→ 可选，表示已完全处理
```

---

## ✅ 总结

**优化后的设计**：
- ❌ 不需要 agentTodos 表
- ✅ 直接使用 agentNotifications 通知表
- ✅ Agent A 在对话框中查看未读通知
- ✅ 通知本身就是待办提醒
- ✅ 简化系统复杂度，避免数据冗余

**优势**：
- 更符合 AI Agent 的交互方式
- 减少数据冗余
- 简化系统复杂度
- 更易于维护

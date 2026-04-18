# Agent B 如何知道要拆解任务？

## 📋 问题
Agent B 如何知道有新任务需要拆解？

## ✅ 解决方案：三种方式

### 方式 1：Agent B 定期主动查询（推荐）

**实现服务**：`src/lib/services/agent-b-task-monitor.ts`

```typescript
import { AgentBTaskMonitor } from '@/lib/services/agent-b-task-monitor';

// 启动 Agent B 任务监控（每 5 分钟检查一次）
AgentBTaskMonitor.start(5 * 60 * 1000);
```

**工作流程**：
1. Agent B 每 5 分钟查询 `taskStatus = "未拆分"` 的任务
2. 找到待拆解任务后，自动更新状态为"拆分中"
3. 调用 LLM 进行智能拆解
4. 提交拆解结果（草稿）
5. 通知 Agent A 确认

**优势**：
- ✅ 不依赖外部通知系统
- ✅ Agent B 主动可控
- ✅ 易于调试和监控

---

### 方式 2：通知中心查询

Agent B 定期查询自己的通知：

```typescript
// 查询 Agent B 的未读通知
const notifications = await db
  .select()
  .from(agentNotifications)
  .where(
    and(
      eq(agentNotifications.toAgentId, 'agent B'),
      isNull(agentNotifications.readAt)
    )
  );

// 遍历通知，处理待拆解任务
for (const notification of notifications) {
  if (notification.relatedTaskId) {
    // 开始拆解任务
    await startSplitting(notification.relatedTaskId);
  }
}
```

---

### 方式 3：WebSocket 实时推送（待实现）

**实现思路**：
1. 创建 WebSocket 服务
2. Agent B 监听 WebSocket 消息
3. 有新通知时，通过 WebSocket 实时推送

```typescript
// Agent B 监听 WebSocket
const ws = new WebSocket('ws://localhost:5000/ws/agent-b');

ws.onmessage = (event) => {
  const notification = JSON.parse(event.data);
  if (notification.type === 'task_created') {
    // 开始拆解任务
    startSplitting(notification.taskId);
  }
};
```

---

## 🔌 完整 API 流程

### 1. 人创建任务
```bash
POST /api/tasks
{
  "taskName": "保险合规文案创作及校验",
  "coreCommand": "在6个工作日内完成保险合规文案创作及校验",
  "executor": "agent insurance-d",
  "taskDurationStart": "2026-02-22T09:00:00Z",
  "taskDurationEnd": "2026-03-01T18:00:00Z",
  "totalDeliverables": "合规文案1份、校验报告1份",
  "taskPriority": "urgent"
}
```

**返回**：
```json
{
  "success": true,
  "data": {
    "taskId": "task-user-to-agent-insurance-d-20260222-001",
    "taskStatus": "unsplit"
  },
  "message": "任务已创建，等待 Agent B 拆解"
}
```

---

### 2. Agent B 主动查询待拆解任务
```bash
GET /api/tasks?status=unsplit
```

**返回**：
```json
{
  "success": true,
  "data": [
    {
      "taskId": "task-user-to-agent-insurance-d-20260222-001",
      "taskName": "保险合规文案创作及校验",
      "taskStatus": "unsplit"
    }
  ]
}
```

---

### 3. Agent B 开始拆解
```bash
POST /api/tasks/{taskId}/split
{
  "commands": [
    {
      "commandContent": "收集用户需求，整理需求文档",
      "executor": "agent insurance-d",
      "commandPriority": "urgent",
      "executionDeadlineStart": "2026-02-22T10:00:00Z",
      "executionDeadlineEnd": "2026-02-23T18:00:00Z",
      "deliverables": "需求文档1份"
    }
  ]
}
```

**返回**：
```json
{
  "success": true,
  "data": {
    "task": {
      "taskId": "task-user-to-agent-insurance-d-20260222-001",
      "taskStatus": "split_completed"
    },
    "splitCommands": [...]
  },
  "message": "拆解结果已提交，等待 Agent A 确认"
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

**返回**：
```json
{
  "success": true,
  "data": {
    "task": {...},
    "commands": [...]
  },
  "message": "拆解方案已确认，指令已入库"
}
```

---

## 🚀 启动 Agent B 任务监控

### 在 Next.js 应用启动时自动启动

```typescript
// src/app/api/start-schedulers/route.ts
import { AgentBTaskMonitor } from '@/lib/services/agent-b-task-monitor';
import { TSScheduler } from '@/lib/services/ts-scheduler';
import { AgentBInspector } from '@/lib/services/agent-b-inspector';

// 启动 Agent B 任务监控（每 5 分钟检查一次）
AgentBTaskMonitor.start(5 * 60 * 1000);

// 启动 TS 定时任务（每 10 分钟检查一次）
TSScheduler.start();

// 启动 Agent B 巡检（每日 13:00）
AgentBInspector.start();

export async function GET() {
  return Response.json({ 
    message: '所有定时任务已启动',
    tasks: [
      'Agent B 任务监控（每 5 分钟）',
      'TS 定时任务（每 10 分钟）',
      'Agent B 巡检（每日 13:00）'
    ]
  });
}
```

---

## 📊 完整通知流程图

```
人创建任务
  ↓
入库 agentTasks（taskStatus = "未拆分"）
  ↓
写入 agentNotifications（通知 Agent B）
  ↓
【方式 1：Agent B 定期主动查询】
Agent B 每 5 分钟查询 taskStatus = "未拆分" 的任务
  ↓
找到待拆解任务
  ↓
更新任务状态为"拆分中"
  ↓
调用 LLM 进行智能拆解
  ↓
提交拆解结果（POST /api/tasks/:id/split）
  ↓
任务状态更新为"拆分完成"
  ↓
通知 Agent A 确认
  ↓
Agent A 确认（POST /api/tasks/:id/confirm）
  ↓
入库 commandResults（执行状态 = "新建"）
  ↓
推送至执行主体
```

---

## ✅ 总结

**Agent B 通过以下方式知道要拆解任务**：

1. **定期主动查询**（推荐）：Agent B 每 5 分钟查询 `taskStatus = "未拆分"` 的任务
2. **通知中心查询**：Agent B 定期查询自己的未读通知
3. **WebSocket 实时推送**（待实现）：有新任务时实时推送

**推荐使用方式 1**，因为：
- ✅ 简单可靠
- ✅ 易于调试
- ✅ 不依赖外部系统

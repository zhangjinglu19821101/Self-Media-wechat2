# Agent 任务管理系统

## 📋 概述

基于 Next.js 的多 Agent 协作系统，支持任务拆解、指令执行、监控巡检等全流程管理。

---

## 🎯 核心功能

### 1. 任务管理
- 人发起任务 → 人确认后入库 `agentTasks` 表
- Agent B 拆解任务（草稿） → Agent A 确认 → 入库 `commandResults` 表
- 执行主体执行指令 → Agent B 审核 → 任务完成

### 2. 三种监控机制

| 机制 | 执行者 | 触发频率 | 触发条件 | 目标 |
|---|---|---|---|---|
| **TS 定时任务** | TS（系统） | 每 10 分钟 | 超过 1 小时无进展 | 及时发现问题 |
| **Agent B 巡检** | Agent B | 每日 13:00 | 执行超过 24 小时 | 系统性检查 |
| **执行主体主动咨询** | 执行主体 | 随时 | 遇到技术问题 | 自主求助 |

### 3. 状态流转

#### agentTasks 状态
```
未拆分 → 拆分中 → 拆分完成 → 执行中 → 完成
                    ↘ 失败
```

#### commandResults 状态
```
新建 → 执行中 → 执行完成 → 反馈完成
       ↘ 执行求助中（寻求技术专家协助）
       ↘ 执行求助中（寻求总裁协助）
                    ↘ 执行失败
```

---

## 📊 数据表结构

### agentTasks（任务表）
- `taskId`: 任务唯一标识
- `taskName`: 任务名称
- `coreCommand`: 核心指令（向量库同步）
- `executor`: 执行主体（向量库同步）
- `taskDurationStart`: 任务开始时间
- `taskDurationEnd`: 任务结束时间（向量库同步）
- `totalDeliverables`: 总交付物（向量库同步）
- `taskPriority`: 任务优先级（urgent | normal）
- `taskStatus`: 任务状态
- `creator`: 创建人
- `updater`: 更新人

### commandResults（指令表）
- `commandId`: 指令唯一标识
- `relatedTaskId`: 关联任务ID
- `commandContent`: 指令内容
- `executor`: 执行主体
- `commandPriority`: 指令优先级
- `executionDeadlineStart`: 执行开始时间
- `executionDeadlineEnd`: 执行结束时间
- `deliverables`: 指令交付物
- `executionStatus`: 执行状态
- `statusProof`: 状态更新佐证
- `helpRecord`: 求助记录
- `auditOpinion`: 审核意见

---

## 🔌 API 接口

### 1. 创建任务
```
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

### 2. 创建指令
```
POST /api/commands
{
  "relatedTaskId": "task-user-to-agent-insurance-d-20260222-001",
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

### 3. 咨询接口
```
POST /api/commands/:id/consult
{
  "type": "active_consult", // 或 "ts_response" | "inspection_response"
  "problemDescription": {
    "currentStatus": "已完成 50%",
    "specificProblem": "合规性校验逻辑复杂",
    "blocker": "不清楚校验规则",
    "neededHelp": "需要校验规则文档",
    "estimatedTimeToResolve": "预计 2 小时"
  }
}
```

---

## 🚀 启动服务

### 1. 启动 TS 定时任务
```typescript
import { TSScheduler } from '@/lib/services/ts-scheduler';

// 启动定时任务（每 10 分钟检查一次）
TSScheduler.start();
```

### 2. 启动 Agent B 巡检
```typescript
import { AgentBInspector } from '@/lib/services/agent-b-inspector';

// 启动巡检任务（每日 13:00）
AgentBInspector.start();
```

### 3. 在 Next.js 启动时自动启动
```typescript
// src/app/api/start-schedulers/route.ts
import { TSScheduler } from '@/lib/services/ts-scheduler';
import { AgentBInspector } from '@/lib/services/agent-b-inspector';

// 启动定时任务
TSScheduler.start();
AgentBInspector.start();

export async function GET() {
  return Response.json({ message: '定时任务已启动' });
}
```

---

## 📝 核心服务

### 1. 状态机服务
```typescript
import { TaskStateMachine, TaskStatus, CommandStatus } from '@/lib/services/task-state-machine';

// 更新任务状态
await TaskStateMachine.updateTaskStatus(
  taskId,
  TaskStatus.IN_PROGRESS,
  'TS',
  '任务开始执行'
);

// 更新指令状态
await TaskStateMachine.updateCommandStatus(
  commandId,
  CommandStatus.COMPLETED,
  'agent B',
  '交付物路径：/uploads/requirements.docx'
);

// 通知 Agent
await TaskStateMachine.notifyAgent(
  'agent B',
  'agent insurance-d',
  'system',
  '通知标题',
  '通知内容',
  taskId
);
```

### 2. 向量同步服务
```typescript
import { TaskVectorSync } from '@/lib/services/task-vector-sync';

// 同步任务到向量库
await TaskVectorSync.syncTaskToVector(taskId);

// 查询相似任务
const similarTasks = await TaskVectorSync.findSimilarTasks(coreCommand);

// 判断是否为重复任务
const { isDuplicate, similarTask } = await TaskVectorSync.isDuplicateTask(
  coreCommand,
  taskDurationEnd,
  totalDeliverables
);
```

---

## 🎨 前端页面（待实现）

### 1. 任务列表页面
- 显示所有任务
- 支持按状态筛选
- 支持按执行主体筛选

### 2. 任务详情页面
- 显示任务信息
- 显示拆解的指令列表
- 支持确认拆解方案

### 3. 指令详情页面
- 显示指令信息
- 显示执行状态
- 支持主动咨询
- 显示求助记录

---

## 🔍 注意事项

1. **入库时机**：
   - 人确认后入库 `agentTasks` 表
   - Agent A 确认后入库 `commandResults` 表

2. **状态联动**：
   - 所有指令状态为"反馈完成"时，任务状态自动更新为"完成"
   - 任意指令状态为"执行失败"时，任务状态自动更新为"失败"

3. **向量同步**：
   - 任务创建时自动同步到向量库
   - 用于相似性比对和重复任务检测

4. **定时任务**：
   - TS 定时任务：每 10 分钟检查一次
   - Agent B 巡检：每日 13:00

---

## ✅ 下一步计划

- [ ] 实现前端任务管理页面
- [ ] 实现 FileVectorDB 向量存储
- [ ] 实现 WebSocket 实时通知
- [ ] 实现任务优先级调度
- [ ] 实现任务统计报表

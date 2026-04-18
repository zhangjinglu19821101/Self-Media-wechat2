# Agent 任务管理与反馈系统

## 📋 概述

Agent 任务管理与反馈系统允许 Agent A（总裁）向其他 Agent（B、C、D、insurance-c、insurance-d）下达异步任务，并跟踪任务执行状态和收集反馈结果。

与实时指令下达相比，任务管理系统支持：
- ✅ 长期任务跟踪
- ✅ 任务状态管理
- ✅ 结果反馈和评价
- ✅ 适合复杂、长时间的任务

## 🎯 核心功能

### 1. 任务管理 API

#### 1.1 创建任务

**接口**：`POST /api/agents/tasks`

**请求体**：
```json
{
  "fromAgentId": "A",
  "toAgentId": "B",
  "command": "任务内容",
  "commandType": "task",
  "priority": "high",
  "metadata": {
    "deadline": "2026-02-10",
    "category": "optimization"
  }
}
```

**参数说明**：
- `fromAgentId`：任务下达者（只能是 "A"）
- `toAgentId`：任务接收者（"B"、"C"、"D"、"insurance-c"、"insurance-d"）
- `command`：任务内容
- `commandType`：任务类型（"instruction"、"task"、"report"、"urgent"）
- `priority`：优先级（"high"、"normal"、"low"）
- `metadata`：任务元数据（可选）

**响应**：
```json
{
  "success": true,
  "data": {
    "task": {
      "taskId": "task-1234567890-abc123",
      "fromAgentId": "A",
      "toAgentId": "B",
      "command": "任务内容",
      "status": "pending",
      "createdAt": "2025-01-15T10:00:00Z"
    },
    "message": "任务已创建，等待执行"
  }
}
```

#### 1.2 获取任务列表

**接口**：`GET /api/agents/[agentId]/tasks`

**查询参数**：
- `status`：任务状态（"pending"、"in_progress"、"completed"、"failed"）
- `limit`：返回数量（默认 20）
- `offset`：偏移量（默认 0）

**示例**：
```bash
GET /api/agents/A/tasks?status=completed&limit=10
```

**响应**：
```json
{
  "success": true,
  "data": {
    "tasks": [...],
    "stats": {
      "total": 100,
      "pending": 5,
      "inProgress": 3,
      "completed": 90,
      "failed": 2
    },
    "pagination": {
      "limit": 10,
      "offset": 0,
      "total": 10
    }
  }
}
```

#### 1.3 更新任务状态

**接口**：`PUT /api/agents/tasks/[taskId]/status`

**请求体**：
```json
{
  "status": "in_progress"
}
```

**状态值**：
- `pending`：待执行
- `in_progress`：执行中
- `completed`：已完成（需要通过 result 接口提交结果）
- `failed`：已失败（需要通过 result 接口提交结果）

#### 1.4 提交任务结果

**接口**：`PUT /api/agents/tasks/[taskId]/result`

**请求体**：
```json
{
  "status": "completed",
  "result": "任务执行结果详细描述..."
}
```

**响应**：
```json
{
  "success": true,
  "data": {
    "task": {
      "taskId": "task-1234567890-abc123",
      "status": "completed",
      "result": "任务执行结果详细描述...",
      "completedAt": "2025-01-15T12:00:00Z"
    },
    "message": "任务已完成"
  }
}
```

### 2. 反馈 API

#### 2.1 获取 Agent 反馈

**接口**：`GET /api/agents/[agentId]/feedback`

**查询参数**：
- `limit`：返回数量（默认 20）
- `offset`：偏移量（默认 0）

**示例**：
```bash
GET /api/agents/A/feedback?limit=10
```

**响应**：
```json
{
  "success": true,
  "data": {
    "feedbacks": [
      {
        "taskId": "task-1234567890-abc123",
        "fromAgent": "B",
        "command": "任务内容",
        "result": "任务执行结果详细描述...",
        "completedAt": "2025-01-15T12:00:00Z",
        "commandType": "task",
        "priority": "high"
      }
    ],
    "total": 1
  }
}
```

## 🔄 工作流程

### 任务管理流程

```
Agent A（总裁）
    ↓
1. 创建任务（POST /api/agents/tasks）
    ↓
任务状态：pending
    ↓
Agent B（接收方）
    ↓
2. 启动任务（PUT /api/agents/tasks/[taskId]/status）
    ↓
任务状态：in_progress
    ↓
3. 执行任务
    ↓
4. 提交结果（PUT /api/agents/tasks/[taskId]/result）
    ↓
任务状态：completed / failed
    ↓
Agent A
    ↓
5. 查看反馈（GET /api/agents/A/feedback）
```

## 💡 使用场景

### 场景 1：下达调研任务

```javascript
// Agent A 创建调研任务
const response = await fetch('/api/agents/tasks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fromAgentId: 'A',
    toAgentId: 'B',
    command: '调研当前最流行的AI内容检测工具，分析其优缺点和适用场景',
    commandType: 'task',
    priority: 'high',
    metadata: {
      deadline: '2025-01-20',
      category: 'research'
    }
  })
});

const task = await response.json();
console.log('任务ID:', task.data.task.taskId);
```

### 场景 2：Agent B 执行任务

```javascript
// Agent B 启动任务
await fetch(`/api/agents/tasks/${taskId}/status`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'in_progress' })
});

// Agent B 执行任务...
// ...

// Agent B 提交结果
await fetch(`/api/agents/tasks/${taskId}/result`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    status: 'completed',
    result: `
## AI内容检测工具调研报告

### 工具1：OpenAI API
- 优点：准确率高，支持多种内容类型
- 缺点：需要API Key，成本较高
- 适用场景：专业内容审核

### 工具2：Copyleaks
- 优点：支持多语言，检测速度快
- 缺点：免费额度有限
- 适用场景：批量内容检测

...
    `
  })
});
```

### 场景 3：Agent A 查看反馈

```javascript
// Agent A 查看反馈
const response = await fetch('/api/agents/A/feedback');
const data = await response.json();

console.log('反馈列表:', data.data.feedbacks);
data.data.feedbacks.forEach(feedback => {
  console.log(`来自 ${feedback.fromAgent} 的反馈:`);
  console.log(`任务: ${feedback.command}`);
  console.log(`结果: ${feedback.result}`);
  console.log(`完成时间: ${feedback.completedAt}`);
});
```

## 🎨 数据库 Schema

### agent_tasks 表

```sql
CREATE TABLE agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT NOT NULL UNIQUE,
  from_agent_id TEXT NOT NULL,
  to_agent_id TEXT NOT NULL,
  command TEXT NOT NULL,
  command_type TEXT NOT NULL DEFAULT 'instruction',
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'pending',
  result TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP
);
```

### 字段说明

- `id`：主键
- `task_id`：任务ID（唯一标识）
- `from_agent_id`：任务下达者
- `to_agent_id`：任务接收者
- `command`：任务内容
- `command_type`：任务类型
- `priority`：优先级
- `status`：任务状态
- `result`：执行结果
- `metadata`：任务元数据
- `created_at`：创建时间
- `updated_at`：更新时间
- `completed_at`：完成时间

## 🔒 权限控制

1. **任务创建**：只有 Agent A（总裁）可以创建任务
2. **任务接收**：Agent B、C、D、insurance-c、insurance-d 可以接收任务
3. **状态更新**：只有任务接收者可以更新任务状态和提交结果
4. **反馈查看**：只有任务下达者可以查看反馈

## ⚡ 与实时指令的区别

| 特性 | 实时指令 | 任务管理 |
|------|---------|---------|
| 执行方式 | 立即执行，实时响应 | 异步执行，长期跟踪 |
| 适用场景 | 简单任务、紧急指令 | 复杂任务、长时间执行 |
| 状态管理 | 无状态 | 有状态（pending → in_progress → completed/failed） |
| 结果反馈 | 实时响应 | 异步反馈 |
| 适用Agent | 所有Agent | Agent A → 其他Agent |

## 🚀 最佳实践

1. **合理选择指令类型**：
   - 简单任务、紧急指令：使用实时指令（`/api/agents/send-command`）
   - 复杂任务、长时间执行：使用任务管理（`/api/agents/tasks`）

2. **明确任务要求**：
   - 在 command 中明确任务目标、完成标准、时限
   - 在 metadata 中添加任务分类、截止日期等信息

3. **跟踪任务进度**：
   - 定期检查任务状态
   - 及时处理失败任务
   - 记录任务执行经验

4. **反馈评估**：
   - 评估任务执行质量
   - 记录优秀执行案例
   - 优化任务分配策略

## 📚 相关文档

- [Agent 指令下达系统](./AGENT_COMMAND_SYSTEM.md)
- [Agent 记忆系统](./AGENT_MEMORY_SYSTEM.md)
- [Agent 配置文档](./AGENT_CONFIG.md)

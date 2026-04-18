# Agent B 识别并下发任务给 insurance-d

## 功能说明

这个功能实现了 Agent B 从 Agent A 的一周工作任务中，识别出属于 insurance-d 的任务，并下发给 insurance-d 进行拆解和执行。

## API 端点

### 1. Agent B 识别并下发任务

**端点：** `POST /api/agents/agent-b/identify-tasks`

**请求体：**
```json
{
  "weeklyTasks": {
    "weekStart": "2024-02-12",
    "weekEnd": "2024-02-18",
    "tasks": [
      {
        "id": "task-001",
        "taskName": "拆解保险文章创作任务",
        "commandContent": "将本周的保险文章创作任务拆解为多个可执行的子任务，包括素材收集、文章撰写、合规校验、配图添加等步骤",
        "executionDate": "2024-02-12",
        "executor": "insurance-d",
        "priority": "normal",
        "deadline": "2024-02-14",
        "deliverables": "拆解后的子任务列表"
      },
      {
        "id": "task-002",
        "taskName": "撰写保险科普文章",
        "commandContent": "撰写一篇关于重疾险的科普文章，字数1500字，包含真实案例",
        "executionDate": "2024-02-13",
        "executor": "insurance-a",
        "priority": "normal",
        "deadline": "2024-02-14",
        "deliverables": "保险科普文章"
      },
      {
        "id": "task-003",
        "taskName": "管理本周任务进度",
        "commandContent": "跟踪和管理本周所有保险相关任务的执行进度，及时发现和解决问题",
        "executionDate": "2024-02-12",
        "executor": "insurance-d",
        "priority": "urgent",
        "deadline": "2024-02-18",
        "deliverables": "任务进度报告"
      }
    ]
  }
}
```

**响应：**
```json
{
  "success": true,
  "message": "成功识别并下发 2 个任务给 insurance-d",
  "identifiedCount": 2,
  "assignedCount": 2,
  "tasks": [
    {
      "taskId": "task-001",
      "taskName": "拆解保险文章创作任务",
      "belongsToInsuranceD": true,
      "reason": "任务包含拆分关键词",
      "confidence": 0.9
    },
    {
      "taskId": "task-003",
      "taskName": "管理本周任务进度",
      "belongsToInsuranceD": true,
      "reason": "任务包含管理关键词",
      "confidence": 0.85
    }
  ],
  "errors": []
}
```

### 2. insurance-d 拆解指令

**端点：** `POST /api/agents/insurance-d/split-task`

**请求体：**
```json
{
  "commandResultId": "uuid-of-command-result"
}
```

**响应：**
```json
{
  "success": true,
  "message": "拆解成功",
  "subTaskCount": 4,
  "subTasks": [
    {
      "orderIndex": 1,
      "title": "收集保险素材",
      "executor": "insurance-b",
      "isCritical": true
    },
    {
      "orderIndex": 2,
      "title": "撰写保险文章初稿",
      "executor": "insurance-a",
      "isCritical": true
    },
    {
      "orderIndex": 3,
      "title": "合规校验与修正",
      "executor": "insurance-b",
      "isCritical": true
    },
    {
      "orderIndex": 4,
      "title": "添加配图",
      "executor": "insurance-c",
      "isCritical": false
    }
  ]
}
```

## 使用示例

### 1. 使用 curl 测试

```bash
# 步骤 1: Agent B 识别并下发任务
curl -X POST http://localhost:5000/api/agents/agent-b/identify-tasks \
  -H "Content-Type: application/json" \
  -d '{
    "weeklyTasks": {
      "weekStart": "2024-02-12",
      "weekEnd": "2024-02-18",
      "tasks": [
        {
          "id": "task-001",
          "taskName": "拆解保险文章创作任务",
          "commandContent": "将本周的保险文章创作任务拆解为多个可执行的子任务",
          "executionDate": "2024-02-12",
          "executor": "insurance-d",
          "priority": "normal",
          "deadline": "2024-02-14",
          "deliverables": "拆解后的子任务列表"
        }
      ]
    }
  }'

# 步骤 2: insurance-d 拆解指令
curl -X POST http://localhost:5000/api/agents/insurance-d/split-task \
  -H "Content-Type: application/json" \
  -d '{
    "commandResultId": "uuid-of-command-result"
  }'
```

### 2. 使用 JavaScript

```javascript
// 步骤 1: Agent B 识别并下发任务
const identifyResponse = await fetch('/api/agents/agent-b/identify-tasks', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    weeklyTasks: {
      weekStart: '2024-02-12',
      weekEnd: '2024-02-18',
      tasks: [
        {
          id: 'task-001',
          taskName: '拆解保险文章创作任务',
          commandContent: '将本周的保险文章创作任务拆解为多个可执行的子任务',
          executionDate: '2024-02-12',
          executor: 'insurance-d',
          priority: 'normal',
          deadline: '2024-02-14',
          deliverables: '拆解后的子任务列表',
        },
      ],
    },
  }),
});

const identifyResult = await identifyResponse.json();
console.log('识别结果:', identifyResult);

// 步骤 2: insurance-d 拆解指令
if (identifyResult.success && identifyResult.tasks.length > 0) {
  for (const task of identifyResult.tasks) {
    const splitResponse = await fetch('/api/agents/insurance-d/split-task', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        commandResultId: task.taskId,
      }),
    });

    const splitResult = await splitResponse.json();
    console.log(`任务 ${task.taskName} 拆解结果:`, splitResult);
  }
}
```

## 数据流程

```
Agent A 一周任务列表
    ↓
Agent B 识别属于 insurance-d 的任务
    ↓
更新 command_results 表（toAgentId = 'insurance-d'）
    ↓
insurance-d 接收任务
    ↓
insurance-d 调用 splitTaskForAgent 拆解任务
    ↓
生成子任务列表（包含 executor、orderIndex 等字段）
    ↓
插入 agent_sub_tasks 表
    ↓
各 agent 执行自己的子任务
```

## 注意事项

1. **任务识别标准**：
   - 任务包含"拆分"关键词
   - 任务包含"管理"关键词
   - 任务复杂度高
   - 任务需要多 Agent 协作

2. **置信度**：
   - 置信度 0-1，表示识别的确定性
   - 任务描述越明确，置信度越高

3. **任务状态**：
   - 下发后，任务状态重置为 'new'
   - insurance-d 重新处理任务

4. **子任务字段**：
   - orderIndex: 执行顺序
   - title: 任务标题
   - description: 任务描述
   - executor: 执行者（可分配给不同 agent）
   - acceptanceCriteria: 验收标准
   - isCritical: 是否关键任务
   - criticalReason: 关键原因

## 后端创建通知的完整流程

当 Agent B 返回拆解结果后，后端创建通知的具体流程如下：

### 1. 触发时机
**位置：** `src/app/api/agents/send-command/route.ts` 的 `processAgentResponse` 函数

**触发条件：**
- `toAgentId === 'B'`（接收指令的是 Agent B）
- `fromAgentId === 'A'`（发送指令的是 Agent A）
- Agent B 的响应中包含 JSON 格式的拆解结果

### 2. 检测拆解结果
```typescript
// 使用正则表达式查找 Markdown 代码块中的 JSON
const jsonMatch = responseContent.match(/```json\s*([\s\S]*?)\s*```/);
```

**要求格式：**
```json
```json
{
  "totalDeliverables": "7",
  "timeFrame": "5天",
  "summary": "...",
  "subTasks": [...]
}
```
```

### 3. 解析拆解结果
```typescript
const splitResult = JSON.parse(jsonMatch[1]);
```

**解析后的对象包含：**
- `totalDeliverables`: 总交付物数量
- `timeFrame`: 时间周期
- `summary`: 拆解方案摘要
- `subTasks`: 子任务数组（包含 executor, taskTitle, commandContent 等）

### 4. 创建通知记录
```typescript
const notificationId = `notif-A-B-split-${Date.now()}`;

await db.insert(agentNotifications).values({
  notificationId,
  fromAgentId: 'B',
  toAgentId: 'A',
  notificationType: 'result',
  title: `任务拆解完成：A → B`,
  content: JSON.stringify({
    fromAgentId: 'B',
    toAgentId: 'A',
    result: JSON.stringify(splitResult),  // 双重 JSON 序列化
    status: 'completed',
    data: {
      splitResult,
      subTasksCount: splitResult.subTasks?.length || 0,
    },
  }),
  relatedTaskId: taskId,  // 原始任务的 taskId
  status: 'unread',
  priority: 'high',
  isRead: false,
  metadata: {
    splitResult,
    subTasksCount: splitResult.subTasks?.length || 0,
  },
});
```

### 5. 通知表结构
**表名：** `agent_notifications`

| 字段 | 说明 | 示例值 |
|------|------|--------|
| `notificationId` | 通知唯一标识 | `notif-A-B-split-1770962175243` |
| `fromAgentId` | 发送方 Agent ID | `B` |
| `toAgentId` | 接收方 Agent ID | `A` |
| `notificationType` | 通知类型 | `result` |
| `title` | 通知标题 | `任务拆解完成：A → B` |
| `content` | 通知内容（JSON字符串） | 包含拆解结果的 JSON |
| `relatedTaskId` | 关联的任务ID | 原始任务的 taskId |
| `status` | 通知状态 | `unread` |
| `priority` | 优先级 | `high` |
| `isRead` | 是否已读 | `false` |
| `createdAt` | 创建时间 | 时间戳 |

### 6. 数据流向

```
Agent B LLM 响应
    ↓
提取 JSON 代码块
    ↓
解析拆解结果
    ↓
插入数据库
    ↓
agent_notifications 表
    ↓
前端轮询查询
    ↓
显示拆解结果弹框
```

### 7. 关键点

1. **双重 JSON 序列化：**
   - `result` 字段存储的是 `JSON.stringify(splitResult)` 的字符串
   - 所以前端解析时需要先解析一次外层 JSON，再解析 result 字段

2. **关联任务ID：**
   - `relatedTaskId` 存储的是原始任务的 taskId
   - 用于关联到 `agent_tasks` 表中的原始任务记录

3. **状态和优先级：**
   - `status: 'unread'` - 未读状态
   - `priority: 'high'` - 高优先级，确保前端优先处理

4. **元数据存储：**
   - `metadata` 字段直接存储 `splitResult` 对象
   - 方便后续查询和分析

### 8. 前端如何使用

前端通过 API 查询通知：
```
GET /api/agents/A/notifications?includeRead=true
```

返回的数据格式：
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "type": "task_result",
        "fromAgentId": "B",
        "toAgentId": "A",
        "taskId": "task-A-to-insurance-d-xxx",
        "result": "{\"totalDeliverables\":\"7\",...}",  // 需要再次 JSON.parse
        "status": "completed",
        "timestamp": "2026-02-13T05:56:15.000Z",
        "notificationId": "notif-A-B-split-1770962175243",
        "isRead": false
      }
    ]
  }
}
```

前端解析后显示拆解结果确认弹框。

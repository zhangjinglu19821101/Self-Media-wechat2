# 向所有 Agent 发送指令

## ✅ 当前支持的功能

系统已经支持向所有 Agent 发送指令，有两种方式：

### 方式 1：针对性发送（推荐）

Agent A 可以生成针对不同 Agent 的具体指令，系统会自动检测并发送给对应的 Agent。

**优点：**
- 每个收到针对自己任务的具体指令
- 指令内容个性化，更清晰
- 支持不同的优先级和类型

**示例：**

```markdown
# 总裁的今日工作安排

## AI事业部
# Agent C
今天分析上周运营数据，重点关注用户留存率，下午3点前提交报告。

# Agent D
撰写3篇关于AI技术趋势的文章，发布到公众号，要求每篇1500字以上。

## 保险事业部
# Agent insurance-c
更新保险产品介绍页面的文案，突出产品优势，今日内完成。

# Agent insurance-d
制作5条短视频内容，用于抖音推广，风格要活泼有趣。

## 技术支撑
# 架构师B
优化系统性能，确保页面加载时间小于2秒，重点优化首页加载速度。
```

**发送流程：**
1. Agent A 生成上述指令
2. 系统自动检测出 5 条指令
3. 显示确认弹框，列出所有指令
4. 点击"全部发送"
5. 逐个发送给对应的 Agent

### 方式 2：广播发送（新增功能）

将相同的指令发送给多个 Agent（例如：通用通知、紧急通知）。

**优点：**
- 一次性发送给多个 Agent
- 适合通用消息
- 适合紧急通知

**使用场景：**
- 通用通知（系统维护、功能更新）
- 紧急通知（突发问题、安全警告）
- 会议邀请
- 汇报要求

---

## 📋 支持的 Agent 列表

| Agent ID | 名称 | 角色 | 主要职责 |
|---------|------|------|---------|
| B | 架构师B | 技术负责人 | 技术落地、系统优化、问题解决 |
| C | AI运营Agent | 内容运营 | 运营数据分析、内容运营策略 |
| D | AI内容生成Agent | 内容创作 | 文章撰写、内容生成 |
| insurance-c | 保险运营Agent | 运营执行 | 保险运营、产品推广 |
| insurance-d | 保险内容创作Agent | 内容执行 | 保险内容创作、短视频制作 |

---

## 🔧 使用方法

### 前端调用 API

#### 发送单条指令

```typescript
import { sendCommandToAgent } from '@/lib/command-detector';

// 发送给 Agent B
const result = await sendCommandToAgent(
  'B',                                    // 目标 Agent ID
  '优化系统性能，确保页面加载时间小于2秒',  // 指令内容
  'task',                                 // 指令类型
  'high',                                 // 优先级
  'A'                                     // 发送方 Agent ID
);

if (result.success) {
  console.log('指令发送成功');
} else {
  console.error('发送失败:', result.error);
}
```

#### 批量发送（针对性）

```typescript
import { detectCommands, sendCommandToAgent } from '@/lib/command-detector';

// Agent A 生成的总指令
const agentACommands = `
# Agent C
分析运营数据

# Agent D
撰写技术文章
`;

// 检测所有指令
const result = detectCommands(agentACommands);

// 逐个发送
for (const command of result.commands) {
  const formattedCommand = formatCommandForAgent(command, 'A');
  await sendCommandToAgent(
    command.targetAgentId,
    formattedCommand,
    command.commandType,
    command.priority,
    'A'
  );
}
```

#### 广播发送

```typescript
// 广播给所有 Agent
const response = await fetch('/api/commands/broadcast', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fromAgentId: 'A',
    command: '系统将于今晚10点进行维护，请做好准备',
    commandType: 'instruction',
    priority: 'high',
    // targetAgentIds: ['B', 'C'],  // 可选：指定目标 Agent，为空则发送给所有
  }),
});

const data = await response.json();
console.log('广播结果:', data);
```

---

## 📊 指令类型和优先级

### 指令类型

| 类型 | 说明 | 使用场景 |
|-----|------|---------|
| `instruction` | 指令 | 日常工作安排、任务分配 |
| `task` | 任务 | 具体执行任务 |
| `report` | 报告 | 要求提交报告 |
| `urgent` | 紧急 | 紧急通知、立即执行的任务 |

### 优先级

| 优先级 | 说明 | 处理策略 |
|-------|------|---------|
| `high` | 高优先级 | 立即执行，优先处理 |
| `normal` | 普通优先级 | 正常处理 |
| `low` | 低优先级 | 可以稍后处理 |

---

## 🎯 最佳实践

### 1. 编写清晰的指令

✅ **好的指令：**
```
优化系统性能，确保页面加载时间小于2秒。
重点关注首页加载速度，今日内完成。
```

❌ **不好的指令：**
```
优化一下系统性能
```

### 2. 使用合适的优先级

- **high**: 紧急问题、关键任务、截止日期近的任务
- **normal**: 日常工作、常规任务
- **low**: 可选任务、长期任务

### 3. 选择合适的发送方式

| 场景 | 推荐方式 |
|-----|---------|
| 每个 Agent 有具体任务 | 针对性发送 |
| 通用通知 | 广播发送 |
| 紧急通知 | 广播发送 + high 优先级 |
| 定期汇报要求 | 针对性发送 |

### 4. 设置明确的截止时间

```
# Agent C
分析上周运营数据，重点关注用户留存率。
今日下午3点前提交报告给 Agent A。
```

---

## 🔄 指令生命周期

```
生成指令
  ↓
检测指令
  ↓
确认弹框
  ↓
发送指令
  ↓
接收方 Agent 收到
  ↓
Agent 执行任务
  ↓
反馈结果
  ↓
指令完成
```

---

## 📝 API 参考

### POST /api/commands/send

发送指令给单个 Agent。

**请求：**
```json
{
  "fromAgentId": "A",
  "toAgentId": "B",
  "command": "指令内容",
  "commandType": "instruction",
  "priority": "high"
}
```

**响应：**
```json
{
  "success": true,
  "message": "指令已发送",
  "data": {
    "conversationId": "xxx",
    "sessionId": "xxx",
    "fromAgentId": "A",
    "toAgentId": "B",
    "wsPushSuccess": true
  }
}
```

### POST /api/commands/broadcast

广播指令给多个 Agent。

**请求：**
```json
{
  "fromAgentId": "A",
  "command": "广播内容",
  "commandType": "instruction",
  "priority": "high",
  "targetAgentIds": ["B", "C", "D"]
}
```

**响应：**
```json
{
  "success": true,
  "message": "指令已发送到 3 个 Agent",
  "data": {
    "total": 3,
    "success": 3,
    "failed": 0,
    "results": [
      {
        "agentId": "B",
        "status": "success",
        "data": {...}
      }
    ]
  }
}
```

---

## 💡 示例代码

### 获取所有支持的 Agent

```typescript
import { getAllSupportedAgents } from '@/lib/command-detector';

const agents = getAllSupportedAgents();
console.log(agents);
// 输出：
// [
//   { id: 'B', name: '架构师B' },
//   { id: 'C', name: 'AI运营Agent（内容运营）' },
//   { id: 'D', name: 'AI内容生成Agent' },
//   { id: 'insurance-c', name: '保险运营Agent' },
//   { id: 'insurance-d', name: '保险内容创作Agent' }
// ]
```

### 检查 Agent ID 是否有效

```typescript
import { isValidAgentId } from '@/lib/command-detector';

if (isValidAgentId('B')) {
  console.log('Agent ID 有效');
} else {
  console.log('Agent ID 无效');
}
```

---

## 🚀 高级用法

### 1. 带元数据的指令

```typescript
const response = await fetch('/api/commands/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fromAgentId: 'A',
    toAgentId: 'B',
    command: '优化系统性能',
    commandType: 'task',
    priority: 'high',
    metadata: {
      deadline: '2026-02-04T18:00:00Z',
      tags: ['performance', 'optimization'],
    },
  }),
});
```

### 2. 批量发送（异步并发）

```typescript
const agentIds = ['B', 'C', 'D'];
const promises = agentIds.map(agentId =>
  sendCommandToAgent(agentId, '任务内容', 'task', 'normal', 'A')
);

const results = await Promise.allSettled(promises);
const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

console.log(`成功发送 ${successCount}/${agentIds.length} 条指令`);
```

---

## 📌 注意事项

1. **Agent A 不能给自己发指令**：fromAgentId 不能等于 toAgentId
2. **广播不包含发送方**：广播时自动排除发送方
3. **WebSocket 连接**：需要 Agent 建立连接才能实时接收
4. **对话历史**：所有指令都会保存到对话历史
5. **并发限制**：建议批量发送时控制并发数量（建议 < 10）

---

## ❓ 常见问题

### Q: 可以向 Agent A 自己发送指令吗？
A: 不可以，Agent A 只能向其他 Agent 发送指令。

### Q: 广播时如何排除某些 Agent？
A: 使用 `targetAgentIds` 参数指定目标 Agent 列表。

### Q: 指令发送失败怎么办？
A: 系统会记录错误日志，可以重试发送。

### Q: 如何知道 Agent 是否收到指令？
A: 查看 WebSocket 连接状态和对话历史记录。

---

## 🎉 总结

系统完全支持向所有 Agent 发送指令，有两种方式：

1. **针对性发送**（推荐）：每个 Agent 收到具体任务
2. **广播发送**（新增）：一次性发送给多个 Agent

根据实际需求选择合适的发送方式！

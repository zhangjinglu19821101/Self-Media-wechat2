# 执行 Agent 身份标识说明

## 功能概述

Agent B 在巡检超长任务时，会与**执行 Agent**进行对话判断。执行 Agent 的具体身份由任务的 `executor` 字段决定，可能是：
- **insurance-c**（保险运营）
- **insurance-d**（保险内容）
- 或其他 Agent

## 数据流转

### 1. 巡检任务识别

```typescript
// src/lib/cron/tasks/check-long-running-tasks.ts
const longRunningTasks = await db
  .select({ executor: schema.commandResults.executor, ... })
  .from(schema.commandResults)
  .where(
    and(
      eq(schema.commandResults.executionStatus, 'in_progress'),
      lt(schema.commandResults.createdAt, oneDayAgo),
    )
  );
```

**关键点**：`task.executor` 字段存储了执行 Agent 的 ID（如 `insurance-c`、`insurance-d`）

### 2. 创建对话上下文

```typescript
const context: DialogueContext = {
  sessionId,
  executorAgentId: task.executor, // 例如：'insurance-c' 或 'insurance-d'
  taskTitle: `任务 ${task.commandId}`,
  taskDescription: task.commandContent,
  commandResultId: task.id,
};
```

### 3. Agent B 对话判断

```typescript
export async function judgeExecutorResponse(context: DialogueContext): Promise<DialogueResult> {
  const executorAgentName = getAgentName(context.executorAgentId);
  // executorAgentName = '保险运营（insurance-c）' 或 '保险内容（insurance-d）'

  console.log(`[Agent B] 执行 Agent: ${executorAgentName} (ID: ${context.executorAgentId})`);

  // 对话过程中，所有日志都明确显示执行 Agent 身份
  console.log(`[Agent B] 第 ${round} 轮对话 - ${executorAgentName}: ${executorResponse}`);

  return {
    sessionId: context.sessionId,
    executorAgentId: context.executorAgentId, // 保存执行 Agent ID
    messages,
    isUnderstand,
    roundCount: messages.length,
    completedReason,
  };
}
```

### 4. 对话总结

```typescript
export async function summarizeDialogue(dialogueResult: DialogueResult): Promise<DialogueSummary> {
  const executorAgentName = getAgentName(dialogueResult.executorAgentId);

  // 对话过程记录中明确标识每条消息的发送者
  const dialogueProcess = convertToDialogueProcess(dialogueResult.messages, executorAgentName);
  // 结果示例：
  // [
  //   { round: 1, sender: 'Agent B', senderId: 'agent_b', content: '...', ... },
  //   { round: 2, sender: '保险运营（insurance-c）', senderId: 'executor', content: '...', ... },
  //   ...
  // ]

  // 总结、结论、建议行动中都明确提到执行 Agent
  const summary = await generateSummary(dialogueResult, executorAgentName);
  // 例如："Agent B 询问执行 Agent (保险运营（insurance-c）) 是否理解任务..."

  const conclusion = await generateConclusion(dialogueResult, summary, executorAgentName);
  // 例如："执行 Agent (保险运营（insurance-c）) 尚未完全理解任务，需要进一步说明。"

  const suggestedActions = await generateSuggestedActions(..., executorAgentName);
  // 例如：{
  //   action: 'escalate',
  //   description: '需要 Agent A 介入，帮助 保险运营（insurance-c） 理解任务',
  //   priority: 'high'
  // }
}
```

## Agent 名称映射

```typescript
export function getAgentName(agentId: string): string {
  const agentNames: Record<string, string> = {
    'insurance-c': '保险运营（insurance-c）',
    'insurance-d': '保险内容（insurance-d）',
    'insurance-b': '保险技术负责人（insurance-b）',
    'insurance-a': '保险总裁（insurance-a）',
    'agent-b': '技术负责人（Agent B）',
    'agent-a': '总裁（Agent A）',
  };
  return agentNames[agentId] || agentId;
}
```

## 日志示例

### 场景 1：insurance-c 执行的任务

```
[Check-Long-Running-Tasks] 发现 1 个超长任务
[Check-Long-Running-Tasks] 处理任务: 创作保险文章 (ID: xxx)
[Check-Long-Running-Tasks] Agent B 开始判断...
[Agent B] 开始判断执行 Agent 是否理解任务...
[Agent B] 执行 Agent: 保险运营（insurance-c） (ID: insurance-c)
[Agent B] 任务: 任务 xxx
[Agent B] 第 1 轮对话 - Agent B: 你好 保险运营（insurance-c），你理解了这个任务吗？请简要说明你的理解。
[Agent B] 等待执行 Agent (保险运营（insurance-c)) 的回复...
[Agent B] 第 1 轮对话 - 保险运营（insurance-c）: 我是保险运营（insurance-c），我理解了这个任务，我现在就开始执行。
[Agent B] 对话完成，共 1 轮
[Agent B] 保险运营（insurance-c） 是否理解: 是
[Agent B] 对话总结完成
[Agent B] 结论: 执行 Agent (保险运营（insurance-c）) 已理解任务
```

### 场景 2：insurance-d 执行的任务

```
[Check-Long-Running-Tasks] 发现 1 个超长任务
[Check-Long-Running-Tasks] 处理任务: 设计产品原型 (ID: yyy)
[Check-Long-Running-Tasks] Agent B 开始判断...
[Agent B] 开始判断执行 Agent 是否理解任务...
[Agent B] 执行 Agent: 保险内容（insurance-d） (ID: insurance-d)
[Agent B] 任务: 任务 yyy
[Agent B] 第 1 轮对话 - Agent B: 你好 保险内容（insurance-d），你理解了这个任务吗？请简要说明你的理解。
[Agent B] 等待执行 Agent (保险内容（insurance-d)) 的回复...
[Agent B] 第 1 轮对话 - 保险内容（insurance-d）: 我是保险内容（insurance-d），任务要求是创作一篇关于保险的文章，对吧？
[Agent B] 对话完成，共 1 轮
[Agent B] 保险内容（insurance-d） 是否理解: 否
[Agent B] 对话总结完成
[Agent B] 结论: 执行 Agent (保险内容（insurance-d）) 尚未完全理解任务，需要进一步说明。
```

## 数据库存储

### agent_reports 表

```sql
-- summary 字段包含明确的执行 Agent 标识
"Agent B 询问执行 Agent (保险运营（insurance-c）) 是否理解任务，执行 Agent 回复表示理解。"

-- conclusion 字段
"执行 Agent (保险运营（insurance-c）) 已理解任务"

-- dialogue_process JSON 字段
[
  {
    "round": 1,
    "sender": "Agent B",
    "senderId": "agent_b",
    "content": "你好 保险运营（insurance-c），你理解了这个任务吗？",
    "isUnderstand": false,
    "timestamp": "2026-02-11T13:40:00.000Z"
  },
  {
    "round": 2,
    "sender": "保险运营（insurance-c）",
    "senderId": "executor",
    "content": "我是保险运营（insurance-c），我理解了这个任务，我现在就开始执行。",
    "isUnderstand": true,
    "timestamp": "2026-02-11T13:40:01.000Z"
  }
]

-- suggested_actions JSON 字段
[
  {
    "action": "continue",
    "description": "执行 Agent (保险运营（insurance-c）) 已理解任务，继续执行",
    "priority": "medium"
  }
]
```

## 总结

所有日志、对话记录、总结报告都**明确标识执行 Agent 的身份**：
- 日志输出：`[Agent B] 执行 Agent: 保险运营（insurance-c） (ID: insurance-c)`
- 对话过程：`sender: "保险运营（insurance-c）", senderId: "executor"`
- 总结文本：`"Agent B 询问执行 Agent (保险运营（insurance-c)) 是否理解任务..."`
- 结论文本：`"执行 Agent (保险运营（insurance-c）) 已理解任务"`
- 建议行动：`description: "需要 Agent A 介入，帮助 保险运营（insurance-c） 理解任务"`

确保在任何场景下都能清楚地知道 Agent B 是在与哪个具体的 Agent（insurance-c 或 insurance-d）进行对话。

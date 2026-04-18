# agent_sub_tasks 执行完整方案（含 insurance-d 与 Agent B 交互）

## 📋 补充内容

1. **insurance-d 执行任务与 Agent B 交互的详细过程**
2. **什么时候上报 Agent A**

---

## 🔄 完整执行流程图

```
┌─────────────────────────────────────────────────────────────────┐
│ 阶段 1：任务分发                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ pending (isDispatched = false)                                 │
│     ↓ [dispatch-agent-subtasks 定时任务]                       │
│ pending_review (isDispatched = true)                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 阶段 2：insurance-d 开始执行                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ pending_review                                                  │
│     ↓ [execute-agent-subtasks 定时任务]                        │
│ in_progress (设置 startedAt = NOW())                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 阶段 3：insurance-d 与 Agent B 交互（核心！）                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ in_progress                                                     │
│     ↓                                                           │
│ ┌─────────────────────────────────────────────────────────┐   │
│ │ insurance-d 执行子任务                                    │   │
│ │   ↓                                                       │   │
│ │ 遇到问题 / 需要确认 / 遇到疑问                            │   │
│ │   ↓                                                       │   │
│ │ 创建 agentInteractions 记录（对话记录）                  │   │
│ │   ↓                                                       │   │
│ │ 创建 agentNotifications 通知给 Agent B                   │   │
│ │   ↓                                                       │   │
│ │ Agent B 收到通知，进行回复 / 确认 / 解答                │   │
│ │   ↓                                                       │   │
│ │ 更新 agentInteractions 记录                              │   │
│ │   ↓                                                       │   │
│ │ insurance-d 继续执行...                                  │   │
│ └─────────────────────────────────────────────────────────┘   │
│     ↓ (可能多轮交互)                                          │
│ in_progress (更新 dialogueRounds, lastDialogueAt)             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        ┌─────────────────────┼─────────────────────┐
        ↓                     ↓                     ↓
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   执行成功     │    │   执行失败     │    │   需要升级      │
│               │    │               │    │               │
│ completed     │    │ blocked       │    │ escalated     │
│               │    │               │    │               │
└───────────────┘    └───────────────┘    └───────────────┘
                              ↓
                    ┌───────────────┐
                    │  上报 Agent A │
                    │  (escalated)  │
                    └───────────────┘
```

---

## 🎯 阶段 3：insurance-d 与 Agent B 交互的详细过程

### 3.1 交互触发场景

insurance-d 在执行过程中，以下情况需要与 Agent B 交互：

| 场景 | 说明 | 示例 |
|------|------|------|
| **疑问** | 对任务内容有疑问 | "这个标题的具体要求是什么？" |
| **确认** | 需要确认某个决策 | "我选择方案 A，可以吗？" |
| **求助** | 遇到技术困难 | "这个功能实现不了，需要帮助" |
| **反馈** | 执行过程中的进度反馈 | "已完成 50%，预计还需要 30 分钟" |
| **异议** | 对任务有不同意见 | "这个方案不合理，建议修改" |

### 3.2 交互流程详解

#### 步骤 1：insurance-d 发起交互

```typescript
// insurance-d 执行时发现需要与 Agent B 交互
async function handleNeedInteraction(subTask: AgentSubTask, interactionType: string, content: string) {
  
  // 1. 创建对话记录（agentInteractions 表）
  const interaction = await db.insert(agentInteractions).values({
    commandResultId: subTask.commandResultId,
    taskDescription: subTask.taskDescription,
    sessionId: `session-${subTask.id}-${Date.now()}`, // 唯一会话 ID
    sender: subTask.agentId, // 'insurance-d'
    receiver: 'B',
    messageType: interactionType, // 'question' | 'answer' | 'confirmation' | 'feedback'
    content: content,
    roundNumber: 1, // 第一轮
    createdAt: new Date(),
  }).returning();

  // 2. 更新子任务的对话状态
  await db.update(agentSubTasks).set({
    dialogueSessionId: interaction[0].sessionId,
    dialogueRounds: 1,
    dialogueStatus: 'in_progress', // 对话进行中
    lastDialogueAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(agentSubTasks.id, subTask.id));

  // 3. 创建通知给 Agent B
  await createNotification({
    agentId: 'B',
    type: 'agent_interaction',
    title: `insurance-d 需要交互：${subTask.taskTitle}`,
    content: {
      fromAgentId: subTask.agentId,
      toAgentId: 'B',
      interactionType: interactionType,
      interactionContent: content,
      sessionId: interaction[0].sessionId,
    },
    relatedTaskId: subTask.commandResultId,
    fromAgentId: subTask.agentId,
    priority: 'high',
    metadata: {
      subTaskId: subTask.id,
      dialogueSessionId: interaction[0].sessionId,
    },
  });

  console.log(`✅ insurance-d 已发起与 Agent B 的交互: ${interactionType}`);
}
```

#### 步骤 2：Agent B 收到通知并回复

```typescript
// Agent B 收到通知，查看并回复
async function handleAgentBReply(notification: Notification, replyContent: string) {
  
  const sessionId = notification.metadata?.dialogueSessionId;
  
  // 1. 查询当前的对话记录
  const interactions = await db
    .select()
    .from(agentInteractions)
    .where(eq(agentInteractions.sessionId, sessionId))
    .orderBy(agentInteractions.roundNumber);
  
  const currentRound = interactions.length + 1;

  // 2. 添加 Agent B 的回复
  await db.insert(agentInteractions).values({
    commandResultId: notification.relatedTaskId,
    sessionId: sessionId,
    sender: 'B',
    receiver: notification.fromAgentId, // 'insurance-d'
    messageType: 'answer', // 或 'confirmation' 等
    content: replyContent,
    roundNumber: currentRound,
    createdAt: new Date(),
  });

  // 3. 更新子任务的对话状态
  await db.update(agentSubTasks).set({
    dialogueRounds: currentRound,
    lastDialogueAt: new Date(),
    // dialogueStatus 保持 'in_progress'，直到对话完成
    updatedAt: new Date(),
  }).where(eq(agentSubTasks.dialogueSessionId, sessionId));

  // 4. 创建通知给 insurance-d
  await createNotification({
    agentId: notification.fromAgentId, // 'insurance-d'
    type: 'agent_interaction_reply',
    title: `Agent B 已回复：${notification.title}`,
    content: {
      fromAgentId: 'B',
      toAgentId: notification.fromAgentId,
      replyContent: replyContent,
      sessionId: sessionId,
    },
    relatedTaskId: notification.relatedTaskId,
    fromAgentId: 'B',
    priority: 'high',
    metadata: {
      subTaskId: notification.metadata?.subTaskId,
      dialogueSessionId: sessionId,
    },
  });

  console.log(`✅ Agent B 已回复 insurance-d`);
}
```

#### 步骤 3：insurance-d 收到回复，继续执行

```typescript
// insurance-d 收到 Agent B 的回复
async function handleInsuranceDReceiveReply(notification: Notification) {
  
  const sessionId = notification.metadata?.dialogueSessionId;
  
  // 1. 查询对话历史
  const interactions = await db
    .select()
    .from(agentInteractions)
    .where(eq(agentInteractions.sessionId, sessionId))
    .orderBy(agentInteractions.roundNumber);

  // 2. 根据 Agent B 的回复继续执行
  const replyContent = notification.content?.replyContent;
  
  // 解析回复，决定下一步动作
  // ... 执行逻辑 ...

  // 3. 如果还需要继续交互，回到步骤 1
  // 如果不需要交互了，继续执行任务

  console.log(`✅ insurance-d 收到 Agent B 的回复，继续执行`);
}
```

#### 步骤 4：对话完成

```typescript
// 对话完成，标记状态
async function markDialogueCompleted(subTaskId: string) {
  
  await db.update(agentSubTasks).set({
    dialogueStatus: 'completed', // 对话完成
    lastDialogueAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(agentSubTasks.id, subTaskId));

  console.log(`✅ 对话已完成`);
}
```

---

## 🚨 什么时候上报 Agent A（escalated 状态）

### 4.1 上报触发条件

满足以下任一条件时，需要上报 Agent A：

| 条件 | 说明 | 阈值 |
|------|------|------|
| **超时次数过多** | 同一个任务重试多次仍然超时 | 3-5 次 |
| **对话轮数过多** | insurance-d 与 Agent B 交互多轮仍然无法解决 | 5-10 轮 |
| **阻塞时间过长** | 任务处于 blocked 状态超过一定时间 | 2-4 小时 |
| **明确要求升级** | insurance-d 或 Agent B 明确要求升级 | 立即 |
| **遇到严重错误** | 遇到无法解决的技术问题 | 立即 |

### 4.2 上报流程详解

#### 场景 1：超时次数过多

```typescript
// monitor-subtasks-timeout 定时任务中检查
async function checkTimeoutAndEscalate(subTask: AgentSubTask) {
  
  const MAX_RETRY_COUNT = 5; // 最多重试 5 次
  
  // 检查超时重试次数
  if (subTask.timeoutHandlingCount >= MAX_RETRY_COUNT) {
    
    console.log(`🚨 任务 ${subTask.id} 超时重试 ${MAX_RETRY_COUNT} 次，需要上报 Agent A`);
    
    // 1. 标记为 escalated
    await db.update(agentSubTasks).set({
      status: 'escalated',
      escalated: true,
      escalatedAt: new Date(),
      escalatedReason: `超时重试 ${MAX_RETRY_COUNT} 次仍然无法完成`,
      updatedAt: new Date(),
    }).where(eq(agentSubTasks.id, subTask.id));

    // 2. 创建通知给 Agent A
    await createNotification({
      agentId: 'A',
      type: 'task_escalated',
      title: `任务需要人工干预：${subTask.taskTitle}`,
      content: {
        fromAgentId: 'system',
        toAgentId: 'A',
        escalatedReason: `超时重试 ${MAX_RETRY_COUNT} 次仍然无法完成`,
        subTaskId: subTask.id,
        timeoutCount: subTask.timeoutHandlingCount,
      },
      relatedTaskId: subTask.commandResultId,
      fromAgentId: 'system',
      priority: 'urgent',
      metadata: {
        subTaskId: subTask.id,
        escalatedType: 'timeout_exceeded',
      },
    });

    console.log(`✅ 已上报 Agent A: ${subTask.id}`);
  }
}
```

#### 场景 2：对话轮数过多

```typescript
// 每次对话更新时检查
async function checkDialogueRoundsAndEscalate(subTask: AgentSubTask) {
  
  const MAX_DIALOGUE_ROUNDS = 10; // 最多 10 轮对话
  
  if (subTask.dialogueRounds >= MAX_DIALOGUE_ROUNDS && subTask.dialogueStatus === 'in_progress') {
    
    console.log(`🚨 任务 ${subTask.id} 对话超过 ${MAX_DIALOGUE_ROUNDS} 轮，需要上报 Agent A`);
    
    // 1. 标记为 escalated
    await db.update(agentSubTasks).set({
      status: 'escalated',
      escalated: true,
      escalatedAt: new Date(),
      escalatedReason: `insurance-d 与 Agent B 对话超过 ${MAX_DIALOGUE_ROUNDS} 轮仍然无法解决`,
      updatedAt: new Date(),
    }).where(eq(agentSubTasks.id, subTask.id));

    // 2. 创建通知给 Agent A
    await createNotification({
      agentId: 'A',
      type: 'task_escalated',
      title: `任务需要人工干预：${subTask.taskTitle}`,
      content: {
        fromAgentId: 'system',
        toAgentId: 'A',
        escalatedReason: `对话超过 ${MAX_DIALOGUE_ROUNDS} 轮`,
        subTaskId: subTask.id,
        dialogueRounds: subTask.dialogueRounds,
      },
      relatedTaskId: subTask.commandResultId,
      fromAgentId: 'system',
      priority: 'urgent',
      metadata: {
        subTaskId: subTask.id,
        escalatedType: 'dialogue_exceeded',
      },
    });

    console.log(`✅ 已上报 Agent A: ${subTask.id}`);
  }
}
```

#### 场景 3：阻塞时间过长

```typescript
// monitor-subtasks-timeout 定时任务中检查
async function checkBlockedAndEscalate(subTask: AgentSubTask) {
  
  const MAX_BLOCKED_HOURS = 4; // 最多阻塞 4 小时
  
  if (subTask.status === 'blocked') {
    const blockedDuration = Date.now() - new Date(subTask.updatedAt).getTime();
    const blockedHours = blockedDuration / (1000 * 60 * 60);
    
    if (blockedHours >= MAX_BLOCKED_HOURS) {
      
      console.log(`🚨 任务 ${subTask.id} 阻塞超过 ${MAX_BLOCKED_HOURS} 小时，需要上报 Agent A`);
      
      // 1. 标记为 escalated
      await db.update(agentSubTasks).set({
        status: 'escalated',
        escalated: true,
        escalatedAt: new Date(),
        escalatedReason: `任务阻塞超过 ${MAX_BLOCKED_HOURS} 小时`,
        updatedAt: new Date(),
      }).where(eq(agentSubTasks.id, subTask.id));

      // 2. 创建通知给 Agent A
      await createNotification({
        agentId: 'A',
        type: 'task_escalated',
        title: `任务需要人工干预：${subTask.taskTitle}`,
        content: {
          fromAgentId: 'system',
          toAgentId: 'A',
          escalatedReason: `阻塞超过 ${MAX_BLOCKED_HOURS} 小时`,
          subTaskId: subTask.id,
          blockedHours: blockedHours,
        },
        relatedTaskId: subTask.commandResultId,
        fromAgentId: 'system',
        priority: 'urgent',
        metadata: {
          subTaskId: subTask.id,
          escalatedType: 'blocked_too_long',
        },
      });

      console.log(`✅ 已上报 Agent A: ${subTask.id}`);
    }
  }
}
```

#### 场景 4：明确要求升级

```typescript
// insurance-d 或 Agent B 明确要求升级
async function requestEscalation(subTaskId: string, reason: string, requestedBy: string) {
  
  console.log(`🚨 ${requestedBy} 要求升级任务 ${subTaskId}: ${reason}`);
  
  // 1. 标记为 escalated
  await db.update(agentSubTasks).set({
    status: 'escalated',
    escalated: true,
    escalatedAt: new Date(),
    escalatedReason: `${requestedBy} 要求升级: ${reason}`,
    updatedAt: new Date(),
  }).where(eq(agentSubTasks.id, subTaskId));

  // 2. 创建通知给 Agent A
  await createNotification({
    agentId: 'A',
    type: 'task_escalated',
    title: `任务需要人工干预：${subTask.taskTitle}`,
    content: {
      fromAgentId: requestedBy,
      toAgentId: 'A',
      escalatedReason: reason,
      subTaskId: subTaskId,
      requestedBy: requestedBy,
    },
    relatedTaskId: subTask.commandResultId,
    fromAgentId: requestedBy,
    priority: 'urgent',
    metadata: {
      subTaskId: subTaskId,
      escalatedType: 'requested_by_agent',
    },
  });

  console.log(`✅ 已上报 Agent A: ${subTaskId}`);
}
```

---

## 📊 完整的状态机（含交互和升级）

```
┌─────────────────────────────────────────────────────────────────┐
│                           创建阶段                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  pending (isDispatched = false)                                 │
│      ↓                                                          │
│  pending_review (isDispatched = true)                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                           执行阶段                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  pending_review                                                  │
│      ↓                                                          │
│  in_progress (startedAt = NOW())                                │
│      ↓                                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 保险-d 与 Agent B 交互（可选，多轮）                    │   │
│  │  dialogueStatus = 'in_progress'                        │   │
│  │  dialogueRounds++                                       │   │
│  │  (通过 agentInteractions 表记录)                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│      ↓ (对话完成后继续执行)                                    │
│  in_progress (dialogueStatus = 'completed')                  │
│      ↓                                                          │
│      ├─────────────────────┬─────────────────────┐          │
│      ↓                     ↓                     ↓          │
│  completed              blocked              timeout        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        ┌─────────────────────┼─────────────────────┐
        ↓                     ↓                     ↓
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  成功完成      │    │  检查是否升级    │    │  检查是否升级    │
│               │    │  (阻塞超时?)     │    │  (重试次数?)    │
└───────────────┘    └───────────────┘    └───────────────┘
                              ↓                     ↓
                       ┌───────────────┐    ┌───────────────┐
                       │  需要升级?      │    │  需要升级?      │
                       │  (是/否)       │    │  (是/否)       │
                       └───────────────┘    └───────────────┘
                              ↓                     ↓
                       ┌───────────────────────────────┐
                       │         escalated              │
                       │  (创建通知给 Agent A)          │
                       └───────────────────────────────┘
```

---

## 🎯 关键字段使用总结

### agent_sub_tasks 表新增字段用途

| 字段 | 用途 | 示例值 |
|------|------|---------|
| `dialogueSessionId` | 对话会话 ID | `'session-xxx-123'` |
| `dialogueRounds` | 对话轮数 | `1`, `2`, `3`, ... |
| `dialogueStatus` | 对话状态 | `'none'` \| `'in_progress'` \| `'completed'` \| `'timeout'` |
| `lastDialogueAt` | 最后对话时间 | `2026-02-18 15:30:00` |
| `timeoutHandlingCount` | 超时重试次数 | `0`, `1`, `2`, `3`, ... |
| `escalated` | 是否已升级 | `true` / `false` |
| `escalatedAt` | 升级时间 | `2026-02-18 16:00:00` |
| `escalatedReason` | 升级原因 | `'超时重试 5 次'` |

---

## ✅ 总结

### insurance-d 与 Agent B 交互过程

1. **insurance-d 发起交互**：创建 `agentInteractions` 记录 + 通知 Agent B
2. **Agent B 回复**：添加对话记录 + 通知 insurance-d
3. **多轮交互**：可能多轮来回
4. **对话完成**：继续执行任务

### 上报 Agent A 的时机

| 场景 | 触发条件 |
|------|---------|
| **超时次数过多** | `timeoutHandlingCount >= 5` |
| **对话轮数过多** | `dialogueRounds >= 10` 且 `dialogueStatus = 'in_progress'` |
| **阻塞时间过长** | `status = 'blocked'` 且超过 4 小时 |
| **明确要求升级** | insurance-d 或 Agent B 明确要求 |
| **严重错误** | 遇到无法解决的问题 |

**上报后**：
- 状态设置为 `escalated`
- 创建通知给 Agent A（优先级 `urgent`）
- 等待人工干预

**完整方案已补充！** 🎯

# 用户反馈后执行 Agent 重新执行 - 流程详细分析

## 📋 文档信息
- **版本**: v1.0
- **创建日期**: 2026-03-15
- **核心目标**: 详细分析用户反馈后让执行 Agent 重新执行的完整流程

---

## 🔍 一、关键发现

### ⚠️ 当前问题

**你问得非常对！当前代码中确实存在缺失的逻辑！**

---

## 📊 二、完整流程分析（应该有的流程）

### 2.1 完整流程图（理想状态）

```
waiting_user (等待用户)
    │
    │ [用户在前端提交反馈]
    │
    ▼
1️⃣ API: POST /api/agents/user-decision
    │
    ├─ 接收用户反馈
    ├─ 记录用户交互到 agent_sub_tasks_step_history
    ├─ 状态: waiting_user → in_progress
    └─ 调用 manuallyExecuteInProgressSubtasks()
    │
    ▼
2️⃣ manuallyExecuteInProgressSubtasks()
    │
    └─ 实例化 SubtaskExecutionEngine
       └─ 调用 engine.execute()
    │
    ▼
3️⃣ engine.execute() - 控制器扫描
    │
    ├─ 发现 in_progress 状态的任务
    │
    ▼
4️⃣ ⭐ 关键缺失：检查是否有历史交互记录 ⭐
    │
    ├─ 查询 agent_sub_tasks_step_history
    ├─ 解析历史记录（parseHistoryRecords）
    │   ├─ mcpExecutionHistory
    │   ├─ userInteractions
    │   └─ executorResult
    │
    ▼
5️⃣ executeAgentBDecisionAndMcp()
    │
    ├─ Agent B 根据用户反馈重新决策
    │
    ├─ [决策类型：RE_EXECUTE] ← 新增！
    │   │
    │   ├─ 创建交互记录（response）
    │   ├─ 状态: in_progress → pending
    │   └─ return
    │
    ▼
6️⃣ 等待控制器下次扫描
    │
    ▼
7️⃣ executeExecutorAgentWorkflow()
    │
    └─ 执行 Agent 重新执行任务！
```

---

## 🔌 三、代码入口（已有的部分）

### 3.1 用户反馈 API 入口

**文件**: `src/app/api/agents/user-decision/route.ts`

**关键代码片段**:

```typescript
// 6. 根据决策类型记录用户交互
let interactContent: any;
let interactUser: string;

if (decisionType === 'waiting_user') {
  // 场景2: waiting_user 状态的用户确认
  interactContent = {
    type: 'user_decision',
    decisionType: 'waiting_user_confirm',
    userDecision: userDecision,
    interactionData: interactionData || {},
    timestamp: new Date().toISOString(),
  };
  interactUser = 'human';
}

// 7. 记录到 agent_sub_tasks_step_history 表
await db.insert(agentSubTasksStepHistory).values({
  commandResultId: commandResultId,
  stepNo: subTask.orderIndex,
  interactType: 'response',
  interactContent: interactContent,
  interactUser: interactUser,
  interactTime: new Date(),
  interactNum: nextInteractNum,
});

// 8. 更新子任务状态为 in_progress
await db
  .update(agentSubTasks)
  .set({
    status: 'in_progress',
    updatedAt: new Date(),
  })
  .where(eq(agentSubTasks.id, subTaskId));

// 10. 触发任务继续执行
try {
  // 异步触发，不阻塞 API 响应
  manuallyExecuteInProgressSubtasks().catch(error => {
    console.error('[User Decision] 触发任务执行失败:', error);
  });
} catch (error) {
  console.error('[User Decision] 触发任务执行异常:', error);
}
```

---

### 3.2 手动触发执行入口

**文件**: `src/lib/cron/index.ts`

**关键代码片段**:

```typescript
export async function manuallyExecuteInProgressSubtasks() {
  console.log('🔔 [手动触发] 开始执行 in_progress 子任务...');
  
  try {
    // 1. 实例化子任务执行引擎
    const { SubtaskExecutionEngine } = await import('@/lib/services/subtask-execution-engine');
    const engine = new SubtaskExecutionEngine();
    
    // 2. 执行引擎
    await engine.execute();
    
    console.log('✅ [手动触发] in_progress 子任务执行完成');
  } catch (error) {
    console.error('❌ [手动触发] 执行失败:', error);
    throw error;
  }
}
```

---

### 3.3 解析历史记录的方法（已存在！）

**文件**: `src/lib/services/subtask-execution-engine.ts`

**方法**: `parseHistoryRecords()` (行号: ~2774)

**关键代码片段**:

```typescript
public parseHistoryRecords(
  historyRecords: typeof agentSubTasksStepHistory.$inferSelect[]
): {
  mcpExecutionHistory: McpAttempt[];
  userInteractions: UserInteraction[];
  executorResult: ExecutorAgentResult | null;
} {
  const mcpExecutionHistory: McpAttempt[] = [];
  const userInteractions: UserInteraction[] = [];
  let executorResult: ExecutorAgentResult | null = null;

  for (const record of historyRecords) {
    const content = record.interactContent as any;

    // ========== 解析 executorResult（从第一条记录） ==========
    if (!executorResult && record.interactNum === 1 && content.question?.isNeedMcp !== undefined) {
      executorResult = {
        isNeedMcp: content.question.isNeedMcp,
        problem: content.question.problem,
        capabilityType: content.question.capabilityType,
        executionResult: content.question.executionResult,
        isTaskDown: content.question.isTaskDown,
      };
    }

    // ========== 解析用户交互 ==========
    if (record.interactUser === 'human' && record.interactType === 'response') {
      if (content.type === 'user_decision' || content.type === 'user_interaction') {
        const userInteraction: UserInteraction = {
          interactionId: 'history-' + record.id,
          interactionNumber: record.interactNum || 0,
          timestamp: record.interactTime,
          keyFieldsConfirmed: content.interactionData?.fieldValues ? 
            Object.entries(content.interactionData.fieldValues).map(([fieldId, fieldValue]) => ({
              fieldId,
              fieldName: fieldId,
              fieldValue,
              isModified: true
            })) : [],
          selectedSolution: {
            solutionId: content.interactionData?.selectedSolution || 'default',
            solutionLabel: '用户选择方案',
            solutionDescription: content.userDecision || '',
            selectedAt: record.interactTime
          },
          userComment: content.interactionData?.notes ? {
            content: content.interactionData.notes,
            inputAt: record.interactTime
          } : undefined,
          userInfo: {
            userId: 'human',
            userName: '用户'
          },
          submission: {
            submittedAt: record.interactTime,
            status: 'completed',
            processingTime: 0
          }
        };
        userInteractions.push(userInteraction);
      }
    }
  }

  return {
    mcpExecutionHistory,
    userInteractions,
    executorResult
  };
}
```

---

## ❌ 四、当前缺失的逻辑

### 4.1 缺失 1：执行引擎对 in_progress 状态任务的处理

**文件**: `src/lib/services/subtask-execution-engine.ts`

**问题**: 当前代码在扫描任务时，对于 `in_progress` 状态的任务，只检查超时，**没有**检查是否有用户反馈需要处理！

**当前代码** (行号: ~321):

```typescript
const hasInProgress = currentStepTasks.some(t => t.status === 'in_progress');

if (hasInProgress) {
  console.log('[SubtaskEngine] order_index = ' + orderIndex + ' 有进行中的任务，检查超时...');
  await this.checkAndHandleTimeout(currentStepTasks);
  return;  // ← 直接返回了！没有处理用户反馈！
}
```

**应该修改为**:

```typescript
const hasInProgress = currentStepTasks.some(t => t.status === 'in_progress');

if (hasInProgress) {
  console.log('[SubtaskEngine] order_index = ' + orderIndex + ' 有进行中的任务');
  
  // ⭐ 新增：检查是否有用户反馈的历史记录
  for (const task of currentStepTasks) {
    if (task.status === 'in_progress') {
      // 查询历史交互记录
      const historyRecords = await db
        .select()
        .from(agentSubTasksStepHistory)
        .where(
          and(
            eq(agentSubTasksStepHistory.commandResultId, task.commandResultId),
            eq(agentSubTasksStepHistory.stepNo, task.orderIndex)
          )
        )
        .orderBy(agentSubTasksStepHistory.interactTime);
      
      // 检查是否有用户交互记录
      const hasUserInteraction = historyRecords.some(
        r => r.interactUser === 'human' && r.interactType === 'response'
      );
      
      if (hasUserInteraction) {
        console.log('[SubtaskEngine] 发现用户反馈，继续处理...');
        await this.executeAgentBDecisionAndMcp(task);
        return;
      }
    }
  }
  
  // 如果没有用户反馈，才检查超时
  console.log('[SubtaskEngine] 无用户反馈，检查超时...');
  await this.checkAndHandleTimeout(currentStepTasks);
  return;
}
```

---

### 4.2 缺失 2：`executeAgentBDecisionAndMcp` 方法中读取历史记录

**文件**: `src/lib/services/subtask-execution-engine.ts`

**问题**: 当前的 `executeAgentBDecisionAndMcp` 方法**没有**从历史记录中恢复状态！

**当前代码** (行号: ~650):

```typescript
private async executeAgentBDecisionAndMcp(task: typeof agentSubTasks.$inferSelect) {
  console.log('[SubtaskEngine] ========== 开始 Agent B 决策 + MCP 调用 ==========');
  
  const MAX_ITERATIONS = 5;
  const MAX_MCP_ATTEMPTS_PER_ITERATION = 3;
  
  // 使用公共初始化方法
  const { executorResult, capabilities } = await this.initializeExecutionContext(task);
  
  if (!executorResult) {
    return;
  }

  // 执行主循环
  await this.executeDecisionLoop(
    task,
    executorResult,
    capabilities,
    MAX_ITERATIONS,
    MAX_MCP_ATTEMPTS_PER_ITERATION
  );
}
```

**应该修改为** (参考备份文件中的逻辑):

```typescript
private async executeAgentBDecisionAndMcp(task: typeof agentSubTasks.$inferSelect) {
  console.log('[SubtaskEngine] ========== 开始 Agent B 决策 + MCP 调用 ==========');
  console.log(`[SubtaskEngine] 任务: ${task.taskTitle}`);

  const MAX_ITERATIONS = 5;
  const MAX_MCP_ATTEMPTS_PER_ITERATION = 3;
  let currentIteration = 0;
  let mcpExecutionHistory: McpAttempt[] = [];
  let userInteractions: UserInteraction[] = [];
  let executorResult: ExecutorAgentResult | null = null;
  let capabilities: any[] = [];

  try {
    // ========== ⭐ 首先检查是否有历史交互记录 ==========
    console.log('[SubtaskEngine] 检查历史交互记录...');
    const historyRecords = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(
        and(
          eq(agentSubTasksStepHistory.commandResultId, task.commandResultId),
          eq(agentSubTasksStepHistory.stepNo, task.orderIndex)
        )
      )
      .orderBy(agentSubTasksStepHistory.interactTime);

    console.log(`[SubtaskEngine] 找到 ${historyRecords.length} 条历史记录`);

    let hasHistory = historyRecords.length > 0;
    
    if (hasHistory) {
      console.log('[SubtaskEngine] 从历史记录恢复状态...');
      
      // ========== 解析历史记录 ==========
      const parsedHistory = this.parseHistoryRecords(historyRecords);
      mcpExecutionHistory = parsedHistory.mcpExecutionHistory;
      userInteractions = parsedHistory.userInteractions;
      executorResult = parsedHistory.executorResult;
      
      console.log('[SubtaskEngine] 恢复历史: ' + mcpExecutionHistory.length + ' 次MCP执行, ' + userInteractions.length + ' 次用户交互');
    }

    // ========== 如果没有历史，从头开始 ==========
    if (!hasHistory) {
      // 使用公共初始化方法
      const initResult = await this.initializeExecutionContext(task);
      executorResult = initResult.executorResult;
      capabilities = initResult.capabilities;
      
      if (!executorResult) {
        return;
      }
    } else {
      // 如果有历史，查询 capability_list
      if (executorResult?.capabilityType) {
        console.log('[SubtaskEngine] 从历史恢复，查询 capability_list');
        capabilities = await this.queryCapabilityList(executorResult.capabilityType);
      }
    }

    // 执行主循环（传入恢复的历史数据）
    await this.executeDecisionLoop(
      task,
      executorResult,
      capabilities,
      mcpExecutionHistory,  // ⭐ 传入
      userInteractions,      // ⭐ 传入
      MAX_ITERATIONS,
      MAX_MCP_ATTEMPTS_PER_ITERATION
    );

  } catch (error) {
    console.error('[SubtaskEngine] Agent B 决策 + MCP 调用失败:', error);
    throw error;
  }
}
```

---

### 4.3 缺失 3：`executeDecisionLoop` 方法需要支持传入历史数据

**文件**: `src/lib/services/subtask-execution-engine.ts`

**问题**: 当前的 `executeDecisionLoop` 方法不支持传入历史数据，需要修改方法签名。

**当前方法签名**:

```typescript
private async executeDecisionLoop(
  task: typeof agentSubTasks.$inferSelect,
  executorResult: ExecutorAgentResult,
  capabilities: any[],
  maxIterations: number,
  maxMcpAttempts: number
)
```

**应该修改为**:

```typescript
private async executeDecisionLoop(
  task: typeof agentSubTasks.$inferSelect,
  executorResult: ExecutorAgentResult,
  capabilities: any[],
  initialMcpExecutionHistory: McpAttempt[] = [],  // ⭐ 新增
  initialUserInteractions: UserInteraction[] = [],    // ⭐ 新增
  maxIterations: number,
  maxMcpAttempts: number
) {
  let currentIteration = 0;
  let mcpExecutionHistory: McpAttempt[] = initialMcpExecutionHistory;  // ⭐ 使用传入的
  let userInteractions: UserInteraction[] = initialUserInteractions;      // ⭐ 使用传入的
  
  // ... 其余逻辑不变
}
```

---

### 4.4 缺失 4：新增 `RE_EXECUTE` 决策类型处理

**文件**: `src/lib/services/subtask-execution-engine.ts`

**问题**: 当前代码中没有处理 `RE_EXECUTE` 决策类型的逻辑。

**需要新增**:

```typescript
case 'RE_EXECUTE':
  await this.handleReExecuteDecision(task, agentBDecision, executorResult, mcpExecutionHistory, userInteractions, currentIteration);
  return false;
```

**新增方法**:

```typescript
private async handleReExecuteDecision(
  task: typeof agentSubTasks.$inferSelect,
  decision: AgentBDecision,
  executorResult: ExecutorAgentResult,
  mcpExecutionHistory: McpAttempt[],
  userInteractions: UserInteraction[],
  iteration: number
) {
  console.log('[SubtaskEngine] 处理RE_EXECUTE决策（让执行Agent重新执行）');

  // 1. 创建交互记录（response）
  await this.createInteractionStep(
    task.commandResultId,
    task.orderIndex,
    'response',
    iteration,
    'agent B',
    {
      interact_type: 'response',
      consultant: task.fromParentsExecutor,
      responder: 'agent B',
      question: '根据用户反馈，要求执行Agent重新执行',
      response: {
        decision: {
          type: decision.type,
          reason_code: decision.reasonCode,
          reasoning: decision.reasoning,
          re_execute_instruction: decision.data?.reExecuteInstruction,
        },
        mcp_attempts: mcpExecutionHistory,
        user_interactions: userInteractions,
      },
      execution_result: { status: 're_execute' },
      ext_info: {
        step: 'agent_b_decision_re_execute',
        iteration,
      }
    }
  );

  // 2. 更新任务状态为 pending
  console.log('[SubtaskEngine] 更新任务状态为 pending，让执行Agent重新执行');
  await db
    .update(agentSubTasks)
    .set({
      status: 'pending',
      updatedAt: getCurrentBeijingTime(),
      startedAt: null,  // 清除 startedAt
      // 可选：保存重新执行指令到 executionResult
      executionResult: decision.data?.reExecuteInstruction ? 
        JSON.stringify({ reExecuteInstruction: decision.data.reExecuteInstruction }) : 
        task.executionResult,
    })
    .where(eq(agentSubTasks.id, task.id));

  console.log('[SubtaskEngine] 任务已标记为重新执行: ' + task.id);
}
```

---

## 📝 五、总结

### 5.1 当前已有的代码 ✅

| 功能 | 状态 | 文件 |
|------|------|------|
| 用户反馈 API | ✅ | `src/app/api/agents/user-decision/route.ts` |
| 手动触发执行 | ✅ | `src/lib/cron/index.ts` |
| 解析历史记录方法 | ✅ | `src/lib/services/subtask-execution-engine.ts` |
| 用户交互数据结构 | ✅ | 已定义 |

### 5.2 当前缺失的代码 ❌

| 功能 | 优先级 | 说明 |
|------|--------|------|
| 执行引擎处理 in_progress 状态的用户反馈 | 🔴 高 | 需要检查历史记录 |
| `executeAgentBDecisionAndMcp` 恢复历史状态 | 🔴 高 | 需要读取历史记录 |
| `executeDecisionLoop` 支持传入历史数据 | 🟡 中 | 修改方法签名 |
| 新增 `RE_EXECUTE` 决策类型处理 | 🔴 高 | 让执行 Agent 重新执行 |

---

## 🎯 六、快速验证

### 6.1 验证用户反馈是否被记录

```sql
-- 查询用户反馈记录
SELECT * FROM agent_sub_tasks_step_history 
WHERE interact_user = 'human' 
ORDER BY interact_time DESC 
LIMIT 10;
```

### 6.2 验证任务状态是否更新

```sql
-- 查询 in_progress 状态的任务
SELECT id, task_title, status, started_at, updated_at 
FROM agent_sub_tasks 
WHERE status = 'in_progress'
ORDER BY updated_at DESC 
LIMIT 10;
```

---

**文档结束**

*本分析文档基于当前代码实现与备份文件对比分析得出。*

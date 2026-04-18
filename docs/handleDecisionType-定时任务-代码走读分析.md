# handleDecisionType 与定时任务执行逻辑 - 代码走读分析

## 📋 概述

本文档详细分析 `handleDecisionType` 方法、定时任务执行逻辑，以及通过 `order_index = 1、2、3` 走读整个代码流程。

---

## 🔧 一、handleDecisionType 方法详解

### 1.1 方法位置与调用链

```
文件: src/lib/services/subtask-execution-engine.ts
行号: 1615

调用链:
executeDecisionLoop()
  ↓
callAgentBWithDecision() → 获取 Agent B 决策
  ↓
handleDecisionType() ← 本文档重点
  ↓
返回 shouldContinue (boolean)
```

### 1.2 方法签名

```typescript
private async handleDecisionType(
  task: typeof agentSubTasks.$inferSelect,           // 当前子任务
  agentBDecision: AgentBDecision,                      // Agent B 决策
  executorResult: ExecutorAgentResult,                  // 执行 Agent 结果
  capabilities: any[],                                   // 可用能力列表
  mcpExecutionHistory: McpAttempt[],                    // MCP 执行历史
  userInteractions: UserInteraction[],                   // 用户交互历史
  currentIteration: number,                              // 当前迭代次数
  maxIterations: number,                                 // 最大迭代次数
  maxMcpAttempts: number                                 // 最大 MCP 尝试次数
): Promise<boolean>
```

### 1.3 决策类型处理分支

#### ✅ 1.3.1 COMPLETE - 任务完成

```typescript
case 'COMPLETE':
  await this.handleCompleteDecision(
    task, 
    agentBDecision, 
    executorResult, 
    mcpExecutionHistory, 
    userInteractions, 
    currentIteration
  );
  return false;  // 不继续循环，任务结束
```

**处理逻辑：**
- 调用 `handleCompleteDecision()` 标记任务完成
- 更新数据库状态为 `completed`
- 记录最终交互信息
- **返回 `false`** - 终止决策循环

---

#### 👤 1.3.2 NEED_USER - 需要用户介入

```typescript
case 'NEED_USER':
  await this.handleNeedUserDecision(
    task, 
    agentBDecision, 
    executorResult, 
    mcpExecutionHistory, 
    userInteractions, 
    currentIteration
  );
  return false;  // 等待用户反馈后重新触发
```

**处理逻辑：**
- 调用 `handleNeedUserDecision()` 标记等待用户
- 更新数据库状态为 `waiting_user`
- 保存 `pendingKeyFields`、`availableSolutions`、`promptMessage`
- **返回 `false`** - 终止决策循环，等待用户反馈后重新触发

---

#### ❌ 1.3.3 FAILED - 任务失败

```typescript
case 'FAILED':
  await this.handleFailedDecision(
    task, 
    agentBDecision, 
    executorResult, 
    mcpExecutionHistory, 
    userInteractions, 
    currentIteration
  );
  return false;  // 任务失败，结束流程
```

**处理逻辑：**
- 调用 `handleFailedDecision()` 标记任务失败
- 更新数据库状态为 `failed`
- 记录失败原因和错误信息
- **返回 `false`** - 终止决策循环

---

#### 🔄 1.3.4 REEXECUTE_EXECUTOR - 重新执行执行 Agent

```typescript
case 'REEXECUTE_EXECUTOR':
  console.log('[SubtaskEngine] Agent B 决策 REEXECUTE_EXECUTOR，重新执行执行 Agent');
  
  // 1. 记录 Agent B 的交互
  await this.recordAgentInteraction(
    task.commandResultId,
    task.orderIndex,
    'agent B',
    executorResult,
    'REEXECUTE_EXECUTOR',
    agentBDecision,
    task.id,
    currentIteration
  );
  
  // 2. 获取同组所有任务（用于智能选择前序信息）
  const allTasksInGroupForReExecution = await db
    .select()
    .from(agentSubTasks)
    .where(eq(agentSubTasks.commandResultId, task.commandResultId))
    .orderBy(agentSubTasks.orderIndex);
  
  // 3. 调用 sendBackToExecutor 重新执行执行 Agent
  await this.sendBackToExecutor(
    task,
    executorResult,
    agentBDecision,
    undefined,  // mcpResult
    mcpExecutionHistory,
    userInteractions,
    allTasksInGroupForReExecution
  );
  
  // 4. 继续循环，让 Agent B 再次决策
  console.log('[SubtaskEngine] 执行 Agent 重新执行完成，继续下一轮决策');
  return true;  // 继续循环
```

**处理逻辑：**
- 记录 Agent B 的 `REEXECUTE_EXECUTOR` 决策
- 获取同组所有任务用于智能选择前序信息
- 调用 `sendBackToExecutor()` 让执行 Agent 重新执行
- **返回 `true`** - 继续决策循环

---

#### 🛠️ 1.3.5 EXECUTE_MCP - 执行 MCP（技术任务）

```typescript
case 'EXECUTE_MCP':
  console.log('[SubtaskEngine] Agent B 决策 EXECUTE_MCP，调用 Agent T（技术专家）');
  
  // 1. 记录 Agent B 的决策
  await this.recordAgentInteraction(
    task.commandResultId,
    task.orderIndex,
    'agent B',
    executorResult,
    'EXECUTE_MCP',
    agentBDecision,
    task.id
  );
  
  // 2. 调用 Agent T（技术专家）处理技术任务
  const agentTDecision = await this.callAgentTTechExpert(
    task,
    // 重新构建 executionContext 传给 Agent T
    await this.buildExecutionContext(
      task,
      executorResult,
      capabilities,
      mcpExecutionHistory,
      userInteractions,
      currentIteration,
      maxIterations
    ),
    capabilities
  );
  
  // 3. 关键：Agent T 返回的格式同 Agent B，直接用这个决策继续执行
  console.log('[SubtaskEngine] 使用 Agent T 的决策继续执行');
  
  // 4. 执行 MCP（支持多次尝试）
  const mcpSuccess = await this.executeMcpWithRetry(
    task,
    agentTDecision,  // 使用 Agent T 的决策
    executorResult,
    capabilities,
    mcpExecutionHistory,
    userInteractions,
    maxMcpAttempts,
    currentIteration
  );

  if (mcpSuccess) {
    // MCP 执行成功，继续下一轮决策让 Agent B 判断是否完成
    console.log('[SubtaskEngine] MCP 执行成功，继续下一轮决策');
    return true;
  } else {
    // MCP 多次尝试都失败，Agent B 会在下一轮决策中处理
    console.log('[SubtaskEngine] MCP 多次尝试失败，继续下一轮决策');
    return true;
  }
```

**处理逻辑：**
- 记录 Agent B 的 `EXECUTE_MCP` 决策
- 调用 `callAgentTTechExpert()` 获取 Agent T（技术专家）决策
- Agent T 返回格式与 Agent B 相同
- 调用 `executeMcpWithRetry()` 执行 MCP（支持多次重试）
- **返回 `true`** - 无论 MCP 成功或失败，都继续决策循环

---

#### ⚠️ 1.3.6 默认分支 - 未知决策类型

```typescript
default:
  console.warn('[SubtaskEngine] 未知的决策类型，视为 NEED_USER:', agentBDecision.type);
  
  // 未知决策类型时，转为 NEED_USER 让用户决定
  const fallbackDecision: AgentBDecision = {
    type: 'NEED_USER',
    reasonCode: 'USER_CONFIRM',
    reasoning: `Agent B返回了未知的决策类型(${agentBDecision.type})，需要您确认下一步操作。`,
    context: {
      executionSummary: 'Agent B返回了未知的决策类型，需要用户确认下一步操作。',
      riskLevel: 'medium',
      suggestedAction: '请确认下一步操作'
    },
    data: {
      promptMessage: {
        title: '需要您的确认',
        description: `Agent B返回了未知的决策类型，需要您确认下一步操作。原始决策信息：${JSON.stringify(agentBDecision)}`
      }
    }
  };
  
  await this.handleNeedUserDecision(
    task, 
    fallbackDecision, 
    executorResult, 
    mcpExecutionHistory, 
    userInteractions, 
    currentIteration
  );
  return false;
```

**处理逻辑：**
- 检测到未知决策类型时，降级为 `NEED_USER`
- 构造 fallback 决策，提示用户确认
- 调用 `handleNeedUserDecision()` 处理
- **返回 `false`** - 终止决策循环

---

## ⏰ 二、定时任务执行逻辑

### 2.1 定时任务调度器

**文件位置:** `src/lib/cron/scheduler.ts`

#### 2.1.1 定时任务配置

```typescript
export const CRON_JOBS = {
  // 每 2 分钟执行 in_progress 子任务（使用新的 SubtaskExecutionEngine）
  EXECUTE_IN_PROGRESS_SUBTASKS: {
    name: 'execute-in-progress-subtasks',
    schedule: '*/2 * * * *',  // 每 2 分钟执行一次
    endpoint: '/api/cron/execute-in-progress-subtasks',
    description: '执行 in_progress 状态的子任务',
  },
  
  // 每天 0 点 1 分监控超时任务
  MONITOR_SUBTASKS_TIMEOUT: {
    name: 'monitor-subtasks-timeout',
    schedule: '1 0 * * *',  // 每天 0 点 1 分执行一次
    endpoint: '/api/cron/monitor-subtasks-timeout',
    description: '监控超时任务并触发反馈流程',
  },
  
  // 每天 0 点 2 分上报未解决问题
  ESCALATE_UNRESOLVED_ISSUES: {
    name: 'escalate-unresolved-issues',
    schedule: '2 0 * * *',  // 每天 0 点 2 分执行一次
    endpoint: '/api/cron/escalate-unresolved-issues',
    description: '上报未解决的问题给 Agent A',
  },
};
```

#### 2.1.2 内存锁机制（防止重叠执行）

```typescript
/**
 * 内存锁：防止定时任务重叠执行
 */
const endpointLocks = new Map<string, boolean>();

async function callEndpoint(endpoint: string): Promise<void> {
  // 1. 检查锁：如果该端点正在执行中，跳过本次调用
  if (endpointLocks.get(endpoint)) {
    console.log(`⏭️  定时任务跳过 [${endpoint}]: 前一次执行尚未完成`);
    return;
  }

  // 2. 加锁：标记该端点开始执行
  endpointLocks.set(endpoint, true);
  console.log(`🔒 定时任务开始执行 [${endpoint}]`);

  try {
    // 3. 原有的调用逻辑
    const response = await fetch(`http://localhost:5000${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ 定时任务调用失败 [${endpoint}]: ${error}`);
    } else {
      const data = await response.json();
      console.log(`✅ 定时任务执行成功 [${endpoint}]:`, data.message || 'OK');
    }
  } catch (error) {
    console.error(`❌ 定时任务调用异常 [${endpoint}]:`, error);
  } finally {
    // 4. 释放锁：无论成功失败，都释放锁
    endpointLocks.set(endpoint, false);
    console.log(`🔓 定时任务执行结束 [${endpoint}]`);
  }
}
```

**内存锁机制关键点：**
1. **加锁前检查**：执行前检查是否已有任务在运行
2. **立即加锁**：检查通过后立即加锁
3. **finally 释放**：无论成功失败，都在 finally 块中释放锁
4. **跳过机制**：如果锁被占用，直接跳过本次执行

---

### 2.2 执行 in_progress 状态任务的定时任务

**API 端点:** `POST /api/cron/execute-in-progress-subtasks`

**文件位置:** `src/app/api/cron/execute-in-progress-subtasks/route.ts`

```typescript
export async function POST(request: NextRequest) {
  try {
    console.log('🔔 手动触发执行 in_progress 子任务...');
    await manuallyExecuteInProgressSubtasks();
    return NextResponse.json({
      success: true,
      message: 'in_progress 子任务执行已完成',
    });
  } catch (error) {
    console.error('❌ 执行 in_progress 子任务失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '执行失败',
      },
      { status: 500 }
    );
  }
}
```

---

## 🔄 三、通过 order_index = 1、2、3 走读代码

### 3.1 完整流程示例场景

假设有一个包含 3 个子任务的任务：
- `order_index = 1`: 任务规划（执行者：insurance-d）
- `order_index = 2`: 文章生产（执行者：insurance-d）
- `order_index = 3`: 合规校验（执行者：insurance-d）

---

### 3.2 order_index = 1 的完整走读

#### 3.2.1 初始状态

```
数据库状态:
- agent_sub_tasks 表:
  id: uuid-1
  commandResultId: command-result-1
  orderIndex: 1
  status: 'pending'  ← 初始状态
  taskTitle: '任务规划'
```

#### 3.2.2 定时任务触发（每 2 分钟）

```
时间线: T0
─────────────────────────────────────────

1. 定时任务调度器触发
   CRON_JOBS.EXECUTE_IN_PROGRESS_SUBTASKS
   schedule: '*/2 * * * *'

2. 调用 API 端点
   POST /api/cron/execute-in-progress-subtasks

3. 查询数据库
   SELECT * FROM agent_sub_tasks
   WHERE status IN ('pending', 'in_progress')
   AND commandResultId = 'command-result-1'
   ORDER BY orderIndex

   ↓ 找到:
   [
     { orderIndex: 1, status: 'pending' },
     { orderIndex: 2, status: 'pending' },
     { orderIndex: 3, status: 'pending' }
   ]
```

#### 3.2.3 处理 order_index = 1（pending 状态）

```
时间线: T1
─────────────────────────────────────────

executeExecutorAgentWorkflow(task)
  ↓
1. 状态检查
   if (task.status === 'pending') {
     // 更新为 in_progress
     await db.update(agentSubTasks)
       .set({ status: 'in_progress' })
       .where(eq(agentSubTasks.id, task.id));
   }

2. 调用执行 Agent（insurance-d）
   const executorResult = await callExecutorAgent(task);
   
   ↓ 执行 Agent 返回:
   {
     status: 'pre_completed',
     result: { /* 规划结果 */ }
   }

3. 更新状态为 pre_completed
   await db.update(agentSubTasks)
     .set({ 
       status: 'pre_completed',
       resultText: JSON.stringify(executorResult.result)
     })
     .where(eq(agentSubTasks.id, task.id));

4. 调用 Agent B 评审
   executeAgentBReviewWorkflow(task, executorResult)
     ↓
     Agent B 决策: { type: 'COMPLETE' }
     ↓
     handleDecisionType(task, { type: 'COMPLETE' }, ...)
       ↓
       handleCompleteDecision(...)
         ↓
         更新状态为 'completed'

5. order_index = 1 完成！
```

#### 3.2.4 handleDecisionType 处理 COMPLETE 决策

```typescript
case 'COMPLETE':
  await this.handleCompleteDecision(
    task, 
    agentBDecision, 
    executorResult, 
    mcpExecutionHistory, 
    userInteractions, 
    currentIteration
  );
  return false;  // 不继续循环
```

**handleCompleteDecision 内部逻辑：**
```
1. 记录最终交互
   recordAgentInteraction(...)

2. 标记任务完成
   markTaskCompleted(task, {
     mcpResult: ...,
     completionType: 'complete',
     message: '任务完成'
   })

3. 更新数据库
   UPDATE agent_sub_tasks
   SET status = 'completed',
       resultText = '...',
       completedAt = NOW()
   WHERE id = 'uuid-1'

4. 更新主任务进度
   updateDailyTaskProgress(...)
```

---

### 3.3 order_index = 2 的完整走读

#### 3.3.1 初始状态（order_index = 1 已完成）

```
数据库状态:
- agent_sub_tasks 表:
  id: uuid-1, orderIndex: 1, status: 'completed' ✓
  id: uuid-2, orderIndex: 2, status: 'pending'   ← 待处理
  id: uuid-3, orderIndex: 3, status: 'pending'
```

#### 3.3.2 定时任务再次触发（2 分钟后）

```
时间线: T2（T0 + 2 分钟）
─────────────────────────────────────────

1. 定时任务调度器再次触发
   EXECUTE_IN_PROGRESS_SUBTASKS

2. 查询数据库
   SELECT * FROM agent_sub_tasks
   WHERE status IN ('pending', 'in_progress')
   AND commandResultId = 'command-result-1'
   ORDER BY orderIndex

   ↓ 找到:
   [
     { orderIndex: 1, status: 'completed' },  ← 跳过
     { orderIndex: 2, status: 'pending' },    ← 处理
     { orderIndex: 3, status: 'pending' }
   ]

3. 选择第一个 pending 任务（order_index = 2）
```

#### 3.3.3 处理 order_index = 2（需要 MCP 协助）

```
时间线: T3
─────────────────────────────────────────

executeExecutorAgentWorkflow(task)
  ↓
1. pending → in_progress

2. 调用执行 Agent（insurance-d）
   const executorResult = await callExecutorAgent(task);
   
   ↓ 执行 Agent 返回:
   {
     status: 'pre_need_support',  ← 需要帮助！
     result: { /* 需要 MCP 生成文章 */ }
   }

3. 更新状态为 pre_need_support
   await db.update(agentSubTasks)
     .set({ status: 'pre_need_support' })
     .where(eq(agentSubTasks.id, task.id));

4. 调用 Agent B 评审
   executeAgentBReviewWorkflow(task, executorResult)
     ↓
     Agent B 决策: { type: 'EXECUTE_MCP' }  ← 执行 MCP！
     ↓
     handleDecisionType(task, { type: 'EXECUTE_MCP' }, ...)
       ↓
       case 'EXECUTE_MCP':
         // 1. 记录决策
         recordAgentInteraction(...)
         
         // 2. 调用 Agent T（技术专家）
         const agentTDecision = await callAgentTTechExpert(...)
         
         // 3. 执行 MCP（支持重试）
         const mcpSuccess = await executeMcpWithRetry(
           task,
           agentTDecision,
           ...,
           maxMcpAttempts = 3  // 最多重试 3 次
         )
         
         // 4. MCP 执行成功，继续循环
         return true;  // 继续决策循环！
```

#### 3.3.4 handleDecisionType 处理 EXECUTE_MCP（继续循环）

```typescript
case 'EXECUTE_MCP':
  // ... 执行 MCP ...
  
  if (mcpSuccess) {
    console.log('[SubtaskEngine] MCP 执行成功，继续下一轮决策');
    return true;  // ← 关键：返回 true，继续循环！
  } else {
    console.log('[SubtaskEngine] MCP 多次尝试失败，继续下一轮决策');
    return true;  // ← 即使失败也继续循环！
  }
```

**决策循环继续：**
```
executeDecisionLoop() 中的循环:
┌─────────────────────────────────────────┐
│ while (currentIteration < maxIterations) │ ← 循环！
│   ↓                                     │
│   callAgentBWithDecision()              │
│   ↓                                     │
│   handleDecisionType()                  │
│   ↓                                     │
│   if (!shouldContinue) break;           │ ← 返回 false 才会 break
│                                          │
│   currentIteration++                    │
└─────────────────────────────────────────┘
```

#### 3.3.5 下一轮决策循环（MCP 执行后）

```
时间线: T4
─────────────────────────────────────────

决策循环继续（currentIteration = 2）:
  ↓
1. 再次调用 Agent B
   agentBDecision = await callAgentBWithDecision(...)
   
   ↓ Agent B 看到 MCP 结果，决策:
   {
     type: 'COMPLETE',  ← MCP 执行成功，任务完成！
     reasonCode: 'TASK_DONE',
     reasoning: '文章已成功生成'
   }

2. handleDecisionType(task, { type: 'COMPLETE' }, ...)
   ↓
   handleCompleteDecision(...)
     ↓
     更新状态为 'completed'

3. order_index = 2 完成！
   return false;  // 终止循环
```

---

### 3.4 order_index = 3 的完整走读

#### 3.4.1 初始状态（order_index = 1、2 已完成）

```
数据库状态:
- agent_sub_tasks 表:
  id: uuid-1, orderIndex: 1, status: 'completed' ✓
  id: uuid-2, orderIndex: 2, status: 'completed' ✓
  id: uuid-3, orderIndex: 3, status: 'pending'   ← 待处理
```

#### 3.4.2 前序信息提取（order_index = 3 执行时）

**关键：使用 precedent-info-extractor.ts 提取前序信息！**

```
时间线: T5
─────────────────────────────────────────

执行 order_index = 3 之前:
  ↓
1. 提取前序任务结果（order_index < 3）
   const previousTaskResults = await extractor.extractPreviousTaskResults(
     commandResultId: 'command-result-1',
     currentOrderIndex: 3
   )
   
   ↓ 返回:
   [
     {
       orderIndex: 1,
       taskTitle: '任务规划',
       resultText: '规划结果...',
       taskId: 'uuid-1'
     },
     {
       orderIndex: 2,
       taskTitle: '文章生产',
       resultText: '文章内容...',
       taskId: 'uuid-2'
     }
   ]

2. 提取当前 MCP 执行结果（如果有）
   const mcpExecutionResult = await extractor.extractMcpExecutionResult(
     commandResultId: 'command-result-1',
     orderIndex: 3
   )

3. 提取用户反馈
   const userFeedbacks = await extractor.extractUserFeedbacks(
     commandResultId: 'command-result-1',
     orderIndex: 3
   )

4. 智能选择最重要的信息
   const selectedInfo = await extractor.selectImportantInfoWithLLM(
     {
       previousTaskResults,
       mcpExecutionResult,
       userFeedbacks,
       currentTask: {
         taskTitle: '合规校验',
         orderIndex: 3
       }
     },
     executorAgentId: 'insurance-d'
   )
   
   ↓ selectedInfo 会被传递给执行 Agent！
```

#### 3.4.3 处理 order_index = 3（需要用户确认）

```
时间线: T6
─────────────────────────────────────────

executeExecutorAgentWorkflow(task)
  ↓
1. pending → in_progress

2. 调用执行 Agent（insurance-d）
   const executorResult = await callExecutorAgent(
     task,
     selectedInfo  // ← 包含前序信息！
   );
   
   ↓ 执行 Agent 返回:
   {
     status: 'pre_completed',
     result: { /* 合规校验通过 */ }
   }

3. 更新状态为 pre_completed

4. 调用 Agent B 评审
   executeAgentBReviewWorkflow(task, executorResult)
     ↓
     Agent B 决策: { type: 'NEED_USER' }  ← 需要用户确认！
     ↓
     handleDecisionType(task, { type: 'NEED_USER' }, ...)
       ↓
       handleNeedUserDecision(...)
         ↓
         更新状态为 'waiting_user'
         保存 pendingKeyFields
         
       return false;  // 终止循环，等待用户

5. order_index = 3 等待用户反馈！
```

#### 3.4.4 handleDecisionType 处理 NEED_USER（等待用户）

```typescript
case 'NEED_USER':
  await this.handleNeedUserDecision(
    task, 
    agentBDecision, 
    executorResult, 
    mcpExecutionHistory, 
    userInteractions, 
    currentIteration
  );
  return false;  // ← 关键：返回 false，终止循环！
```

**用户反馈后重新触发：**
```
用户提交反馈后:
  ↓
1. API 端点处理用户反馈
   POST /api/agents/[id]/feedback

2. 更新状态为 'pending'
   await db.update(agentSubTasks)
     .set({ status: 'pending' })
     .where(eq(agentSubTasks.id, task.id));

3. 下次定时任务触发时（最多 2 分钟后）
   order_index = 3 会再次被处理！
```

---

## 📊 四、代码复制分析

### 4.1 是否存在代码复制？

**分析结论：不存在重复代码，逻辑清晰分离！**

| 功能模块 | 处理状态 | 方法 | 是否独立 |
|---------|---------|------|---------|
| 处理 pending 状态 | `pending` | `handlePendingStatus()` | ✅ 独立 |
| 执行 Agent 工作流 | `pending` → `in_progress` → `pre_completed/pre_need_support` | `executeExecutorAgentWorkflow()` | ✅ 独立 |
| Agent B 评审工作流 | `pre_completed/pre_need_support` | `executeAgentBReviewWorkflow()` | ✅ 独立 |
| Agent B 决策 + MCP 调用 | 各种决策类型 | `executeAgentBDecisionAndMcp()` | ✅ 独立 |
| 处理决策类型 | 各种决策类型 | `handleDecisionType()` | ✅ 独立 |

### 4.2 通过 order_index 区分处理逻辑

**关键设计：使用 order_index 天然区分不同任务阶段！**

```
order_index = 1:
  - 任务规划阶段
  - 可能不需要前序信息（第一个任务）
  - 执行逻辑相对简单

order_index = 2:
  - 文章生产阶段
  - 需要 order_index = 1 的结果作为前序信息
  - 可能需要 MCP 协助
  - 更复杂的执行逻辑

order_index = 3:
  - 合规校验阶段
  - 需要 order_index = 1、2 的结果作为前序信息
  - 可能需要用户确认
  - 最复杂的执行逻辑
```

**相同的代码，不同的数据：**
```typescript
// 相同的 handleDecisionType 方法
private async handleDecisionType(
  task: typeof agentSubTasks.$inferSelect,  // ← task.orderIndex 不同！
  agentBDecision: AgentBDecision,
  ...
) {
  // 相同的代码逻辑
  // 但因为 task.orderIndex 不同，行为自然不同！
  
  switch (agentBDecision.type) {
    case 'COMPLETE':
      // order_index = 1、2、3 都可能进入这里
      // 但 task.orderIndex 不同，后续处理的上下文不同
      ...
  }
}
```

---

## 🎯 五、关键总结

### 5.1 handleDecisionType 的返回值语义

| 返回值 | 语义 | 后续行为 | 典型场景 |
|-------|------|---------|---------|
| `true` | 继续决策循环 | 再次调用 Agent B 决策 | EXECUTE_MCP、REEXECUTE_EXECUTOR |
| `false` | 终止决策循环 | 结束当前任务处理 | COMPLETE、NEED_USER、FAILED |

### 5.2 定时任务执行状态

| 状态 | 定时任务处理 | 说明 |
|------|------------|------|
| `pending` | ✅ 处理 | 初始状态，开始执行 |
| `in_progress` | ✅ 处理 | 执行中状态，继续执行 |
| `pre_completed` | ❌ 跳过 | 等待 Agent B 评审 |
| `pre_need_support` | ❌ 跳过 | 等待 Agent B 评审 |
| `waiting_user` | ❌ 跳过 | 等待用户反馈 |
| `completed` | ❌ 跳过 | 已完成 |
| `failed` | ❌ 跳过 | 已失败 |

### 5.3 order_index 走读的核心要点

1. **天然区分**：order_index 天然区分不同任务阶段，无需重复代码
2. **前序信息**：order_index > 1 时，使用 precedent-info-extractor 提取前序信息
3. **决策循环**：handleDecisionType 返回 true 时继续循环，返回 false 时终止
4. **定时触发**：每 2 分钟定时扫描 pending 和 in_progress 状态任务
5. **内存锁**：防止同一任务重叠执行

---

## 📝 六、相关文件索引

| 文件路径 | 说明 |
|---------|------|
| `src/lib/services/subtask-execution-engine.ts` | 子任务执行引擎（包含 handleDecisionType） |
| `src/lib/utils/precedent-info-extractor.ts` | 前序信息提取工具 |
| `src/lib/cron/scheduler.ts` | 定时任务调度器 |
| `src/app/api/cron/execute-in-progress-subtasks/route.ts` | 执行 in_progress 任务的 API 端点 |
| `docs/子任务执行引擎-完整流程架构梳理.md` | 子任务执行引擎架构文档 |


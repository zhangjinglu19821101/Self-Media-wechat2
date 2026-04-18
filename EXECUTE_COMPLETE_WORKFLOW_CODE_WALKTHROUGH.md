# executeCompleteWorkflow 方法代码梳理

## 📋 方法概述

**方法名**: `executeCompleteWorkflow`  
**位置**: `src/lib/services/subtask-execution-engine.ts`  
**作用**: 执行完整的子任务工作流程，协调执行Agent、Agent B 和 MCP 能力

---

## 🔍 逐行代码业务含义

### 1. 初始化部分

```typescript
private async executeCompleteWorkflow(task: typeof agentSubTasks.$inferSelect) {
  // 业务含义：开始执行完整工作流程，打印日志标记
  console.log('[SubtaskEngine] ========== 开始完整工作流程（智能决策模式） ==========');
  
  // 业务含义：打印当前处理的任务标题，便于追踪
  console.log(`[SubtaskEngine] 任务: ${task.taskTitle}`);

  // 业务含义：定义最大迭代次数，防止无限循环，最多5次决策
  const MAX_ITERATIONS = 5;
  
  // 业务含义：定义单次循环中最多尝试多少次 MCP 调用，最多3次
  const MAX_MCP_ATTEMPTS_PER_ITERATION = 3;
  
  // 业务含义：初始化当前迭代次数计数器，从0开始
  let currentIteration = 0;
  
  // 业务含义：初始化 MCP 执行历史数组，用于记录所有 MCP 调用记录
  let mcpExecutionHistory: McpAttempt[] = [];
  
  // 业务含义：初始化用户交互记录数组，用于记录用户的反馈和操作
  let userInteractions: UserInteraction[] = [];
```

---

### 2. 阶段1：执行Agent能力边界判定

```typescript
  try {
    // 业务含义：打印日志标记，进入第一阶段
    console.log('[SubtaskEngine] 阶段1：执行Agent能力边界判定');

    // 业务含义：调用执行Agent（如 insurance-d）进行任务分析
    // 执行Agent负责：
    // 1. 分析任务内容
    // 2. 判断是否需要调用 MCP
    // 3. 建议使用哪种 MCP 能力
    // 4. 输出问题描述和建议
    const executorResult = await this.callExecutorAgent(task);
    
    // 业务含义：打印执行Agent的返回结果，便于调试和追踪
    console.log('[SubtaskEngine] 执行Agent返回:', executorResult);

    // 业务含义：将执行Agent的执行结果保存到数据库
    await db
      .update(agentSubTasks)
      .set({
        executionResult: JSON.stringify(executorResult.executionResult),
        updatedAt: getCurrentBeijingTime(),
      })
      .where(eq(agentSubTasks.id, task.id));
```

---

### 3. 快速路径判断（不需要MCP）

```typescript
    // 业务含义：检查是否不需要 MCP，且任务已完成
    // 如果执行Agent说"不需要MCP"且"任务已完成"，走快速完成路径
    if (!executorResult.isNeedMcp && executorResult.isTaskDown) {
      // 业务含义：打印日志，说明走快速完成路径
      console.log('[SubtaskEngine] 不依赖MCP，直接完成');
      
      // 业务含义：标记任务为已完成，直接结束
      await this.markTaskCompleted(task, executorResult.executionResult);
      return;
    }
```

---

### 4. 异常状态判断

```typescript
    // 业务含义：检查执行Agent返回的状态是否异常
    // 异常情况：
    // 1. 不需要 MCP（isNeedMcp = false），但任务没完成
    // 2. 需要 MCP（isNeedMcp = true），但任务已完成
    // 这两种情况都属于逻辑矛盾，需要人工介入
    if (!executorResult.isNeedMcp || executorResult.isTaskDown) {
      // 业务含义：打印日志，说明状态异常
      console.log('[SubtaskEngine] 执行Agent返回状态异常，标记为需要支持');
      
      // 业务含义：将任务状态改为"需要支持"，等待人工处理
      await db
        .update(agentSubTasks)
        .set({
          status: 'need_support',
          updatedAt: getCurrentBeijingTime(),
        })
        .where(eq(agentSubTasks.id, task.id));
      return;
    }
```

---

### 5. 记录交互历史（Request）

```typescript
    // 业务含义：打印日志，说明需要 MCP 介入，继续流程
    console.log('[SubtaskEngine] 需要MCP介入，继续流程');

    // 业务含义：记录第一条交互历史（Request 类型）
    // 这是 insurance-d 向 Agent B 发起的咨询请求
    // interactNum = 1，表示这是第一轮交互
    console.log('[SubtaskEngine] 记录交互1：执行Agent分析（request）');
    await this.createInteractionStep(
      task.commandResultId,           // 关联的 commandResultId
      task.orderIndex,                 // 任务的执行顺序
      'request',                        // 交互类型：请求
      1,                                // 交互次数：第1轮
      task.fromParentsExecutor,        // 发起方：insurance-d
      {
        interact_type: 'request',
        consultant: task.fromParentsExecutor,  // 咨询方
        responder: 'agent B',                   // 响应方
        question: executorResult,                // 问题内容：执行Agent的输出
        response: '',                            // 响应内容：空（等待Agent B响应）
        execution_result: { status: 'waiting' }, // 执行状态：等待中
        ext_info: { step: 'phase_1_executor_analysis' } // 扩展信息：阶段1
      }
    );
```

---

### 6. 查询可用能力列表

```typescript
    // 业务含义：打印日志，准备查询可用的 MCP 能力
    console.log('[SubtaskEngine] 查询 capability_list');
    
    // 业务含义：根据执行Agent建议的能力类型，查询可用的 MCP 能力列表
    // 例如：如果 capabilityType = 'wechat_upload'，就查询所有公众号相关的能力
    const capabilities = await this.queryCapabilityList(executorResult.capabilityType);
    
    // 业务含义：打印找到的可用能力数量
    console.log(`[SubtaskEngine] 找到 ${capabilities.length} 个可用能力`);
```

---

### 7. Agent B 循环决策（主循环）

```typescript
    // 业务含义：开始 Agent B 的循环决策，最多5次
    while (currentIteration < MAX_ITERATIONS) {
      // 业务含义：迭代次数加1
      currentIteration++;
      
      // 业务含义：打印日志，标记当前是第几轮决策
      console.log(`\n[SubtaskEngine] ========== 第 ${currentIteration}/${MAX_ITERATIONS} 轮决策 ==========`);
```

---

### 8. 构建执行上下文

```typescript
      // 业务含义：构建执行上下文，传递给 Agent B
      // 执行上下文包含 Agent B 决策所需的所有信息
      const executionContext: ExecutionContext = {
        // 执行Agent的反馈信息
        executorFeedback: {
          originalTask: task.taskTitle,                    // 原始任务标题
          problem: executorResult.problem || '',           // 问题描述（文章内容）
          attemptedSolutions: mcpExecutionHistory.map(m => m.decision.reasoning), // 已尝试的方案
          suggestedApproach: executorResult.capabilityType, // 建议的方案类型
        },
        
        // MCP 执行历史（之前的所有 MCP 调用记录）
        mcpExecutionHistory,
        
        // 用户反馈（如果有用户交互的话）
        userFeedback: userInteractions.length > 0 ? {
          feedbackType: 'select',
          userInput: userInteractions[userInteractions.length - 1].selectedSolution,
          feedbackTime: userInteractions[userInteractions.length - 1].timestamp,
          userId: userInteractions[userInteractions.length - 1].userInfo.userId,
        } : undefined,
        
        // 任务元数据
        taskMeta: {
          taskId: task.id,
          taskType: task.taskType || 'default',
          priority: 'medium',
          createdAt: task.createdAt || getCurrentBeijingTime(),
          timeoutAt: undefined,
          iterationCount: currentIteration,      // 当前迭代次数
          maxIterations: MAX_ITERATIONS,         // 最大迭代次数
        },
        
        // 可用的 MCP 能力列表
        availableCapabilities: capabilities,
      };
```

---

### 9. 两阶段流程控制（新增功能）

```typescript
      // ========== 两阶段流程控制 ==========
      // 业务含义：判断是否需要"先合规检查，后上传公众号"的两阶段流程
      const needsTwoPhase = this.needsTwoPhaseProcess(task, executorResult);
      
      // 业务含义：判断是否已经完成了合规检查
      const hasComplianceCheck = this.hasCompletedComplianceCheck(mcpExecutionHistory);
      
      // 业务含义：判断合规检查是否通过
      const isCompliancePassed = this.isComplianceCheckPassed(mcpExecutionHistory);

      // 业务含义：打印两阶段流程检查结果
      console.log('[SubtaskEngine] 两阶段流程检查:', {
        needsTwoPhase,
        hasComplianceCheck,
        isCompliancePassed
      });

      // 业务含义：如果需要两阶段流程，且还没做合规检查
      if (needsTwoPhase && !hasComplianceCheck) {
        // 业务含义：打印日志，强制执行第一阶段：合规检查
        console.log('[SubtaskEngine] 强制第一阶段：先执行合规检查');
        
        // 业务含义：强制 Agent B 输出合规检查决策
        const forcedComplianceDecision = await this.forceComplianceCheckDecision(
          task,
          executionContext,
          capabilities
        );
        
        // 业务含义：如果强制决策是 EXECUTE_MCP 类型，且有 MCP 参数
        if (forcedComplianceDecision.type === 'EXECUTE_MCP' && forcedComplianceDecision.data?.mcpParams) {
          // 业务含义：打印日志，准备执行强制合规检查
          console.log('[SubtaskEngine] 执行强制合规检查');
          
          // 业务含义：执行合规检查 MCP（只尝试1次）
          const mcpSuccess = await this.executeMcpWithRetry(
            task,
            forcedComplianceDecision,
            capabilities,
            mcpExecutionHistory,
            1 // 只尝试1次
          );
          
          // 业务含义：如果合规检查执行成功
          if (mcpSuccess) {
            // 业务含义：打印日志，合规检查已完成，继续下一轮
            console.log('[SubtaskEngine] 合规检查完成，继续流程');
            // 业务含义：合规检查已记录到 mcpExecutionHistory，继续下一轮循环
            continue;
          } else {
            // 业务含义：合规检查执行失败，标记任务失败
            console.error('[SubtaskEngine] 合规检查执行失败');
            await this.markTaskFailed(task, '合规检查执行失败');
            return;
          }
        }
      }

      // 业务含义：如果需要两阶段流程，且合规检查已完成但未通过
      if (needsTwoPhase && hasComplianceCheck && !isCompliancePassed) {
        // 业务含义：打印日志，让 Agent B 处理合规未通过的情况
        console.log('[SubtaskEngine] 合规检查未通过，让 Agent B 处理');
        // 业务含义：继续正常流程，让 Agent B 决定下一步（可能是 NEED_USER 或 FAILED）
      }
```

---

### 10. 调用 Agent B 进行决策

```typescript
      // 业务含义：调用 Agent B 进行智能决策
      // Agent B 基于执行上下文，输出标准化决策
      const agentBDecision = await this.callAgentBWithDecision(
        task,
        executionContext,
        capabilities
      );

      // 业务含义：打印 Agent B 的决策结果，便于调试
      console.log('[SubtaskEngine] Agent B 决策:', JSON.stringify(agentBDecision, null, 2));
```

---

### 11. 处理不同类型的决策

```typescript
      // 业务含义：根据 Agent B 的决策类型，分别处理
      switch (agentBDecision.type) {
        // 业务含义：决策类型 = COMPLETE（任务已完成）
        case 'COMPLETE':
          // 业务含义：处理完成决策，记录 response，标记任务完成
          await this.handleCompleteDecision(task, agentBDecision, executorResult, mcpExecutionHistory, userInteractions, currentIteration);
          return;

        // 业务含义：决策类型 = NEED_USER（需要用户介入）
        case 'NEED_USER':
          // 业务含义：处理需要用户决策，记录 response，标记任务为 waiting_user
          await this.handleNeedUserDecision(task, agentBDecision, executorResult, mcpExecutionHistory, userInteractions, currentIteration);
          return; // 等待用户反馈后会重新触发

        // 业务含义：决策类型 = FAILED（任务失败）
        case 'FAILED':
          // 业务含义：处理失败决策，记录 response，标记任务失败
          await this.handleFailedDecision(task, agentBDecision, executorResult, mcpExecutionHistory, userInteractions, currentIteration);
          return;

        // 业务含义：决策类型 = EXECUTE_MCP（需要执行 MCP）
        case 'EXECUTE_MCP':
          // 业务含义：执行 MCP（支持多次尝试，最多3次）
          const mcpSuccess = await this.executeMcpWithRetry(
            task,
            agentBDecision,
            capabilities,
            mcpExecutionHistory,
            MAX_MCP_ATTEMPTS_PER_ITERATION
          );

          // 业务含义：如果 MCP 执行成功
          if (mcpSuccess) {
            // 业务含义：打印日志，继续下一轮决策，让 Agent B 判断是否完成
            console.log('[SubtaskEngine] MCP执行成功，继续下一轮决策');
            continue;
          } else {
            // 业务含义：MCP 多次尝试都失败，继续下一轮，让 Agent B 处理
            console.log('[SubtaskEngine] MCP多次尝试失败，继续下一轮决策');
            continue;
          }

        // 业务含义：未知的决策类型
        default:
          // 业务含义：打印错误日志
          console.error('[SubtaskEngine] 未知的决策类型:', agentBDecision.type);
          // 业务含义：标记任务失败
          await this.markTaskFailed(task, `未知的决策类型: ${agentBDecision.type}`);
          return;
      }
```

---

### 12. 达到最大循环次数

```typescript
    } // 业务含义：while 循环结束

    // 业务含义：达到最大循环次数（5次），强制完成
    console.log('[SubtaskEngine] 达到最大循环次数，强制完成');
    
    // 业务含义：处理超过最大迭代次数的情况
    await this.handleMaxIterationsExceeded(task, executorResult, mcpExecutionHistory, userInteractions, currentIteration);
```

---

### 13. 异常处理

```typescript
  } catch (error) {
    // 业务含义：捕获并打印异常
    console.error('[SubtaskEngine] 完整工作流程失败:', error);
    // 业务含义：重新抛出异常，让上层处理
    throw error;
  }
}
```

---

## 📊 完整流程图

```
executeCompleteWorkflow(task)
    │
    ├─ 初始化（maxIterations=5, mcpHistory=[]）
    │
    ├─ 阶段1：调用执行Agent（insurance-d）
    │   └─ 获取 executorResult
    │
    ├─ 判断快速路径
    │   ├─ 不需要MCP且任务完成 → markTaskCompleted()
    │   └─ 状态异常 → markTaskNeedSupport()
    │
    ├─ 记录交互历史（request, interactNum=1）
    │
    ├─ 查询可用能力列表（capability_list）
    │
    └─ 主循环（最多5次）
        │
        ├─ 构建执行上下文（executionContext）
        │
        ├─ 两阶段流程控制（新增）
        │   ├─ 需要两阶段且未做合规检查
        │   │   └─ 强制执行合规检查 MCP
        │   │       ├─ 成功 → continue（继续下一轮）
        │   │       └─ 失败 → markTaskFailed()
        │   │
        │   └─ 需要两阶段但合规未通过
        │       └─ 继续正常流程
        │
        ├─ 调用 Agent B 决策
        │
        └─ 处理决策
            ├─ COMPLETE → handleCompleteDecision()
            ├─ NEED_USER → handleNeedUserDecision()
            ├─ FAILED → handleFailedDecision()
            └─ EXECUTE_MCP → executeMcpWithRetry()
                ├─ 成功 → continue
                └─ 失败 → continue
```

---

## 🎯 关键业务要点

1. **两阶段流程**（新增）：
   - 对于保险事业部内容发布场景，强制先合规检查
   - 合规检查通过后，再执行公众号上传
   - 确保 mcp_attempts 包含2条记录

2. **Agent B 决策**：
   - 基于完整的执行上下文（包括MCP历史、用户反馈）
   - 输出4种决策类型：COMPLETE、NEED_USER、FAILED、EXECUTE_MCP

3. **MCP 重试机制**：
   - 单次循环最多重试3次 MCP
   - 失败后继续下一轮，让 Agent B 重新决策

4. **最大迭代限制**：
   - 最多5轮决策，防止无限循环
   - 达到限制后强制完成

# recordAgentInteraction() & recordMcpExecution() 方法深度分析报告

**分析身份**: 技术专家 + 业务专家  
**分析日期**: 2026年  
**分析对象**: 新增的两个交互记录方法

---

## 一、现有方法的快速回顾

### 1.1 recordAgentInteraction() 方法

**位置**: `src/lib/services/subtask-execution-engine.ts`  
**职责**: 记录 Agent 的完整交互（请求 + 响应）

**现有实现**:
```typescript
public async recordAgentInteraction(
  commandResultId: string,
  stepNo: number,
  agentId: string,
  requestContent: any,
  responseStatus: 'pre_completed' | 'pre_need_support' | 'pre_failed' | 'EXECUTE_MCP' | 'COMPLETE' | 'NEED_USER' | 'FAILED' | 'REEXECUTE_EXECUTOR',
  responseContent: any,
  subTaskId?: number
): Promise<number>
```

**核心逻辑**:
1. 查询现有记录，计算下一个 `interactNum`
2. 直接插入 `agent_sub_tasks_step_history` 表
3. 返回 `interactNum`

---

### 1.2 recordMcpExecution() 方法

**位置**: `src/lib/services/subtask-execution-engine.ts`  
**职责**: 记录 MCP 执行情况

**现有实现**:
```typescript
public async recordMcpExecution(
  commandResultId: string,
  stepNo: number,
  subTaskId: number,
  interactNum: number,
  mcpData: {
    attemptId: string;
    attemptNumber: number;
    toolName?: string;
    actionName?: string;
    params?: any;
    resultStatus: string;
    resultData?: any;
    resultText?: string;
    errorCode?: string;
    errorMessage?: string;
    errorType?: string;
    executionTimeMs?: number;
  }
)
```

**核心逻辑**:
1. 直接插入 `agent_sub_tasks_mcp_executions` 表

---

## 二、技术专家视角：问题分析

### 2.1 🔴 严重问题：缺少重复插入防护

#### 问题 1.1: recordAgentInteraction() 没有唯一性检查

**风险等级**: 🔴 高  
**问题描述**:
- 现有实现直接插入，没有检查记录是否已存在
- 如果由于网络重试、代码bug等原因导致重复调用，会产生重复记录
- 虽然数据库有唯一约束，但会抛出异常，影响用户体验

**对比 createInteractionStep()**:
```typescript
// ✅ createInteractionStep() 的做法：
const existingRecord = await db.select(...).where(...);
if (existingRecord.length > 0) {
  console.log('记录已存在，跳过插入');
  return;
}

// ❌ recordAgentInteraction() 的做法：
// 直接插入，没有检查！
```

**建议修复**:
```typescript
public async recordAgentInteraction(
  commandResultId: string,
  stepNo: number,
  agentId: string,
  requestContent: any,
  responseStatus: string,
  responseContent: any,
  subTaskId?: number
): Promise<number> {
  console.log('[SubtaskEngine] 🔴 记录 Agent 完整交互:', { agentId, responseStatus, commandResultId, stepNo });

  // ========== 🔴 新增：先检查记录是否已存在 ==========
  // 生成一个唯一标识，用于检查是否重复
  // 可以基于 requestContent 的 hash 或者其他唯一标识
  const interactionFingerprint = this.generateInteractionFingerprint(
    agentId,
    requestContent,
    responseStatus
  );

  // 检查是否已存在相同的交互记录
  const existingRecords = await db
    .select({ 
      id: agentSubTasksStepHistory.id,
      interactNum: agentSubTasksStepHistory.interactNum,
      interactContent: agentSubTasksStepHistory.interactContent
    })
    .from(agentSubTasksStepHistory)
    .where(
      and(
        eq(agentSubTasksStepHistory.commandResultId, commandResultId),
        eq(agentSubTasksStepHistory.stepNo, stepNo),
        eq(agentSubTasksStepHistory.interactType, 'agent_interaction'),
        eq(agentSubTasksStepHistory.interactUser, agentId)
      )
    );

  // 检查是否有相同的交互（基于内容指纹）
  for (const record of existingRecords) {
    if (this.isDuplicateInteraction(record.interactContent, interactionFingerprint)) {
      console.log(
        `[SubtaskEngine] ⚠️  Agent 交互记录已存在，跳过插入: ` +
        `agentId=${agentId}, ` +
        `commandResultId=${commandResultId}, ` +
        `stepNo=${stepNo}`
      );
      return record.interactNum; // 返回已存在的 interactNum
    }
  }

  // ========== 原有逻辑：计算下一个 interactNum ==========
  const nextInteractNum = existingRecords.length > 0
    ? Math.max(...existingRecords.map(r => r.interactNum || 1)) + 1
    : 1;

  // ========== 🔴 新增：捕获插入异常 ==========
  try {
    await db.insert(agentSubTasksStepHistory)
      .values({
        commandResultId,
        stepNo,
        interactType: 'agent_interaction',
        interactNum: nextInteractNum,
        interactUser: agentId,
        interactContent: {
          type: 'agent_interaction',
          agentId,
          requestContent,
          responseStatus,
          responseContent,
          timestamp: getCurrentBeijingTime().toISOString(),
          fingerprint: interactionFingerprint, // 🔴 新增：保存指纹，便于后续去重
        },
        interactTime: getCurrentBeijingTime(),
      });

    console.log('[SubtaskEngine] ✅ Agent 完整交互记录完成:', { interactNum: nextInteractNum });
    return nextInteractNum;
  } catch (insertError) {
    // 🔴 新增：捕获唯一约束错误
    if (this.isUniqueConstraintError(insertError)) {
      console.warn(
        `[SubtaskEngine] ⚠️  Agent 交互记录插入失败（唯一约束），查询已存在记录: ` +
        `agentId=${agentId}, ` +
        `commandResultId=${commandResultId}, ` +
        `stepNo=${stepNo}`
      );
      
      // 重新查询已存在的记录
      const existingRecord = await this.findExistingAgentInteraction(
        commandResultId,
        stepNo,
        agentId,
        interactionFingerprint
      );
      
      if (existingRecord) {
        console.log('[SubtaskEngine] ✅ 找到已存在的记录，返回其 interactNum:', existingRecord.interactNum);
        return existingRecord.interactNum;
      }
    }
    
    // 其他错误重新抛出
    throw insertError;
  }
}
```

---

#### 问题 1.2: recordMcpExecution() 没有唯一性检查

**风险等级**: 🔴 高  
**问题描述**:
- 同样的问题：直接插入，没有检查记录是否已存在
- `attemptId` 应该是唯一的，可以基于 `attemptId` 来检查

**建议修复**:
```typescript
public async recordMcpExecution(
  commandResultId: string,
  stepNo: number,
  subTaskId: number,
  interactNum: number,
  mcpData: {
    attemptId: string;
    attemptNumber: number;
    toolName?: string;
    actionName?: string;
    params?: any;
    resultStatus: string;
    resultData?: any;
    resultText?: string;
    errorCode?: string;
    errorMessage?: string;
    errorType?: string;
    executionTimeMs?: number;
  }
) {
  console.log('[SubtaskEngine] 🔴 记录 MCP 执行:', { 
    toolName: mcpData.toolName, 
    actionName: mcpData.actionName, 
    resultStatus: mcpData.resultStatus,
    attemptId: mcpData.attemptId
  });

  // ========== 🔴 新增：先检查记录是否已存在 ==========
  const existingRecord = await db
    .select({ id: agentSubTasksMcpExecutions.id })
    .from(agentSubTasksMcpExecutions)
    .where(
      and(
        eq(agentSubTasksMcpExecutions.attemptId, mcpData.attemptId),
        eq(agentSubTasksMcpExecutions.subTaskId, subTaskId)
      )
    );

  if (existingRecord.length > 0) {
    console.log(
      `[SubtaskEngine] ⚠️  MCP 执行记录已存在，跳过插入: ` +
      `attemptId=${mcpData.attemptId}, ` +
      `subTaskId=${subTaskId}`
    );
    return;
  }

  // ========== 🔴 新增：如果没有 resultText，自动生成 ==========
  let resultText = mcpData.resultText;
  if (!resultText && mcpData.resultData) {
    try {
      resultText = await this.generateMcpResultText({
        decision: {
          toolName: mcpData.toolName,
          actionName: mcpData.actionName,
        },
        result: {
          status: mcpData.resultStatus,
          data: mcpData.resultData,
        },
      });
      console.log('[SubtaskEngine] ✅ 自动生成 MCP resultText 成功');
    } catch (error) {
      console.warn('[SubtaskEngine] ⚠️  自动生成 MCP resultText 失败，将留空:', error);
    }
  }

  // ========== 🔴 新增：捕获插入异常 ==========
  try {
    await db.insert(agentSubTasksMcpExecutions)
      .values({
        subTaskId,
        stepNo,
        interactNo: interactNum,
        commandResultId,
        orderIndex: stepNo,
        attemptId: mcpData.attemptId,
        attemptNumber: mcpData.attemptNumber,
        attemptTimestamp: getCurrentBeijingTime(),
        toolName: mcpData.toolName,
        actionName: mcpData.actionName,
        params: mcpData.params,
        resultStatus: mcpData.resultStatus,
        resultData: mcpData.resultData,
        resultText: resultText, // 🔴 使用自动生成的 resultText
        errorCode: mcpData.errorCode,
        errorMessage: mcpData.errorMessage,
        errorType: mcpData.errorType,
        executionTimeMs: mcpData.executionTimeMs || 0,
      });

    console.log('[SubtaskEngine] ✅ MCP 执行记录完成');
  } catch (insertError) {
    // 🔴 新增：捕获唯一约束错误
    if (this.isUniqueConstraintError(insertError)) {
      console.warn(
        `[SubtaskEngine] ⚠️  MCP 执行记录插入失败（唯一约束），但不影响主流程: ` +
        `attemptId=${mcpData.attemptId}, ` +
        `subTaskId=${subTaskId}`
      );
      return;
    }
    
    // 其他错误重新抛出
    throw insertError;
  }
}
```

---

### 2.2 🔴 严重问题：缺少事务保证

#### 问题 2.1: 两个方法分开调用，没有事务

**风险等级**: 🔴 高  
**问题描述**:
- 典型场景：先调用 `recordAgentInteraction()`，再调用 `recordMcpExecution()`
- 两个操作不在同一个事务中
- 如果第一个成功，第二个失败，会导致数据不一致

**业务场景示例**:
```typescript
// ❌ 现有做法：两个方法分开调用
const interactNum = await engine.recordAgentInteraction(...); // ✅ 成功
await engine.recordMcpExecution(...); // ❌ 失败
// 结果：step_history 有记录，但 mcp_executions 没有记录 → 数据不一致！
```

**对比 createInteractionStep()**:
```typescript
// ✅ createInteractionStep() 的做法：
await db.transaction(async (tx) => {
  // 两个操作在同一个事务中
  await tx.insert(agentSubTasksStepHistory)...;
  await tx.insert(agentSubTasksMcpExecutions)...;
});
```

**建议方案 1：提供组合方法（推荐）**
```typescript
/**
 * 🔴 新增：组合方法 - 同时记录 Agent 交互和 MCP 执行
 * 使用事务保证数据一致性
 */
public async recordAgentInteractionWithMcp(
  commandResultId: string,
  stepNo: number,
  agentId: string,
  requestContent: any,
  responseStatus: string,
  responseContent: any,
  subTaskId: number,
  mcpDataList: Array<{
    attemptId: string;
    attemptNumber: number;
    toolName?: string;
    actionName?: string;
    params?: any;
    resultStatus: string;
    resultData?: any;
    resultText?: string;
    errorCode?: string;
    errorMessage?: string;
    errorType?: string;
    executionTimeMs?: number;
  }>
): Promise<{ interactNum: number; success: boolean }> {
  console.log('[SubtaskEngine] 🔴 记录 Agent 交互 + MCP 执行（事务保证）:', { 
    agentId, 
    responseStatus, 
    mcpCount: mcpDataList.length 
  });

  try {
    const result = await db.transaction(async (tx) => {
      // ========== 1. 先检查 Agent 交互记录是否已存在 ==========
      const interactionFingerprint = this.generateInteractionFingerprint(
        agentId,
        requestContent,
        responseStatus
      );

      const existingInteractions = await tx
        .select({ 
          id: agentSubTasksStepHistory.id,
          interactNum: agentSubTasksStepHistory.interactNum,
          interactContent: agentSubTasksStepHistory.interactContent
        })
        .from(agentSubTasksStepHistory)
        .where(
          and(
            eq(agentSubTasksStepHistory.commandResultId, commandResultId),
            eq(agentSubTasksStepHistory.stepNo, stepNo),
            eq(agentSubTasksStepHistory.interactType, 'agent_interaction'),
            eq(agentSubTasksStepHistory.interactUser, agentId)
          )
        );

      let interactNum: number;
      let isNewInteraction = true;

      // 检查是否有相同的交互
      for (const record of existingInteractions) {
        if (this.isDuplicateInteraction(record.interactContent, interactionFingerprint)) {
          console.log('[SubtaskEngine] ⚠️  Agent 交互记录已存在，复用:', record.interactNum);
          interactNum = record.interactNum;
          isNewInteraction = false;
          break;
        }
      }

      // 如果是新交互，插入记录
      if (isNewInteraction) {
        interactNum = existingInteractions.length > 0
          ? Math.max(...existingInteractions.map(r => r.interactNum || 1)) + 1
          : 1;

        await tx.insert(agentSubTasksStepHistory)
          .values({
            commandResultId,
            stepNo,
            interactType: 'agent_interaction',
            interactNum,
            interactUser: agentId,
            interactContent: {
              type: 'agent_interaction',
              agentId,
              requestContent,
              responseStatus,
              responseContent,
              timestamp: getCurrentBeijingTime().toISOString(),
              fingerprint: interactionFingerprint,
              hasMcpExecutions: mcpDataList.length > 0, // 🔴 新增：标记是否有 MCP 执行
              mcpCount: mcpDataList.length, // 🔴 新增：MCP 数量
            },
            interactTime: getCurrentBeijingTime(),
          });

        console.log('[SubtaskEngine] ✅ Agent 交互记录插入成功:', { interactNum });
      }

      // ========== 2. 插入 MCP 执行记录（如果有） ==========
      for (const mcpData of mcpDataList) {
        // 检查 MCP 记录是否已存在
        const existingMcp = await tx
          .select({ id: agentSubTasksMcpExecutions.id })
          .from(agentSubTasksMcpExecutions)
          .where(
            and(
              eq(agentSubTasksMcpExecutions.attemptId, mcpData.attemptId),
              eq(agentSubTasksMcpExecutions.subTaskId, subTaskId)
            )
          );

        if (existingMcp.length > 0) {
          console.log('[SubtaskEngine] ⚠️  MCP 记录已存在，跳过:', mcpData.attemptId);
          continue;
        }

        // 自动生成 resultText（如果需要）
        let resultText = mcpData.resultText;
        if (!resultText && mcpData.resultData) {
          try {
            resultText = await this.generateMcpResultText({
              decision: {
                toolName: mcpData.toolName,
                actionName: mcpData.actionName,
              },
              result: {
                status: mcpData.resultStatus,
                data: mcpData.resultData,
              },
            });
          } catch (error) {
            console.warn('[SubtaskEngine] ⚠️  自动生成 MCP resultText 失败:', error);
          }
        }

        await tx.insert(agentSubTasksMcpExecutions)
          .values({
            subTaskId,
            stepNo,
            interactNo: interactNum,
            commandResultId,
            orderIndex: stepNo,
            attemptId: mcpData.attemptId,
            attemptNumber: mcpData.attemptNumber,
            attemptTimestamp: getCurrentBeijingTime(),
            toolName: mcpData.toolName,
            actionName: mcpData.actionName,
            params: mcpData.params,
            resultStatus: mcpData.resultStatus,
            resultData: mcpData.resultData,
            resultText,
            errorCode: mcpData.errorCode,
            errorMessage: mcpData.errorMessage,
            errorType: mcpData.errorType,
            executionTimeMs: mcpData.executionTimeMs || 0,
          });

        console.log('[SubtaskEngine] ✅ MCP 执行记录插入成功:', mcpData.attemptId);
      }

      return { interactNum, success: true };
    });

    console.log('[SubtaskEngine] ✅ 事务提交成功，Agent 交互 + MCP 执行记录完成');
    return result;
  } catch (error) {
    console.error('[SubtaskEngine] ❌ 事务执行失败:', error);
    throw error;
  }
}
```

---

### 2.3 🟡 中等问题：缺少辅助方法

#### 问题 3.1: 缺少通用的辅助方法

**建议新增的辅助方法**:

```typescript
/**
 * 🔴 新增：生成交互指纹（用于去重）
 */
private generateInteractionFingerprint(
  agentId: string,
  requestContent: any,
  responseStatus: string
): string {
  // 简化版本：可以根据实际需求调整
  const contentStr = typeof requestContent === 'string' 
    ? requestContent 
    : JSON.stringify(requestContent);
  
  // 取前 1000 个字符做 hash，避免太长
  const contentPreview = contentStr.substring(0, 1000);
  
  return `${agentId}:${responseStatus}:${this.simpleHash(contentPreview)}`;
}

/**
 * 🔴 新增：简单 hash 函数
 */
private simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * 🔴 新增：检查是否为重复交互
 */
private isDuplicateInteraction(
  existingContent: any,
  newFingerprint: string
): boolean {
  if (!existingContent) return false;
  
  // 检查指纹是否匹配
  return existingContent.fingerprint === newFingerprint;
}

/**
 * 🔴 新增：检查是否为唯一约束错误
 */
private isUniqueConstraintError(error: any): boolean {
  const errorMsg = error?.message || String(error);
  return errorMsg.includes('unique constraint') || 
         errorMsg.includes('duplicate key') ||
         errorMsg.includes('idx_task_step_num_type_user');
}

/**
 * 🔴 新增：查找已存在的 Agent 交互记录
 */
private async findExistingAgentInteraction(
  commandResultId: string,
  stepNo: number,
  agentId: string,
  fingerprint: string
): Promise<{ interactNum: number } | null> {
  const records = await db
    .select({ interactNum: agentSubTasksStepHistory.interactNum })
    .from(agentSubTasksStepHistory)
    .where(
      and(
        eq(agentSubTasksStepHistory.commandResultId, commandResultId),
        eq(agentSubTasksStepHistory.stepNo, stepNo),
        eq(agentSubTasksStepHistory.interactType, 'agent_interaction'),
        eq(agentSubTasksStepHistory.interactUser, agentId)
      )
    );

  for (const record of records) {
    // 这里可以根据实际存储的内容来匹配
    // 由于 interactContent 是 jsonb，可能需要额外的查询逻辑
    return record; // 简化版本：返回第一个找到的
  }

  return null;
}
```

---

## 三、业务专家视角：问题分析

### 3.1 🔴 严重问题：缺少业务元数据

#### 问题 1.1: recordAgentInteraction() 缺少业务上下文

**业务风险**: 🔴 高  
**问题描述**:
- 现有的 `interactContent` 结构太简单
- 缺少业务场景信息，不利于后续分析和审计

**建议增强的内容**:
```typescript
interactContent: {
  type: 'agent_interaction',
  agentId,
  requestContent,
  responseStatus,
  responseContent,
  timestamp: getCurrentBeijingTime().toISOString(),
  fingerprint: interactionFingerprint,
  
  // ========== 🔴 新增：业务元数据 ==========
  businessContext: {
    taskType: string; // 任务类型：'article_writing' | 'compliance_audit' | 'web_search' | ...
    businessPhase: string; // 业务阶段：'planning' | 'execution' | 'review' | 'delivery'
    priority: 'low' | 'medium' | 'high' | 'urgent'; // 优先级
    executionMode: 'normal' | 'retry' | 'escalated'; // 执行模式
  },
  
  // ========== 🔴 新增：性能监控 ==========
  performance: {
    totalDurationMs?: number; // 总耗时
    llmCallCount?: number; // LLM 调用次数
    mcpCallCount?: number; // MCP 调用次数
    waitingTimeMs?: number; // 等待时间
  },
  
  // ========== 🔴 新增：关联信息 ==========
  relatedEntities: {
    conversationId?: string; // 对话会话 ID
    sessionId?: string; // 会话 ID
    relatedTaskId?: string; // 关联的总任务 ID
    articleId?: string; // 关联的文章 ID（如果有）
  },
  
  // ========== 🔴 新增：审计信息 ==========
  audit: {
    recordedAt: string; // 记录时间
    recordedBy: string; // 记录人（系统/模块名）
    version: string; // 记录格式版本
  }
}
```

---

#### 问题 1.2: recordMcpExecution() 缺少业务上下文

**建议增强**:
```typescript
// 可以在 mcpData 中增加可选的业务元数据
mcpData: {
  // ... 原有字段 ...
  
  // ========== 🔴 新增：业务元数据 ==========
  businessContext?: {
    usageScenario?: string; // 使用场景：'research' | 'content_generation' | 'compliance_check'
    isRetry?: boolean; // 是否为重试
    retryCount?: number; // 重试次数
    businessPriority?: 'low' | 'medium' | 'high'; // 业务优先级
  };
}
```

---

### 3.2 🟡 中等问题：缺少状态追溯能力

#### 问题 2.1: 没有记录状态变更历史

**业务需求**:
- 需要知道 Agent 从什么状态变成了什么状态
- 需要知道状态变更的原因

**建议在 recordAgentInteraction() 中增加**:
```typescript
interactContent: {
  // ... 其他字段 ...
  
  // ========== 🔴 新增：状态变更信息 ==========
  stateTransition: {
    previousStatus?: string; // 之前的状态
    currentStatus: string; // 当前状态
    transitionReason?: string; // 状态变更原因
    triggeredBy?: string; // 触发者：'agent' | 'system' | 'user'
  };
}
```

---

## 四、综合建议：完整的增强方案

### 4.1 第一优先级：必须修复的问题（🔴 严重）

1. **增加重复插入防护**
   - `recordAgentInteraction()`: 增加基于内容指纹的去重
   - `recordMcpExecution()`: 增加基于 `attemptId` 的去重

2. **增加异常处理**
   - 捕获唯一约束错误
   - 优雅降级，不影响主流程

3. **提供组合方法**
   - `recordAgentInteractionWithMcp()`: 使用事务保证一致性

---

### 4.2 第二优先级：强烈建议的增强（🟡 中等）

1. **自动生成 `resultText`**
   - 如果 `recordMcpExecution()` 调用时没有提供 `resultText`，自动调用 `generateMcpResultText()` 生成

2. **增加辅助方法**
   - `generateInteractionFingerprint()`: 生成交互指纹
   - `isUniqueConstraintError()`: 判断唯一约束错误
   - 等等

---

### 4.3 第三优先级：长期优化（🔵 低）

1. **增加业务元数据**
   - 任务类型、业务阶段、优先级等
   - 性能监控数据
   - 关联实体信息

2. **增加状态变更追踪**
   - 记录状态变更历史
   - 记录变更原因

---

## 五、总结

### 5.1 核心问题清单

| 优先级 | 问题 | 风险 | 建议 |
|--------|------|------|------|
| 🔴 高 | 缺少重复插入防护 | 数据重复、异常 | 必须修复 |
| 🔴 高 | 缺少事务保证 | 数据不一致 | 必须修复（提供组合方法） |
| 🔴 高 | 缺少异常处理 | 系统崩溃 | 必须修复 |
| 🟡 中 | 缺少自动 resultText 生成 | 数据不完整 | 强烈建议 |
| 🟡 中 | 缺少辅助方法 | 代码重复 | 强烈建议 |
| 🔵 低 | 缺少业务元数据 | 审计困难 | 长期优化 |
| 🔵 低 | 缺少状态追踪 | 追溯困难 | 长期优化 |

### 5.2 实施建议

**Phase 1（紧急）**:
- 修复重复插入防护
- 增加异常处理
- 提供组合的事务方法

**Phase 2（短期）**:
- 自动生成 resultText
- 增加辅助方法

**Phase 3（长期）**:
- 增加业务元数据
- 增加状态追踪

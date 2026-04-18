# createInteractionStep 方法深入剖析

## 一、方法概述

**方法名**: `createInteractionStep`
**位置**: `src/lib/services/subtask-execution-engine.ts`
**状态**: 已保留（待分析）

## 二、方法签名

```typescript
public async createInteractionStep(
  commandResultId: string,
  stepNo: number,
  interactType: string,
  interactNum: number,
  interactUser: string,
  content: any,
  subTaskId: number
)
```

## 三、核心逻辑剖析

### 3.1 第一步：检查记录是否已存在

**目的**: 避免重复插入，防止唯一约束错误

**实现**:
```typescript
const existingRecord = await db
  .select({ id: agentSubTasksStepHistory.id })
  .from(agentSubTasksStepHistory)
  .where(
    and(
      eq(agentSubTasksStepHistory.commandResultId, commandResultId),
      eq(agentSubTasksStepHistory.stepNo, stepNo),
      eq(agentSubTasksStepHistory.interactType, interactType),
      eq(agentSubTasksStepHistory.interactNum, interactNum),
      eq(agentSubTasksStepHistory.interactUser, interactUser)
    )
  );
```

**检查字段**:
- `commandResultId`
- `stepNo`
- `interactType`
- `interactNum`
- `interactUser`

**逻辑**:
- 如果记录已存在 → 直接返回，不重复插入
- 如果记录不存在 → 继续执行插入

---

### 3.2 第二步：事务插入（核心逻辑）

**使用事务**: `db.transaction()`

**事务内操作**:

#### 3.2.1 插入 agent_sub_tasks_step_history 表

**表**: `agent_sub_tasks_step_history`

**插入字段**:
| 字段 | 值 |
|------|-----|
| `commandResultId` | `commandResultId` |
| `stepNo` | `stepNo` |
| `interactType` | `interactType` |
| `interactNum` | `interactNum` |
| `interactContent` | `content` |
| `interactUser` | `interactUser` |
| `interactTime` | `getCurrentBeijingTime()` |

**返回**: 插入记录的 `id`

---

#### 3.2.2 解析并插入 MCP 执行记录（如果有）

**触发条件**: `content?.response?.mcp_attempts` 存在且为数组且长度 > 0

**循环处理**: 遍历每个 `mcp_attempt`

##### 3.2.2.1 生成 MCP 执行结果的文本化格式

**方法**: `generateMcpResultText(attempt)`

**目的**: 为 LLM 优化的文本化格式

---

##### 3.2.2.2 插入 agent_sub_tasks_mcp_executions 表

**表**: `agent_sub_tasks_mcp_executions`

**插入字段**:
| 字段 | 值 |
|------|-----|
| `subTaskId` | `subTaskId` |
| `stepNo` | `stepNo` |
| `interactNo` | `interactNum` |
| `commandResultId` | `commandResultId` |
| `orderIndex` | `stepNo` |
| `attemptId` | `attempt.attemptId` |
| `attemptNumber` | `attempt.attemptNumber` |
| `attemptTimestamp` | `attempt.timestamp` |
| `solutionNum` | `attempt.decision?.solutionNum` |
| `toolName` | `attempt.decision?.toolName` |
| `actionName` | `attempt.decision?.actionName` |
| `reasoning` | `attempt.decision?.reasoning` |
| `strategy` | `attempt.decision?.strategy` |
| `params` | `attempt.params` |
| `resultStatus` | `attempt.result?.status` |
| `resultData` | `attempt.result?.data` |
| `resultText` | `resultText` (文本化结果) |
| `errorCode` | `attempt.result?.error?.code` |
| `errorMessage` | `attempt.result?.error?.message` |
| `errorType` | `attempt.result?.error?.type` |
| `executionTimeMs` | `attempt.result?.executionTime` |
| `isRetryable` | `attempt.failureAnalysis?.isRetryable` |
| `failureType` | `attempt.failureAnalysis?.failureType` |
| `suggestedNextAction` | `attempt.failureAnalysis?.suggestedNextAction` |

---

### 3.3 第三步：异常处理

**捕获错误**: 插入过程中的任何错误

**处理逻辑**:
- 捕获错误，不中断主流程
- 输出警告日志
- 记录完成（插入失败但已捕获）

---

## 四、逻辑拆分建议

### 4.1 拆分方案

#### 4.1.1 拆分 1：agent_sub_tasks_step_history 表操作

**方法名**: `insertStepHistory()`

**职责**: 仅负责插入 `agent_sub_tasks_step_history` 表

**输入**:
- `commandResultId`
- `stepNo`
- `interactType`
- `interactNum`
- `interactUser`
- `content`

**输出**: 插入记录的 `id`

---

#### 4.1.2 拆分 2：agent_sub_tasks_mcp_executions 表操作

**方法名**: `insertMcpExecutions()`

**职责**: 仅负责插入 `agent_sub_tasks_mcp_executions` 表

**输入**:
- `subTaskId`
- `stepNo`
- `interactNum`
- `commandResultId`
- `mcpAttempts` (MCP 尝试数组)

**输出**: 无

---

#### 4.1.3 拆分 3：LLM 处理指令逻辑

**方法名**: `generateMcpResultText()`

**职责**: 生成 MCP 执行结果的文本化格式（已存在）

**输入**: `mcpAttempt`

**输出**: 文本化结果字符串

---

### 4.2 拆分后的调用流程

```typescript
public async createInteractionStep(
  commandResultId: string,
  stepNo: number,
  interactType: string,
  interactNum: number,
  interactUser: string,
  content: any,
  subTaskId: number
) {
  // 1. 检查记录是否已存在
  const exists = await this.checkStepHistoryExists(...);
  if (exists) return;

  try {
    await db.transaction(async (tx) => {
      // 2. 插入 step_history 表
      const stepHistoryId = await this.insertStepHistory(tx, ...);

      // 3. 如果有 MCP attempts，插入 mcp_executions 表
      const mcpAttempts = content?.response?.mcp_attempts;
      if (mcpAttempts?.length > 0) {
        await this.insertMcpExecutions(tx, subTaskId, stepNo, interactNum, commandResultId, mcpAttempts);
      }
    });
  } catch (error) {
    // 异常处理
  }
}
```

---

## 五、数据库表结构详解

### 5.1 agent_sub_tasks_step_history 表

**表名**: `agent_sub_tasks_step_history`

**字段**:
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | serial | 主键 ID |
| `commandResultId` | uuid | 关联 agent_sub_tasks.commandResultId |
| `stepNo` | integer | 步骤编号（对应 agent_sub_tasks.order_index） |
| `interactType` | text | 交互类型（request/response） |
| `interactContent` | jsonb | 结构化交互内容 |
| `interactUser` | text | 交互发起方 |
| `interactTime` | timestamp | 交互发生时间 |
| `interactNum` | integer | 同 commandResultId + stepNo 下的交流次数 |

**唯一约束**: `commandResultId + stepNo + interactNum + interactType + interactUser`

**索引**:
- `idx_task_step_num_type_user`: 唯一约束索引
- `idx_step_history_command_result_id`: commandResultId 索引
- `idx_step_history_interact_time`: interactTime 索引

---

### 5.2 agent_sub_tasks_mcp_executions 表

**表名**: `agent_sub_tasks_mcp_executions`

**字段**:
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | serial | 主键 ID |
| `subTaskId` | integer | 关联 agent_sub_tasks.id |
| `stepNo` | integer | 步骤编号 |
| `interactNo` | integer | 交互编号 |
| `commandResultId` | uuid | 关联 agent_sub_tasks.commandResultId |
| `orderIndex` | integer | 排序索引 |
| `attemptId` | text | MCP 尝试 ID |
| `attemptNumber` | integer | 尝试次数 |
| `attemptTimestamp` | timestamp | 尝试时间戳 |
| `solutionNum` | integer | 解决方案编号 |
| `toolName` | text | 工具名称 |
| `actionName` | text | 动作名称 |
| `reasoning` | text | 推理过程 |
| `strategy` | text | 策略 |
| `params` | jsonb | 参数 |
| `resultStatus` | text | 结果状态 |
| `resultData` | jsonb | 结果数据 |
| `resultText` | text | 文本化结果（Agent 能读懂） |
| `errorCode` | text | 错误码 |
| `errorMessage` | text | 错误信息 |
| `errorType` | text | 错误类型 |
| `executionTimeMs` | integer | 执行时间（毫秒） |
| `isRetryable` | boolean | 是否可重试 |
| `failureType` | text | 失败类型 |
| `suggestedNextAction` | text | 建议的下一步操作 |
| `createdAt` | timestamp | 创建时间 |

**索引**:
- `idx_mcp_sub_task_id`: subTaskId 索引
- `idx_mcp_step_interact`: subTaskId + stepNo + interactNo 组合索引
- `idx_mcp_command_result`: commandResultId + orderIndex 索引
- `idx_mcp_tool_action`: toolName + actionName 索引
- `idx_mcp_status`: resultStatus 索引
- `idx_mcp_timestamp`: attemptTimestamp 索引
- `idx_mcp_error_type`: errorType 索引

---

## 六、关键发现

### 6.1 数据流向

```
content (输入)
  ↓
content?.response?.mcp_attempts (提取)
  ↓
遍历每个 attempt
  ↓
generateMcpResultText(attempt) (文本化)
  ↓
插入 agent_sub_tasks_mcp_executions 表
```

### 6.2 generateMcpResultText 方法实现

**位置**: `src/lib/services/subtask-execution-engine.ts:4223`

**实现逻辑**:
```typescript
private async generateMcpResultText(attempt: any): Promise<string> {
  const toolName = attempt.decision?.toolName;
  const actionName = attempt.decision?.actionName;
  const resultStatus = attempt.result?.status;
  const resultData = attempt.result?.data;
  
  const { getMcpResultTextGenerator } = await import('./mcp-result-text-generator');
  const generator = getMcpResultTextGenerator();
  
  const result = await generator.generate({
    toolName,
    actionName,
    resultStatus,
    resultData
  });
  
  if (!result.success) {
    throw new Error(`MCP 结果文本生成失败: ${result.error}`);
  }
  
  return result.text;
}
```

**依赖模块**: `./mcp-result-text-generator`

---

### 6.3 事务保证

**关键点**: step_history 和 mcp_executions 的插入在同一个事务中

**意义**: 要么都成功，要么都失败，保证数据一致性

---

### 6.4 重复检查机制

**检查字段**: 5 个字段组合唯一

**意义**: 防止重复插入，避免唯一约束错误

**唯一约束字段**:
- `commandResultId`
- `stepNo`
- `interactNum`
- `interactType`
- `interactUser`

---

## 七、content 参数结构分析

### 7.1 content 参数的预期结构

根据代码推断，`content` 参数的结构应该是：

```typescript
{
  // 可能的其他字段...
  
  response?: {
    mcp_attempts?: Array<{
      attemptId: string;
      attemptNumber: number;
      timestamp: Date;
      decision?: {
        solutionNum?: number;
        toolName?: string;
        actionName?: string;
        reasoning?: string;
        strategy?: string;
      };
      params?: any;
      result?: {
        status: string;
        data?: any;
        error?: {
          code?: string;
          message?: string;
          type?: string;
        };
        executionTime?: number;
      };
      failureAnalysis?: {
        isRetryable?: boolean;
        failureType?: string;
        suggestedNextAction?: string;
      };
    }>;
  };
}
```

---

## 八、逻辑拆分方案（详细版）

### 8.1 拆分后的方法结构

#### 8.1.1 方法 1：检查记录是否已存在

**方法名**: `checkStepHistoryExists()`

**职责**: 检查 agent_sub_tasks_step_history 表中是否已存在记录

**输入**:
- `commandResultId: string`
- `stepNo: number`
- `interactType: string`
- `interactNum: number`
- `interactUser: string`

**输出**: `Promise<boolean>` - 是否存在

**实现**:
```typescript
private async checkStepHistoryExists(
  commandResultId: string,
  stepNo: number,
  interactType: string,
  interactNum: number,
  interactUser: string
): Promise<boolean> {
  const existingRecord = await db
    .select({ id: agentSubTasksStepHistory.id })
    .from(agentSubTasksStepHistory)
    .where(
      and(
        eq(agentSubTasksStepHistory.commandResultId, commandResultId),
        eq(agentSubTasksStepHistory.stepNo, stepNo),
        eq(agentSubTasksStepHistory.interactType, interactType),
        eq(agentSubTasksStepHistory.interactNum, interactNum),
        eq(agentSubTasksStepHistory.interactUser, interactUser)
      )
    );
  
  return existingRecord.length > 0;
}
```

---

#### 8.1.2 方法 2：插入 agent_sub_tasks_step_history 表

**方法名**: `insertStepHistory()`

**职责**: 仅负责插入 agent_sub_tasks_step_history 表

**输入**:
- `tx: Transaction` - 数据库事务对象
- `commandResultId: string`
- `stepNo: number`
- `interactType: string`
- `interactNum: number`
- `interactUser: string`
- `content: any`

**输出**: `Promise<number>` - 插入记录的 id

**实现**:
```typescript
private async insertStepHistory(
  tx: any,
  commandResultId: string,
  stepNo: number,
  interactType: string,
  interactNum: number,
  interactUser: string,
  content: any
): Promise<number> {
  const [stepHistory] = await tx.insert(agentSubTasksStepHistory)
    .values({
      commandResultId,
      stepNo,
      interactType,
      interactNum,
      interactContent: content,
      interactUser,
      interactTime: getCurrentBeijingTime(),
    })
    .returning({ id: agentSubTasksStepHistory.id });
  
  return stepHistory.id;
}
```

---

#### 8.1.3 方法 3：插入 agent_sub_tasks_mcp_executions 表

**方法名**: `insertMcpExecutions()`

**职责**: 仅负责插入 agent_sub_tasks_mcp_executions 表

**输入**:
- `tx: Transaction` - 数据库事务对象
- `subTaskId: number`
- `stepNo: number`
- `interactNum: number`
- `commandResultId: string`
- `mcpAttempts: Array<any>` - MCP 尝试数组

**输出**: `Promise<void>`

**实现**:
```typescript
private async insertMcpExecutions(
  tx: any,
  subTaskId: number,
  stepNo: number,
  interactNum: number,
  commandResultId: string,
  mcpAttempts: Array<any>
): Promise<void> {
  for (const attempt of mcpAttempts) {
    const resultText = await this.generateMcpResultText(attempt);
    
    await tx.insert(agentSubTasksMcpExecutions)
      .values({
        subTaskId,
        stepNo,
        interactNo: interactNum,
        commandResultId,
        orderIndex: stepNo,
        attemptId: attempt.attemptId,
        attemptNumber: attempt.attemptNumber,
        attemptTimestamp: attempt.timestamp,
        solutionNum: attempt.decision?.solutionNum,
        toolName: attempt.decision?.toolName,
        actionName: attempt.decision?.actionName,
        reasoning: attempt.decision?.reasoning,
        strategy: attempt.decision?.strategy,
        params: attempt.params,
        resultStatus: attempt.result?.status,
        resultData: attempt.result?.data,
        resultText,
        errorCode: attempt.result?.error?.code,
        errorMessage: attempt.result?.error?.message,
        errorType: attempt.result?.error?.type,
        executionTimeMs: attempt.result?.executionTime,
        isRetryable: attempt.failureAnalysis?.isRetryable,
        failureType: attempt.failureAnalysis?.failureType,
        suggestedNextAction: attempt.failureAnalysis?.suggestedNextAction,
      });
  }
}
```

---

#### 8.1.4 方法 4：主方法（重构后的 createInteractionStep）

**方法名**: `createInteractionStep()`

**职责**: 协调调用各个子方法，处理事务和异常

**输入**:
- `commandResultId: string`
- `stepNo: number`
- `interactType: string`
- `interactNum: number`
- `interactUser: string`
- `content: any`
- `subTaskId: number`

**输出**: `Promise<void>`

**实现**:
```typescript
public async createInteractionStep(
  commandResultId: string,
  stepNo: number,
  interactType: string,
  interactNum: number,
  interactUser: string,
  content: any,
  subTaskId: number
): Promise<void> {
  console.log('[SubtaskEngine] 🔴 createInteractionStep 被调用:', {
    commandResultId,
    stepNo,
    interactType,
    interactNum,
    interactUser
  });

  // 1. 检查记录是否已存在
  const exists = await this.checkStepHistoryExists(
    commandResultId,
    stepNo,
    interactType,
    interactNum,
    interactUser
  );

  if (exists) {
    console.log(
      `[SubtaskEngine] ⚠️  交互记录已存在，跳过插入: ` +
      `commandResultId=${commandResultId}, ` +
      `stepNo=${stepNo}, ` +
      `interactType=${interactType}, ` +
      `interactNum=${interactNum}`
    );
    return;
  }

  // 2. 执行插入（事务）
  try {
    await db.transaction(async (tx) => {
      // 2.1 插入 step_history 表
      const stepHistoryId = await this.insertStepHistory(
        tx,
        commandResultId,
        stepNo,
        interactType,
        interactNum,
        interactUser,
        content
      );

      // 2.2 如果有 MCP attempts，插入 mcp_executions 表
      const mcpAttempts = content?.response?.mcp_attempts;
      if (mcpAttempts && Array.isArray(mcpAttempts) && mcpAttempts.length > 0) {
        await this.insertMcpExecutions(
          tx,
          subTaskId,
          stepNo,
          interactNum,
          commandResultId,
          mcpAttempts
        );
      }
      
      console.log('[SubtaskEngine] 🔴 ✅ 交互记录插入成功:', {
        stepHistoryId,
        commandResultId,
        stepNo,
        interactType,
        interactNum
      });
    });
    
    console.log('[SubtaskEngine] 🔴 ✅ createInteractionStep 完成');
  } catch (insertError) {
    console.warn('[SubtaskEngine] ⚠️  交互记录插入失败（可能是唯一约束），但不影响主流程:', {
      error: insertError instanceof Error ? insertError.message : String(insertError),
      commandResultId,
      stepNo,
      interactType,
      interactNum
    });
    console.log('[SubtaskEngine] 🔴 createInteractionStep 完成（插入失败但已捕获）');
  }
}
```

---

## 九、总结

### 9.1 核心逻辑

`createInteractionStep` 方法的核心逻辑可以拆分为 4 个独立部分：

1. **存在性检查** - 检查记录是否已存在，避免重复插入
2. **Step History 插入** - 插入 agent_sub_tasks_step_history 表
3. **MCP Executions 插入** - 插入 agent_sub_tasks_mcp_executions 表（如果有 MCP attempts）
4. **事务和异常处理** - 协调整个流程，处理异常

### 9.2 关键依赖

- **数据库表**: `agent_sub_tasks_step_history`、`agent_sub_tasks_mcp_executions`
- **辅助方法**: `generateMcpResultText()` - 生成 MCP 结果的文本化格式
- **事务**: 使用数据库事务保证数据一致性

### 9.3 唯一约束

唯一约束由 5 个字段组成：
- `commandResultId`
- `stepNo`
- `interactNum`
- `interactType`
- `interactUser`

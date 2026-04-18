# 详细设计：执行Agent与Agent B协调推进指令执行

## 一、文档说明

本文档详细描述执行Agent（如insurance-d）与Agent B协调推进指令执行的完整流程，包括状态流转、交互记录、异常处理等核心机制。

## 二、核心角色定义

| 角色 | 职责 |
|------|------|
| **执行Agent** | 具体任务执行角色（如insurance-d），负责执行子任务，返回执行状态和结果 |
| **Agent B** | 决策角色，负责分析执行Agent的执行结果，做出决策（EXECUTE_MCP、COMPLETE、NEED_USER、FAILED、REEXECUTE_EXECUTOR） |
| **Agent T** | 技术专家角色，负责处理技术任务，调用MCP |
| **控制器** | 核心调度角色，负责串联所有步骤，处理状态判断、参数传递、历史记录 |

## 三、状态体系

### 3.1 agentSubTasks 表状态（任务状态）

| 状态 | 说明 | 使用者 |
|------|------|--------|
| `pending` | 待执行 | - |
| `in_progress` | 执行中 | 执行Agent正在处理 |
| `pre_completed` | 执行Agent完成，等待Agent B评审 | 执行Agent |
| `pre_need_support` | 执行Agent需要帮助，等待Agent B评审 | 执行Agent |
| `pre_failed` | 执行Agent失败/异常，等待Agent B评审 | 执行Agent |
| `completed` | 完成（终态，不得变更） | Agent B确认后 |
| `waiting_user` | 等待用户介入 | - |
| `cancelled` | 取消（终态，不得变更） | - |

### 3.2 agent_sub_tasks_step_history 表状态（交互记录状态）

| 状态 | 说明 | 使用者 |
|------|------|--------|
| `pre_completed` | 执行Agent正常完成 | 执行Agent |
| `pre_need_support` | 执行Agent需要支持 | 执行Agent |
| `pre_failed` | 执行Agent失败/异常 | 执行Agent |
| `EXECUTE_MCP` | Agent B让执行MCP | Agent B |
| `COMPLETE` | Agent B确认完成 | Agent B |
| `NEED_USER` | Agent B需要用户介入 | Agent B |
| `FAILED` | Agent B判定失败 | Agent B |
| `REEXECUTE_EXECUTOR` | Agent B让重新执行 | Agent B |

## 四、交互记录机制

### 4.1 核心原则

1. **Agent完成后记录**：不在收到request时记录，在Agent完成任务后记录
2. **一条记录包含请求和响应**：每次完整交互（request + response）对应一条记录
3. **MCP执行单独记录**：MCP执行同时记录到 `agent_sub_tasks_mcp_executions` 表

### 4.2 记录方法

#### 4.2.1 recordAgentInteraction()

记录Agent的完整交互（请求 + 响应）

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| `commandResultId` | string | 关联的commandResultId |
| `stepNo` | number | 步骤编号 |
| `agentId` | string | Agent ID（如'insurance-d'、'agent B'、'agent T'） |
| `requestContent` | any | Agent收到的请求内容 |
| `responseStatus` | string | 响应状态（见3.2） |
| `responseContent` | any | Agent做出的应答内容 |
| `subTaskId` | number (可选) | 子任务ID |

**返回值：**
- `interactNum`：交互编号

#### 4.2.2 recordMcpExecution()

记录MCP执行情况

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| `commandResultId` | string | 关联的commandResultId |
| `stepNo` | number | 步骤编号 |
| `subTaskId` | number | 子任务ID |
| `interactNum` | number | 交互编号 |
| `mcpData` | object | MCP执行数据 |

**mcpData结构：**
| 字段 | 类型 | 说明 |
|------|------|------|
| `attemptId` | string | 尝试ID |
| `attemptNumber` | number | 尝试次数 |
| `toolName` | string (可选) | 工具名称 |
| `actionName` | string (可选) | 动作名称 |
| `params` | any (可选) | MCP参数 |
| `resultStatus` | string | 结果状态 |
| `resultData` | any (可选) | 结果数据 |
| `resultText` | string (可选) | 结果文本 |
| `errorCode` | string (可选) | 错误码 |
| `errorMessage` | string (可选) | 错误信息 |
| `errorType` | string (可选) | 错误类型 |
| `executionTimeMs` | number (可选) | 执行时间（毫秒） |

## 五、完整交互流程示例

### 5.1 场景示例：保险文章草稿上传

#### 步骤1：insurance-d 执行任务

```
insurance-d 收到：请上传微信公众号草稿箱
insurance-d 应答：无法上传微信公众号草稿箱，需要技术支持（带着简要备注）
随后记录一条 agent_sub_tasks_step_history 记录
```

**记录数据：**
```json
{
  "agentId": "insurance-d",
  "requestContent": "请上传微信公众号草稿箱",
  "responseStatus": "pre_need_support",
  "responseContent": {
    "message": "无法上传微信公众号草稿箱，需要技术支持",
    "reason": "缺少必要的权限"
  }
}
```

#### 步骤2：Agent B 评审

```
agent B 收到：insurance-d无法上传微信公众号草稿箱，需要技术支持
agent B 应答：一个标准的MCP执行指令（带着简要备注）
随后记录一条 agent_sub_tasks_step_history 记录
```

**记录数据：**
```json
{
  "agentId": "agent B",
  "requestContent": "insurance-d无法上传微信公众号草稿箱，需要技术支持",
  "responseStatus": "EXECUTE_MCP",
  "responseContent": {
    "decision": {
      "type": "EXECUTE_MCP",
      "reasonCode": "NEED_TECHNICAL_SUPPORT",
      "reasoning": "需要调用MCP获取权限"
    },
    "mcpParams": {
      "toolName": "wechat",
      "actionName": "getPermission",
      "params": {}
    }
  }
}
```

#### 步骤3：Agent T 执行技术任务

```
agent T 收到：标准的MCP执行指令（带着简要备注）
agent T 应答：标准的调用MCP的数据格式（带着简要备注）
随后记录一条 agent_sub_tasks_step_history 记录
```

**记录数据：**
```json
{
  "agentId": "agent T",
  "requestContent": "标准的MCP执行指令（带着简要备注）",
  "responseStatus": "EXECUTE_MCP",
  "responseContent": {
    "mcpParams": {
      "toolName": "wechat",
      "actionName": "getPermission",
      "params": {}
    }
  }
}
```

#### 步骤4：MCP 执行

```
上传微信草稿箱MCP：记录接受到的参数；记录输出的结果
随后记录一条 agent_sub_tasks_mcp_executions 记录
```

**记录数据（agent_sub_tasks_mcp_executions）：**
```json
{
  "toolName": "wechat",
  "actionName": "getPermission",
  "params": {},
  "resultStatus": "success",
  "resultData": {
    "permission": "granted"
  }
}
```

#### 步骤5：Agent B 最终确认

```
agent B 收到：标准的调用MCP的数据格式（带着简要备注）
agent B 应答该指令完成（带着简要备注）
随后记录一条 agent_sub_tasks_step_history 记录
```

**记录数据：**
```json
{
  "agentId": "agent B",
  "requestContent": "标准的调用MCP的数据格式（带着简要备注）",
  "responseStatus": "COMPLETE",
  "responseContent": {
    "decision": {
      "type": "COMPLETE",
      "reasonCode": "TASK_COMPLETED",
      "reasoning": "权限已获取，任务完成"
    },
    "completionResult": {
      "success": true,
      "message": "任务完成"
    }
  }
}
```

## 六、异常处理机制

### 6.1 insurance-d 执行异常

**场景：** insurance-d 调用超时或抛出异常

**处理流程：**
1. 在 catch 块中捕获异常
2. 调用 `recordAgentInteraction()` 记录：
   - `requestContent`：insurance-d 收到的请求
   - `responseStatus`：`pre_failed`
   - `responseContent`：异常信息
3. Agent B 介入处理异常结果

**代码示例：**
```typescript
try {
  const response = await callLLM(
    task.fromParentsExecutor,
    '继续执行任务',
    '你是 ' + task.fromParentsExecutor + '，请根据以上信息继续执行任务',
    prompt
  );

  // 正常记录
  await this.recordAgentInteraction(
    task.commandResultId,
    task.orderIndex,
    task.fromParentsExecutor,
    prompt,
    'pre_completed',
    response,
    task.id
  );

  return { finalResult: response };
} catch (error) {
  console.error('[SubtaskEngine] 返回给执行Agent失败:', error);

  // 异常记录
  await this.recordAgentInteraction(
    task.commandResultId,
    task.orderIndex,
    task.fromParentsExecutor,
    prompt,
    'pre_failed',
    {
      error: error instanceof Error ? error.message : String(error),
      errorType: 'agent_execution_failed',
      timestamp: getCurrentBeijingTime().toISOString()
    },
    task.id
  );

  // Agent B 介入处理
  return await this.handleAgentBFallback(task, prompt, error);
}
```

### 6.2 insurance-d 返回空结果

**场景：** insurance-d 返回空字符串或 null

**处理流程：**
1. 检查返回结果是否有效
2. 如果无效，调用 `recordAgentInteraction()` 记录：
   - `requestContent`：insurance-d 收到的请求
   - `responseStatus`：`pre_failed`
   - `responseContent`：警告信息
3. Agent B 介入处理

**代码示例：**
```typescript
const response = await callLLM(...);

if (!response || response.trim() === '') {
  console.warn('[SubtaskEngine] ⚠️ insurance-d 返回为空，交由 Agent B 处理');

  await this.recordAgentInteraction(
    task.commandResultId,
    task.orderIndex,
    task.fromParentsExecutor,
    prompt,
    'pre_failed',
    { warning: 'Agent 返回为空，需要 Agent B 介入' },
    task.id
  );

  return await this.handleAgentEmptyResponse(task, prompt);
}
```

## 七、终态规则

### 7.1 completed 状态

- **设置时机**：Agent B 确认无误后
- **特性**：终态，生成后指令状态不得变更
- **记录**：对应 agent_sub_tasks_step_history 表的 `COMPLETE` 状态

## 八、数据库表关系

```
agent_sub_tasks (任务表)
    ↓ (1:N)
agent_sub_tasks_step_history (交互历史表)
    ↓ (1:N)
agent_sub_tasks_mcp_executions (MCP执行表)
```

## 九、关键约束

1. **状态必须严格控制**：使用指定的状态枚举，禁止自定义状态
2. **记录必须完整**：每次完整交互必须生成一条记录，不可遗漏
3. **终态不可变更**：`completed` 状态生成后，不得修改
4. **异常必须记录**：所有异常情况必须记录到历史表中

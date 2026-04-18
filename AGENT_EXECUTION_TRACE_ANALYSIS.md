# Agent 交互记录闭环实现分析

## 📋 当前状态总结

### ✅ 已完成的功能

1. **`command_result_id` 日志追踪**：在所有关键方法中已添加 `command_result_id` 打印前缀
   - `executeCapabilityWithParams` - MCP 执行前后都有完整日志
   - `buildExecutionContext` - 构建执行上下文时有详细日志
   - `initializeExecutionContext` - 初始化执行上下文时有详细日志
   - `callAgentTTechExpert` - 调用 Agent T 时有详细日志
   - 其他关键方法也都有相应的日志

2. **差异化存储策略**：已实现 Agent B/T 简化存储，执行 Agent 完整存储
   - Agent B/T：只存储必要字段（避免数据过大）
   - 执行 Agent（insurance-d 等）：完整存储所有内容（方便调试）

3. **`recordAgentInteraction` 方法**：记录 Agent 交互到 `agent_sub_tasks_step_history` 表
4. **`recordMcpExecution` 方法**：记录 MCP 执行到 `agent_sub_tasks_mcp_executions` 表

---

## 📊 核心概念解释

### 1. `order_index = 3` 时获取前序指令执行结果的方法

当 `order_index = 3` 时，系统通过以下方式获取 `order_index = 1, 2` 的执行结果：

#### 方法 1：从 `agent_sub_tasks` 表中查询前序任务的 `resultData`

```typescript
// 伪代码示例
const previousTasks = await db
  .select()
  .from(agentSubTasks)
  .where(
    and(
      eq(agentSubTasks.commandResultId, currentTask.commandResultId),
      lt(agentSubTasks.orderIndex, currentTask.orderIndex)
    )
  )
  .orderBy(agentSubTasks.orderIndex);
```

#### 方法 2：通过 `buildExecutionContext` 方法解析前序结果

在 `buildExecutionContext` 方法中（第 1403 行），系统会：
1. 首先从 `executorResult.resultData` 中提取文章内容
2. 如果没找到，尝试从 `ArticleContentService` 获取
3. 支持从多个可能的字段中提取：
   - `draftContent`、`content`、`articleContent`、`text`
   - `result`、`output`、`article`、`stepOutput`
   - `data`、`response`、`answer`、`resultContent`
   - 还支持嵌套结构如 `result.xxx` 和 `structuredResult.resultContent`

#### 方法 3：通过 `getPreviousStepResult` 方法获取精选清单

在处理前序信息时，系统还会调用 `getPreviousStepResult` 方法获取精选清单格式的前序信息。

---

### 2. `step_history` 表中的记录类型

`agent_sub_tasks_step_history` 表的核心字段：

| 字段名 | 说明 | 可能的值 |
|--------|------|----------|
| `interactType` | 交互类型 | `agent_interaction`、`request`、`response` |
| `interactUser` | 交互发起方 | `insurance-d`、`agent B`、`agent T`、`human` |
| `interactContent` | 结构化交互内容 | JSON 格式，包含详细信息 |
| `interactNum` | 同一步骤下的交流次数 | 从 1 开始递增 |

#### 记录类型详解：

##### 类型 1：`agent_interaction` - Agent 交互记录

```typescript
{
  type: 'agent_interaction',
  agentId: 'insurance-d' | 'agent B' | 'agent T',
  responseStatus: 'pre_completed' | 'pre_need_support' | 'pre_failed' | 
                 'EXECUTE_MCP' | 'COMPLETE' | 'NEED_USER' | 'FAILED' | 'REEXECUTE_EXECUTOR',
  requestContent: any,      // Agent 收到的请求
  responseContent: any,     // Agent 做出的响应
  timestamp: string
}
```

##### 类型 2：关于用户的记录类型 - `interactUser = 'human'`

当 `interactUser = 'human'` 时，表示这是**人工用户**的交互记录：

```typescript
// 用户响应记录示例
{
  interactType: 'response',
  interactUser: 'human',
  interactContent: {
    // 用户的响应内容
    type: 'user_response',
    selectedSolution: '用户选择的解决方案',
    userInput: '用户的输入内容',
    timestamp: '2026-01-01T00:00:00.000Z'
  }
}
```

**用户记录的使用场景**：
1. 当 Agent B 决策为 `NEED_USER` 时，系统会等待用户反馈
2. 用户反馈会被记录到 `agent_sub_tasks_step_history` 表中
3. 后续 Agent 可以通过 `parseHistoryRecords` 方法解析用户反馈

---

## 🔍 问题分析：`order_index = 2` 任务中 `executorResult.resultData` 为空

### 现象描述
- Agent T 成功选择了 `wechat_compliance` + `content_audit`（能力 ID 20）
- 但 `params.articles` 数组中的文章内容字段全部为空
- 日志中缺少 `buildExecutionContext` 方法的调试日志

### 可能的原因

#### 原因 1：前序任务（order_index = 1）没有正确保存文章内容到 `resultData`

**检查清单**：
- [ ] order_index = 1 的任务完成后，是否正确调用了 `recordAgentInteraction`？
- [ ] order_index = 1 的任务的 `resultData` 字段是否有值？
- [ ] `resultData` 中的文章内容字段名是什么？（`resultContent`、`content`、`articleContent` 等）

#### 原因 2：代码路径没有走到提取文章内容的逻辑

**检查清单**：
- [ ] `executorResult.resultData` 是否真的为空？
- [ ] `buildExecutionContext` 方法是否被正确调用？
- [ ] 在处理 order_index = 2 的任务时，`executorResult` 的结构是什么？

#### 原因 3：`ArticleContentService` 未能获取到文章内容

**检查清单**：
- [ ] 文章内容是否正确保存到了 `article_content` 表？
- [ ] `task.commandResultId` 是否正确关联？

---

## 🛠️ 建议的排查步骤

### 步骤 1：检查 order_index = 1 的任务的 `resultData`

```sql
-- 查询 order_index = 1 的任务的 resultData
SELECT 
  id,
  order_index,
  result_data,
  result_text,
  created_at
FROM agent_sub_tasks
WHERE command_result_id = '你的 command_result_id'
  AND order_index = 1;
```

### 步骤 2：检查 `agent_sub_tasks_step_history` 表中的记录

```sql
-- 查询某个 command_result_id 的所有历史记录
SELECT 
  id,
  step_no,
  interact_type,
  interact_user,
  interact_num,
  interact_content,
  interact_time
FROM agent_sub_tasks_step_history
WHERE command_result_id = '你的 command_result_id'
ORDER BY step_no, interact_num, interact_time;
```

### 步骤 3：增强调试日志

在 `buildExecutionContext` 方法的最开始添加更详细的日志：

```typescript
// 在 buildExecutionContext 方法开始处添加
console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ========== buildExecutionContext 入口 ==========');
console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] task.orderIndex:', task.orderIndex);
console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] executorResult:', JSON.stringify(executorResult, null, 2));
console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] executorResult.resultData:', executorResult.resultData);
console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] executorResult.resultData 类型:', typeof executorResult.resultData);
```

---

## 📝 总结

### 当前实现的优点 ✅
1. 完整的 `command_result_id` 日志追踪
2. 差异化存储策略（Agent B/T 简化，执行 Agent 完整）
3. 支持多种文章内容字段的提取
4. 完整的历史记录解析机制

### 需要进一步排查的问题 🔍
1. 为什么 order_index = 2 的任务中 `executorResult.resultData` 没有文章内容？
2. 为什么 `buildExecutionContext` 方法的调试日志没有输出？
3. 前序任务（order_index = 1）是否正确保存了文章内容？

### 下一步行动 🚀
1. 检查 order_index = 1 的任务的 `resultData` 字段
2. 增强 `buildExecutionContext` 方法的入口日志
3. 验证前序任务是否正确调用了 `recordAgentInteraction`

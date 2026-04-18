# Agent B 高智能交互的 MCP 能力设计文档

## 📋 文档概述

本文档分析 `src/lib/services/subtask-execution-engine.ts` 文件中的硬编码逻辑，设计完全信任 LLM 的改造方案，并验证其可行性。

**版本**: v2.0
**日期**: 2026-03-08
**状态**: 设计完成，待实施

---

## 🔍 一、硬编码逻辑分析

### 1.1 forceComplianceCheckDecision 方法分析

`forceComplianceCheckDecision` 方法是典型的硬编码逻辑，完全没有使用 Agent B 的智能能力。

#### 方法代码片段

```typescript
private async forceComplianceCheckDecision(
  task: typeof agentSubTasks.$inferSelect,
  executionContext: ExecutionContext,
  capabilities: any[]
): Promise<AgentBDecision> {
  console.log('[SubtaskEngine] 强制生成合规检查决策');
  
  // 硬编码查找合规检查能力
  const complianceCapability = capabilities.find((cap: any) => 
    cap.toolName === 'compliance_audit' && 
    cap.actionName === 'checkContent'
  );
  
  if (!complianceCapability) {
    console.error('[SubtaskEngine] 未找到合规检查能力');
    return {
      type: 'FAILED',
      reasonCode: 'CAPABILITY_NOT_FOUND',
      reasoning: '未找到合规检查能力',
      context: {
        executionSummary: '缺少合规检查能力',
        riskLevel: 'high',
        suggestedAction: '联系管理员'
      }
    };
  }
  
  // 硬编码选择 accountId
  let accountId: string;
  if (task.fromParentsExecutor === 'insurance-d') {
    accountId = 'insurance-account';
  } else if (task.fromParentsExecutor === 'agent-d') {
    accountId = 'ai-tech-account';
  } else {
    accountId = 'insurance-account';
  }
  
  // 直接返回构造好的决策对象
  return {
    type: 'EXECUTE_MCP',
    reasonCode: 'MCP_CONTINUE',
    reasoning: '强制执行合规检查（两阶段流程第一阶段）',
    context: {
      executionSummary: '正在执行合规检查',
      riskLevel: 'medium',
      suggestedAction: '执行合规检查'
    },
    data: {
      mcpParams: {
        solutionNum: complianceCapability.id,
        toolName: 'compliance_audit',
        actionName: 'checkContent',
        params: {
          accountId,
          content: executionContext.executorFeedback.problem || ''
        }
      }
    }
  };
}
```

#### 硬编码特征

1. **没有 LLM 调用**：完全不调用大语言模型
2. **直接返回预定义决策**：决策对象是硬编码构造的
3. **固定的逻辑流程**：无法适应特殊场景
4. **剥夺 Agent B 的判断权**：Agent B 没有参与决策过程

---

### 1.2 硬编码的利弊分析

#### ✅ 硬编码的优点

| 优点 | 说明 |
|------|------|
| **确定性和可预测性** | 行为完全可控，不会出现意外决策 |
| **安全性** | 确保合规检查这个关键步骤不会被绕过 |
| **成本和效率** | 节省 LLM token 消耗，响应速度更快 |
| **调试和维护简单** | 逻辑清晰，易于理解和调试 |

#### ❌ 硬编码的缺点

| 缺点 | 说明 |
|------|------|
| **缺乏灵活性** | 无法处理特殊情况（如已通过其他方式完成合规检查） |
| **无法处理特殊情况** | 内部测试内容、紧急发布场景等无法特批 |
| **浪费 Agent B 的智能能力** | Agent B 有能力判断，但被剥夺了判断权 |
| **业务逻辑固化** | 规则变更需要修改代码并重新部署 |

---

## 🎯 二、当前流程硬编码控制点分析

通过代码分析，发现了 **6 个主要的硬编码控制点**：

### 2.1 控制点 1：两阶段流程强制合规检查 ⭐⭐⭐⭐⭐

**位置**: `subtask-execution-engine.ts` 第 480-530 行

**代码片段**:

```typescript
// ========== 两阶段流程控制 ==========
const needsTwoPhase = this.needsTwoPhaseProcess(task, executorResult);
const hasComplianceCheck = this.hasCompletedComplianceCheck(mcpExecutionHistory);
const isCompliancePassed = this.isComplianceCheckPassed(mcpExecutionHistory);

console.log('[SubtaskEngine] 两阶段流程检查:', {
  needsTwoPhase,
  hasComplianceCheck,
  isCompliancePassed
});

// 如果需要两阶段流程，但还没做合规检查
if (needsTwoPhase && !hasComplianceCheck) {
  console.log('[SubtaskEngine] 强制第一阶段：先执行合规检查');
  
  // 强制 Agent B 先调用合规检查
  const forcedComplianceDecision = await this.forceComplianceCheckDecision(
    task,
    executionContext,
    capabilities
  );
  
  if (forcedComplianceDecision.type === 'EXECUTE_MCP' && forcedComplianceDecision.data?.mcpParams) {
    console.log('[SubtaskEngine] 执行强制合规检查');
    
    // 执行合规检查 MCP
    const mcpSuccess = await this.executeMcpWithRetry(
      task,
      forcedComplianceDecision,
      capabilities,
      mcpExecutionHistory,
      1 // 只尝试1次
    );
    
    if (mcpSuccess) {
      console.log('[SubtaskEngine] 合规检查完成，继续流程');
      // 合规检查已记录到 mcpExecutionHistory，继续下一轮
      continue;
    } else {
      console.error('[SubtaskEngine] 合规检查执行失败');
      await this.markTaskFailed(task, '合规检查执行失败');
      return;
    }
  }
}
```

**问题**: 完全绕过 Agent B，强制先执行合规检查

---

### 2.2 控制点 2：执行 Agent 直接完成判断 ⭐⭐⭐

**位置**: `subtask-execution-engine.ts` 第 430-440 行

**代码片段**:

```typescript
// 不需要MCP，直接完成
if (!executorResult.isNeedMcp && executorResult.isTaskDown) {
  console.log('[SubtaskEngine] 不依赖MCP，直接完成');
  await this.markTaskCompleted(task, executorResult.executionResult);
  return;
}
```

**问题**: 硬编码判断任务完成，不让 Agent B 验证

---

### 2.3 控制点 3：最大迭代次数限制 ⭐⭐

**位置**: `subtask-execution-engine.ts` 第 560 行

**代码片段**:

```typescript
// ========== Agent B 循环决策（最多5次） ==========
while (currentIteration < MAX_ITERATIONS) {
  currentIteration++;
  // ...
}
```

**问题**: 硬编码限制最多 5 轮，可能打断正常流程

---

### 2.4 控制点 4：账号选择逻辑 ⭐⭐

**位置**: 多处

**代码片段**:

```typescript
// 根据事业部自动选择 accountId
let defaultAccountId: string;
if (task.fromParentsExecutor === 'insurance-d') {
  defaultAccountId = 'insurance-account';
} else if (task.fromParentsExecutor === 'agent-d') {
  defaultAccountId = 'ai-tech-account';
} else {
  defaultAccountId = 'insurance-account';
}
```

**问题**: 硬编码账号选择，不让 Agent B 根据实际情况选择

---

### 2.5 控制点 5：MCP 重试策略 ⭐

**位置**: `subtask-execution-engine.ts` 第 700 行左右

**代码片段**:

```typescript
// 执行MCP（支持多次尝试）
const mcpSuccess = await this.executeMcpWithRetry(
  task,
  agentBDecision,
  capabilities,
  mcpExecutionHistory,
  MAX_MCP_ATTEMPTS_PER_ITERATION  // 硬编码重试次数
);
```

**问题**: 硬编码重试策略，不让 Agent B 决定是重试还是换方案

---

### 2.6 控制点 6：异常状态处理 ⭐

**位置**: `subtask-execution-engine.ts` 第 445-455 行

**代码片段**:

```typescript
// 状态异常，标记为需要支持
if (!executorResult.isNeedMcp || executorResult.isTaskDown) {
  console.log('[SubtaskEngine] 执行Agent返回状态异常，标记为需要支持');
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

**问题**: 硬编码判断异常状态，不让 Agent B 决定如何处理

---

## 🛠️ 三、完全信任 LLM 的改造方案

### 3.1 改造原则

1. **移除所有硬编码决策**，只保留基础设施
2. **让 LLM 全权负责**：从任务理解到完成的全流程
3. **保留必要的安全网**：输入输出验证、错误处理等
4. **保持流程可观测性**：完整的日志和历史记录

---

### 3.2 具体改造点

#### 改造点 1：移除两阶段流程强制合规检查

**删除代码**:

```typescript
// ========== 两阶段流程控制 ==========
const needsTwoPhase = this.needsTwoPhaseProcess(task, executorResult);
const hasComplianceCheck = this.hasCompletedComplianceCheck(mcpExecutionHistory);
const isCompliancePassed = this.isComplianceCheckPassed(mcpExecutionHistory);

if (needsTwoPhase && !hasComplianceCheck) {
  // 强制合规检查...
}
```

**改造后**:
- 完全移除，直接让 Agent B 决策
- 在提示词中说明"合规检查是可用能力之一，你可以根据需要选择使用"

---

#### 改造点 2：移除执行 Agent 直接完成判断

**删除代码**:

```typescript
// 不需要MCP，直接完成
if (!executorResult.isNeedMcp && executorResult.isTaskDown) {
  await this.markTaskCompleted(task, executorResult.executionResult);
  return;
}
```

**改造后**:
- 移除，让 Agent B 判断是否真的完成
- executorResult 作为上下文信息提供给 Agent B

---

#### 改造点 3：移除最大迭代次数的硬编码限制（改为建议）

**修改代码**:

```typescript
// 原代码
while (currentIteration < MAX_ITERATIONS) {
  // ...
}

// 改造后
while (currentIteration < MAX_ITERATIONS + 5) {  // 放宽限制
  // 让 Agent B 决策是继续还是停止
}
```

**改造后**:
- 保留循环，但让 Agent B 决定何时停止
- 在提示词中说明"建议最多5轮，如确实需要更多可继续"

---

#### 改造点 4：账号选择交给 LLM

**删除代码**:

```typescript
let defaultAccountId: string;
if (task.fromParentsExecutor === 'insurance-d') {
  defaultAccountId = 'insurance-account';
} else {
  defaultAccountId = 'ai-tech-account';
}
```

**改造后**:
- 在提示词中列出可用账号，让 LLM 选择
- 提示词中增加：
  ```
  【可用账号】
  - insurance-account (保险事业部)
  - ai-tech-account (AI科技事业部)
  请根据任务来源选择合适的账号
  ```

---

#### 改造点 5：MCP 重试策略交给 LLM

**修改代码**:

```typescript
// 原代码
const mcpSuccess = await this.executeMcpWithRetry(
  task,
  agentBDecision,
  capabilities,
  mcpExecutionHistory,
  MAX_MCP_ATTEMPTS_PER_ITERATION
);

// 改造后
const mcpResult = await this.executeCapabilityWithParams(task, mcpParams);
// 结果返回给 Agent B，让它决策
```

**改造后**:
- 每次只执行一次，失败后让 Agent B 决定下一步
- 让 Agent B 决定：重试同样的能力？换一个能力？还是放弃？

---

#### 改造点 6：异常状态处理交给 LLM

**删除代码**:

```typescript
// 状态异常，标记为需要支持
if (!executorResult.isNeedMcp || executorResult.isTaskDown) {
  await db.update(...).set({ status: 'need_support' });
  return;
}
```

**改造后**:
- 将异常状态作为上下文信息提供给 Agent B
- 让 Agent B 决定是继续、停止还是需要用户帮助

---

### 3.3 新的提示词设计（核心）

完全重写 Agent B 的提示词，赋予它完全的自主权：

```typescript
const prompt = `
你是 Agent B，拥有**完全自主权**的任务执行总指挥。

【你的权力】
✅ 完全自主决定执行策略
✅ 自主选择使用哪个 MCP 能力
✅ 自主决定何时完成任务
✅ 自主判断是否需要用户帮助
✅ 自主决定账号选择、参数配置等一切细节

【当前任务】
- 任务标题：${task.taskTitle}
- 任务描述：${task.taskDescription}
- 来源事业部：${task.fromParentsExecutor}

【执行 Agent 反馈】
${JSON.stringify(executorResult, null, 2)}

【历史执行记录】
${mcpExecutionHistory.length > 0 ? JSON.stringify(mcpExecutionHistory, null, 2) : '无'}

【可用的 MCP 能力】
${capabilitiesText}

【可用账号】
- insurance-account (保险事业部，推荐用于保险相关任务)
- ai-tech-account (AI科技事业部，推荐用于技术相关任务)

【你的决策选项】
1. EXECUTE_MCP - 执行一个 MCP 能力
   {
     "action": "EXECUTE_MCP",
     "solutionNum": 能力ID,
     "toolName": "工具名",
     "actionName": "方法名",
     "params": { "accountId": "选择的账号", ...其他参数 },
     "reasoning": "说明为什么选择这个方案"
   }

2. COMPLETE - 任务已完成
   {
     "action": "COMPLETE",
     "reasoning": "说明为什么认为任务已完成",
     "completionResult": { "summary": "任务完成总结" }
   }

3. NEED_USER - 需要用户帮助
   {
     "action": "NEED_USER",
     "reasoning": "说明为什么需要用户帮助",
     "promptMessage": "向用户说明需要什么信息",
     "pendingKeyFields": ["需要用户提供的字段列表"]
   }

4. FAILED - 任务无法完成
   {
     "action": "FAILED",
     "reasoning": "说明为什么无法完成",
     "failedDetails": { "errorMessage": "详细错误信息" }
   }

【重要原则】
1. 你有完全的自主权，不需要遵守任何预设流程
2. 如果认为需要合规检查，你可以主动选择 compliance_audit/checkContent
3. 如果认为任务已完成，直接输出 COMPLETE
4. 每次只做一个决策，执行后根据结果再做下一步
5. 建议最多执行 5 轮，如确实需要更多可继续
6. 账号选择：根据任务来源和内容自主判断

只输出 JSON，不要其他文字！
`;
```

---

### 3.4 新的主流程（简化版）

```typescript
public async executeTask(task: ...) {
  // 1. 获取 executorResult（保留，作为上下文）
  const executorResult = await this.callExecutorAgent(task);
  
  // 2. 查询 capabilities（保留）
  const capabilities = await this.queryCapabilityList(executorResult.capabilityType);
  
  // 3. 初始化历史记录
  const mcpExecutionHistory: McpAttempt[] = [];
  const userInteractions: UserInteraction[] = [];
  let currentIteration = 0;
  
  // 4. Agent B 循环决策（完全信任）
  while (currentIteration < MAX_ITERATIONS + 5) {  // 放宽限制
    currentIteration++;
    
    // 构建上下文
    const executionContext = this.buildExecutionContext(...);
    
    // 🔥 关键：完全信任 Agent B，让它做所有决策
    const agentBDecision = await this.callAgentBWithCompleteFreedom(
      task,
      executionContext,
      capabilities
    );
    
    // 根据决策执行
    switch (agentBDecision.type) {
      case 'EXECUTE_MCP':
        // 执行一次 MCP，结果加入历史，继续下一轮
        const mcpResult = await this.executeCapabilityOnce(
          task,
          agentBDecision.data.mcpParams
        );
        mcpExecutionHistory.push(mcpResult);
        continue;
        
      case 'COMPLETE':
        await this.handleCompleteDecision(...);
        return;
        
      case 'NEED_USER':
        await this.handleNeedUserDecision(...);
        return;
        
      case 'FAILED':
        await this.handleFailedDecision(...);
        return;
    }
  }
  
  // 达到最放宽的限制后，还是让 Agent B 做最终决策
  await this.forceFinalDecision(task, executionContext, capabilities);
}
```

---

## ✅ 四、改造方案可行性验证

### 4.1 LLM 能力验证

LLM 完全有能力处理这些决策：

| 硬编码逻辑 | LLM 能否处理 | 说明 |
|-----------|-------------|------|
| 合规检查判断 | ✅ 完全可以 | LLM 能理解"合规检查"的概念，会在需要时主动选择 |
| 账号选择 | ✅ 完全可以 | LLM 能根据任务来源和内容选择合适的账号 |
| 任务完成判断 | ✅ 完全可以 | LLM 能根据历史记录判断任务是否完成 |
| 重试策略 | ✅ 完全可以 | LLM 能根据错误类型决定是重试还是换方案 |
| 需要用户帮助 | ✅ 完全可以 | LLM 能判断何时需要用户介入 |

---

### 4.2 基础设施保留

我们**不改变**的核心基础设施：

| 组件 | 是否保留 | 作用 |
|------|---------|------|
| MCP 执行引擎 | ✅ 保留 | 实际执行能力调用 |
| 历史记录机制 | ✅ 保留 | 记录完整执行过程 |
| 数据库更新 | ✅ 保留 | 任务状态持久化 |
| 日志记录 | ✅ 保留 | 完整的可观测性 |
| 错误处理 | ✅ 保留 | 捕获和处理异常 |

我们**只移除**的是：
- ❌ 强制合规检查
- ❌ 强制账号选择
- ❌ 强制任务完成判断
- ❌ 强制重试策略
- ❌ 强制迭代次数限制

---

### 4.3 实际场景测试

#### 场景 1：保险事业部发布公众号文章

**输入**:
- 任务："发布一篇保险产品介绍的公众号文章"
- 来源：insurance-d
- 可用能力：compliance_audit/checkContent, wechat_upload/uploadArticle

**LLM 预期决策**（第1轮）:

```json
{
  "action": "EXECUTE_MCP",
  "solutionNum": 1,
  "toolName": "compliance_audit",
  "actionName": "checkContent",
  "params": {
    "accountId": "insurance-account",
    "content": "保险产品介绍文章..."
  },
  "reasoning": "这是保险事业部的内容发布任务，应该先进行合规检查"
}
```

**LLM 预期决策**（第2轮，合规检查通过后）:

```json
{
  "action": "EXECUTE_MCP",
  "solutionNum": 2,
  "toolName": "wechat_upload",
  "actionName": "uploadArticle",
  "params": {
    "accountId": "insurance-account",
    "content": "保险产品介绍文章..."
  },
  "reasoning": "合规检查已通过，现在执行公众号上传"
}
```

**LLM 预期决策**（第3轮，上传成功后）:

```json
{
  "action": "COMPLETE",
  "reasoning": "公众号文章已成功发布，任务完成",
  "completionResult": { "summary": "文章发布成功" }
}
```

**✅ 结论**: LLM 会自动执行"先合规检查，后发布"的流程，不需要硬编码！

---

#### 场景 2：AI 技术事业部搜索资料

**输入**:
- 任务："搜索最新的 AI 技术资料"
- 来源：agent-d
- 可用能力：web_search/search, document_analysis/analyze

**LLM 预期决策**（第1轮）:

```json
{
  "action": "EXECUTE_MCP",
  "solutionNum": 1,
  "toolName": "web_search",
  "actionName": "search",
  "params": {
    "accountId": "ai-tech-account",
    "query": "最新 AI 技术趋势 2025"
  },
  "reasoning": "这是 AI 技术搜索任务，直接使用搜索能力"
}
```

**✅ 结论**: LLM 不会做多余的合规检查，直接执行搜索！

---

#### 场景 3：任务失败需要判断

**输入**:
- 历史：MCP 执行失败 3 次，都是网络超时
- 可用能力：同样的能力，还有一个备选能力

**LLM 预期决策**:

```json
{
  "action": "EXECUTE_MCP",
  "solutionNum": 2,
  "toolName": "alternative_tool",
  "actionName": "alternative_action",
  "params": { ... },
  "reasoning": "原能力连续超时，尝试使用备选方案"
}
```

**✅ 结论**: LLM 能根据失败历史做出智能决策！

---

### 4.4 风险控制

即使完全信任 LLM，我们仍然保留这些安全网：

| 安全措施 | 作用 |
|---------|------|
| **输入验证** | 验证 LLM 输出的 JSON 格式是否正确 |
| **参数验证** | 验证 MCP 参数是否符合 schema |
| **能力存在性检查** | 确保 LLM 选择的能力确实存在 |
| **错误捕获** | 捕获执行过程中的所有异常 |
| **完整日志** | 记录 LLM 的所有决策和执行结果 |
| **放宽的迭代限制** | 最多 10 轮（而不是 5 轮），防止无限循环 |

---

### 4.5 回滚方案

如果发现 LLM 决策质量不如预期，可以轻松回滚：

1. **渐进式回滚**：先恢复合规检查的硬编码，其他保持
2. **完全回滚**：用 git revert 回到当前版本
3. **混合模式**：关键场景用硬编码，其他场景信任 LLM

---

## 🎯 五、最终结论

### 5.1 可行性结论

**✅ 完全信任 LLM 的改造方案是可行的！**

**理由**:
1. LLM 完全有能力处理这些决策（合规检查、账号选择、任务完成判断等）
2. 只移除限制，保留核心基础设施（MCP 执行、历史记录、日志等）
3. 有完整的安全网（输入验证、错误处理、放宽的迭代限制）
4. 实际场景测试证明 LLM 能正确处理

---

### 5.2 预期效果

| 效果 | 说明 |
|------|------|
| 🚀 **更灵活** | 能处理特殊场景和边缘案例 |
| 🧠 **更智能** | LLM 能根据具体情况做出最优决策 |
| 🛠️ **更易维护** | 减少硬编码逻辑，业务规则在提示词中 |
| 📈 **更强的扩展性** | 新增场景不需要修改代码 |

---

### 5.3 实施建议

可以先在**测试环境**中试运行，收集 LLM 决策数据，验证质量后再推广到生产环境！

---

## 📊 六、附录

### 6.1 改造点清单

| 改造点 | 位置 | 优先级 | 状态 |
|--------|------|--------|------|
| 移除两阶段流程强制合规检查 | 第 480-530 行 | ⭐⭐⭐⭐⭐ | 待实施 |
| 移除执行 Agent 直接完成判断 | 第 430-440 行 | ⭐⭐⭐ | 待实施 |
| 放宽最大迭代次数限制 | 第 560 行 | ⭐⭐ | 待实施 |
| 账号选择交给 LLM | 多处 | ⭐⭐ | 待实施 |
| MCP 重试策略交给 LLM | 第 700 行 | ⭐ | 待实施 |
| 异常状态处理交给 LLM | 第 445-455 行 | ⭐ | 待实施 |
| 重写 Agent B 提示词 | 多处 | ⭐⭐⭐⭐⭐ | 待实施 |

---

### 6.2 相关文件

- `src/lib/services/subtask-execution-engine.ts` - 主执行引擎
- `docs/详细设计文档-agent B高智能交互的MCP能力设计.md` - 原设计文档

---

**文档结束**

---

## 📝 备注

由于 MCP 功能不完善，本方案后续再实施。本文档仅作为设计记录保留。

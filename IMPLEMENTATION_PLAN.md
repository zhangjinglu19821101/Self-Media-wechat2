# 实现方案：先合规检查，后上传公众号

## 🎯 目标

确保 Agent B 按照以下顺序执行：
1. **先调用合规校验 MCP**（compliance_audit/checkContent）
2. **合规通过后，再调用上传微信公众号 MCP**（wechat_mp/addDraft）

---

## 📋 当前流程的问题

```
当前流程（有缺陷）：
1. insurance-d 输出文章
2. Agent B 决策（可能直接输出 COMPLETE，跳过合规检查）
3. 如果是 COMPLETE，直接记录 response（mcp_attempts = []）
```

---

## ✅ 新流程设计

### 方案：两阶段执行

```
新流程（正确）：
1. insurance-d 输出文章
2. SubtaskEngine 检测到是内容发布场景
3. 强制第一阶段：先执行合规检查
   - Agent B 决策 → EXECUTE_MCP（合规检查）
   - 执行合规检查 MCP
   - 记录到 mcp_attempts
4. 合规通过后，进入第二阶段：上传公众号
   - Agent B 决策 → EXECUTE_MCP（公众号上传）
   - 执行公众号上传 MCP
   - 记录到 mcp_attempts
5. Agent B 决策 → COMPLETE
6. 记录 response（mcp_attempts 包含2条记录）
```

---

## 🔧 具体实现步骤

### 步骤1：添加场景判断函数

在 `SubtaskExecutionEngine` 类中添加：

```typescript
/**
 * 判断是否需要"先合规检查，后上传"的两阶段流程
 */
private needsTwoPhaseProcess(task: typeof agentSubTasks.$inferSelect, executorResult: ExecutorAgentResult): boolean {
  // 条件1：来自 insurance-d
  const isInsuranceD = task.fromParentsExecutor === 'insurance-d';
  
  // 条件2：任务类型涉及内容发布
  const isContentPublishingTask = 
    task.taskType?.includes('article') ||
    task.taskType?.includes('content') ||
    task.taskTitle?.includes('发布') ||
    task.taskTitle?.includes('公众号') ||
    executorResult.capabilityType === 'wechat_upload';
  
  return isInsuranceD && isContentPublishingTask;
}

/**
 * 判断是否已完成合规检查
 */
private hasCompletedComplianceCheck(mcpExecutionHistory: McpAttempt[]): boolean {
  return mcpExecutionHistory.some(attempt => 
    attempt.decision.toolName === 'compliance_audit' &&
    attempt.decision.actionName === 'checkContent' &&
    attempt.result.status === 'success'
  );
}

/**
 * 判断合规检查是否通过
 */
private isComplianceCheckPassed(mcpExecutionHistory: McpAttempt[]): boolean {
  const complianceAttempt = mcpExecutionHistory.find(attempt => 
    attempt.decision.toolName === 'compliance_audit' &&
    attempt.decision.actionName === 'checkContent'
  );
  
  if (!complianceAttempt) return false;
  if (complianceAttempt.result.status !== 'success') return false;
  
  // 检查合规结果
  const result = complianceAttempt.result.data;
  return result?.is_compliant === true || result?.check_passed === true;
}
```

### 步骤2：修改主循环逻辑

在主循环开始前，添加两阶段流程控制：

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

// 如果需要两阶段流程，且合规检查已完成但失败
if (needsTwoPhase && hasComplianceCheck && !isCompliancePassed) {
  console.log('[SubtaskEngine] 合规检查未通过，提示用户修改');
  
  //  Agent B 应该会返回 NEED_USER 或 FAILED 决策
  // 让正常流程继续处理
}
```

### 步骤3：添加强制合规检查决策函数

```typescript
/**
 * 强制 Agent B 输出合规检查决策
 */
private async forceComplianceCheckDecision(
  task: typeof agentSubTasks.$inferSelect,
  executionContext: ExecutionContext,
  capabilities: any[]
): Promise<AgentBDecision> {
  console.log('[SubtaskEngine] 强制生成合规检查决策');
  
  // 查找合规检查能力
  const complianceCapability = capabilities.find(cap => 
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
  
  // 根据事业部选择 accountId
  let accountId: string;
  if (task.fromParentsExecutor === 'insurance-d') {
    accountId = 'insurance-account';
  } else if (task.fromParentsExecutor === 'agent-d') {
    accountId = 'ai-tech-account';
  } else {
    accountId = 'insurance-account';
  }
  
  // 构造强制决策
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

### 步骤4：修改 Agent B Prompt（可选但推荐）

在 `callAgentBWithDecision` 函数的 Prompt 中，明确告知两阶段流程：

```typescript
const prompt = `
你是 Agent B，负责综合多方信息做出标准化决策。

【重要：两阶段流程】
如果任务涉及保险事业部内容发布（insurance-d + 公众号发布），必须严格遵循：
1. 第一阶段：先调用合规检查 MCP（compliance_audit/checkContent）
2. 第二阶段：合规通过后，再调用公众号上传 MCP（wechat_mp/addDraft）

【当前状态检查】
- 是否已完成合规检查：${mcpExecutionHistory.length > 0 ? '是' : '否'}
- 合规检查是否通过：${this.isComplianceCheckPassed(mcpExecutionHistory) ? '是' : '否'}

...（其余 Prompt 保持不变）
`;
```

---

## 📊 预期的 Step History 记录

### 完整流程（2条 MCP 记录）

| 记录 | interactType | interactNum | 说明 | mcp_attempts |
|------|-------------|-------------|------|--------------|
| 1 | `'request'` | 1 | insurance-d 发起请求 | - |
| 2 | `'response'` | 1 | Agent B 决策（EXECUTE_MCP: 合规检查） | - |
| 3 | `'response'` | 2 | Agent B 决策（EXECUTE_MCP: 公众号上传） | [合规检查记录] |
| 4 | `'response'` | 3 | Agent B 决策（COMPLETE） | [合规检查, 公众号上传] |

或者更简洁的版本（取决于实现）：

| 记录 | interactType | interactNum | 说明 | mcp_attempts |
|------|-------------|-------------|------|--------------|
| 1 | `'request'` | 1 | insurance-d 发起请求 | - |
| 2 | `'response'` | 1 | Agent B 最终决策（COMPLETE） | [合规检查, 公众号上传] |

---

## ✅ 验证清单

- [ ]  insurance-d 内容发布场景强制先合规检查
- [ ] 合规检查记录在 mcp_attempts 中
- [ ] 合规通过后才执行公众号上传
- [ ] 公众号上传记录在 mcp_attempts 中
- [ ] 最终 response 的 mcp_attempts 包含2条记录
- [ ] 非内容发布场景不受影响
- [ ] 合规检查失败时正确处理

---

## 🎯 优先级

1. **P0**：实现步骤1-3（核心逻辑）
2. **P1**：实现步骤4（Prompt 优化）
3. **P2**：回归测试所有13个测试用例

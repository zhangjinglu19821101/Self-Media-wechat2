# Agent B 信息传递标准化机制

## 问题背景

在 order_index=1 的任务中，insurance-d 明显返回了初稿和建议，但是 Agent B 反馈"不知道"。这说明 Agent B 没有充分理解执行 Agent 的完整反馈。

## 问题根因分析

1. **信息传递不完整**：执行 Agent 的完整输出（初稿、建议、思考过程等）没有被充分传递给 Agent B
2. **提示词利用不足**：Agent B 的提示词没有充分利用执行 Agent 的反馈信息
3. **缺少标准化机制**：没有建立标准化的信息传递格式，导致每次任务的信息传递方式不一致

## 优化方案

### 1. 增强 ExecutorAgentResult 类型

在 `src/lib/services/subtask-execution-engine.ts` 中增强 `ExecutorAgentResult` 类型：

```typescript
interface ExecutorAgentResult {
  isNeedMcp: boolean;
  problem?: string;
  capabilityType?: string;
  executionResult?: any;
  isTaskDown: boolean;
  
  // 🔴 新增：执行 Agent 的完整输出
  executorOutput?: {
    // 初稿/产出内容
    draftContent?: string;
    // 执行 Agent 的建议
    suggestions?: string;
    // 执行 Agent 的思考过程
    reasoning?: string;
    // 结构化结果（如果有）
    structuredResult?: any;
    // 其他补充信息
    additionalInfo?: Record<string, any>;
  };
}
```

### 2. 增强 ExecutionContext 类型

```typescript
interface ExecutionContext {
  executorFeedback: {
    originalTask: string;
    problem: string;
    attemptedSolutions: string[];
    suggestedApproach?: string;
    executionLogs?: any[];
    // 🔴 新增：执行 Agent 的完整输出
    executorOutput?: {
      draftContent?: string;
      suggestions?: string;
      reasoning?: string;
      structuredResult?: any;
      additionalInfo?: Record<string, any>;
    };
  };
  // ... 其他字段保持不变
  taskMeta: {
    taskId: string;
    taskType: string;
    priority: 'low' | 'medium' | 'high';
    createdAt: Date;
    timeoutAt?: Date;
    iterationCount: number;
    maxIterations: number;
    taskTitle?: string;  // 🔴 新增
  };
  // ... 其他字段保持不变
}
```

### 3. 优化 buildExecutionContext 方法

在 `buildExecutionContext` 方法中添加执行 Agent 完整输出的解析逻辑：

```typescript
private async buildExecutionContext(
  task: typeof agentSubTasks.$inferSelect,
  executorResult: ExecutorAgentResult,
  capabilities: any[],
  mcpExecutionHistory: McpAttempt[],
  userInteractions: UserInteraction[],
  currentIteration: number,
  maxIterations: number
): Promise<ExecutionContext> {
  // ... 原有代码保持不变
  
  // 🔴 新增：解析 executorResult 中的完整输出
  let executorOutput: ExecutionContext['executorFeedback']['executorOutput'] = undefined;
  if (executorResult.executionResult) {
    try {
      // 尝试从 executionResult 中解析执行 Agent 的完整输出
      const executionResultData = typeof executorResult.executionResult === 'string' 
        ? JSON.parse(executorResult.executionResult)
        : executorResult.executionResult;
      
      executorOutput = {
        draftContent: executionResultData.draftContent || executionResultData.content || executionResultData.articleContent || undefined,
        suggestions: executionResultData.suggestions || executionResultData.suggestion || undefined,
        reasoning: executionResultData.reasoning || executionResultData.thought || undefined,
        structuredResult: executionResultData.structuredResult || undefined,
        additionalInfo: executionResultData.additionalInfo || undefined,
      };
      
      console.log('[SubtaskEngine] ✅ 解析到执行 Agent 的完整输出:', {
        hasDraftContent: !!executorOutput.draftContent,
        hasSuggestions: !!executorOutput.suggestions,
        hasReasoning: !!executorOutput.reasoning,
      });
    } catch (error) {
      console.warn('[SubtaskEngine] ⚠️  解析执行 Agent 输出失败:', error);
    }
  }
  
  // 如果没有从 executionResult 中解析到，尝试从 executorResult.executorOutput 中获取
  if (!executorOutput && executorResult.executorOutput) {
    executorOutput = executorResult.executorOutput;
    console.log('[SubtaskEngine] ✅ 使用 executorResult.executorOutput 中的数据');
  }

  return {
    executorFeedback: {
      originalTask: task.taskTitle,
      problem: executorResult.problem || '',
      attemptedSolutions: mcpExecutionHistory.map(m => m.decision.reasoning),
      suggestedApproach: executorResult.capabilityType,
      // 🔴 新增：执行 Agent 的完整输出
      executorOutput,
    },
    // ... 其他字段保持不变
    taskMeta: {
      taskId: task.id,
      taskType: (task.metadata as any)?.taskType || 'default',
      priority: 'medium',
      createdAt: task.createdAt || getCurrentBeijingTime(),
      timeoutAt: undefined,
      iterationCount: currentIteration,
      maxIterations: maxIterations,
      taskTitle: task.taskTitle,  // 🔴 新增
    },
    // ... 其他字段保持不变
  };
}
```

### 4. 优化 Agent B 提示词构建

在 `callAgentBWithDecision` 方法中添加执行 Agent 完整输出的文本构建：

```typescript
// 🔴 新增：构建执行 Agent 完整输出的文本
let executorOutputText = '';
if (executionContext.executorFeedback.executorOutput) {
  const eo = executionContext.executorFeedback.executorOutput;
  const parts: string[] = [];
  
  if (eo.draftContent) {
    parts.push('- 初稿/产出内容: ' + eo.draftContent.substring(0, 500) + (eo.draftContent.length > 500 ? '...' : ''));
  }
  if (eo.suggestions) {
    parts.push('- 执行Agent的建议: ' + eo.suggestions);
  }
  if (eo.reasoning) {
    parts.push('- 执行Agent的思考: ' + eo.reasoning);
  }
  
  if (parts.length > 0) {
    executorOutputText = '\n【执行Agent的完整输出】\n' + parts.join('\n') + '\n';
    console.log('[SubtaskEngine] ✅ 将执行Agent的完整输出加入到提示词中:', {
      partCount: parts.length
    });
  }
}

// 🔴 新增：将 priorStepOutput 加入到 Agent B 的提示词中
let priorStepOutputText = '';
if (executionContext.priorStepOutput) {
  priorStepOutputText = `
【上一步骤输出（重要！）】
${executionContext.priorStepOutput}
`;
  console.log('[SubtaskEngine] ✅ 将 priorStepOutput 加入到 Agent B 提示词中，长度:', executionContext.priorStepOutput.length);
}
```

然后在提示词中加入这些信息：

```typescript
const prompt = 
'你是 Agent B，技术专家，拥有不断完善的MCP能力，负责推动各个执行agent解决他们遇到的所有技术问题。\n\n' +
// ... 原有提示词内容保持不变
'【执行Agent反馈】\n' +
'- 原始任务: ' + executionContext.executorFeedback.originalTask + '\n' +
'- 遇到的问题: ' + executionContext.executorFeedback.problem + '\n' +
'- 建议方案: ' + (executionContext.executorFeedback.suggestedApproach || '无') + '\n' +
executorOutputText +  // 🔴 新增
priorStepOutputText +  // 🔴 新增
mcpHistoryText + '\n' +
userFeedbackText + '\n' +
// ... 提示词剩余内容保持不变
'【重要规则】\n' +
// ... 原有规则保持不变
'7. **🔴 重要：如果有【上一步骤输出】或【执行Agent的完整输出】中的初稿内容，**\n' +
'8. **🔴 必须将其作为 content、articleContent 或 text 参数传递给 MCP！**\n';
```

## 标准化信息传递流程

### 步骤1：执行 Agent 输出标准化

执行 Agent（如 insurance-d）在返回结果时，应该使用标准化的格式：

```typescript
// 推荐的执行 Agent 输出格式
{
  draftContent: "这是初稿内容...",  // 初稿/产出内容
  suggestions: "建议进行合规检查...",  // 执行 Agent 的建议
  reasoning: "我认为需要...",  // 执行 Agent 的思考过程
  structuredResult: {  // 结构化结果（可选）
    // 任何结构化数据
  },
  additionalInfo: {  // 其他补充信息（可选）
    // 其他信息
  }
}
```

### 步骤2：信息解析和传递

`buildExecutionContext` 方法负责：
1. 从 `executorResult.executionResult` 中解析执行 Agent 的完整输出
2. 如果解析失败，尝试从 `executorResult.executorOutput` 中获取
3. 将解析后的信息放入 `executionContext.executorFeedback.executorOutput`

### 步骤3：提示词构建

`callAgentBWithDecision` 方法负责：
1. 将 `executorOutput` 转换为易读的文本格式
2. 将该文本加入到 Agent B 的提示词中
3. 在提示词中明确强调：如果有初稿内容，必须作为 MCP 参数传递

## 关键优化点

### 1. 信息完整性
- ✅ 初稿/产出内容
- ✅ 执行 Agent 的建议
- ✅ 执行 Agent 的思考过程
- ✅ 结构化结果
- ✅ 上一步骤输出（priorStepOutput）

### 2. 提示词明确性
- ✅ 在提示词中明确展示执行 Agent 的完整输出
- ✅ 强调必须将初稿内容作为 MCP 参数传递
- ✅ 使用清晰的标题和格式分隔不同信息

### 3. 容错机制
- ✅ 支持从多个字段解析信息
- ✅ 提供降级方案
- ✅ 记录详细的调试日志

## 使用示例

### 场景：保险内容合规检查

**执行 Agent（insurance-d）输出：**
```json
{
  "draftContent": "这是一篇关于保险产品的文章...",
  "suggestions": "建议进行合规检查，确保内容符合监管要求",
  "reasoning": "根据任务要求，我需要先创作出初稿，然后进行合规检查"
}
```

**Agent B 收到的提示词中会包含：**
```
【执行Agent的完整输出】
- 初稿/产出内容: 这是一篇关于保险产品的文章...
- 执行Agent的建议: 建议进行合规检查，确保内容符合监管要求
- 执行Agent的思考: 根据任务要求，我需要先创作出初稿，然后进行合规检查

【上一步骤输出（重要！）】
（如果有的话，这里会显示上一步骤的输出）
```

**Agent B 应该做出的决策：**
- 识别到这是合规检查任务
- 从初稿内容中提取文本
- 调用 `wechat_compliance/content_audit` 进行合规检查

## 后续优化建议

1. **执行 Agent 输出标准化**：确保所有执行 Agent 都使用标准化的输出格式
2. **Agent B 提示词优化**：可以进一步优化 Agent B 的提示词，让它更好地理解和利用执行 Agent 的反馈
3. **历史记录利用**：可以考虑将历史交互记录也加入到提示词中，提供更多上下文
4. **测试和验证**：建立测试用例，验证信息传递机制的有效性

## 总结

通过以上优化，我们建立了一个标准化的信息传递机制：

1. **增强类型定义**：支持执行 Agent 的完整输出
2. **优化信息解析**：从多个来源解析执行 Agent 的输出
3. **完善提示词构建**：将所有相关信息清晰地展示给 Agent B
4. **明确使用规则**：在提示词中强调如何利用这些信息

这样，Agent B 就能充分理解执行 Agent 的反馈，做出更明智的决策了。


# Agent 职能分离 - 完整解决方案与实施步骤

**📋 **项目版本**: v2.0（完整版）**  
**📅 **创建日期**: 2026-03-22**  
**🎯 **改造目标**: Agent B 专注流程决策，Agent T 专注所有技术相关工作**

---

## 📋 **目录**

1. [一、整体架构设计](#一整体架构设计)
2. [二、提示词改造详细设计](#二提示词改造详细设计)
3. [三、详细代码修改清单](#三详细代码修改清单)
4. [四、Step-by-Step 实施步骤](#四步步实施步骤)
5. [五、测试验证计划](#五测试验证计划)
6. [六、回滚方案](#六回滚方案)

---

## 一、整体架构设计

### 1.1 双 Agent 职责划分

| Agent | 定位 | 决策类型 | 职责范围 |
|-------|------|---------|---------|
| **Agent B** | 业务流程控制专家 | `EXECUTE_MCP` \| `COMPLETE` \| `NEED_USER` \| `REEXECUTE_EXECUTOR` | 任务完成判断、用户交互协调、流程状态管理、业务规则应用 |
| **Agent T（技术专家）** | 技术专家 | （无，只执行） | **所有技术相关工作**：MCP 执行、技术问题处理、参数优化、错误分析、工具选择... |

### 1.2 调用流程

```
┌─────────────────────────────────────────────────────────────────┐
│  🔴 while (currentIteration < maxIterations) {  ← 外层循环    │
│                                                                 │
│    第 N 轮：                                                     │
│      ├─ 调用 Agent B 决策                                       │
│      ├─ Agent B 决策：EXECUTE_MCP                               │
│      ├─ 🔴 调用 Agent T（技术专家）                              │
│      ├─ Agent T 执行 MCP 工具                                    │
│      ├─ MCP 执行完成                                             │
│      └─ 🔴 返回 true → 继续循环（关键！）                        │
│                                                                 │
│    第 N+1 轮：                                                   │
│      ├─ 🔴 自动回到 Agent B！（通过 while 循环）                 │
│      ├─ Agent B 根据 MCP 结果再次决策                            │
│      └─ 决策：COMPLETE / NEED_USER / 继续 EXECUTE_MCP           │
│                                                                 │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

**详细流程图：**

```
用户任务
    ↓
执行 Agent（处理任务）
    ↓
┌─────────────────────────────────────────────────────────┐
│  while (currentIteration < maxIterations) {             │ ← 🔴 关键：循环！
│                                                          │
│  第 1 轮：                                               │
│    ├─ Agent B（流程决策）                                │
│    ├─ 决策类型：EXECUTE_MCP                              │
│    └─→ 🔴 调用 Agent T（技术专家）                       │
│               ↓                                          │
│          Agent T 执行 MCP 工具                            │
│               ↓                                          │
│          MCP 执行完成                                     │
│               ↓                                          │
│          返回 true → 继续循环 🔴                          │ ← 关键：不退出！
│                                                          │
│  第 2 轮：                                               │
│    ├─ 🔴 自动回到 Agent B！（while 循环继续）             │ ← 回到 Agent B
│    ├─ Agent B 根据 MCP 结果再次决策                        │
│    ├─ 决策类型：COMPLETE（任务完成）                      │
│    └─→ 返回 false → 退出循环 🔴                          │
│                                                          │
│  }                                                       │
└─────────────────────────────────────────────────────────┘
    ↓
任务完成
```

### 1.3 关键机制说明

**Q: Agent T 执行完 MCP 后如何通知 Agent B？**

**A: 不需要通知！通过 `while` 循环自动回到 Agent B！**

| 机制 | 说明 |
|-----|------|
| **外层循环** | `while (currentIteration < maxIterations)` |
| **返回 true** | `handleDecisionType()` 返回 `true` → 继续循环 |
| **下一轮** | 自动进入下一轮，再次调用 Agent B |
| **Agent B 决策** | 根据 MCP 执行结果，决定下一步 |

**代码逻辑：**
```typescript
// 1. 外层循环
while (currentIteration < maxIterations) {
  
  // 2. 调用 Agent B 决策
  const agentBDecision = await this.callAgentBWithDecision(...);
  
  // 3. 处理决策（可能调用 Agent T）
  const shouldContinue = await this.handleDecisionType(...);
  
  // 4. 如果返回 true，继续循环（下一轮再次调用 Agent B）
  if (!shouldContinue) {
    return;
  }
}
```

---

## 二、提示词改造详细设计

### 2.1 Agent B 提示词改造（去除技术处理）

**改造原则**：Agent B 只做流程决策，不参与技术细节

| 项目 | 改造前 | 改造后 |
|-----|--------|--------|
| **职责范围** | 流程决策 + 技术处理（MCP 选择、参数构建） | 只做流程决策 |
| **技术处理** | ❌ 参与 MCP 工具选择 | ❌ 不参与 |
| **参数构建** | ❌ 参与 MCP 参数构建 | ❌ 不参与 |
| **决策类型** | EXECUTE_MCP / COMPLETE / NEED_USER / REEXECUTE_EXECUTOR / FAILED | 保持不变 |
| **EXECUTE_MCP 细节** | 构建完整 mcpParams | 只标记类型，具体参数交给 Agent T |

**Agent B 新提示词要点**：
```
你是 Agent B，业务流程控制专家。

【核心定位】
你只负责业务流程决策，不参与任何技术细节。
技术相关的工作（MCP 选择、参数构建等）完全交给 Agent T。

【决策逻辑】
1. 判断任务是否完成 → COMPLETE
2. 判断是否需要用户交互 → NEED_USER
3. 判断是否需要重新执行执行 Agent → REEXECUTE_EXECUTOR
4. 判断是否需要技术处理（调用 MCP）→ EXECUTE_MCP
   - 注意：只决策类型，不构建具体 MCP 参数！
   - 具体 MCP 选择和参数完全交给 Agent T

【输出格式】
（保持现有格式，但 EXECUTE_MCP 时 mcpParams 可留空或简化）
```

---

### 2.2 Agent T 提示词设计（参考 insurance-d 风格）

**设计原则**：参考 insurance-d 提示词的结构化、详细化风格

**insurance-d 提示词特点分析**：
| 特点 | 说明 | Agent T 借鉴 |
|-----|------|-------------|
| ✅ 清晰的身份定义 | 明确的角色定位 | ✅ 采用 |
| ✅ 明确的执行逻辑 | 步骤化的处理流程 | ✅ 采用 |
| ✅ 分步骤的标准流程 | 每个阶段都有明确目标 | ✅ 采用 |
| ✅ 详细的规则说明 | 工具选择、参数构建规则 | ✅ 采用 |
| ✅ 固定的输出格式 | 严格的 JSON 格式要求 | ✅ 采用 |

**Agent T 新提示词结构**：

```
# Agent T - 技术专家提示词

## 身份
你是 Agent T，技术专家，负责所有技术相关的工作。

【核心定位】
你是技术专家，专注于技术层面的工作，不参与业务决策。
你的职责：根据 Agent B 提供的上下文，智能处理所有技术相关任务。
你不决定任务是否完成、是否需要用户等，那是 Agent B 的工作。

## 执行逻辑
收到任务后，按标准步骤完成技术处理：
1. 任务理解：理解技术任务目标
2. 工具选择：从可用能力中选择最佳工具
3. 参数构建：智能构建完整参数（必须包含 accountId）
4. 执行决策：按格式返回 EXECUTE_MCP 决策

## 标准步骤

### 步骤 1：任务理解阶段
- 从 Agent B 提供的上下文中理解技术任务
- 识别关键信息：任务目标、可用工具、历史记录等
- 明确技术处理需求

### 步骤 2：工具选择阶段
- 从可用能力中选择最匹配的工具
- 考虑因素：工具功能、历史成功率、参数要求等
- 说明选择理由

### 步骤 3：参数构建阶段
- 必须包含 accountId
- 如果有上一步骤输出，必须作为参数传递
- 根据工具要求构建完整参数
- 参数名通常使用：content、articleContent、text、priorStepOutput 等

### 步骤 4：输出决策阶段
- 严格按照指定格式输出
- 只输出 JSON，不要其他文字
- 确保所有必需字段都存在

## 工具选择规则
1. 优先选择与任务目标最匹配的工具
2. 参考历史执行记录，选择成功率高的工具
3. 如果有多个可选工具，选择参数最简单的
4. 为未来能力扩展预留空间

## 参数构建规则
1. 🔴 必须包含 accountId！
2. 🔴 如果有上一步骤输出，必须通过 content/articleContent/text/priorStepOutput 传递！
3. 根据工具的 param_desc 填充参数
4. 参数值要合理、完整
5. 为未来参数优化预留空间

## 输出格式
**重要：按照当前 Agent B 的返回格式返回！**

{
  "type": "EXECUTE_MCP",
  "reasonCode": "MCP_CONTINUE",
  "reasoning": "详细说明选择该工具的理由",
  "context": {
    "executionSummary": "执行摘要",
    "riskLevel": "low",
    "suggestedAction": "执行 MCP 工具"
  },
  "data": {
    "mcpParams": {
      "solutionNum": 1,
      "toolName": "工具名",
      "actionName": "方法名",
      "params": {
        "accountId": "{{accountId}}",
        // 其他参数
      }
    }
  }
}

## 重要规则
1. 🔴 只输出 JSON，不要输出其他任何文字说明！
2. 🔴 必须包含 accountId！
3. 🔴 如果有文章内容，必须通过 content/articleContent/text/priorStepOutput 传递！
4. 🔴 当前阶段只返回 EXECUTE_MCP 类型，不要返回其他类型！
5. 🔴 利用所有可用的上下文信息！
6. 🔴 为未来能力扩展预留空间，提示词结构保持扩展性！
```

---

## 三、详细代码修改清单

### 3.1 新增文件

| 文件路径 | 文件类型 | 说明 |
|---------|---------|------|
| `src/lib/prompts/agent-t-tech-expert.ts` | TypeScript | Agent T 提示词（系统提示词 + 用户提示词构建函数） |

### 3.2 修改文件

| 文件路径 | 修改内容 | 风险等级 |
|---------|---------|---------|
| `src/lib/services/subtask-execution-engine.ts` | 1. 新增 `callAgentTTechExpert()` 方法&lt;br&gt;2. 修改 `handleDecisionType()` 中的 `EXECUTE_MCP` case | 中 |

---

## 四、Step-by-Step 实施步骤

### **前置条件检查** ✅
- [x] 备份已完成：`backup-before-agent-split-20260322-222233`
- [x] 当前分支干净，可以开始改造

---

### **步骤 1：创建 Agent T 提示词文件**

**文件**: `src/lib/prompts/agent-t-tech-expert.ts`

```typescript
/**
 * Agent T - 技术专家提示词
 * 
 * 职责：所有技术相关工作
 * 当前阶段（Phase 1）：MCP 执行专家
 * 未来扩展：技术问题处理、技术方案选择等
 */

export const AGENT_T_TECH_EXPERT_SYSTEM_PROMPT = `
你是 Agent T，技术专家，负责所有技术相关的工作。

【核心定位】
你是技术专家，专注于技术层面的工作，不参与业务决策。
你的职责：根据 Agent B 提供的上下文，智能处理所有技术相关任务。
你不决定任务是否完成、是否需要用户等，那是 Agent B 的工作。

【当前阶段能力（Phase 1）】
1. MCP 工具选择：从可用能力中选择最合适的工具
2. MCP 参数构建：根据上下文智能构建完整参数
3. MCP 执行策略：决定执行策略（首次尝试、重试、更换工具等）
4. MCP 结果理解：理解 MCP 返回的结构化结果

【未来扩展能力（预留）】
- 技术错误分析
- 技术方案选择
- 技术参数优化
- 技术风险评估
- 技术架构设计
- 技术方案评审

【当前阶段决策逻辑（Phase 1）】
1. 理解任务目标：从 Agent B 提供的上下文中理解技术任务
2. 选择工具：从可用能力中选择最匹配的工具
3. 构建参数：必须包含 accountId，必须传递文章内容（如果有）
4. 执行：按照格式返回 EXECUTE_MCP 决策

【输出格式】
**重要：按照当前 Agent B 的返回格式返回！**

{
  "type": "EXECUTE_MCP",
  "reasonCode": "MCP_CONTINUE",
  "reasoning": "详细说明选择该工具的理由",
  "context": {
    "executionSummary": "执行摘要",
    "riskLevel": "low",
    "suggestedAction": "执行 MCP 工具"
  },
  "data": {
    "mcpParams": {
      "solutionNum": 1,
      "toolName": "工具名",
      "actionName": "方法名",
      "params": {
        "accountId": "{{accountId}}",
        // 其他参数
      }
    }
  }
}

【重要规则】
1. 🔴 只输出 JSON，不要输出其他任何文字说明！
2. 🔴 必须包含 accountId！
3. 🔴 如果有文章内容，必须通过 content/articleContent/text/priorStepOutput 传递！
4. 🔴 当前阶段只返回 EXECUTE_MCP 类型，不要返回其他类型！
5. 🔴 利用所有可用的上下文信息！
6. 🔴 为未来能力扩展预留空间，提示词结构保持扩展性！
`;

export function buildAgentTTechExpertUserPrompt(
  task: any,
  executionContext: any,
  capabilitiesText: string,
  mcpHistoryText: string,
  priorStepOutputText: string,
  defaultAccountId: string
): string {
  return `
【任务信息】
- 任务ID: ${executionContext.taskMeta.taskId}
- 任务标题: ${executionContext.taskMeta.taskTitle}
- 是否合规任务: ${task.orderIndex === 2 ? '是' : '否'}

【执行 Agent 反馈】
- 原始任务: ${executionContext.executorFeedback.originalTask}
- 遇到的问题: ${executionContext.executorFeedback.problem}

【上一步骤输出（重要！）】
${priorStepOutputText}

【MCP 执行历史】
${mcpHistoryText}

【可用 MCP 能力清单】
${capabilitiesText}

【默认账户 ID】
${defaultAccountId}

【你的任务（当前阶段 Phase 1）】
请作为技术专家，完成以下工作：
1. 理解技术任务目标
2. 从可用能力中选择最佳工具
3. 构建完整的参数（必须包含 accountId）
4. 如果有上一步骤输出，必须作为参数传递
5. 按照当前 Agent B 的返回格式返回 EXECUTE_MCP 决策

【未来扩展（预留）】
- 技术错误分析
- 技术方案选择
- 技术参数优化
- 技术风险评估

记住：你是技术专家，只负责技术相关工作，不做业务决策！
`;
}
```

---

### **步骤 2：修改 subtask-execution-engine.ts**

#### 2.1 在文件顶部添加导入

找到文件顶部的导入区域，添加：

```typescript
// 🔴 新增：Agent T（技术专家）提示词
import { 
  AGENT_T_TECH_EXPERT_SYSTEM_PROMPT, 
  buildAgentTTechExpertUserPrompt 
} from '@/lib/prompts/agent-t-tech-expert';
```

#### 2.2 新增 callAgentTTechExpert() 方法

在 `SubtaskExecutionEngine` 类中新增方法（建议放在 `callAgentB()` 方法附近）：

```typescript
  /**
   * 🔴 新增：调用 Agent T（技术专家）处理技术任务
   * 当前阶段（Phase 1）：MCP 执行
   * 未来扩展：技术问题处理、技术方案选择等
   */
  private async callAgentTTechExpert(
    task: typeof agentSubTasks.$inferSelect,
    executionContext: any,
    capabilities: any[]
  ): Promise&lt;any&gt; {
    console.log('[SubtaskEngine] ========== 调用 Agent T（技术专家） ==========');
    
    const defaultAccountId = this.getDefaultAccountId(task.fromParentsExecutor);
    const capabilitiesText = this.buildCapabilitiesText(capabilities);
    const mcpHistoryText = this.buildMcpHistoryText(executionContext.mcpExecutionHistory);
    
    // 构建 priorStepOutputText
    let priorStepOutputText = '';
    if (executionContext.priorStepOutput) {
      const maxContentLength = 3000;
      let contentToUse = executionContext.priorStepOutput;
      
      if (contentToUse.length &gt; maxContentLength) {
        contentToUse = contentToUse.substring(0, maxContentLength) + 
          '\n\n[...内容已截断，完整内容请参考上一步骤输出...]';
      }
      
      priorStepOutputText = `
【🔴 上一步骤输出（重要！）】
${contentToUse}
`;
    }
    
    // 构建 Prompt
    const prompt = 
      AGENT_T_TECH_EXPERT_SYSTEM_PROMPT + '\n\n' +
      buildAgentTTechExpertUserPrompt(
        task,
        executionContext,
        capabilitiesText,
        mcpHistoryText,
        priorStepOutputText,
        defaultAccountId
      );
    
    console.log('[SubtaskEngine] Agent T 提示词构建完成，长度:', prompt.length);
    
    try {
      const response = await callLLM(
        'agent T',
        '技术专家',
        '你是 Agent T，技术专家，负责所有技术相关工作',
        prompt,
        {
          timeout: 180000 // 3 分钟超时
        }
      );
      
      console.log('[SubtaskEngine] Agent T 原始响应:', response);
      
      // 使用统一响应解析器
      const parseResult = AgentResponseParser.parseAgentBResponse(response);
      
      if (!parseResult.success) {
        console.error('[SubtaskEngine] Agent T 响应解析失败:', parseResult.error);
        throw new Error(parseResult.error || 'Agent T 响应解析失败');
      }
      
      const decision = parseResult.data!;
      
      // 确保 MCP 参数中有 accountId
      if (decision.type === 'EXECUTE_MCP' &amp;&amp; decision.data?.mcpParams?.params) {
        if (!decision.data.mcpParams.params.accountId) {
          decision.data.mcpParams.params.accountId = defaultAccountId;
          console.log('[SubtaskEngine] Agent T 自动填充 accountId:', defaultAccountId);
        }
      }
      
      console.log('[SubtaskEngine] Agent T 决策解析成功:', JSON.stringify(decision, null, 2));
      return decision;
      
    } catch (error) {
      console.error('[SubtaskEngine] Agent T 调用失败:', error);
      throw error;
    }
  }
```

#### 4.3 修改 handleDecisionType() 方法

找到 `handleDecisionType()` 方法中的 `case 'EXECUTE_MCP':` 部分，替换为：

```typescript
      case 'EXECUTE_MCP':
        // 🔴 改造：调用 Agent T（技术专家）处理技术任务
        console.log('[SubtaskEngine] Agent B 决策 EXECUTE_MCP，调用 Agent T（技术专家）');
        
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
        
        // 🔴 关键：Agent T 返回的格式同 Agent B，直接用这个决策继续执行
        console.log('[SubtaskEngine] 使用 Agent T 的决策继续执行');
        
        // 执行 MCP（支持多次尝试）
        const mcpSuccess = await this.executeMcpWithRetry(
          task,
          agentTDecision, // 🔴 使用 Agent T 的决策
          executorResult,
          capabilities,
          mcpExecutionHistory,
          userInteractions,
          maxMcpAttempts
        );

        if (mcpSuccess) {
          // MCP执行成功，继续下一轮决策让Agent B判断是否完成
          console.log('[SubtaskEngine] MCP执行成功，继续下一轮决策');
          return true;
        } else {
          // MCP多次尝试都失败，Agent B会在下一轮决策中处理
          console.log('[SubtaskEngine] MCP多次尝试失败，继续下一轮决策');
          return true;
        }
```

---

## 五、测试验证计划

### 5.1 测试阶段

| 阶段 | 测试内容 | 预期结果 |
|-----|---------|---------|
| **阶段 1：单元测试** | 1. Agent T 提示词语法检查&lt;br&gt;2. 导入语句检查&lt;br&gt;3. 方法签名检查 | 编译通过，无 TypeScript 错误 |
| **阶段 2：集成测试** | 1. 完整调用链测试&lt;br&gt;2. MCP 执行测试&lt;br&gt;3. 回退机制测试 | 任务正常执行，成功率与改造前相当 |
| **阶段 3：灰度测试** | 小部分任务（10-20%）使用新架构 | 失败率 &lt; 5%，执行时间 &lt; 旧架构 120% |

### 5.2 测试用例

#### 测试用例 1：常规文章创作任务
- **任务类型**: order_index = 1（初稿创作）
- **预期流程**: 
  1. 执行 Agent 处理
  2. Agent B 决策 EXECUTE_MCP
  3. 调用 Agent T
  4. Agent T 执行 MCP
  5. 返回结果给 Agent B
  6. Agent B 决策 COMPLETE
- **预期结果**: 任务成功完成

#### 测试用例 2：合规检查任务
- **任务类型**: order_index = 2（合规检查）
- **预期流程**: 同测试用例 1
- **预期结果**: 任务成功完成

#### 测试用例 3：需要用户交互的任务
- **任务类型**: 需要用户输入
- **预期流程**:
  1. 执行 Agent 处理
  2. Agent B 决策 NEED_USER
  3. **不调用 Agent T**
  4. 等待用户交互
- **预期结果**: 正确等待用户，不调用 Agent T

---

## 六、回滚方案

### 6.1 回滚触发条件

满足以下任一条件即触发回滚：
- 新架构失败率 &gt; 5%
- 新架构执行时间 &gt; 旧架构 120%
- 严重业务错误发生
- 关键功能不可用

### 6.2 回滚步骤

#### 步骤 1：确认回滚
```bash
# 确认当前状态
git status
```

#### 步骤 2：切换到备份分支
```bash
# 切换到备份分支
git checkout backup-before-agent-split-20260322-222233
```

#### 步骤 3：验证功能
```bash
# 确认功能正常
# 运行测试验证
```

#### 步骤 4：重启服务
```bash
# 根据实际部署方式重启服务
```

---

## 📋 **实施检查清单**

### 实施前
- [x] 备份已完成
- [x] 方案已评审通过
- [x] 测试计划已制定

### 实施中
- [ ] 步骤 1：创建 Agent T 提示词文件
- [ ] 步骤 2：添加导入语句
- [ ] 步骤 3：新增 callAgentTTechExpert() 方法
- [ ] 步骤 4：修改 handleDecisionType() 方法
- [ ] 步骤 5：编译检查（TypeScript）
- [ ] 步骤 6：单元测试

### 实施后
- [ ] 集成测试
- [ ] 灰度测试
- [ ] 监控指标收集
- [ ] 文档更新

---

**📋 **文档结束**

**🔄 **下一步：按照此步骤开始实施！**

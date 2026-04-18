# Agent T MCP 返回格式严谨验证与设计

## 一、Agent B 原始返回格式的严谨验证

### 1.1 完整的调用链路验证

```
Agent B 输出 
    ↓
executeCapability(agentBOutput)
    ↓
genericMCPCall(toolName, actionName, params)
    ↓
toolRegistry.getTool(toolName)[actionName](params)
    ↓
实际 MCP 工具执行
```

### 1.2 Agent B 原始返回格式（必须严格遵循）

```typescript
interface AgentBOutput {
  // 🔴 核心：决定动作类型
  action: 'EXECUTE_MCP' | 'NEED_USER' | 'FAILED';
  
  // 🔴 MCP 调用必需字段（当 action === 'EXECUTE_MCP' 时）
  solutionNum: number;        // 从 capability_list 选择的方案 ID
  toolName: string;           // 工具名（用于 genericMCPCall 第一个参数）
  actionName: string;         // 动作名（用于 genericMCPCall 第二个参数）
  params: Record<string, any>; // 参数（用于 genericMCPCall 第三个参数）
  
  // 🟡 可选但推荐字段
  reasoning?: string;         // 决策理由说明
  userMessage?: string;       // 给用户的提示（当 action === 'NEED_USER' 时）
  failedReason?: string;      // 失败原因（当 action === 'FAILED' 时）
}
```

### 1.3 为什么这个格式能成功调用 MCP？

**关键证据来自 `subtask-execution-engine.ts` 第 3300-3310 行：**

```typescript
// executeCapability 方法的核心逻辑
const mcpResult = await genericMCPCall(
  agentBOutput.toolName,      // 🔴 直接使用 toolName
  agentBOutput.actionName,    // 🔴 直接使用 actionName
  agentBOutput.params || {}   // 🔴 直接使用 params
);
```

**来自 `generic-mcp-call.ts` 第 58 行的函数签名：**

```typescript
export async function genericMCPCall(
  tool: string,      // 对应 agentBOutput.toolName
  action: string,    // 对应 agentBOutput.actionName
  params: any        // 对应 agentBOutput.params
): Promise<GenericMCPResponse>
```

---

## 二、Agent T 返回格式的正确设计

### 2.1 核心原则：Agent T 必须与 Agent B 格式兼容

**原因**：
1. `executeCapability` 方法只接受 `AgentBOutput` 格式
2. `genericMCPCall` 只需要 `toolName`、`actionName`、`params`
3. 现有的整个调用链路都是为 Agent B 格式设计的

### 2.2 Agent T 的正确返回格式

```typescript
// ✅ 正确：与 Agent B 完全一致的格式
interface AgentTOutput {
  // 🔴 核心动作类型（Agent T 当前阶段只返回 EXECUTE_MCP）
  action: 'EXECUTE_MCP';
  
  // 🔴 MCP 调用必需字段
  solutionNum: number;
  toolName: string;
  actionName: string;
  params: Record<string, any>;
  
  // 🟡 推荐字段
  reasoning: string;  // 技术选择理由（为什么选这个工具/参数）
}
```

### 2.3 ❌ 错误的格式（当前 agent-t-tech-expert.ts 中的格式）

```typescript
// ❌ 错误：这个格式无法被 executeCapability 处理
{
  "type": "EXECUTE_MCP",           // 应该是 action，不是 type
  "reasonCode": "MCP_CONTINUE",     // 多余字段
  "reasoning": "...",
  "context": { ... },               // 多余字段
  "data": {
    "mcpParams": {                  // 应该平铺，不要嵌套
      "solutionNum": 1,
      "toolName": "...",
      "actionName": "...",
      "params": { ... }
    }
  }
}
```

---

## 三、模拟微信公众号合规校验的返回格式

### 3.1 前置条件：微信合规审核 MCP 工具信息

从 `wechat-compliance-auditor.ts` 和 `tool-registry.ts` 确认：

| 项目 | 值 | 说明 |
|------|-----|------|
| **toolName** | `wechat` | 在 tool-registry.ts 中注册的工具名 |
| **actionName** | `contentAudit` 或 `contentAuditSimple` | 微信合规审核工具的两个方法 |
| **必需 params** | `articleTitle`, `articleContent` | 从 wechat-compliance-auditor.ts 第 375 行确认 |

### 3.2 Agent T 调用微信合规校验的完整返回示例

```typescript
// ✅ 正确示例 1：使用完整审核模式
{
  "action": "EXECUTE_MCP",
  "solutionNum": 20,
  "toolName": "wechat",
  "actionName": "contentAudit",
  "params": {
    "articleTitle": "2024年保险产品购买指南",
    "articleContent": "这是一篇关于保险产品的文章内容...\n包含了产品介绍、投保建议等内容。",
    "auditMode": "full",
    "accountId": "insurance-account"
  },
  "reasoning": "选择微信公众号内容合规审核工具，因为任务需要对保险文章进行合规性检查。使用完整审核模式可以获得更全面的审核结果，包括 RAG 检索的相关合规规则和详细的问题分析。"
}

// ✅ 正确示例 2：使用快速检查模式
{
  "action": "EXECUTE_MCP",
  "solutionNum": 21,
  "toolName": "wechat",
  "actionName": "contentAuditSimple",
  "params": {
    "articleTitle": "保险理赔常见问题解答",
    "articleContent": "本文介绍保险理赔的常见问题和解答...",
    "accountId": "insurance-account"
  },
  "reasoning": "选择快速检查模式，因为这篇文章内容相对简单，只需要进行基本的关键词和规则检查即可。快速检查模式效率更高，适合初步筛查。"
}
```

### 3.3 验证这个格式能成功调用的链路

```
Agent T 返回上面的 JSON
    ↓
executeCapability 接收（因为格式与 Agent B 一致）
    ↓
genericMCPCall(
  "wechat",                    // toolName
  "contentAudit",              // actionName
  {
    articleTitle: "...",
    articleContent: "...",
    accountId: "insurance-account"
  }
)
    ↓
toolRegistry.getTool("wechat")["contentAudit"](params)
    ↓
WechatComplianceAuditor.contentAudit(params) 执行
    ↓
返回合规审核结果 ✅
```

---

## 四、Agent T 返回格式的目的深度解析

### 4.1 现在 Agent T 应该返回什么格式？

**答案：必须返回与 Agent B 完全一致的格式！**

### 4.2 为什么？目的是什么？

#### 目的 1：复用现有的调用链路

```typescript
// subtask-execution-engine.ts 中的现有方法
public async executeCapability(
  task: typeof agentSubTasks.$inferSelect,
  agentBOutput: AgentBOutput  // 🔴 参数类型固定为 AgentBOutput
) {
  // 直接使用 agentBOutput.toolName, .actionName, .params
  // 不需要修改任何代码就能支持 Agent T
}
```

**目的**：不需要重写 `executeCapability` 方法，Agent T 可以直接接入。

#### 目的 2：确保 MCP 调用参数正确

`genericMCPCall` 只需要三个参数：
- `toolName`: 工具名
- `actionName`: 动作名  
- `params`: 参数对象

**目的**：Agent T 作为技术专家，责任就是正确提供这三个参数。

#### 目的 3：支持未来的职责分离架构

```
Phase 1（当前）：
  Agent B：业务决策 + MCP 参数生成
  Agent T：（实验性，未实际使用）

Phase 2（未来）：
  Agent B：只做业务决策（用不用 MCP、要不要用户等）
  Agent T：专门负责 MCP 参数生成和技术执行

→ Agent T 必须能生成 Agent B 格式的输出，才能无缝替换！
```

---

## 五、修正后的 agent-t-tech-expert.ts 提示词

### 5.1 输出格式部分修正建议

```typescript
## 输出格式
**重要：严格按照 Agent B 的标准返回格式返回！**

{
  "action": "EXECUTE_MCP",
  "solutionNum": 选定的方案ID（capability_list.id）,
  "toolName": "工具名（capability_list.tool_name）",
  "actionName": "方法名（capability_list.action_name）",
  "params": {
    "根据选定方案的 param_desc 填充参数",
    "accountId": "{{accountId}}"
  },
  "reasoning": "详细说明为什么选择这个工具和参数的技术理由"
}

## 重要规则
1. 🔴 只输出 JSON，不要输出其他任何文字说明！
2. 🔴 必须包含 accountId！
3. 🔴 toolName、actionName 必须与 capability_list 完全一致！
4. 🔴 params 必须根据 param_desc 完整填充！
5. 🔴 当前阶段只返回 "action": "EXECUTE_MCP"！
```

---

## 六、总结

| 问题 | 答案 |
|------|------|
| **Agent B 格式能成功调用 MCP 吗？** | ✅ 能，已通过代码严谨验证 |
| **Agent T 应该返回什么格式？** | ✅ 与 Agent B 完全一致的格式 |
| **为什么要这样设计？** | 1. 复用现有调用链路 <br> 2. 确保 MCP 参数正确 <br> 3. 支持未来职责分离 |
| **当前 agent-t-tech-expert.ts 格式正确吗？** | ❌ 不正确，需要修正 |
| **微信合规校验的返回示例？** | 见本文第三章 |

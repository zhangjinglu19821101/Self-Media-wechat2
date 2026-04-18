# Agent T 智能提示词 - 完整示例验证

## 一、capability_list 表示例数据

### 1.1 微信公众号合规审核能力（ID: 20）

```json
{
  "id": 20,
  "functionDesc": "微信公众号内容合规审核（RAG + LLM），对文章内容进行全面的合规性检查，包括绝对化用语、保险敏感词等检测",
  "capabilityType": "content_audit",
  "toolName": "wechat",
  "actionName": "contentAudit",
  "param_desc": {
    "type": "object",
    "properties": {
      "articleTitle": {
        "type": "string",
        "description": "文章标题"
      },
      "articleContent": {
        "type": "string",
        "description": "文章内容"
      },
      "auditMode": {
        "type": "string",
        "description": "审核模式：full（完整审核）或 simple（快速检查）",
        "default": "full"
      }
    },
    "required": ["articleTitle", "articleContent"]
  },
  "requiresOnSiteExecution": false,
  "example_output": {
    "approved": true,
    "riskLevel": "low",
    "issues": [],
    "suggestions": []
  }
}
```

### 1.2 微信公众号快速合规检查能力（ID: 21）

```json
{
  "id": 21,
  "functionDesc": "微信公众号内容合规审核（快速检查 - 仅用 RAG），仅使用关键词和规则片段进行快速筛查",
  "capabilityType": "content_audit_simple",
  "toolName": "wechat",
  "actionName": "contentAuditSimple",
  "param_desc": {
    "type": "object",
    "properties": {
      "articleTitle": {
        "type": "string",
        "description": "文章标题"
      },
      "articleContent": {
        "type": "string",
        "description": "文章内容"
      }
    },
    "required": ["articleTitle", "articleContent"]
  },
  "requiresOnSiteExecution": false,
  "example_output": {
    "approved": true,
    "riskLevel": "low",
    "summary": "文章内容合规"
  }
}
```

### 1.3 微信公众号添加草稿能力（ID: 5）

```json
{
  "id": 5,
  "functionDesc": "添加微信公众号草稿，将文章内容发布到微信公众号草稿箱",
  "capabilityType": "platform_publish",
  "toolName": "wechat",
  "actionName": "addDraft",
  "param_desc": {
    "type": "object",
    "properties": {
      "title": {
        "type": "string",
        "description": "文章标题"
      },
      "content": {
        "type": "string",
        "description": "文章内容（支持 HTML）"
      },
      "author": {
        "type": "string",
        "description": "作者",
        "default": "保险助手"
      },
      "digest": {
        "type": "string",
        "description": "文章摘要"
      }
    },
    "required": ["title", "content"]
  },
  "requiresOnSiteExecution": false,
  "example_output": {
    "media_id": "123456",
    "url": "https://mp.weixin.qq.com/..."
  }
}
```

### 1.4 网页搜索能力（ID: 1）

```json
{
  "id": 1,
  "functionDesc": "网页搜索，根据关键词搜索互联网信息",
  "capabilityType": "search",
  "toolName": "search",
  "actionName": "webSearch",
  "param_desc": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "搜索关键词"
      },
      "num": {
        "type": "number",
        "description": "返回结果数量",
        "default": 10
      }
    },
    "required": ["query"]
  },
  "requiresOnSiteExecution": false,
  "example_output": {
    "results": [
      { "title": "...", "url": "...", "snippet": "..." }
    ]
  }
}
```

---

## 二、Agent T 智能提示词工作流程示例

### 2.1 场景 1：保险文章合规审核

#### 输入信息

**任务信息：**
- 任务标题：保险文章合规审核
- 执行主体：insurance-d
- 上一步输出：
  ```
  文章标题：2024年保险产品购买指南
  文章内容：这是一篇关于保险产品的文章，介绍了最好的保险产品，提供100%保本保息的承诺...
  ```

**可用 capabilities：** [20, 21, 5, 1]（见上方示例数据）

**默认账户 ID：** `insurance-account`

---

#### Agent T 的分析过程

**步骤 1：任务理解**
- 目标：对保险文章进行合规审核
- 可用数据：文章标题、文章内容
- 上一步输出：有文章内容，需要传递

**步骤 2：能力分析（逐个分析）**

**分析能力 20（微信合规审核）：**
```
【能力分析】
ID: 20
功能: 微信公众号内容合规审核（RAG + LLM），对文章内容进行全面的合规性检查
类型: content_audit
工具: wechat
动作: contentAudit
参数要求: {
  articleTitle (required, string): 文章标题
  articleContent (required, string): 文章内容
  auditMode (optional, string): 审核模式，默认 full
}
是否需要现场: false

【适用性判断】
- 任务目标: 保险文章合规审核
- 匹配度: 高
- 理由: 功能完全匹配，有 RAG + LLM，审核更全面
```

**分析能力 21（快速检查）：**
```
【能力分析】
ID: 21
功能: 微信公众号内容合规审核（快速检查 - 仅用 RAG）
类型: content_audit_simple
工具: wechat
动作: contentAuditSimple
参数要求: {
  articleTitle (required, string): 文章标题
  articleContent (required, string): 文章内容
}
是否需要现场: false

【适用性判断】
- 任务目标: 保险文章合规审核
- 匹配度: 中
- 理由: 功能匹配，但只有快速检查，不如能力 20 全面
```

**分析能力 5（添加草稿）：**
```
【能力分析】
ID: 5
功能: 添加微信公众号草稿
类型: platform_publish
工具: wechat
动作: addDraft
参数要求: {
  title (required, string): 文章标题
  content (required, string): 文章内容
  author (optional, string): 作者
  digest (optional, string): 文章摘要
}
是否需要现场: false

【适用性判断】
- 任务目标: 保险文章合规审核
- 匹配度: 低
- 理由: 这是发布功能，不是审核功能，不匹配
```

**分析能力 1（网页搜索）：**
```
【能力分析】
ID: 1
功能: 网页搜索
类型: search
工具: search
动作: webSearch
参数要求: {
  query (required, string): 搜索关键词
  num (optional, number): 返回结果数量
}
是否需要现场: false

【适用性判断】
- 任务目标: 保险文章合规审核
- 匹配度: 低
- 理由: 这是搜索功能，不是审核功能，不匹配
```

**步骤 3：工具选择**
- 选择：能力 20（微信合规审核）
- 理由：功能最匹配，审核最全面

**步骤 4：参数构建**
根据 param_desc：
- articleTitle (required)："2024年保险产品购买指南"
- articleContent (required)："这是一篇关于保险产品的文章，介绍了最好的保险产品，提供100%保本保息的承诺..."
- auditMode (optional)："full"（使用默认值）
- accountId (必须添加)："insurance-account"

---

#### Agent T 的最终输出

```json
{
  "action": "EXECUTE_MCP",
  "solutionNum": 20,
  "toolName": "wechat",
  "actionName": "contentAudit",
  "params": {
    "articleTitle": "2024年保险产品购买指南",
    "articleContent": "这是一篇关于保险产品的文章，介绍了最好的保险产品，提供100%保本保息的承诺...",
    "auditMode": "full",
    "accountId": "insurance-account"
  },
  "reasoning": "1. 为什么选择这个 capability：功能描述与任务目标完全匹配，能力 20 提供 RAG + LLM 的全面合规审核，比能力 21 的快速检查更准确；2. 参数构建的依据：严格按照 capability 20 的 param_desc 填充，articleTitle 和 articleContent 是 required 字段，使用默认值 full 作为 auditMode；3. 上一步输出的传递：通过 articleContent 参数传递了上一步的文章内容，确保审核的是正确的文章。"
}
```

---

### 2.2 场景 2：微信公众号发布文章

#### 输入信息

**任务信息：**
- 任务标题：发布保险文章到微信公众号
- 执行主体：insurance-d
- 上一步输出：
  ```
  文章标题：2024年保险产品购买指南
  文章内容：<h1>保险产品介绍</h1><p>这是一篇经过合规审核的保险文章...</p>
  作者：保险助手
  摘要：本文介绍2024年最新保险产品
  ```

**可用 capabilities：** [20, 21, 5, 1]

**默认账户 ID：** `insurance-account`

---

#### Agent T 的最终输出

```json
{
  "action": "EXECUTE_MCP",
  "solutionNum": 5,
  "toolName": "wechat",
  "actionName": "addDraft",
  "params": {
    "title": "2024年保险产品购买指南",
    "content": "<h1>保险产品介绍</h1><p>这是一篇经过合规审核的保险文章...</p>",
    "author": "保险助手",
    "digest": "本文介绍2024年最新保险产品",
    "accountId": "insurance-account"
  },
  "reasoning": "1. 为什么选择这个 capability：功能描述与任务目标完全匹配，能力 5 是专门用于添加微信公众号草稿的；2. 参数构建的依据：严格按照 capability 5 的 param_desc 填充，title 和 content 是 required 字段，author 和 digest 是 optional 字段但有可用数据所以也提供了；3. 上一步输出的传递：通过 title 和 content 参数传递了上一步的文章标题和内容。"
}
```

---

### 2.3 场景 3：搜索保险产品信息

#### 输入信息

**任务信息：**
- 任务标题：搜索2024年保险产品信息
- 执行主体：insurance-d
- 上一步输出：无

**可用 capabilities：** [20, 21, 5, 1]

**默认账户 ID：** `insurance-account`

---

#### Agent T 的最终输出

```json
{
  "action": "EXECUTE_MCP",
  "solutionNum": 1,
  "toolName": "search",
  "actionName": "webSearch",
  "params": {
    "query": "2024年保险产品信息",
    "num": 10,
    "accountId": "insurance-account"
  },
  "reasoning": "1. 为什么选择这个 capability：功能描述与任务目标完全匹配，能力 1 是专门用于网页搜索的；2. 参数构建的依据：严格按照 capability 1 的 param_desc 填充，query 是 required 字段，num 使用默认值 10；3. 上一步输出的传递：无上一步输出，无需传递。"
}
```

---

## 三、验证要点

### 3.1 格式验证

✅ **executeCapability 兼容检查：**
```typescript
// Agent T 的输出格式与 Agent B 完全一致
interface AgentTOutput {
  action: 'EXECUTE_MCP';
  solutionNum: number;
  toolName: string;
  actionName: string;
  params: Record<string, any>;
  reasoning: string;
}

// 可以直接传入 executeCapability
executeCapability(task, agentTOutput);
```

### 3.2 MCP 调用验证

✅ **genericMCPCall 参数检查：**
```typescript
// Agent T 的输出可以直接用于 genericMCPCall
const mcpResult = await genericMCPCall(
  agentTOutput.toolName,      // ✅ 正确
  agentTOutput.actionName,    // ✅ 正确
  agentTOutput.params         // ✅ 正确
);
```

### 3.3 动态扩展验证

✅ **新增 capability 无需修改提示词：**
- 只需在 capability_list 表中新增记录
- Agent T 会自动理解新 capability 的 param_desc
- 无需修改提示词代码

---

## 四、总结

### 4.1 智能提示词的核心优势

| 特性 | 说明 |
|------|------|
| **动态理解** | 基于 capability_list 表，无需硬编码 |
| **参数严谨** | 严格按照 param_desc 的 JSON Schema 构建参数 |
| **格式兼容** | 与 Agent B 输出格式完全一致 |
| **易于扩展** | 新增 capability 只需更新数据库 |
| **自我说明** | reasoning 字段详细说明选择理由 |

### 4.2 关键设计点

1. **capability 分析阶段**：逐个分析每个 capability 的完整信息
2. **param_desc 优先**：参数构建的唯一依据是 param_desc
3. **accountId 必需**：无论 param_desc 有没有，都必须添加
4. **上一步输出传递**：通过合适的参数名传递上一步输出
5. **详细 reasoning**：必须说明选择理由和参数构建依据

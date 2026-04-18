
# Agent B 智能决策标准返回格式

## 文档信息
- **版本**: v1.0
- **创建日期**: 2026-03-14
- **适用场景**: 旧流程改造方案 A

---

## 一、核心接口定义

### 1.1 AgentBDecision 接口（标准返回格式）

**文件位置**: `src/lib/services/subtask-execution-engine.ts`  
**行号**: 142-200

```typescript
interface AgentBDecision {
  // ========== 必需字段 ==========
  type: 'EXECUTE_MCP' | 'COMPLETE' | 'NEED_USER' | 'FAILED';
  reasonCode: ReasonCode;
  reasoning: string;
  context: DecisionContext;
  
  // ========== 可选字段（根据 type 不同而不同）==========
  data?: DecisionData;
}
```

---

## 二、字段详细说明

### 2.1 `type` - 决策类型（必需）

| 值 | 说明 | 使用场景 |
|----|------|---------|
| `EXECUTE_MCP` | 需要执行 MCP 工具 | 首次执行、重试、切换方案 |
| `COMPLETE` | 任务已完成 | 任务目标达成，无需继续 |
| `NEED_USER` | 需要用户介入 | 需要用户确认、选择或输入 |
| `FAILED` | 任务无法继续 | 多次失败、不可恢复错误 |

---

### 2.2 `reasonCode` - 原因编码（必需）

#### ReasonCode 类型定义

```typescript
type ReasonCode = 
  // EXECUTE_MCP 类型
  | 'MCP_CONTINUE'        // 继续执行 MCP（首次或正常继续）
  | 'MCP_RETRY'           // 重试 MCP（之前失败，现在重试）
  | 'MCP_NEXT_STEP'       // 下一步 MCP（两阶段流程的第二阶段）
  
  // COMPLETE 类型
  | 'TASK_DONE'           // 任务完成
  | 'NO_MCP_NEEDED'       // 不需要 MCP，直接完成
  
  // NEED_USER 类型
  | 'USER_CONFIRM'        // 需要用户确认
  | 'USER_SELECT'         // 需要用户选择
  | 'USER_INPUT'          // 需要用户输入
  
  // FAILED 类型
  | 'MAX_RETRY_EXCEEDED'  // 超过最大重试次数
  | 'MCP_ERROR_UNRECOVERABLE'  // MCP 错误不可恢复
  | 'CAPABILITY_NOT_FOUND'      // 找不到可用能力
  | 'USER_REJECT'               // 用户拒绝
  | 'BUSINESS_RULE_VIOLATION'   // 违反业务规则
  | 'UNKNOWN_ERROR';             // 未知错误
```

---

### 2.3 `reasoning` - 决策理由（必需）

**格式**: 字符串  
**要求**: 详细说明决策理由，让人类和机器都能理解

**示例**:
```
"reasoning": "根据执行 Agent 的反馈，需要先进行合规检查。找到可用的合规检查能力（ID: 5），建议先执行合规检查，通过后再进行公众号上传。"
```

---

### 2.4 `context` - 决策上下文（必需）

```typescript
interface DecisionContext {
  executionSummary: string;      // 执行摘要
  riskLevel: 'low' | 'medium' | 'high';  // 风险等级
  suggestedAction: string;       // 建议控制器执行的操作
}
```

**字段说明**:

| 字段 | 类型 | 说明 |
|-----|------|------|
| `executionSummary` | string | 执行摘要，简明扼要说明当前状态 |
| `riskLevel` | 'low' \| 'medium' \| 'high' | 风险等级评估 |
| `suggestedAction` | string | 建议控制器执行的操作 |

**示例**:
```json
"context": {
  "executionSummary": "需要执行合规检查",
  "riskLevel": "medium",
  "suggestedAction": "执行合规检查 MCP"
}
```

---

### 2.5 `data` - 决策数据（可选，根据 type 不同）

#### 2.5.1 当 `type === "EXECUTE_MCP"` 时

```typescript
data: {
  mcpParams: {
    solutionNum: number;    // 能力 ID
    toolName: string;       // 工具名
    actionName: string;     // 动作名
    params: any;            // MCP 参数（包含 accountId）
  }
}
```

**示例**:
```json
"data": {
  "mcpParams": {
    "solutionNum": 5,
    "toolName": "wechat_compliance",
    "actionName": "content_audit",
    "params": {
      "accountId": "insurance-account",
      "content": "这是要检查的文章内容..."
    }
  }
}
```

---

#### 2.5.2 当 `type === "COMPLETE"` 时

```typescript
data: {
  completionResult: any;  // 完成结果（任意格式）
}
```

**示例**:
```json
"data": {
  "completionResult": {
    "status": "success",
    "message": "任务已完成",
    "articleUrl": "https://mp.weixin.qq.com/..."
  }
}
```

---

#### 2.5.3 当 `type === "NEED_USER"` 时

```typescript
data: {
  pendingKeyFields?: PendingKeyField[];    // 待填写字段
  availableSolutions?: AvailableSolution[]; // 可用方案列表
  promptMessage?: PromptMessage;             // 提示消息
}
```

**子类型定义**:

```typescript
interface PendingKeyField {
  fieldId: string;
  fieldName: string;
  fieldType: 'text' | 'number' | 'select' | 'date' | 'boolean';
  description: string;
  currentValue: any;
  options?: any[];
  validationRules?: {
    required: boolean;
    min?: number;
    max?: number;
    pattern?: string;
  };
}

interface AvailableSolution {
  solutionId: string;
  label: string;
  description: string;
  pros: string[];
  cons: string[];
}

interface PromptMessage {
  title: string;
  description: string;
  deadline?: Date;
  priority?: 'low' | 'medium' | 'high';
}
```

**示例**:
```json
"data": {
  "pendingKeyFields": [
    {
      "fieldId": "publish_date",
      "fieldName": "发布日期",
      "fieldType": "date",
      "description": "请选择文章发布日期",
      "currentValue": "2026-03-15",
      "validationRules": {
        "required": true
      }
    }
  ],
  "availableSolutions": [
    {
      "solutionId": "option_1",
      "label": "立即发布",
      "description": "立即发布文章",
      "pros": ["快速", "简单"],
      "cons": ["无法撤销"]
    },
    {
      "solutionId": "option_2",
      "label": "定时发布",
      "description": "明天早上 9 点发布",
      "pros": ["更安全"],
      "cons": ["需要等待"]
    }
  ],
  "promptMessage": {
    "title": "请确认发布方式",
    "description": "请选择文章的发布方式",
    "priority": "medium"
  }
}
```

---

#### 2.5.4 当 `type === "FAILED"` 时

```typescript
data: {
  failedDetails: {
    errorType: string;
    errorMessage: string;
    recoverable: boolean;
    suggestedFix?: string;
  }
}
```

**示例**:
```json
"data": {
  "failedDetails": {
    "errorType": "MCP_ERROR",
    "errorMessage": "合规检查失败，内容包含敏感词",
    "recoverable": false,
    "suggestedFix": "请修改文章内容后重试"
  }
}
```

---

## 三、完整返回示例

### 3.1 示例 1: EXECUTE_MCP（合规检查 - 两阶段第一阶段）

```json
{
  "type": "EXECUTE_MCP",
  "reasonCode": "MCP_CONTINUE",
  "reasoning": "根据执行 Agent 的反馈，这是保险事业部的公众号发布任务。按照两阶段流程要求，需要先执行合规检查。找到可用的合规检查能力（ID: 5），建议先执行合规检查。",
  "context": {
    "executionSummary": "需要先执行合规检查",
    "riskLevel": "medium",
    "suggestedAction": "执行合规检查 MCP"
  },
  "data": {
    "mcpParams": {
      "solutionNum": 5,
      "toolName": "wechat_compliance",
      "actionName": "content_audit",
      "params": {
        "accountId": "insurance-account",
        "content": "这是要检查的保险产品介绍文章内容..."
      }
    }
  }
}
```

---

### 3.2 示例 2: EXECUTE_MCP（公众号上传 - 两阶段第二阶段）

```json
{
  "type": "EXECUTE_MCP",
  "reasonCode": "MCP_NEXT_STEP",
  "reasoning": "合规检查已通过！现在进入第二阶段，执行公众号上传。找到可用的公众号上传能力（ID: 11），可以执行上传操作。",
  "context": {
    "executionSummary": "合规检查通过，执行公众号上传",
    "riskLevel": "low",
    "suggestedAction": "执行公众号上传 MCP"
  },
  "data": {
    "mcpParams": {
      "solutionNum": 11,
      "toolName": "wechat",
      "actionName": "add_draft",
      "params": {
        "accountId": "insurance-account",
        "articles": [
          {
            "title": "保险产品介绍",
            "author": "保险事业部",
            "digest": "这是一篇保险产品介绍文章",
            "content": "&lt;h1&gt;保险产品介绍&lt;/h1&gt;&lt;p&gt;...&lt;/p&gt;",
            "show_cover_pic": 0
          }
        ]
      }
    }
  }
}
```

---

### 3.3 示例 3: COMPLETE（任务完成）

```json
{
  "type": "COMPLETE",
  "reasonCode": "TASK_DONE",
  "reasoning": "公众号上传成功！任务目标已达成，可以结束。",
  "context": {
    "executionSummary": "任务已完成",
    "riskLevel": "low",
    "suggestedAction": "标记任务为完成"
  },
  "data": {
    "completionResult": {
      "status": "success",
      "message": "文章已成功上传到公众号草稿箱",
      "articleUrl": "https://mp.weixin.qq.com/...",
      "draftId": "123456"
    }
  }
}
```

---

### 3.4 示例 4: NEED_USER（需要用户选择）

```json
{
  "type": "NEED_USER",
  "reasonCode": "USER_SELECT",
  "reasoning": "检测到有多个发布选项，需要用户选择具体的发布方式。",
  "context": {
    "executionSummary": "需要用户选择发布方式",
    "riskLevel": "medium",
    "suggestedAction": "等待用户选择"
  },
  "data": {
    "availableSolutions": [
      {
        "solutionId": "publish_now",
        "label": "立即发布",
        "description": "立即将文章发布到公众号",
        "pros": ["快速生效", "操作简单"],
        "cons": ["无法撤销", "需要立即确认"]
      },
      {
        "solutionId": "save_draft",
        "label": "保存草稿",
        "description": "保存到草稿箱，稍后手动发布",
        "pros": ["安全", "可修改"],
        "cons": ["需要手动发布"]
      }
    ],
    "promptMessage": {
      "title": "请选择发布方式",
      "description": "文章已通过合规检查，请选择发布方式",
      "priority": "medium"
    }
  }
}
```

---

### 3.5 示例 5: FAILED（任务失败）

```json
{
  "type": "FAILED",
  "reasonCode": "MCP_ERROR_UNRECOVERABLE",
  "reasoning": "合规检查失败，内容包含敏感词，且无法自动修复。任务无法继续。",
  "context": {
    "executionSummary": "合规检查失败",
    "riskLevel": "high",
    "suggestedAction": "标记任务失败"
  },
  "data": {
    "failedDetails": {
      "errorType": "COMPLIANCE_ERROR",
      "errorMessage": "内容包含敏感词：'xxx'",
      "recoverable": false,
      "suggestedFix": "请修改文章内容，删除敏感词后重新提交"
    }
  }
}
```

---

## 四、提示词中的输出格式要求

### 4.1 提示词中的 JSON 模板

在 `callAgentBWithDecision()` 方法的提示词中，要求 Agent B 严格按照以下格式输出：

```json
{
  "type": "EXECUTE_MCP" | "COMPLETE" | "NEED_USER" | "FAILED",
  "reasonCode": "...",
  "reasoning": "详细说明决策理由",
  "context": {
    "executionSummary": "执行摘要",
    "riskLevel": "low" | "medium" | "high",
    "suggestedAction": "建议控制器执行的操作"
  },
  "data": {
    // 根据 type 不同填充相应数据
  }
}
```

### 4.2 重要规则（提示词中强调）

1. **必须严格按照 JSON 格式输出**
2. **基于 MCP 历史分析**：如果多次失败且不可恢复，应输出 FAILED
3. **如果任务目标已达成**，输出 COMPLETE
4. **如果需要用户确认关键信息**，输出 NEED_USER
5. **关键**: `params.accountId` 必须使用正确的值
6. **只输出 JSON**，不要输出其他任何文字说明

---

## 五、验证与解析逻辑

### 5.1 代码中的解析逻辑

在 `callAgentBWithDecision()` 方法中，对 Agent B 的返回进行以下验证：

```typescript
// 1. 解析 JSON
const parsed = JSON.parse(response);

// 2. 验证必需字段
if (!parsed.type || !['EXECUTE_MCP', 'COMPLETE', 'NEED_USER', 'FAILED'].includes(parsed.type)) {
  throw new Error('缺少有效的 type 字段');
}
if (!parsed.reasonCode) {
  throw new Error('缺少 reasonCode 字段');
}

// 3. 补全 context（如果缺失）
if (!parsed.context) {
  parsed.context = {
    executionSummary: '未提供执行摘要',
    riskLevel: 'medium',
    suggestedAction: '根据type执行相应操作'
  };
}

// 4. 确保 MCP 参数中有 accountId
if (decision.type === 'EXECUTE_MCP' && decision.data?.mcpParams?.params) {
  if (!decision.data.mcpParams.params.accountId) {
    decision.data.mcpParams.params.accountId = defaultAccountId;
  }
}
```

---

## 六、快速参考卡

### 6.1 Decision Type 速查

| Type | 说明 | 必须包含的 data 字段 |
|------|------|-------------------|
| `EXECUTE_MCP` | 执行 MCP | `mcpParams` |
| `COMPLETE` | 任务完成 | `completionResult` (可选) |
| `NEED_USER` | 需要用户 | `pendingKeyFields` 或 `availableSolutions` 或 `promptMessage` |
| `FAILED` | 任务失败 | `failedDetails` |

### 6.2 Reason Code 速查

| Type | 常用 Reason Code |
|------|-----------------|
| `EXECUTE_MCP` | `MCP_CONTINUE`, `MCP_RETRY`, `MCP_NEXT_STEP` |
| `COMPLETE` | `TASK_DONE`, `NO_MCP_NEEDED` |
| `NEED_USER` | `USER_CONFIRM`, `USER_SELECT`, `USER_INPUT` |
| `FAILED` | `MAX_RETRY_EXCEEDED`, `MCP_ERROR_UNRECOVERABLE`, `UNKNOWN_ERROR` |

---

## 附录 A：关键代码位置

| 内容 | 文件 | 行号 |
|-----|------|------|
| AgentBDecision 接口定义 | subtask-execution-engine.ts | 142-200 |
| 提示词中的输出格式要求 | subtask-execution-engine.ts | 2180-2230 |
| 解析和验证逻辑 | subtask-execution-engine.ts | 2250-2320 |

---

**文档结束**

*最后更新: 2026-03-14*

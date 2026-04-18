# interact_content 字段完整说明文档（含测试案例标注）

## 📋 文档概述
本文档基于真实的 `agent_sub_tasks_step_history` 表数据，详细说明 `interact_content` 字段的完整内容、每个 key 与 value 的业务含义，以及 Agent 与 Agent 的交互过程。

### 数据来源
- `command_result_id`: `7b005762-6480-4e39-8678-73d6b1233d2d`
- 对应的 `daily_task`: `e2e-test-1772801252` (端到端功能测试-full)
- 包含 23 条 `agent_sub_tasks_step_history` 记录

---

## ⚠️ 重要说明：测试案例对应关系

**文档中每条数据对应的测试案例如下：**

### 📊 13个测试案例与数据对应表

| 测试案例ID | 子任务名称 | order_index | 对应的 step-history 数据 |
|-----------|-----------|-------------|-------------------|
| **TC-01A** | **合规审核测试-违规识别并整改** | 1 | step_no 1-2 (文档中的第1-3条记录) |
| TC-01B | 合规审核测试-合规直接发布 | 2 | 数据不完整 |
| TC-01C | 合规审核测试-流程完整性验证 | 3 | 数据不完整 |
| **TC-02** | **网页搜索带摘要测试-搜索保险市场趋势** | 4 | 数据不完整 |
| **TC-03** | **网页搜索测试-基础搜索** | 5 | 数据不完整 |
| TC-04 | 添加草稿测试-微信公众号草稿 | 6 | 数据不完整 |
| TC-05 | 重试策略测试-首次失败重试成功 | 7 | 数据不完整 |
| TC-06 | 重试限制测试-多次失败 | 8 | 数据不完整 |
| TC-07 | 迭代限制测试-最大迭代 | 9 | 数据不完整 |
| TC-08 | 用户交互测试-确认后继续 | 10 | 数据不完整 |
| **TC-23** | **复杂审核流程-多次违规整改后发布** | 11 | 数据不完整 |
| **TC-24** | **正常发布流程-合规内容直接发布** | 12 | 数据不完整 |
| **TC-25** | **审核不通过-提示修改后重试发布** | 13 | 数据不完整 |

### 📝 文档中数据的测试案例标注

本文档中展示的数据主要来自 **TC-01A (合规审核测试-违规识别并整改)**，其他测试案例的数据在这个 command_result_id 中不完整。

**完整的13个测试案例与 step-history 记录的对应关系，请参考文档：[test-case-to-step-history-mapping.md](test-case-to-step-history-mapping.md)**

---

## 🔍 完整的 interact_content 字段内容展示

### 第 1 条记录：insurance-d → agent B (request)

**对应测试案例**: **TC-01A** - **合规审核测试-违规识别并整改**
- 测试场景: 初始内容违规 → Agent 识别违规提示修改 → 用户整改后重新提交 → 合规审核通过 → 成功上传公众号
- capabilityType: platform_publish

**元数据**:
- `step_no`: 1
- `interact_num`: 1
- `interact_type`: "request"
- `interact_user`: "insurance-d"
- `interact_time`: "2026-03-06T12:47:33.579Z"

**interact_content 完整内容**:
```json
{
  "ext_info": {
    "step": "phase_1_executor_analysis"
  },
  "question": {
    "problem": "需要微信公众号相关的操作能力",
    "isNeedMcp": true,
    "isTaskDown": false,
    "capabilityType": "platform_publish",
    "executionResult": null
  },
  "response": "",
  "responder": "agent B",
  "consultant": "insurance-d",
  "interact_type": "request",
  "execution_result": {
    "status": "waiting"
  }
}
```

---

### 第 2 条记录：agent B → insurance-d (response)

**对应测试案例**: **TC-01A** - **合规审核测试-违规识别并整改**
- 测试场景: 初始内容违规 → Agent 识别违规提示修改 → 用户整改后重新提交 → 合规审核通过 → 成功上传公众号
- capabilityType: platform_publish

**元数据**:
- `step_no`: 1
- `interact_num`: 2
- `interact_type`: "response"
- `interact_user`: "agent B"
- `interact_time`: "2026-03-06T12:47:52.076Z"

**interact_content 完整内容**:
```json
{
  "ext_info": {
    "step": "phase_2_mcp_decision"
  },
  "question": {
    "problem": "需要微信公众号相关的操作能力",
    "isNeedMcp": true,
    "isTaskDown": false,
    "capabilityType": "platform_publish",
    "executionResult": null
  },
  "response": {
    "decision": {
      "type": "NEED_USER",
      "reasoning": "当前任务为合规审核测试-违规识别并整改，需要微信公众号相关操作能力，但现有多个platform_publish类型的微信公众号操作能力，无法确定具体需要执行哪一项操作，需用户选择具体的操作能力。",
      "reason_code": "USER_SELECT",
      "final_conclusion": "等待用户处理"
    },
    "mcp_attempts": [],
    "prompt_message": {
      "title": "请选择微信公众号操作能力",
      "priority": "medium",
      "description": "当前任务为合规审核测试-违规识别并整改，需要执行微信公众号相关操作，但存在多个可选能力，请您选择具体需要执行的操作能力，以便推进任务。"
    },
    "user_interactions": [],
    "pending_key_fields": [
      {
        "fieldId": "selectedMcpCapability",
        "fieldName": "选择微信公众号操作能力",
        "fieldType": "select",
        "description": "请选择需要执行的微信公众号相关操作能力，以推进合规审核测试-违规识别并整改任务",
        "currentValue": "",
        "validationRules": {
          "required": true
        }
      }
    ],
    "available_solutions": [
      {
        "cons": ["仅能获取账号列表，无法直接进行违规内容的识别与整改"],
        "pros": ["可获取账号基础信息，为后续违规识别提供账号范围"],
        "label": "微信公众号-获取账号列表",
        "solutionId": "15",
        "description": "获取微信公众号的账号列表"
      },
      {
        "cons": ["仅能获取草稿列表，无法直接对违规内容进行整改操作"],
        "pros": ["可获取待发布的草稿内容，便于识别其中的违规内容"],
        "label": "微信公众号-获取草稿列表",
        "solutionId": "12",
        "description": "获取微信公众号的草稿列表"
      },
      {
        "cons": ["需要先确定违规草稿，无前置信息无法直接执行"],
        "pros": ["可直接删除违规的草稿内容，完成整改"],
        "label": "微信公众号-删除草稿",
        "solutionId": "13",
        "description": "删除微信公众号的指定草稿"
      },
      {
        "cons": ["仅能上传素材，无法直接识别违规内容"],
        "pros": ["可用于替换违规的图片素材"],
        "label": "微信公众号-上传图片素材",
        "solutionId": "14",
        "description": "向微信公众号上传图片素材"
      },
      {
        "cons": ["需要先完成合规内容的编辑，无前置信息无法直接执行"],
        "pros": ["可用于重新编辑合规的草稿替换违规内容"],
        "label": "微信公众号-添加草稿",
        "solutionId": "11",
        "description": "向微信公众号添加新的草稿"
      }
    ]
  },
  "responder": "agent B",
  "consultant": "insurance-d",
  "interact_type": "response",
  "execution_result": {
    "status": "waiting_user"
  }
}
```

---

### 第 3 条记录：insurance-d → agent B (request)

**对应测试案例**: **TC-01A** - **合规审核测试-违规识别并整改**
- 测试场景: 初始内容违规 → Agent 识别违规提示修改 → 用户整改后重新提交 → 合规审核通过 → 成功上传公众号
- capabilityType: platform_publish

**元数据**:
- `step_no`: 2
- `interact_num`: 1
- `interact_type`: "request"
- `interact_user": "insurance-d"
- `interact_time": "2026-03-06T12:47:57.626Z"

**interact_content 完整内容**:
```json
{
  "ext_info": {
    "step": "phase_1_executor_analysis"
  },
  "question": {
    "problem": "需要微信公众号相关的操作能力",
    "isNeedMcp": true,
    "isTaskDown": false,
    "capabilityType": "platform_publish",
    "executionResult": null
  },
  "response": "",
  "responder": "agent B",
  "consultant": "insurance-d",
  "interact_type": "request",
  "execution_result": {
    "status": "waiting"
  }
}
```

---

### 第 4 条记录：agent B → insurance-d (response)

**对应测试案例**: **TC-01A** - **合规审核测试-违规识别并整改**
- 测试场景: 初始内容违规 → Agent 识别违规提示修改 → 用户整改后重新提交 → 合规审核通过 → 成功上传公众号
- capabilityType: platform_publish

**元数据**:
- `step_no`: 2
- `interact_num`: 2
- `interact_type`: "response"
- `interact_user": "agent B"
- `interact_time": "2026-03-06T12:48:21.785Z"

**interact_content 完整内容**:
```json
{
  "ext_info": {
    "step": "phase_2_mcp_decision"
  },
  "question": {
    "problem": "需要微信公众号相关的操作能力",
    "isNeedMcp": true,
    "isTaskDown": false,
    "capabilityType": "platform_publish",
    "executionResult": null
  },
  "response": {
    "decision": {
      "type": "NEED_USER",
      "reasoning": "当前任务为合规审核测试-违规识别并整改，需要微信公众号相关操作能力，但现有多个platform_publish类型的微信公众号操作能力，无法确定具体需要执行哪一项操作，需用户选择具体的操作能力。",
      "reason_code": "USER_SELECT",
      "final_conclusion": "等待用户处理"
    },
    "mcp_attempts": [],
    "prompt_message": {
      "title": "请选择微信公众号操作能力",
      "priority": "medium",
      "description": "当前任务为合规审核测试-违规识别并整改，需要执行微信公众号相关操作，但存在多个可选能力，请您选择具体需要执行的操作能力，以便推进任务。"
    },
    "user_interactions": [],
    "pending_key_fields": [
      {
        "fieldId": "selectedMcpCapability",
        "fieldName": "选择微信公众号操作能力",
        "fieldType": "select",
        "description": "请选择需要执行的微信公众号相关操作能力，以推进合规审核测试-违规识别并整改任务",
        "currentValue": "",
        "validationRules": {
          "required": true
        }
      }
    ],
    "available_solutions": [
      {
        "cons": ["仅能获取账号列表，无法直接进行违规内容的识别与整改"],
        "pros": ["可获取账号基础信息，为后续违规识别提供账号范围"],
        "label": "微信公众号-获取账号列表",
        "solutionId": "15",
        "description": "获取微信公众号的账号列表"
      },
      {
        "cons": ["仅能获取草稿列表，无法直接对违规内容进行整改操作"],
        "pros": ["可获取待发布的草稿内容，便于识别其中的违规内容"],
        "label": "微信公众号-获取草稿列表",
        "solutionId": "12",
        "description": "获取微信公众号的草稿列表"
      },
      {
        "cons": ["需要先确定违规草稿，无前置信息无法直接执行"],
        "pros": ["可直接删除违规的草稿内容，完成整改"],
        "label": "微信公众号-删除草稿",
        "solutionId": "13",
        "description": "删除微信公众号的指定草稿"
      },
      {
        "cons": ["仅能上传素材，无法直接识别违规内容"],
        "pros": ["可用于替换违规的图片素材"],
        "label": "微信公众号-上传图片素材",
        "solutionId": "14",
        "description": "向微信公众号上传图片素材"
      },
      {
        "cons": ["需要先完成合规内容的编辑，无前置信息无法直接执行"],
        "pros": ["可用于重新编辑合规的草稿替换违规内容"],
        "label": "微信公众号-添加草稿",
        "solutionId": "11",
        "description": "向微信公众号添加新的草稿"
      }
    ]
  },
  "responder": "agent B",
  "consultant": "insurance-d",
  "interact_type": "response",
  "execution_result": {
    "status": "waiting_user"
  }
}
```

---

### 第 5 条记录：insurance-d → agent B (request)

**对应测试案例**: **TC-01A** - **合规审核测试-违规识别并整改**
- 测试场景: 初始内容违规 → Agent 识别违规提示修改 → 用户整改后重新提交 → 合规审核通过 → 成功上传公众号
- capabilityType: platform_publish

**元数据**:
- `step_no`: 3
- `interact_num`: 1
- `interact_type`: "request"
- `interact_user": "insurance-d"
- `interact_time": "2026-03-06T12:48:27.398Z"

**interact_content 完整内容**:
```json
{
  "ext_info": {
    "step": "phase_1_executor_analysis"
  },
  "question": {
    "problem": "需要微信公众号相关的操作能力",
    "isNeedMcp": true,
    "isTaskDown": false,
    "capabilityType": "platform_publish",
    "executionResult": null
  },
  "response": "",
  "responder": "agent B",
  "consultant": "insurance-d",
  "interact_type": "request",
  "execution_result": {
    "status": "waiting"
  }
}
```

---

## 📋 每个 key 与 value 的业务含义详细说明

### 顶层字段

| Key | Value 示例 | 业务含义 | 数据来源 |
|-----|-----------|---------|---------|
| `ext_info` | `{"step": "phase_1_executor_analysis"}` | 扩展信息，记录当前处理阶段等元数据 | Agent 内部状态管理 |
| `question` | `{"problem": "...", "isNeedMcp": true, ...}` | 问题内容，描述需要解决的问题、是否需要MCP、任务类型等 | 从 insurance-d 传递的任务信息 |
| `response` | `{"decision": {...}, "mcp_attempts": [...], ...}` | 响应内容，包含决策、MCP调用记录、提示消息等 | Agent B 处理后的输出 |
| `responder` | `"agent B"` | 回应者，即发送此条消息的 Agent 名称 | 系统标识 |
| `consultant` | `"insurance-d"` | 顾问，即此交互过程的咨询者/请求者 | 系统标识 |
| `interact_type` | `"request"` \| `"response"` | 交互类型，标识这是请求还是响应 | 系统标识 |
| `execution_result` | `{"status": "waiting"}` | 执行结果，记录当前步骤的执行状态 | Agent 执行状态 |

---

### `question` 字段详细说明

| Key | Value 示例 | 业务含义 | 说明 |
|-----|-----------|---------|------|
| `problem` | `"需要微信公众号相关的操作能力"` | 任务问题描述 | 简洁说明需要解决什么问题 |
| `isNeedMcp` | `true` \| `false` | 是否需要调用 MCP 能力 | true 表示需要调用工具，false 表示不需要 |
| `isTaskDown` | `false` \| `true` | 任务是否完成 | false 表示任务未完成，true 表示任务已完成 |
| `capabilityType` | `"platform_publish"` \| `"search"` | 任务类型/能力类型 | 标识这是什么类型的任务（平台发布/搜索等） |
| `executionResult` | `null` \| `{...}` | 执行结果（request 时通常为空） | 在 request 中通常为 null，response 中可能有结果 |

---

### `response` 字段详细说明（当 interact_type = "response" 时）

| Key | Value 示例 | 业务含义 | 说明 |
|-----|-----------|---------|------|
| `decision` | `{"type": "NEED_USER", "reasoning": "..."}` | 决策数据 | Agent 做出的最终决策 |
| `mcp_attempts` | `[{"decision": {...}, "result": {...}]` | MCP 调用记录 | 记录每次 MCP 调用的参数、决策、结果 |
| `prompt_message` | `{"title": "...", "priority": "medium"}` | 提示消息 | 给用户的提示信息（标题、优先级、描述） |
| `user_interactions` | `[]` \| `[{...}]` | 用户交互记录 | 记录用户的交互操作（确认、选择等） |
| `pending_key_fields` | `[{"fieldId": "...", "fieldName": "..."}]` | 待处理字段 | 需要用户填写或确认的关键字段 |
| `available_solutions` | `[{"label": "...", "solutionId": "..."}]` | 可用解决方案 | 提供给用户选择的解决方案列表 |
| `failed_details` | `{...}` \| `undefined` | 失败详情 | 任务失败时的详细信息 |

---

### `response.decision` 字段详细说明

| Key | Value 示例 | 业务含义 | 说明 |
|-----|-----------|---------|------|
| `type` | `"NEED_USER"` \| `"COMPLETE"` \| `"FAILED"` | 决策类型 | 标识 Agent 的决策类型 |
| `reasoning` | `"当前任务为合规审核测试..."` | Agent 推理过程 | Agent 做出此决策的思考过程/理由 |
| `reason_code` | `"USER_SELECT"` \| `"..."` | 原因代码 | 标准化的决策原因代码 |
| `final_conclusion` | `"等待用户处理"` | 最终结论 | 简洁的结论描述 |

#### `decision.type` 取值说明：

| 值 | 含义 | 场景 |
|----|------|------|
| `NEED_USER` | 需要用户操作 | Agent 无法自动决定，需要用户选择/确认/输入 |
| `COMPLETE` | 任务完成 | Agent 已成功完成任务 |
| `FAILED` | 任务失败 | Agent 尝试后未能完成任务 |

---

### `response.mcp_attempts` 单条记录详细说明

`mcp_attempts` 是一个数组，记录每次 MCP 调用的完整过程。

| Key | Value 示例 | 业务含义 | 说明 |
|-----|-----------|---------|------|
| `decision` | `{"strategy": "execute", "toolName": "..."}` | 调用决策 | Agent 决定如何调用 MCP 的决策 |
| `result` | `{"status": "success", "data": {...}}` | 调用结果 | MCP 工具的执行结果 |

#### `mcp_attempts[].decision` 详细说明：

| Key | Value 示例 | 业务含义 |
|-----|-----------|---------|
| `strategy` | `"execute"` \| `"skip"` \| `"retry"` | 策略：执行/跳过/重试 |
| `toolName` | `"微信公众号-获取账号列表"` | 工具名称 |
| `actionName` | `"getAccountList"` \| `"addDraft"` | 动作名称（具体的 API 操作） |
| `reasoning` | `"首先需要获取账号列表..."` | 推理过程 |
| `toolInput` | `{...}` | 工具输入参数 |

#### `mcp_attempts[].result` 详细说明：

| Key | Value 示例 | 业务含义 |
|-----|-----------|---------|
| `status` | `"success"` \| `"failed"` \| `"error"` | **工具调用是否成功**（HTTP 层面） |
| `executionTime` | `1234` | 执行耗时（毫秒） |
| `data` | `{"success": true, "data": [...]}` | **业务数据**（包含业务层面的 success/error） |

⚠️ **重要区分**：
- `result.status` = 工具调用是否成功（如网络请求成功）
- `result.data.success` = 业务是否成功（如工具返回了预期结果）

---

### `response.prompt_message` 字段详细说明

| Key | Value 示例 | 业务含义 |
|-----|-----------|---------|
| `title` | `"请选择微信公众号操作能力"` | 提示消息标题 |
| `priority` | `"low"` \| `"medium"` \| `"high"` | 优先级 |
| `description` | `"当前任务为合规审核测试..."` | 详细描述 |

---

### `response.pending_key_fields[]` 单条记录详细说明

| Key | Value 示例 | 业务含义 |
|-----|-----------|---------|
| `fieldId` | `"selectedMcpCapability"` | 字段唯一标识 |
| `fieldName` | `"选择微信公众号操作能力"` | 字段显示名称 |
| `fieldType` | `"select"` \| `"text"` \| `"confirm"` | 字段类型（下拉选择/文本输入/确认） |
| `description` | `"请选择需要执行的微信公众号相关操作能力..."` | 字段描述 |
| `currentValue` | `""` \| `"15"` | 当前值 |
| `validationRules` | `{"required": true}` | 验证规则 |

---

### `response.available_solutions[]` 单条记录详细说明

| Key | Value 示例 | 业务含义 |
|-----|-----------|---------|
| `label` | `"微信公众号-获取账号列表"` | 方案显示标签 |
| `solutionId` | `"15"` | 方案唯一标识 |
| `description` | `"获取微信公众号的账号列表"` | 方案描述 |
| `pros` | `["可获取账号基础信息..."]` | 优点列表 |
| `cons` | `["仅能获取账号列表..."]` | 缺点列表 |

---

### `execution_result` 字段详细说明

| Key | Value 示例 | 业务含义 |
|-----|-----------|---------|
| `status` | `"waiting"` \| `"waiting_user"` \| `"failed"` \| `"completed"` | 执行状态 |

#### `execution_result.status` 取值说明：

| 值 | 含义 |
|----|------|
| `waiting` | 等待处理（request 时的初始状态） |
| `waiting_user` | 等待用户操作（response 后） |
| `failed` | 执行失败 |
| `completed` | 执行完成 |

---

## 💬 Agent 与 Agent 的完整交互过程

### 对话形式展示 5 轮完整交互

#### 第 1 轮：insurance-d 发起任务（request）
- **时间**: 2026-03-06T12:47:33.579Z
- **发送者**: insurance-d
- **接收者**: agent B
- **内容**: "需要微信公众号相关的操作能力"
- **capabilityType**: platform_publish
- **isNeedMcp**: true
- **业务背景**: insurance-d 有一个任务需要完成，需要调用微信公众号相关的 MCP 能力

#### 第 2 轮：agent B 回应（response）- NEED_USER
- **时间**: 2026-03-06T12:47:52.076Z
- **发送者**: agent B
- **接收者**: insurance-d
- **决策**: NEED_USER
- **推理过程**: "当前任务为合规审核测试-违规识别并整改，需要微信公众号相关操作能力，但现有多个platform_publish类型的微信公众号操作能力，无法确定具体需要执行哪一项操作，需用户选择具体的操作能力。"
- **提示消息**: "请选择微信公众号操作能力"
- **提供 5 个可选方案**:
  1. 微信公众号-获取账号列表
  2. 微信公众号-获取草稿列表
  3. 微信公众号-删除草稿
  4. 微信公众号-上传图片素材
  5. 微信公众号-添加草稿
- **执行结果**: waiting_user
- **业务含义**: agent B 分析任务后，发现有多个可用的 MCP 能力，无法自动决定用哪个，所以需要用户选择

#### 第 3 轮：insurance-d 再次请求（request）
- **时间**: 2026-03-06T12:47:57.626Z
- **发送者**: insurance-d
- **接收者**: agent B
- **内容**: "需要微信公众号相关的操作能力"
- **执行状态**: waiting
- **业务背景**: 用户（可能是真实用户或测试脚本）继续提交相同的问题，可能用户已经选择了某个方案但数据中未体现

#### 第 4 轮：agent B 再次回应（response）- NEED_USER
- **时间**: 2026-03-06T12:48:21.785Z
- **发送者**: agent B
- **接收者**: insurance-d
- **决策**: NEED_USER
- **推理过程**: 与第 2 轮相同
- **提示消息**: 与第 2 轮相同
- **执行结果**: waiting_user
- **业务含义**: agent B 再次需要用户选择具体的 MCP 能力

#### 第 5 轮：insurance-d 继续请求（request）
- **时间**: 2026-03-06T12:48:27.398Z
- **发送者**: insurance-d
- **接收者**: agent B
- **内容**: "需要微信公众号相关的操作能力"
- **执行状态**: waiting
- **后续**: 数据中没有继续的记录了，实际业务中用户应该会选择某个方案继续执行

---

## 📊 13个测试案例与 interact_content 字段对应关系

### TC-01A - 合规审核测试-违规识别并整改
- **order_index**: 1
- **task_id 示例**: subtask-20260306-001
- **业务场景**: 初始内容违规 → Agent 识别违规提示修改 → 用户整改后重新提交 → 合规审核通过 → 成功上传公众号
- **interact_content 关键字段**:
  - `question.problem`: "需要微信公众号相关的操作能力"
  - `question.capabilityType`: "platform_publish"
  - `response.decision.type`: "NEED_USER"
  - `response.prompt_message.description`: "当前任务为合规审核测试-违规识别并整改..."
  - `response.pending_key_fields[].description`: "请选择需要执行的微信公众号相关操作能力，以推进合规审核测试-违规识别并整改任务"
- **interact_content 特征**: 
  - response 中包含 5 个 available_solutions（微信公众号相关操作）
  - pending_key_fields 是 select 类型，用于选择 MCP 能力
  - mcp_attempts 数组为空（还未执行 MCP 调用）

### TC-01B - 合规审核测试-合规直接发布
- **order_index**: 2
- **task_id 示例**: subtask-20260306-002
- **业务场景**: 初始内容合规 → Agent 确认内容合规 → 直接发布到微信公众号 → 发布成功
- **interact_content 关键字段**:
  - `question.problem`: "需要微信公众号相关的操作能力"
  - `question.capabilityType`: "platform_publish"
  - `response.decision.type`: "COMPLETE"（任务直接完成）
- **interact_content 特征**:
  - 可能不经过 NEED_USER，直接判断内容合规并发布
  - mcp_attempts 会有微信公众号发布的调用记录

### TC-01C - 合规审核测试-流程完整性验证
- **order_index**: 3
- **task_id 示例**: subtask-20260306-003
- **业务场景**: 验证完整的合规审核流程（接收内容 → 合规检查 → 反馈结果 → 确认发布）
- **interact_content 关键字段**:
  - `question.problem`: "需要微信公众号相关的操作能力"
  - `question.capabilityType`: "platform_publish"
  - `response.decision.type`: 可能先 NEED_USER 再 COMPLETE
- **interact_content 特征**:
  - 可能有多轮交互，验证完整流程
  - 包含多个 step_no 的记录

### TC-02 - 网页搜索带摘要测试-搜索保险市场趋势
- **order_index**: 4
- **task_id 示例**: subtask-20260306-004
- **业务场景**: 搜索"2026年保险市场发展趋势" → 联网搜索获取结果 → 生成摘要 → 返回摘要信息
- **interact_content 关键字段**:
  - `question.capabilityType`: "search"（不是 platform_publish）
  - `question.problem`: "搜索保险市场趋势相关信息"
  - `response.mcp_attempts[].decision.toolName`: "联网搜索"
  - `response.mcp_attempts[].result.data`: 包含搜索摘要
- **interact_content 特征**:
  - capabilityType 是 "search"
  - mcp_attempts 会有联网搜索的调用记录
  - result.data 中包含搜索结果和摘要

### TC-03 - 网页搜索测试-基础搜索
- **order_index**: 5
- **task_id 示例**: subtask-20260306-005
- **业务场景**: 基础搜索测试 → 执行简单关键词搜索 → 返回原始搜索结果
- **interact_content 关键字段**:
  - `question.capabilityType`: "search"
  - `question.problem`: "执行基础网页搜索"
  - `response.mcp_attempts[].decision.toolName`: "联网搜索"
- **interact_content 特征**:
  - capabilityType 是 "search"
  - 可能不需要生成摘要，直接返回搜索结果
  - mcp_attempts 记录搜索调用

### TC-04 - 添加草稿测试-微信公众号草稿
- **order_index**: 6
- **task_id 示例**: subtask-20260306-006
- **业务场景**: 准备文章内容 → 调用微信公众号添加草稿接口 → 草稿保存成功 → 返回草稿 ID
- **interact_content 关键字段**:
  - `question.capabilityType`: "platform_publish"
  - `question.problem`: "需要添加微信公众号草稿"
  - `response.mcp_attempts[].decision.toolName`: "微信公众号-添加草稿"
  - `response.mcp_attempts[].result.data.success`: true（草稿添加成功）
- **interact_content 特征**:
  - mcp_attempts 中有 "微信公众号-添加草稿" 的调用记录
  - result.data 中返回草稿 ID
  - decision.type 可能是 "COMPLETE"

### TC-05 - 重试策略测试-首次失败重试成功
- **order_index**: 7
- **task_id 示例**: subtask-20260306-007
- **业务场景**: 首次调用 MCP 失败 → Agent 识别失败原因 → 自动重试 → 第二次调用成功
- **interact_content 关键字段**:
  - `response.mcp_attempts`: 数组长度 >= 2（至少 2 次尝试）
  - `response.mcp_attempts[0].result.status`: "failed"（第一次失败）
  - `response.mcp_attempts[1].result.status`: "success"（第二次成功）
  - `response.decision.type`: "COMPLETE"（最终成功）
- **interact_content 特征**:
  - mcp_attempts 数组有多条记录
  - 前几次失败，最后一次成功
  - decision.reasoning 会提到重试策略

### TC-06 - 重试限制测试-多次失败
- **order_index**: 8
- **task_id 示例**: subtask-20260306-008
- **业务场景**: 多次调用 MCP 都失败 → 达到最大重试次数 → 停止重试 → 返回失败
- **interact_content 关键字段**:
  - `response.mcp_attempts`: 数组长度 >= 3（多次尝试）
  - `response.mcp_attempts[*].result.status`: "failed"（全部失败）
  - `response.decision.type`: "FAILED"（最终失败）
  - `response.failed_details`: 有详细失败信息
- **interact_content 特征**:
  - mcp_attempts 数组有多条记录，全部失败
  - decision.type 是 "FAILED"
  - failed_details 记录了失败原因和重试次数

### TC-07 - 迭代限制测试-最大迭代
- **order_index**: 9
- **task_id 示例**: subtask-20260306-009
- **业务场景**: 多轮对话 → 执行多次迭代 → 达到最大迭代次数限制 → 任务终止
- **interact_content 关键字段**:
  - `ext_info.step`: "phase_1_executor_analysis"（可能有多个 phase）
  - `execution_result.status`: 可能有多个 step_no
  - `response.decision.type`: "FAILED"（因为达到迭代限制）
  - `response.failed_details.reason`: "达到最大迭代次数"
- **interact_content 特征**:
  - 有多个 step_no 的记录
  - ext_info 中可能记录了迭代次数
  - 最终因为迭代限制而失败

### TC-08 - 用户交互测试-确认后继续
- **order_index**: 10
- **task_id 示例**: subtask-20260306-010
- **业务场景**: Agent 提出方案 → 用户确认 → Agent 继续执行 → 任务完成
- **interact_content 关键字段**:
  - `response.decision.type`: 先 "NEED_USER"，后 "COMPLETE"
  - `response.user_interactions`: 有用户确认记录
  - `response.pending_key_fields[].fieldType`: "confirm"（确认类型）
- **interact_content 特征**:
  - pending_key_fields 是 confirm 类型
  - user_interactions 数组记录了用户的确认操作
  - 至少有两轮交互：NEED_USER → 用户确认 → COMPLETE

### TC-23 - 复杂审核流程-多次违规整改后发布
- **order_index**: 11
- **task_id 示例**: subtask-20260306-023
- **业务场景**: 初始内容违规 → 提示修改 → 用户整改 → 仍违规 → 再次提示 → 用户二次整改 → 合规 → 成功发布
- **interact_content 关键字段**:
  - `question.problem`: "需要微信公众号相关的操作能力"
  - `question.capabilityType`: "platform_publish"
  - `response.decision.type`: 多次 NEED_USER，最后 COMPLETE
  - `response.mcp_attempts`: 有多次调用记录
- **interact_content 特征**:
  - 有多个 step_no，代表多轮整改
  - 每次 response 都有不同的提示消息
  - 最终 mcp_attempts 有成功的发布记录

### TC-24 - 正常发布流程-合规内容直接发布
- **order_index**: 12
- **task_id 示例**: subtask-20260306-024
- **业务场景**: 内容完全合规 → 无需修改 → 直接调用发布接口 → 发布成功
- **interact_content 关键字段**:
  - `question.capabilityType`: "platform_publish"
  - `response.decision.type`: "COMPLETE"
  - `response.mcp_attempts[].decision.toolName`: "微信公众号-添加草稿" 或发布相关
  - `response.mcp_attempts[].result.data.success`: true
- **interact_content 特征**:
  - 可能没有 NEED_USER，直接 COMPLETE
  - mcp_attempts 有发布调用记录
  - result.data 显示发布成功

### TC-25 - 审核不通过-提示修改后重试发布
- **order_index**: 13
- **task_id 示例**: subtask-20260306-025
- **业务场景**: 内容审核不通过 → 提示具体修改意见 → 用户修改 → 重新提交 → 审核通过 → 发布成功
- **interact_content 关键字段**:
  - `question.capabilityType`: "platform_publish"
  - `response.decision.type`: 先 NEED_USER，后 COMPLETE
  - `response.prompt_message.description`: 包含具体的修改建议
  - `response.mcp_attempts`: 有失败和成功两次调用
- **interact_content 特征**:
  - 第一次 mcp_attempts 失败（审核不通过）
  - prompt_message 中有具体的修改意见
  - 第二次 mcp_attempts 成功（修改后通过）

---

## 🎯 关键字段业务含义总结

| 字段 | 业务含义 | 示例值 |
|------|---------|--------|
| `question.problem` | 任务问题描述 | "需要微信公众号相关的操作能力" |
| `question.capabilityType` | 任务类型 | "platform_publish" / "search" |
| `response.decision.type` | 决策类型 | "NEED_USER" / "COMPLETE" / "FAILED" |
| `response.decision.reasoning` | Agent 推理过程 | "当前任务为合规审核测试..." |
| `response.mcp_attempts` | MCP 调用记录 | 每次调用的参数、决策、结果 |
| `result.status` | 工具调用是否成功 | "success" |
| `result.data.success` | 业务是否成功 | true/false |
| `result.data.error` | 业务失败原因 | "缺少 articles 参数..." |
| `execution_result.status` | 整体执行状态 | "waiting" / "waiting_user" / "failed" |

---

## 🔀 decision.type 与 13个测试案例的对应关系

| 测试案例ID | 预期 decision.type | 场景说明 |
|-----------|------------------|---------|
| **TC-01A** | NEED_USER → COMPLETE | 先需要用户选择，整改后完成 |
| **TC-01B** | COMPLETE | 内容合规，直接完成 |
| **TC-01C** | NEED_USER → COMPLETE | 验证完整流程，需要用户交互 |
| **TC-02** | COMPLETE | 搜索完成，直接返回结果 |
| **TC-03** | COMPLETE | 基础搜索完成 |
| **TC-04** | COMPLETE | 草稿添加完成 |
| **TC-05** | COMPLETE | 重试后最终成功 |
| **TC-06** | FAILED | 多次重试后失败 |
| **TC-07** | FAILED | 达到迭代限制，失败 |
| **TC-08** | NEED_USER → COMPLETE | 用户确认后继续，最终完成 |
| **TC-23** | NEED_USER → NEED_USER → COMPLETE | 多次整改后完成 |
| **TC-24** | COMPLETE | 内容合规，直接发布 |
| **TC-25** | NEED_USER → COMPLETE | 提示修改后重试，最终完成 |

---

## 📝 总结

- `interact_content` 是 Agent 交互过程的完整记录，包含了问题、响应、决策、MCP 调用等所有关键信息
- 每条记录都有明确的测试案例标注，说明是哪个测试案例的数据
- 每个字段都有清晰的业务含义，理解这些字段可以帮助分析 Agent 的决策过程和执行结果
- 通过分析 `mcp_attempts` 可以看到 MCP 调用的完整过程，包括 Agent 的决策、工具的执行结果、成功/失败原因
- 不同的测试案例在 `interact_content` 中有不同的特征，可以通过关键字段快速判断是哪个测试案例

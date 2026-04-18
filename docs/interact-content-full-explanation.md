# agent_sub_tasks_step_history 表 interact_content 字段完整说明

---

## 📋 13个测试案例业务场景与 task_id 对应表

### 基础功能测试案例 (6个)

| 测试案例ID | 名称 | task_id (示例) | 业务场景描述 | 对应 capabilityType |
|-----------|------|----------------|-------------|-------------------|
| **TC-01A** | 初始不合规→整改→成功上传公众号 | `task-TC-01A-xxxxxx` | 初始内容违规（夸大宣传、绝对化用语）→ Agent 识别违规提示修改 → 用户整改后重新提交 → 合规审核通过 → 成功上传公众号 | `platform_publish` |
| **TC-01B** | 初始合规→直接上传公众号 | `task-TC-01B-xxxxxx` | 初始内容合规 → Agent 审核通过 → 直接上传公众号 | `platform_publish` |
| **TC-01C** | 合规审核-流程完整性 | `task-TC-01C-xxxxxx` | 提交内容审核 → Agent 执行完整审核流程 → 输出审核结果 | `platform_publish` |
| **TC-02** | 网页搜索带摘要 | `task-TC-02-xxxxxx` | 执行网页搜索 → 生成搜索摘要 | `search` |
| **TC-03** | 网页搜索（基础版） | `task-TC-03-xxxxxx` | 执行基础网页搜索 → 返回搜索结果（无摘要） | `search` |
| **TC-04** | 添加草稿 | `task-TC-04-xxxxxx` | 准备文章内容 → 调用微信公众号添加草稿 API | `platform_publish` |

### 复杂场景测试案例 (7个)

| 测试案例ID | 名称 | task_id (示例) | 业务场景描述 | 对应 capabilityType |
|-----------|------|----------------|-------------|-------------------|
| **TC-05** | MCP首次失败重试成功 | `task-TC-05-xxxxxx` | 第一次 MCP 调用失败 → Agent 自动重试 → 第二次调用成功 | `platform_publish` / `search` |
| **TC-06** | MCP多次失败最终失败 | `task-TC-06-xxxxxx` | 第一次 MCP 调用失败 → Agent 多次重试（达到最大重试次数）→ 最终放弃返回失败 | `platform_publish` / `search` |
| **TC-07** | 达到最大迭代次数 | `task-TC-07-xxxxxx` | Agent 执行多轮迭代 → 达到最大迭代次数限制 → 停止执行 | `platform_publish` / `search` |
| **TC-08** | 用户确认后继续执行 | `task-TC-08-xxxxxx` | Agent 执行需要用户确认的操作 → 暂停等待用户确认 → 用户确认后继续执行 | `platform_publish` / `search` |
| **TC-23** | 多次违规→多次整改→最终成功上传公众号 | `task-TC-23-xxxxxx` | 第1次内容违规 → Agent 提示修改 → 用户整改 → 第2次仍然违规 → Agent 再次提示 → 用户再次整改 → 第3次合规 → 成功上传公众号 | `platform_publish` |
| **TC-24** | 合规通过-正常发布流程 | `task-TC-24-xxxxxx` | 内容合规 → Agent 审核通过 → 直接执行公众号发布流程 → 成功上传公众号 | `platform_publish` |
| **TC-25** | 合规不通过-提示修改后重试 | `task-TC-25-xxxxxx` | 内容违规 → Agent 提示具体修改意见 → 用户根据提示修改 → 修改后合规 → 成功上传公众号 | `platform_publish` |

---

## 📊 数据来源

- **command_result_id**: `7b005762-6480-4e39-8678-73d6b1233d2d`
- **时间**: 2026-03-06
- **交互 Agent**: `insurance-d` ↔ `agent B`

---

## 🎯 先看完整的 interact_content 内容

### 第 1 条记录：insurance-d → agent B (request)

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

**元数据**:
- `step_no`: 1
- `interact_num`: 1
- `interact_type`: "response"
- `interact_user`: "agent B"
- `interact_time`: "2026-03-06T12:47:54.530Z"

**interact_content 完整内容**:
```json
{
  "ext_info": {
    "step": "agent_b_decision_need_user",
    "iteration": 1,
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

**元数据**:
- `step_no`: 2
- `interact_num`: 1
- `interact_type`: "request"
- `interact_user`: "insurance-d"
- `interact_time`: "2026-03-06T12:47:57.626Z"

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

### 第 4 条记录：agent B → insurance-d (response) - FAILED + MCP 调用

**元数据**:
- `step_no`: 2
- `interact_num`: 4
- `interact_type`: "response"
- `interact_user`: "agent B"
- `interact_time`: "2026-03-06T12:49:36.628Z"

**interact_content 完整内容（关键！）**:
```json
{
  "ext_info": {
    "step": "agent_b_decision_failed",
    "iteration": 4,
    "failed_reason": "UNKNOWN_ERROR",
    "failed_details": {
      "errorType": "PARSE_ERROR",
      "recoverable": false,
      "errorMessage": "SyntaxError: Bad control character in string literal in JSON at position 3848"
    }
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
      "type": "FAILED",
      "reasoning": "决策解析失败: Bad control character in string literal in JSON at position 3848",
      "reason_code": "UNKNOWN_ERROR",
      "final_conclusion": "Agent B输出解析失败"
    },
    "mcp_attempts": [
      {
        "params": {
          "accountId": "insurance-account"
        },
        "result": {
          "data": {
            "data": {
              "data": [
                {
                  "id": "insurance-account",
                  "name": "保险科普公众号",
                  "agent": "insurance-d",
                  "appId": "wxdb3ea2f8e0bb2496",
                  "enabled": true,
                  "appSecret": "***",
                  "createdAt": 1772801064387,
                  "updatedAt": 1772801064387,
                  "description": "insurance-d 对应的保险科普公众号",
                  "defaultAuthor": "保险科普",
                  "defaultAuthorId": 1
                },
                {
                  "id": "ai-tech-account",
                  "name": "AI技术公众号",
                  "agent": "agent-d",
                  "appId": "wxf102f76f4a6e56b0",
                  "enabled": true,
                  "appSecret": "***",
                  "createdAt": 1772801064387,
                  "updatedAt": 1772801064387,
                  "description": "Agent D 对应的 AI 技术公众号",
                  "defaultAuthor": "AI技术",
                  "defaultAuthorId": 2
                }
              ],
              "success": true,
              "metadata": {
                "timestamp": 1772801284305
              }
            },
            "success": true,
            "metadata": {
              "tool": "wechat",
              "action": "getAccounts",
              "timestamp": 1772801284305
            }
          },
          "status": "success",
          "executionTime": 2
        },
        "decision": {
          "strategy": "initial",
          "toolName": "wechat",
          "reasoning": "当前任务为合规审核测试-合规直接发布，需要微信公众号相关操作能力，建议方案为platform_publish，首先需要获取微信公众号账号列表来确定操作的账号，因此选择执行微信公众号-获取账号列表的MCP能力。",
          "actionName": "get_accounts",
          "solutionNum": 15
        },
        "attemptId": "mcp-1772801284303-1",
        "timestamp": "2026-03-06T12:48:04.305Z",
        "attemptNumber": 1
      },
      {
        "params": {
          "accountId": "insurance-account"
        },
        "result": {
          "data": {
            "data": {
              "error": "缺少 articles 参数或格式错误",
              "success": false,
              "metadata": {
                "timestamp": 1772801291387
              }
            },
            "success": true,
            "metadata": {
              "tool": "wechat",
              "action": "addDraft",
              "timestamp": 1772801291388
            }
          },
          "status": "success",
          "executionTime": 6
        },
        "decision": {
          "strategy": "initial",
          "toolName": "wechat",
          "reasoning": "当前任务为合规审核测试-合规直接发布，已成功执行微信公众号获取账号列表操作，接下来需要进行添加草稿的操作以推进发布流程，对应MCP能力为微信公众号-添加草稿。",
          "actionName": "add_draft",
          "solutionNum": 11
        },
        "attemptId": "mcp-1772801291382-1",
        "timestamp": "2026-03-06T12:48:11.389Z",
        "attemptNumber": 1
      },
      {
        "params": {
          "accountId": "insurance-account"
        },
        "result": {
          "data": {
            "data": {
              "error": "获取草稿列表失败: 获取 Access Token 失败: ... invalid ip ...",
              "success": false,
              "metadata": {
                "timestamp": 1772801299000
              }
            },
            "success": true,
            "metadata": {
              "tool": "wechat",
              "action": "getDraftList",
              "timestamp": 1772801299001
            }
          },
          "status": "success",
          "executionTime": 228
        },
        "decision": {
          "strategy": "initial",
          "toolName": "wechat",
          "reasoning": "当前任务为合规审核测试-合规直接发布，已成功执行获取微信公众号账号列表、添加草稿的操作，接下来需要将草稿发布，结合可用MCP能力，应先获取草稿列表确认已添加的草稿，为后续发布做准备。",
          "actionName": "get_draft_list",
          "solutionNum": 12
        },
        "attemptId": "mcp-1772801298773-1",
        "timestamp": "2026-03-06T12:48:19.001Z",
        "attemptNumber": 1
      }
    ],
    "failed_details": {
      "errorType": "PARSE_ERROR",
      "recoverable": false,
      "errorMessage": "SyntaxError: Bad control character in string literal in JSON at position 3848"
    },
    "user_interactions": [],
    "available_solutions": []
  },
  "responder": "agent B",
  "consultant": "insurance-d",
  "interact_type": "response",
  "execution_result": {
    "status": "failed"
  }
}
```

---

### 第 5 条记录：insurance-d → agent B (request)

**元数据**:
- `step_no`: 3
- `interact_num`: 1
- `interact_type`: "request"
- `interact_user": "insurance-d"
- `interact_time": "2026-03-06T12:49:40.320Z"

**interact_content 完整内容**:
```json
{
  "ext_info": {
    "step": "phase_1_executor_analysis"
  },
  "question": {
    "problem": "无法判定能力边界，需要MCP介入",
    "isNeedMcp": true,
    "isTaskDown": false,
    "capabilityType": "search"
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

## 📖 每个 Key 与 Value 的业务含义详解

---

### 1. 顶层字段（所有记录都有）

#### `ext_info` - 扩展信息
**业务含义**: 记录当前步骤的元数据和上下文信息

| 子字段 | 值示例 | 业务含义 |
|--------|---------|---------|
| `step` | `"phase_1_executor_analysis"` | 当前处于第1阶段：执行器分析 |
| `step` | `"agent_b_decision_need_user"` | agent B 做出了 NEED_USER 决策 |
| `step` | `"agent_b_decision_failed"` | agent B 做出了 FAILED 决策 |
| `iteration` | `1` | 第几次迭代 |
| `pending_key_fields` | `[...]` | 需要用户填写的字段列表 |
| `available_solutions` | `[...]` | 可用的解决方案列表 |
| `failed_reason` | `"UNKNOWN_ERROR"` | 失败原因分类 |
| `failed_details` | `{...}` | 失败详细信息 |

**业务场景对应**:
- `phase_1_executor_analysis`: 任务开始，分析阶段
- `agent_b_decision_need_user`: 需要用户介入
- `agent_b_decision_failed`: 任务失败

---

#### `question` - 问题/请求内容
**业务含义**: 记录用户或 Agent 的问题、请求、任务描述

| 子字段 | 值示例 | 业务含义 |
|--------|---------|---------|
| `problem` | `"需要微信公众号相关的操作能力"` | 任务的问题描述 |
| `problem` | `"无法判定能力边界，需要MCP介入"` | 任务的问题描述 |
| `isNeedMcp` | `true` | 是否需要调用 MCP 能力 |
| `isTaskDown` | `false` | 任务是否已结束 |
| `capabilityType` | `"platform_publish"` | 需要的能力类型：平台发布 |
| `capabilityType` | `"search"` | 需要的能力类型：搜索 |
| `executionResult` | `null` | 执行结果（request 时为空） |

**业务场景对应**:
- `platform_publish`: 公众号发布任务（对应 TC-01A/01B/04/23/24/25）
- `search`: 搜索任务（对应 TC-02/03/05/06/07/08）

---

#### `response` - 响应内容
**业务含义**: Agent B 的完整回应（仅 response 类型记录有值）

**子字段详见下文 `response` 详细说明**

---

#### `responder` - 回应者
**业务含义**: 是谁给出的回应

| 值 | 业务含义 |
|----|---------|
| `"agent B"` | 回应者是 agent B |

**业务场景对应**: 所有 response 记录都是 agent B 给出的回应

---

#### `consultant` - 顾问
**业务含义**: 相关的顾问/Agent

| 值 | 业务含义 |
|----|---------|
| `"insurance-d"` | 顾问是 insurance-d |

**业务场景对应**: insurance-d 是任务的发起方

---

#### `interact_type` - 交互类型
**业务含义**: 这条记录是请求还是响应

| 值 | 业务含义 |
|----|---------|
| `"request"` | 请求记录（insurance-d → agent B） |
| `"response"` | 响应记录（agent B → insurance-d） |

**业务场景对应**:
- `request`: insurance-d 发起任务、提交选择
- `response`: agent B 返回决策、执行结果

---

#### `execution_result` - 执行结果
**业务含义**: 本次交互的执行状态

| 子字段 | 值示例 | 业务含义 |
|--------|---------|---------|
| `status` | `"waiting"` | 等待处理（request 记录） |
| `status` | `"waiting_user"` | 等待用户处理（NEED_USER） |
| `status` | `"failed"` | 执行失败（FAILED） |

**业务场景对应**:
- `waiting`: 请求刚发出，等待 agent B 处理
- `waiting_user`: agent B 需要用户确认
- `failed`: 任务执行失败

---

## 📦 `response` 字段详细说明（仅 response 记录有）

---

### `response.decision` - 决策数据（核心！）
**业务含义**: agent B 的最终决策

| 子字段 | 值示例 | 业务含义 |
|--------|---------|---------|
| `type` | `"NEED_USER"` | 需要用户介入/确认 |
| `type` | `"COMPLETE"` | 任务完成，成功 |
| `type` | `"FAILED"` | 任务失败，放弃 |
| `reasoning` | `"当前任务为合规审核测试..."` | Agent 的推理过程（自然语言） |
| `reason_code` | `"USER_SELECT"` | 原因代码：需要用户选择 |
| `reason_code` | `"UNKNOWN_ERROR"` | 原因代码：未知错误 |
| `final_conclusion` | `"等待用户处理"` | 最终结论 |
| `final_conclusion` | `"Agent B输出解析失败"` | 最终结论 |

**决策类型详解**:

#### 1. `decision.type = "NEED_USER"`
**业务含义**: agent B 无法自己决定，需要用户介入
- **对应测试案例**: TC-01A, TC-08, TC-23, TC-25
- **场景**:
  - 有多个能力可选，需要用户选择
  - 需要用户确认操作
  - 需要用户补充信息

#### 2. `decision.type = "COMPLETE"`
**业务含义**: 任务成功完成
- **对应测试案例**: TC-01B, TC-02, TC-03, TC-04, TC-05, TC-24
- **场景**:
  - 搜索成功完成
  - 公众号草稿添加成功
  - 重试成功

#### 3. `decision.type = "FAILED"`
**业务含义**: 任务失败，放弃
- **对应测试案例**: TC-06
- **场景**:
  - 达到最大重试次数
  - 解析错误
  - 不可恢复错误

---

### `response.mcp_attempts` - MCP 调用记录（核心！）
**业务含义**: 所有 MCP 工具调用尝试的完整记录

**单条 mcp_attempt 结构**:

| 字段 | 值示例 | 业务含义 |
|------|---------|---------|
| `attemptNumber` | `1` | 第几次尝试（从1开始） |
| `attemptId` | `"mcp-1772801284303-1"` | 尝试的唯一 ID |
| `timestamp` | `"2026-03-06T12:48:04.305Z"` | 调用时间戳 |
| `params` | `{ "accountId": "insurance-account" }` | 调用时传入的参数 |
| `decision` | `{...}` | 本次调用的决策（为什么调用这个工具） |
| `result` | `{...}` | 工具返回的结果 |

---

#### `mcp_attempts[].decision` - 单次调用的决策
**业务含义**: 为什么选择调用这个工具

| 子字段 | 值示例 | 业务含义 |
|--------|---------|---------|
| `strategy` | `"initial"` | 策略：初始调用 |
| `strategy` | `"retry"` | 策略：重试调用 |
| `toolName` | `"wechat"` | 工具名称：微信公众号 |
| `toolName` | `"search"` | 工具名称：搜索 |
| `actionName` | `"get_accounts"` | 动作名称：获取账号列表 |
| `actionName` | `"add_draft"` | 动作名称：添加草稿 |
| `actionName` | `"get_draft_list"` | 动作名称：获取草稿列表 |
| `actionName` | `"webSearch"` | 动作名称：网页搜索 |
| `actionName` | `"webSearchWithSummary"` | 动作名称：网页搜索带摘要 |
| `reasoning` | `"当前任务为合规审核测试..."` | 推理过程（为什么调用这个工具） |
| `solutionNum` | `15` | 对应第几个解决方案 |

---

#### `mcp_attempts[].result` - 工具调用结果
**业务含义**: 工具返回的结果数据

| 子字段 | 值示例 | 业务含义 |
|--------|---------|---------|
| `status` | `"success"` | 调用是否成功（工具调用本身） |
| `executionTime` | `2` | 执行耗时（毫秒） |
| `executionTime` | `228` | 执行耗时（毫秒） |
| `data` | `{...}` | 业务数据 |

**`result.data` 业务数据**:

| 子字段 | 值示例 | 业务含义 |
|--------|---------|---------|
| `success` | `true` | **业务是否成功**（关键！） |
| `success` | `false` | **业务是否成功**（关键！） |
| `error` | `"缺少 articles 参数或格式错误"` | 业务失败时的错误信息 |
| `error` | `"获取草稿列表失败: ... invalid ip ..."` | 业务失败时的错误信息 |
| `data` | `[{ "id": "insurance-account", ... }]` | 业务成功时的返回数据 |
| `metadata` | `{ "timestamp": 1772801284305 }` | 元数据（时间戳等） |

**关键点区分**:
- `result.status = "success"`: 工具调用**本身**成功（网络通、API 可达）
- `result.data.success = true/false`: **业务**是否成功（参数对不对、IP 在不在白名单等）

**示例 1 - 业务成功**:
```json
{
  "status": "success",
  "executionTime": 2,
  "data": {
    "data": { "id": "insurance-account", "name": "保险科普公众号" },
    "success": true,
    "metadata": { "timestamp": 1772801284305 }
  }
}
```
**业务含义**: 获取账号列表成功

**示例 2 - 业务失败**:
```json
{
  "status": "success",
  "executionTime": 6,
  "data": {
    "data": {
      "error": "缺少 articles 参数或格式错误",
      "success": false
    },
    "success": true,
    "metadata": { "timestamp": 1772801291387 }
  }
}
```
**业务含义**: 工具调用成功，但业务失败（缺少参数）

---

### `response.prompt_message` - 提示消息
**业务含义**: 给用户的提示信息（NEED_USER 时用）

| 子字段 | 值示例 | 业务含义 |
|--------|---------|---------|
| `title` | `"请选择微信公众号操作能力"` | 提示标题 |
| `priority` | `"medium"` | 优先级 |
| `description` | `"当前任务为合规审核测试..."` | 提示描述 |

---

### `response.user_interactions` - 用户交互记录
**业务含义**: 与用户的交互历史记录

| 值 | 业务含义 |
|----|---------|
| `[]` | 暂无用户交互 |

---

### `response.pending_key_fields` - 待处理关键字段
**业务含义**: 需要用户填写/选择的字段

**单条字段结构**:

| 子字段 | 值示例 | 业务含义 |
|--------|---------|---------|
| `fieldId` | `"selectedMcpCapability"` | 字段 ID |
| `fieldName` | `"选择微信公众号操作能力"` | 字段名称 |
| `fieldType` | `"select"` | 字段类型：选择框 |
| `description` | `"请选择需要执行的微信公众号相关操作能力..."` | 字段描述 |
| `currentValue` | `""` | 当前值（空表示未选择） |
| `validationRules.required` | `true` | 是否必填 |

---

### `response.available_solutions` - 可用解决方案
**业务含义**: agent B 建议的解决方案列表

**单条方案结构**:

| 子字段 | 值示例 | 业务含义 |
|--------|---------|---------|
| `solutionId` | `"15"` | 方案 ID |
| `label` | `"微信公众号-获取账号列表"` | 方案名称 |
| `description` | `"获取微信公众号的账号列表"` | 方案描述 |
| `pros` | `["可获取账号基础信息..."]` | 方案优点 |
| `cons` | `["仅能获取账号列表..."]` | 方案缺点 |

---

### `response.failed_details` - 失败详情
**业务含义**: 任务失败时的详细信息

| 子字段 | 值示例 | 业务含义 |
|--------|---------|---------|
| `errorType` | `"PARSE_ERROR"` | 错误类型：解析错误 |
| `recoverable` | `false` | 是否可恢复 |
| `errorMessage` | `"SyntaxError: Bad control character..."` | 错误信息 |

---

## 🎭 Agent 与 Agent 的完整交互过程

---

### 第 1 轮交互：任务开始 - insurance-d → agent B

**时间**: 12:47:33

#### insurance-d（请求方）说:
> "我需要微信公众号相关的操作能力，这是 platform_publish 类型的任务，需要 MCP 介入。"

**interact_content 记录**:
```json
{
  "question": {
    "problem": "需要微信公众号相关的操作能力",
    "isNeedMcp": true,
    "capabilityType": "platform_publish"
  },
  "execution_result": { "status": "waiting" }
}
```

---

### 第 2 轮交互：agent B 回应 - agent B → insurance-d

**时间**: 12:47:54

#### agent B（执行方）说:
> "我理解了，这是合规审核测试-违规识别并整改任务。但是我发现有多个微信公众号操作能力可选，我不知道该用哪个。让我给你 5 个选项：

> 1. **获取账号列表** - 可以获取账号基础信息，但无法直接识别违规内容
> 2. **获取草稿列表** - 可以查看待发布的草稿，但无法直接整改
> 3. **删除草稿** - 可以删除违规草稿，但需要先确定是哪个
> 4. **上传图片素材** - 可以替换违规图片，但无法直接识别
> 5. **添加草稿** - 可以重新编辑合规草稿，但需要先完成内容编辑

> 请你选择一个具体的操作能力，我才能继续推进任务。"

**interact_content 记录**:
```json
{
  "response": {
    "decision": {
      "type": "NEED_USER",
      "reasoning": "当前任务为合规审核测试-违规识别并整改，需要微信公众号相关操作能力，但现有多个platform_publish类型的微信公众号操作能力，无法确定具体需要执行哪一项操作，需用户选择具体的操作能力。",
      "reason_code": "USER_SELECT",
      "final_conclusion": "等待用户处理"
    },
    "prompt_message": {
      "title": "请选择微信公众号操作能力",
      "description": "当前任务为合规审核测试-违规识别并整改，需要执行微信公众号相关操作，但存在多个可选能力，请您选择具体需要执行的操作能力，以便推进任务。"
    },
    "available_solutions": [
      {
        "solutionId": "15",
        "label": "微信公众号-获取账号列表",
        "pros": ["可获取账号基础信息，为后续违规识别提供账号范围"],
        "cons": ["仅能获取账号列表，无法直接进行违规内容的识别与整改"]
      },
      "... 其他 4 个方案 ..."
    ]
  },
  "execution_result": { "status": "waiting_user" }
}
```

---

### 第 3 轮交互：insurance-d 再次请求 - insurance-d → agent B

**时间**: 12:47:57

#### insurance-d（请求方）说:
> "还是需要微信公众号相关的操作能力，继续处理。"

**interact_content 记录**（与第 1 轮类似）

---

### 第 4 轮交互：agent B 执行 MCP 但失败 - agent B → insurance-d

**时间**: 12:49:36

#### agent B（执行方）说:
> "好的，我尝试执行了！虽然最后解析失败了，但我先执行了 3 次 MCP 调用：

> **第 1 次调用** (12:48:04):
> - 工具: `wechat.get_accounts`
> - 参数: accountId = 'insurance-account'
> - 结果: ✅ **成功**！获取到了 2 个账号：
>   1. 保险科普公众号 (insurance-d)
>   2. AI技术公众号 (agent-d)

> **第 2 次调用** (12:48:11):
> - 工具: `wechat.add_draft`
> - 参数: accountId = 'insurance-account'
> - 结果: ⚠️ **业务失败**！错误：'缺少 articles 参数或格式错误'

> **第 3 次调用** (12:48:19):
> - 工具: `wechat.get_draft_list`
> - 参数: accountId = 'insurance-account'
> - 结果: ❌ **业务失败**！错误：'获取草稿列表失败: ... invalid ip ...'

> 但是最后我的输出解析失败了，任务失败。"

**interact_content 记录**（关键！）:
```json
{
  "ext_info": {
    "step": "agent_b_decision_failed",
    "failed_reason": "UNKNOWN_ERROR",
    "failed_details": {
      "errorType": "PARSE_ERROR",
      "errorMessage": "SyntaxError: Bad control character in JSON at position 3848"
    }
  },
  "response": {
    "decision": {
      "type": "FAILED",
      "reasoning": "决策解析失败: Bad control character in string literal in JSON at position 3848",
      "reason_code": "UNKNOWN_ERROR",
      "final_conclusion": "Agent B输出解析失败"
    },
    "mcp_attempts": [
      {
        "attemptNumber": 1,
        "decision": {
          "toolName": "wechat",
          "actionName": "get_accounts",
          "reasoning": "当前任务为合规审核测试-合规直接发布，需要微信公众号相关操作能力...首先需要获取微信公众号账号列表..."
        },
        "result": {
          "status": "success",
          "data": {
            "success": true,
            "data": [
              { "id": "insurance-account", "name": "保险科普公众号" },
              { "id": "ai-tech-account", "name": "AI技术公众号" }
            ]
          }
        }
      },
      {
        "attemptNumber": 2,
        "decision": {
          "toolName": "wechat",
          "actionName": "add_draft",
          "reasoning": "已成功执行获取账号列表，接下来需要添加草稿..."
        },
        "result": {
          "status": "success",
          "data": {
            "success": false,
            "error": "缺少 articles 参数或格式错误"
          }
        }
      },
      {
        "attemptNumber": 3,
        "decision": {
          "toolName": "wechat",
          "actionName": "get_draft_list",
          "reasoning": "已成功执行获取账号列表、添加草稿，接下来需要获取草稿列表..."
        },
        "result": {
          "status": "success",
          "data": {
            "success": false,
            "error": "获取草稿列表失败: ... invalid ip ..."
          }
        }
      }
    ],
    "failed_details": {
      "errorType": "PARSE_ERROR",
      "errorMessage": "SyntaxError: Bad control character in JSON at position 3848"
    }
  },
  "execution_result": { "status": "failed" }
}
```

---

### 第 5 轮交互：切换任务类型 - insurance-d → agent B

**时间**: 12:49:40

#### insurance-d（请求方）说:
> "好吧，公众号任务先放一放。现在我无法判定能力边界，需要搜索类型的 MCP 介入。"

**interact_content 记录**:
```json
{
  "question": {
    "problem": "无法判定能力边界，需要MCP介入",
    "isNeedMcp": true,
    "capabilityType": "search"
  }
}
```

---

## 📊 总结

### 13个测试案例与 interact_content 字段完整对应表

| 测试案例ID | task_id (示例) | 业务场景 | 关键字段 | interact_content 特征 |
|-----------|----------------|---------|---------|---------------------|
| **TC-01A** | `task-TC-01A-xxxxxx` | 初始不合规→整改→成功上传公众号 | `question.problem` = "需要微信公众号相关的操作能力"<br>`question.capabilityType` = "platform_publish"<br>`response.decision.type` = "NEED_USER" 然后 "COMPLETE"<br>`response.mcp_attempts` 有多次调用<br>`response.prompt_message` 有提示<br>`response.available_solutions` 有方案 | - 有多次 request/response 成对<br>- 前几次 decision 包含违规说明<br>- 最后 decision = COMPLETE<br>- 有用户整改交互记录<br>- 有公众号上传 mcp_attempts |
| **TC-01B** | `task-TC-01B-xxxxxx` | 初始合规→直接上传公众号 | `question.problem` = "需要微信公众号相关的操作能力"<br>`question.capabilityType` = "platform_publish"<br>`response.decision.type` = "COMPLETE"<br>`response.mcp_attempts` 有公众号调用 | - 有 request/response 成对<br>- 合规审核 decision = COMPLETE<br>- 有公众号上传 mcp_attempts<br>- mcp_attempts 业务成功 |
| **TC-01C** | `task-TC-01C-xxxxxx` | 合规审核-流程完整性 | `question.problem` = "需要微信公众号相关的操作能力"<br>`question.capabilityType` = "platform_publish"<br>`response.decision.type` = "COMPLETE" | - 有完整的 request/response 交互<br>- 有合规审核 decision<br>- 有 execution_summary |
| **TC-02** | `task-TC-02-xxxxxx` | 网页搜索带摘要 | `question.problem` = "无法判定能力边界，需要MCP介入"<br>`question.capabilityType` = "search"<br>`response.decision.type` = "COMPLETE"<br>`response.mcp_attempts` 有 search 调用<br>`mcp_attempts[].decision.actionName` = "webSearchWithSummary" | - 有 search 类型的 mcp_attempts<br>- decision 包含搜索相关 reasoning<br>- result 包含搜索结果和摘要 |
| **TC-03** | `task-TC-03-xxxxxx` | 网页搜索（基础版） | `question.problem` = "无法判定能力边界，需要MCP介入"<br>`question.capabilityType` = "search"<br>`response.decision.type` = "COMPLETE"<br>`response.mcp_attempts` 有 search 调用<br>`mcp_attempts[].decision.actionName` = "webSearch" | - 有 search 类型的 mcp_attempts<br>- result 包含搜索结果（无摘要） |
| **TC-04** | `task-TC-04-xxxxxx` | 添加草稿 | `question.problem` = "需要微信公众号相关的操作能力"<br>`question.capabilityType` = "platform_publish"<br>`response.decision.type` = "COMPLETE"<br>`response.mcp_attempts` 有 wechat 调用<br>`mcp_attempts[].decision.actionName` = "add_draft" | - 有 wechat.add_draft 的 mcp_attempts<br>- decision 包含公众号发布相关 reasoning<br>- result 包含草稿添加结果 |
| **TC-05** | `task-TC-05-xxxxxx` | MCP首次失败重试成功 | `question.problem` = "需要微信公众号相关的操作能力"<br>`question.capabilityType` = "platform_publish"<br>`response.decision.type` = "COMPLETE"<br>`response.mcp_attempts` 有 2+ 条记录<br>`mcp_attempts[0].result.data.success` = false<br>`mcp_attempts[-1].result.data.success` = true<br>`mcp_attempts[].decision.strategy` = "initial" 然后 "retry" | - mcp_attempts 数组有 2+ 条记录<br>- 第一条: businessSuccess = false, hasError = true<br>- 最后一条: businessSuccess = true<br>- 有 attemptNumber 编号 |
| **TC-06** | `task-TC-06-xxxxxx` | MCP多次失败最终失败 | `question.problem` = "需要微信公众号相关的操作能力"<br>`question.capabilityType` = "platform_publish"<br>`response.decision.type` = "FAILED"<br>`response.mcp_attempts` 有 N 条记录<br>`mcp_attempts[*].result.data.success` = false<br>`response.failed_details` 有失败详情 | - mcp_attempts 数组有 N 条记录（N = 最大重试次数）<br>- 所有记录: businessSuccess = false<br>- decision.type = FAILED<br>- 有 execution_summary 说明失败原因<br>- 有 failed_details |
| **TC-07** | `task-TC-07-xxxxxx` | 达到最大迭代次数 | `question.problem` = "需要微信公众号相关的操作能力"<br>`question.capabilityType` = "platform_publish"<br>`response.decision.type` = "FAILED" 或 "COMPLETE"<br>`ext_info.iteration` 有多次迭代 | - 有多轮 step/interact 记录<br>- 最后 decision 包含迭代终止原因<br>- execution_summary 说明达到最大迭代<br>- ext_info.iteration 显示迭代次数 |
| **TC-08** | `task-TC-08-xxxxxx` | 用户确认后继续执行 | `question.problem` = "需要微信公众号相关的操作能力"<br>`question.capabilityType` = "platform_publish"<br>`response.decision.type` = "NEED_USER" 然后 "COMPLETE"<br>`response.prompt_message` 有提示<br>`response.pending_key_fields` 有字段<br>`response.available_solutions` 有方案 | - decision.type = NEED_USER<br>- 有用户交互记录 (interact_user = 用户)<br>- 确认后继续执行的记录<br>- 有 pending_key_fields<br>- 有 available_solutions |
| **TC-23** | `task-TC-23-xxxxxx` | 多次违规→多次整改→最终成功上传公众号 | `question.problem` = "需要微信公众号相关的操作能力"<br>`question.capabilityType` = "platform_publish"<br>`response.decision.type` = "NEED_USER" × N 然后 "COMPLETE"<br>`response.mcp_attempts` 有多次调用<br>`response.prompt_message` 有多次提示<br>`response.available_solutions` 有多次方案 | - 有多轮 request/response 成对（至少3轮交互）<br>- 有多次合规审核 decision<br>- 前几次 decision 包含违规说明<br>- 最后一次 decision = COMPLETE<br>- 有用户整改交互记录<br>- 有公众号上传 mcp_attempts<br>- 有完整的 execution_summary |
| **TC-24** | `task-TC-24-xxxxxx` | 合规通过-正常发布流程 | `question.problem` = "需要微信公众号相关的操作能力"<br>`question.capabilityType` = "platform_publish"<br>`response.decision.type` = "COMPLETE"<br>`response.mcp_attempts` 有公众号调用<br>`mcp_attempts[].result.data.success` = true | - 有 request/response 成对<br>- 合规审核 decision = COMPLETE<br>- 有公众号发布相关 mcp_attempts<br>- mcp_attempts 业务成功<br>- 有 execution_summary 说明发布成功 |
| **TC-25** | `task-TC-25-xxxxxx` | 合规不通过-提示修改后重试 | `question.problem` = "需要微信公众号相关的操作能力"<br>`question.capabilityType` = "platform_publish"<br>`response.decision.type` = "NEED_USER" 然后 "COMPLETE"<br>`response.mcp_attempts` 有调用<br>`response.prompt_message` 有提示<br>`response.available_solutions` 有方案 | - 有2轮以上 request/response 成对<br>- 第一次 decision 包含违规说明和修改建议<br>- 有用户修改交互记录<br>- 第二次 decision = COMPLETE<br>- 有公众号上传 mcp_attempts<br>- 有 execution_summary |

### interact_content 关键字段业务价值

| 字段 | 业务价值 | 对应测试案例 |
|------|---------|-------------|
| `question.problem` | 记录任务问题描述 | 全部13个 |
| `question.capabilityType` | 标识任务类型 | 全部13个 |
| `response.decision.type` | 标识任务状态 | 全部13个 |
| `response.decision.reasoning` | 记录 Agent 推理过程 | 全部13个 |
| `response.mcp_attempts` | 记录每次 MCP 调用 | TC-02/03/04/05/06/23/24/25 |
| `mcp_attempts[].result.data.success` | 区分业务成功/失败 | TC-05/06 |
| `mcp_attempts[].result.data.error` | 记录业务失败原因 | TC-05/06 |
| `response.prompt_message` | 给用户提示 | TC-01A/08/23/25 |
| `response.available_solutions` | 提供可选方案 | TC-01A/08/23/25 |
| `response.failed_details` | 记录失败详情 | TC-06 |

### Agent 交互流程总结

1. **insurance-d 发起任务** → `interact_type = "request"`
2. **agent B 分析并决策** → `interact_type = "response"`
   - `NEED_USER`: 需要用户选择/确认
   - `COMPLETE`: 任务成功完成
   - `FAILED`: 任务失败
3. **agent B 执行 MCP**（如需要）→ `mcp_attempts` 记录每次调用
4. **insurance-d 继续/切换任务** → 下一轮 `request`

---

**文档生成时间**: 2026-03-06
**数据完整性**: ✅ 完整
**业务场景覆盖**: ⭐⭐⭐⭐⭐

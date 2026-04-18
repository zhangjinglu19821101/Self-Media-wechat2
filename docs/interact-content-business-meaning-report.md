# 13个测试案例 interact_content 字段存储结构与业务含义关联汇报

---

## 📋 概述

本文档详细说明 `agent_sub_tasks_step_history` 表中 `interact_content` 字段的存储结构，以及如何与13个测试案例的业务场景关联起来。

---

## 🏗️ interact_content 整体数据结构

### 顶层字段

`interact_content` 是一个 JSON 对象，包含以下关键字段：

| 字段名 | 类型 | 说明 | 业务含义 |
|--------|------|------|---------|
| `question` | object | 问题/请求内容 | 用户或 Agent 的提问/请求 |
| `response` | object | 响应内容 | Agent 的回应（仅 response 类型记录有） |
| `ext_info` | object | 扩展信息 | 额外的元数据和上下文 |
| `execution_result` | object | 执行结果 | 执行状态和结果 |
| `interact_type` | string | 交互类型 | 标识这是什么类型的交互 |
| `responder` | string | 回应者 | 谁给出的回应 |
| `consultant` | string | 顾问 | 相关的顾问/Agent |

---

## 📦 interact_content.response 详细结构

当 `interact_type = 'response'` 时，`response` 字段包含 Agent 的完整回应数据：

| 字段名 | 类型 | 说明 | 业务含义 |
|--------|------|------|---------|
| `decision` | object | **决策数据** | Agent 的最终决策（核心字段） |
| `mcp_attempts` | array | **MCP 调用记录** | 所有 MCP 工具调用尝试 |
| `execution_summary` | object | 执行摘要 | 本次执行的总结信息 |
| `user_interactions` | array | 用户交互记录 | 与用户的交互历史 |
| `prompt_message` | string | 提示消息 | 给用户的提示信息 |
| `available_solutions` | array | 可用方案 | Agent 建议的解决方案 |
| `pending_key_fields` | object | 待处理关键字段 | 需要用户补充的信息 |
| `failed_details` | object | 失败详情 | 失败时的详细信息 |

---

## 🎯 decision 字段（决策核心）

`decision` 是最重要的字段，记录 Agent 的最终决策：

| 字段名 | 类型 | 说明 | 业务含义 |
|--------|------|------|---------|
| `type` | string | 决策类型 | `COMPLETE` / `FAILED` / `NEED_USER` |
| `reasoning` | string | 推理过程 | Agent 为什么做出这个决策 |
| `reason_code` | string | 原因代码 | 分类的原因标识 |
| `final_conclusion` | string | 最终结论 | 最终的总结性结论 |

### decision.type 三种取值及业务场景

| 取值 | 业务含义 | 对应测试案例 |
|------|---------|-------------|
| `COMPLETE` | 任务完成，成功 | TC-01B, TC-02, TC-03, TC-04, TC-24 |
| `FAILED` | 任务失败，放弃 | TC-06 |
| `NEED_USER` | 需要用户介入/确认 | TC-01A, TC-08, TC-23, TC-25 |

---

## 🔧 mcp_attempts 字段（MCP 调用记录）

`mcp_attempts` 是一个数组，记录每次 MCP 工具调用：

### 单条 mcp_attempt 结构

| 字段名 | 类型 | 说明 | 业务含义 |
|--------|------|------|---------|
| `attemptNumber` | number | 尝试编号 | 第几次尝试（从1开始） |
| `decision` | object | 本次调用决策 | 为什么调用这个工具 |
| `result` | object | 调用结果 | 工具返回的结果 |
| `params` | object | 调用参数 | 传给工具的参数 |
| `attemptId` | string | 尝试ID | 唯一标识 |
| `timestamp` | string | 时间戳 | 调用时间 |

### mcp_attempt.decision 结构

| 字段名 | 类型 | 说明 | 业务含义 |
|--------|------|------|---------|
| `toolName` | string | 工具名称 | `wechat` / `search` 等 |
| `actionName` | string | 动作名称 | `get_accounts` / `add_draft` / `webSearch` 等 |
| `reasoning` | string | 推理过程 | 为什么选择调用这个工具 |
| `strategy` | string | 策略 | `initial` / `retry` 等 |
| `solutionNum` | number | 方案编号 | 对应第几个方案 |

### mcp_attempt.result 结构

| 字段名 | 类型 | 说明 | 业务含义 |
|--------|------|------|---------|
| `data` | object | 业务数据 | 工具返回的实际业务数据 |
| `data.success` | boolean | 业务是否成功 | 业务操作是否成功 |
| `data.error` | string | 错误信息 | 失败时的错误描述 |
| `data.data` | any | 业务结果数据 | 成功时的返回数据 |
| `success` | boolean | 调用是否成功 | 工具调用本身是否成功 |
| `metadata` | object | 元数据 | 工具信息、时间戳等 |

---

## 📊 13个测试案例与 interact_content 存储结构关联

---

### 基础功能 (6个)

#### TC-01A: 初始不合规→整改→成功上传公众号

**业务场景**:
1. 用户提交违规内容
2. Agent 识别违规，`decision.type = NEED_USER`，提示修改
3. 用户整改后重新提交
4. Agent 审核通过，`decision.type = COMPLETE`
5. 调用公众号 MCP，`mcp_attempts` 记录上传过程

**interact_content 存储**:
- 第1轮 response:
  ```json
  {
    "response": {
      "decision": {
        "type": "NEED_USER",
        "reasoning": "内容包含违规表述，需要修改...",
        "reason_code": "CONTENT_VIOLATION"
      },
      "prompt_message": "请修改以下违规内容...",
      "user_interactions": [...]
    }
  }
  ```

- 第2轮 response (用户整改后):
  ```json
  {
    "response": {
      "decision": {
        "type": "COMPLETE",
        "reasoning": "内容已合规，准备上传公众号...",
        "final_conclusion": "审核通过，已上传公众号"
      },
      "mcp_attempts": [
        {
          "attemptNumber": 1,
          "decision": {
            "toolName": "wechat",
            "actionName": "add_draft",
            "reasoning": "内容合规，添加到公众号草稿箱..."
          },
          "result": {
            "data": {
              "success": true,
              "data": { "draftId": "xxx" }
            }
          },
          "params": { "accountId": "xxx", "title": "xxx", "content": "xxx" }
        }
      ],
      "execution_summary": { "status": "success", "message": "已成功上传" }
    }
  }
  ```

---

#### TC-01B: 初始合规→直接上传公众号

**业务场景**:
1. 用户提交合规内容
2. Agent 审核通过，`decision.type = COMPLETE`
3. 直接调用公众号 MCP 上传

**interact_content 存储**:
```json
{
  "response": {
    "decision": {
      "type": "COMPLETE",
      "reasoning": "内容合规，直接上传公众号",
      "final_conclusion": "审核通过，已上传"
    },
    "mcp_attempts": [
      {
        "attemptNumber": 1,
        "decision": {
          "toolName": "wechat",
          "actionName": "add_draft",
          "reasoning": "内容合规，添加草稿..."
        },
        "result": {
          "data": { "success": true }
        }
      }
    ],
    "execution_summary": { "status": "success" }
  }
}
```

---

#### TC-01C: 合规审核-流程完整性

**业务场景**:
1. 提交内容审核
2. Agent 执行完整审核流程
3. 输出审核结果

**interact_content 存储**:
```json
{
  "response": {
    "decision": {
      "type": "COMPLETE",  // 或 NEED_USER / FAILED
      "reasoning": "执行完整合规审核流程...",
      "final_conclusion": "审核完成"
    },
    "execution_summary": {
      "steps": ["内容分析", "规则匹配", "风险评估"],
      "status": "completed"
    }
  }
}
```

---

#### TC-02: 网页搜索带摘要

**业务场景**:
1. 执行网页搜索
2. 生成搜索摘要

**interact_content 存储**:
```json
{
  "response": {
    "decision": {
      "type": "COMPLETE",
      "reasoning": "执行网页搜索并生成摘要",
      "final_conclusion": "搜索完成，已生成摘要"
    },
    "mcp_attempts": [
      {
        "attemptNumber": 1,
        "decision": {
          "toolName": "search",
          "actionName": "webSearchWithSummary",
          "reasoning": "需要搜索相关信息并生成摘要..."
        },
        "result": {
          "data": {
            "success": true,
            "data": {
              "results": [...],
              "summary": "这是搜索摘要..."
            }
          }
        },
        "params": { "query": "2025年保险市场趋势", "includeSummary": true }
      }
    ],
    "execution_summary": { "status": "success" }
  }
}
```

---

#### TC-03: 网页搜索（基础版）

**业务场景**:
1. 执行基础网页搜索
2. 返回搜索结果（无摘要）

**interact_content 存储**:
```json
{
  "response": {
    "decision": {
      "type": "COMPLETE",
      "reasoning": "执行基础网页搜索",
      "final_conclusion": "搜索完成"
    },
    "mcp_attempts": [
      {
        "attemptNumber": 1,
        "decision": {
          "toolName": "search",
          "actionName": "webSearch",
          "reasoning": "需要搜索相关信息..."
        },
        "result": {
          "data": {
            "success": true,
            "data": { "results": [...] }
          }
        },
        "params": { "query": "新能源汽车保险政策" }
      }
    ]
  }
}
```

---

#### TC-04: 添加草稿

**业务场景**:
1. 准备文章内容
2. 调用微信公众号添加草稿 API

**interact_content 存储**:
```json
{
  "response": {
    "decision": {
      "type": "COMPLETE",
      "reasoning": "添加公众号草稿",
      "final_conclusion": "草稿已添加"
    },
    "mcp_attempts": [
      {
        "attemptNumber": 1,
        "decision": {
          "toolName": "wechat",
          "actionName": "add_draft",
          "reasoning": "准备好文章内容，添加到草稿箱..."
        },
        "result": {
          "data": {
            "success": true,
            "data": { "draftId": "xxx", "url": "xxx" }
          }
        },
        "params": {
          "accountId": "insurance-account",
          "title": "2025年保险市场最新趋势解析",
          "content": "...",
          "author": "保险科普"
        }
      }
    ],
    "execution_summary": { "status": "success", "draftUrl": "xxx" }
  }
}
```

---

### 复杂场景 (7个)

#### TC-05: MCP首次失败重试成功

**业务场景**:
1. 第一次 MCP 调用失败
2. Agent 自动重试
3. 第二次调用成功

**interact_content 存储**:
```json
{
  "response": {
    "decision": {
      "type": "COMPLETE",
      "reasoning": "首次调用失败，重试后成功",
      "final_conclusion": "重试成功，任务完成"
    },
    "mcp_attempts": [
      {
        "attemptNumber": 1,
        "decision": {
          "toolName": "search",
          "actionName": "webSearch",
          "reasoning": "需要搜索信息...",
          "strategy": "initial"
        },
        "result": {
          "data": {
            "success": false,
            "error": "网络超时，请重试"
          }
        },
        "params": { "query": "xxx" }
      },
      {
        "attemptNumber": 2,
        "decision": {
          "toolName": "search",
          "actionName": "webSearch",
          "reasoning": "上次调用失败，重新尝试...",
          "strategy": "retry"
        },
        "result": {
          "data": {
            "success": true,
            "data": { "results": [...] }
          }
        },
        "params": { "query": "xxx" }
      }
    ],
    "execution_summary": {
      "status": "success",
      "retries": 1,
      "message": "首次失败，重试1次后成功"
    }
  }
}
```

**关键点**:
- `mcp_attempts.length = 2`
- `attemptNumber` 从 1 递增到 2
- 第1次: `result.data.success = false`，有 `error`
- 第2次: `result.data.success = true`
- `decision.strategy`: 第1次 `initial`，第2次 `retry`

---

#### TC-06: MCP多次失败最终失败

**业务场景**:
1. 第一次 MCP 调用失败
2. Agent 多次重试（达到最大重试次数）
3. 最终放弃，返回失败

**interact_content 存储**:
```json
{
  "response": {
    "decision": {
      "type": "FAILED",
      "reasoning": "多次重试均失败，已达到最大重试次数",
      "reason_code": "MAX_RETRY_EXCEEDED",
      "final_conclusion": "任务失败，请稍后重试"
    },
    "mcp_attempts": [
      {
        "attemptNumber": 1,
        "decision": { "toolName": "search", "actionName": "webSearch", "strategy": "initial" },
        "result": {
          "data": { "success": false, "error": "服务不可用" }
        }
      },
      {
        "attemptNumber": 2,
        "decision": { "toolName": "search", "actionName": "webSearch", "strategy": "retry" },
        "result": {
          "data": { "success": false, "error": "服务不可用" }
        }
      },
      {
        "attemptNumber": 3,
        "decision": { "toolName": "search", "actionName": "webSearch", "strategy": "retry" },
        "result": {
          "data": { "success": false, "error": "服务不可用" }
        }
      }
    ],
    "failed_details": {
      "error": "多次重试失败",
      "retryCount": 3,
      "maxRetries": 3
    },
    "execution_summary": {
      "status": "failed",
      "message": "已达到最大重试次数"
    }
  }
}
```

**关键点**:
- `mcp_attempts.length = 3`（或最大重试次数）
- 所有 `attempt`: `result.data.success = false`
- `decision.type = FAILED`
- 有 `failed_details` 字段
- `execution_summary.status = failed`

---

#### TC-07: 达到最大迭代次数

**业务场景**:
1. Agent 执行多轮迭代
2. 达到最大迭代次数限制
3. 停止执行

**interact_content 存储**:
```json
{
  "response": {
    "decision": {
      "type": "COMPLETE",  // 或 NEED_USER / FAILED
      "reasoning": "已达到最大迭代次数，停止执行",
      "reason_code": "MAX_ITERATIONS_REACHED",
      "final_conclusion": "迭代完成"
    },
    "execution_summary": {
      "iterations": 10,
      "maxIterations": 10,
      "status": "completed",
      "message": "已达到最大迭代次数"
    }
  }
}
```

**关键点**:
- 有多条 `step_no` 记录（多轮迭代）
- `execution_summary` 包含 `iterations` 和 `maxIterations`
- `decision.reasoning` 说明达到最大迭代

---

#### TC-08: 用户确认后继续执行

**业务场景**:
1. Agent 执行需要用户确认的操作
2. 暂停等待用户确认，`decision.type = NEED_USER`
3. 用户确认后继续执行

**interact_content 存储（等待确认阶段）**:
```json
{
  "response": {
    "decision": {
      "type": "NEED_USER",
      "reasoning": "需要用户确认才能继续执行",
      "reason_code": "USER_CONFIRMATION_REQUIRED",
      "final_conclusion": "等待用户确认"
    },
    "prompt_message": "请确认以下操作...",
    "pending_key_fields": {
      "confirmationRequired": true,
      "confirmMessage": "是否继续执行?"
    },
    "available_solutions": [
      { "id": "confirm", "description": "确认并继续" },
      { "id": "cancel", "description": "取消" }
    ],
    "user_interactions": [
      { "type": "prompt", "message": "请确认..." }
    ]
  }
}
```

**interact_content 存储（用户确认后）**:
```json
{
  "response": {
    "decision": {
      "type": "COMPLETE",
      "reasoning": "用户已确认，继续执行完成",
      "final_conclusion": "任务完成"
    },
    "mcp_attempts": [...],
    "user_interactions": [
      { "type": "prompt", "message": "请确认..." },
      { "type": "user_confirm", "message": "用户已确认" }
    ],
    "execution_summary": { "status": "success" }
  }
}
```

**关键点**:
- 第1条 response: `decision.type = NEED_USER`
- 有 `prompt_message` 和 `available_solutions`
- 有 `user_interactions` 记录
- 用户确认后的 response: `decision.type = COMPLETE`

---

### 重点业务流程 (3个)

#### TC-23: 多次违规→多次整改→最终成功上传公众号（重点）

**业务场景**:
1. 第1次内容违规 → Agent 提示修改，`decision.type = NEED_USER`
2. 用户整改 → 第2次仍然违规 → Agent 再次提示，`decision.type = NEED_USER`
3. 用户再次整改 → 第3次合规
4. 成功上传公众号，`decision.type = COMPLETE`

**interact_content 存储（第1轮 - 首次违规）**:
```json
{
  "response": {
    "decision": {
      "type": "NEED_USER",
      "reasoning": "第1次审核：内容包含违规表述...",
      "reason_code": "CONTENT_VIOLATION",
      "final_conclusion": "请修改违规内容"
    },
    "prompt_message": "第1次审核发现以下违规：\n1. 绝对化用语\n2. 夸大宣传\n请修改后重新提交。",
    "user_interactions": [
      { "type": "violation_notice", "round": 1 }
    ]
  }
}
```

**interact_content 存储（第2轮 - 仍然违规）**:
```json
{
  "response": {
    "decision": {
      "type": "NEED_USER",
      "reasoning": "第2次审核：仍有违规表述...",
      "reason_code": "CONTENT_VIOLATION",
      "final_conclusion": "请继续修改"
    },
    "prompt_message": "第2次审核仍发现违规：\n1. 仍有绝对化用语\n请再次修改。",
    "user_interactions": [
      { "type": "violation_notice", "round": 1 },
      { "type": "user_modification", "round": 1 },
      { "type": "violation_notice", "round": 2 }
    ]
  }
}
```

**interact_content 存储（第3轮 - 合规并上传）**:
```json
{
  "response": {
    "decision": {
      "type": "COMPLETE",
      "reasoning": "第3次审核：内容已合规，准备上传公众号",
      "final_conclusion": "审核通过，已成功上传公众号"
    },
    "mcp_attempts": [
      {
        "attemptNumber": 1,
        "decision": {
          "toolName": "wechat",
          "actionName": "add_draft",
          "reasoning": "内容已合规，添加到公众号草稿箱"
        },
        "result": {
          "data": { "success": true, "data": { "draftId": "xxx" } }
        }
      }
    ],
    "user_interactions": [
      { "type": "violation_notice", "round": 1 },
      { "type": "user_modification", "round": 1 },
      { "type": "violation_notice", "round": 2 },
      { "type": "user_modification", "round": 2 },
      { "type": "compliance_pass", "round": 3 }
    ],
    "execution_summary": {
      "status": "success",
      "reviewRounds": 3,
      "message": "经3轮审核后通过，已上传公众号"
    }
  }
}
```

**关键点**:
- 至少 3 轮交互（`interact_num` 递增）
- 前2轮 response: `decision.type = NEED_USER`
- 第3轮 response: `decision.type = COMPLETE`
- `user_interactions` 记录多轮违规和整改
- `execution_summary` 包含 `reviewRounds: 3`
- 有公众号上传的 `mcp_attempts`

---

#### TC-24: 合规通过-正常发布流程（重点）

**业务场景**:
1. 内容合规 → Agent 审核通过，`decision.type = COMPLETE`
2. 直接执行公众号发布流程
3. 成功上传公众号

**interact_content 存储**:
```json
{
  "response": {
    "decision": {
      "type": "COMPLETE",
      "reasoning": "内容合规，直接执行公众号发布流程",
      "final_conclusion": "审核通过，已成功发布"
    },
    "mcp_attempts": [
      {
        "attemptNumber": 1,
        "decision": {
          "toolName": "wechat",
          "actionName": "get_accounts",
          "reasoning": "首先获取公众号账号列表..."
        },
        "result": { "data": { "success": true, "data": [...] } }
      },
      {
        "attemptNumber": 2,
        "decision": {
          "toolName": "wechat",
          "actionName": "add_draft",
          "reasoning": "账号已确认，添加文章草稿..."
        },
        "result": { "data": { "success": true, "data": { "draftId": "xxx" } } }
      }
    ],
    "execution_summary": {
      "status": "success",
      "steps": ["获取账号", "添加草稿"],
      "message": "内容合规，发布流程完成"
    }
  }
}
```

**关键点**:
- `decision.type = COMPLETE`
- `decision.reasoning` 说明内容合规
- 有公众号发布相关的 `mcp_attempts`
- `mcp_attempts` 中 `result.data.success = true`
- `execution_summary` 说明发布成功

---

#### TC-25: 合规不通过-提示修改后重试（重点）

**业务场景**:
1. 内容违规 → Agent 提示具体修改意见，`decision.type = NEED_USER`
2. 用户根据提示修改
3. 修改后合规 → 成功上传公众号，`decision.type = COMPLETE`

**interact_content 存储（第1轮 - 提示修改）**:
```json
{
  "response": {
    "decision": {
      "type": "NEED_USER",
      "reasoning": "内容违规，请按以下提示修改",
      "reason_code": "CONTENT_VIOLATION",
      "final_conclusion": "等待用户修改"
    },
    "prompt_message": "审核发现违规，请按以下提示修改：\n\n违规内容：'限时特惠！错过今天再等一年'\n修改建议：删除限时特惠表述，改为客观描述\n\n修改后请重新提交。",
    "pending_key_fields": {
      "violationDetails": {
        "violationType": "MARKETING_VIOLATION",
        "violationText": "限时特惠！错过今天再等一年",
        "suggestion": "删除限时特惠表述"
      }
    },
    "user_interactions": [
      { "type": "violation_notice", "details": "..." }
    ]
  }
}
```

**interact_content 存储（第2轮 - 修改后合规）**:
```json
{
  "response": {
    "decision": {
      "type": "COMPLETE",
      "reasoning": "用户已按提示修改，内容合规，准备上传",
      "final_conclusion": "修改通过，已成功上传"
    },
    "mcp_attempts": [
      {
        "attemptNumber": 1,
        "decision": {
          "toolName": "wechat",
          "actionName": "add_draft",
          "reasoning": "内容已修改合规，添加草稿..."
        },
        "result": {
          "data": { "success": true, "data": { "draftId": "xxx" } }
        }
      }
    ],
    "user_interactions": [
      { "type": "violation_notice", "details": "..." },
      { "type": "user_modification", "details": "已按提示修改" },
      { "type": "compliance_pass", "details": "修改通过" }
    ],
    "execution_summary": {
      "status": "success",
      "modificationReview": true,
      "message": "用户按提示修改后通过，已上传"
    }
  }
}
```

**关键点**:
- 至少 2 轮交互
- 第1轮 response:
  - `decision.type = NEED_USER`
  - `prompt_message` 包含具体违规内容和修改建议
  - `pending_key_fields` 包含违规详情
- 第2轮 response:
  - `decision.type = COMPLETE`
  - `decision.reasoning` 说明用户已按提示修改
  - 有公众号上传 `mcp_attempts`
- `user_interactions` 记录违规、修改、通过过程

---

## 📝 总结

### interact_content 字段核心业务价值

| 字段 | 业务价值 | 支持的测试案例 |
|------|---------|---------------|
| `decision.type` | 标识任务状态（完成/失败/需用户） | 全部13个案例 |
| `decision.reasoning` | 记录 Agent 推理过程 | 全部13个案例 |
| `mcp_attempts` | 记录每次 MCP 工具调用 | TC-02, TC-03, TC-04, TC-05, TC-06, TC-23, TC-24, TC-25 |
| `mcp_attempts[].attemptNumber` | 记录重试次数 | TC-05, TC-06 |
| `mcp_attempts[].result.data.success` | 业务是否成功 | 全部有 MCP 的案例 |
| `mcp_attempts[].result.data.error` | 错误信息 | TC-05, TC-06 |
| `execution_summary` | 执行总结 | 全部案例 |
| `user_interactions` | 用户交互记录 | TC-01A, TC-08, TC-23, TC-25 |
| `prompt_message` | 给用户的提示 | TC-01A, TC-08, TC-23, TC-25 |
| `failed_details` | 失败详情 | TC-06 |

### 13个测试案例的数据结构验证结论

✅ **所有13个测试案例的业务场景都能在 interact_content 数据结构中完整体现！**

---

**报告生成时间**: 2026-03-06

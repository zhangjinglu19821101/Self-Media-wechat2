# 统一测试案例文档

> 📋 **文档版本**：v2.0
> 📅 **更新日期**：2026-03-08
> 🎯 **测试案例总数**：21个
> 
> 🔄 **重要更新**：
> - **v2.0 (2026-03-08)**: 新增 f1bafc6 版本新功能测试案例（8个）
> - **v1.0**: 初始版本，核心功能测试案例（13个）
> 
> 🔄 **两阶段流程说明**：内容发布场景已实现：
> - 阶段1：合规检查（compliance_audit/checkContent）
> - 阶段2：公众号上传（wechat_mp/addDraft）
> - mcp_attempts 预期包含 **2条记录**

---

## 📊 测试案例总览

### 📈 测试案例统计

| 类别 | 数量 | 说明 |
|------|------|------|
| **核心功能测试（v1.0）** | 13个 | 初始版本的核心测试案例 |
| **f1bafc6 新功能测试（v2.0）** | 8个 | 新增功能测试案例 |
| **总计** | **21个** | |

---

### 第一部分：核心功能测试（v1.0，13个案例）

| ID | 名称 | 类型 | 业务场景 | 是否需要两阶段流程 | 预期 mcp_attempts 数量 |
|----|------|------|---------|------------------|----------------------|
| **TC-01A** | 初始不合规→整改→成功上传公众号 | 基础 | 内容不合规时的整改流程 | ✅ 是 | 2条（合规检查 + 公众号上传） |
| **TC-01B** | 初始合规→直接上传公众号 | 基础 | 内容合规时的直接发布流程 | ✅ 是 | 2条（合规检查 + 公众号上传） |
| **TC-01C** | 合规审核-流程完整性 | 基础 | 合规审核流程完整性验证 | ⚠️ 仅合规检查 | 1条（仅合规检查） |
| **TC-02** | 网页搜索带摘要 | 基础 | 网页搜索+摘要功能 | ❌ 否 | 1条（仅搜索） |
| **TC-03** | 网页搜索（基础版） | 基础 | 基础网页搜索功能 | ❌ 否 | 1条（仅搜索） |
| **TC-04** | 添加草稿 | 基础 | 微信公众号添加草稿功能 | ❌ 否 | 1条（仅公众号上传） |
| **TC-05** | MCP首次失败重试成功 | 复杂 | MCP失败重试机制验证 | ❌ 否 | 视具体场景 |
| **TC-06** | MCP多次失败最终失败 | 复杂 | MCP重试限制机制验证 | ❌ 否 | 视具体场景 |
| **TC-07** | 达到最大迭代次数 | 复杂 | 最大迭代次数限制验证 | ❌ 否 | 视具体场景 |
| **TC-08** | 用户确认后继续执行 | 复杂 | 用户交互确认机制验证 | ❌ 否 | 视具体场景 |
| **TC-23** | 多次违规→多次整改→最终成功上传公众号 | 复杂 | 多轮违规整改的完整业务流程 | ✅ 是 | 2条（合规检查 + 公众号上传） |
| **TC-24** | 合规通过-正常发布流程 | 复杂 | 合规内容的完整正常发布流程 | ✅ 是 | 2条（合规检查 + 公众号上传） |
| **TC-25** | 合规不通过-提示修改后重试 | 复杂 | 违规后提示修改再重试的流程 | ✅ 是 | 2条（合规检查 + 公众号上传） |

---

### 第二部分：f1bafc6 新功能测试（v2.0，8个案例）

#### 2.1 MCP 执行审计表测试（4个案例）

| ID | 名称 | 类型 | 业务场景 | 重点验证表 | 优先级 |
|----|------|------|---------|------------|--------|
| **TC-MCP-01** | MCP执行审计表-基础写入验证 | 新功能 | 验证新表能正确记录 MCP 执行信息 | agent_sub_tasks_mcp_executions | 🔴 P0 |
| **TC-MCP-02** | MCP执行审计表-重试场景验证 | 新功能 | 验证重试场景下的 strategy 字段（initial/retry） | agent_sub_tasks_mcp_executions | 🔴 P0 |
| **TC-MCP-03** | MCP执行审计表-失败分析验证 | 新功能 | 验证失败时的 isRetryable/failure_type/suggested_next_action | agent_sub_tasks_mcp_executions | 🔴 P0 |
| **TC-MCP-04** | MCP执行审计表-两阶段流程验证 | 新功能 | 验证合规检查+公众号上传在新表中的记录 | agent_sub_tasks_mcp_executions | 🔴 P0 |

#### 2.2 NEED_USER 决策流程测试（4个案例）

| ID | 名称 | 类型 | 业务场景 | 重点验证 | 优先级 |
|----|------|------|---------|----------|--------|
| **TC-NEED-01** | NEED_USER-用户确认字段 | 新功能 | 验证用户确认关键字段的完整流程 | waiting_user 状态、用户交互 | 🔴 P0 |
| **TC-NEED-02** | NEED_USER-用户选择方案 | 新功能 | 验证用户选择可选方案的流程 | 可选方案、用户选择 | 🔴 P0 |
| **TC-NEED-03** | NEED_USER-字段+方案混合 | 新功能 | 验证字段确认和方案选择的混合场景 | 混合交互 | 🟡 P1 |
| **TC-NEED-04** | NEED_USER-字段验证失败 | 新功能 | 验证必填字段未填写时的处理 | 字段验证、错误处理 | 🟡 P1 |

---

## 1️⃣ 测试方案

### 1.1 测试目标

验证以下核心功能是否正确实现：
- ✅ 合规审核流程（初始不合规→整改→合规→发布）
- ✅ 网页搜索功能（带摘要/基础版）
- ✅ 微信公众号草稿添加
- ✅ MCP失败重试机制
- ✅ 最大迭代次数限制
- ✅ 用户交互确认流程
- ✅ interact_content 数据结构完整性

### 1.2 测试范围

| 模块 | 测试内容 |
|------|---------|
| **MCP能力** | 合规审核、网页搜索、公众号发布 |
| **Agent B决策** | COMPLETE、FAILED、NEED_USER、EXECUTE_MCP |
| **重试机制** | MCP重试、最大迭代限制 |
| **数据存储** | agent_sub_tasks_step_history 表、agent_sub_tasks_mcp_executions 表 |
| **interact_content** | 数据结构完整性验证 |

### 1.3 测试环境要求

- **数据库**：PostgreSQL (火山引擎)
- **服务端口**：5000
- **测试API**：`/api/test/run-all-tests`
- **数据清理**：`/api/test/cleanup-data`

---

## 🔄 两阶段流程说明

### 两阶段流程概述

对于**内容发布场景**（TC-01A/B/C, TC-23/24/25），系统已实现**两阶段流程**：

| 阶段 | 工具 | 动作 | 说明 |
|------|------|------|------|
| **阶段1** | `compliance_audit` | `checkContent` | 先执行合规检查，确保内容合规 |
| **阶段2** | `wechat_mp` | `addDraft` | 合规检查通过后，再上传公众号草稿 |

### mcp_attempts 数据结构

**预期 mcp_attempts 包含 2 条记录**（按时间顺序）：

```json
{
  "mcp_attempts": [
    {
      "attemptId": "mcp-xxx-001",
      "attemptNumber": 1,
      "timestamp": "2026-01-05T10:30:00Z",
      "decision": {
        "solutionNum": 1,
        "toolName": "compliance_audit",
        "actionName": "checkContent",
        "reasoning": "先执行合规检查，确保内容合规",
        "strategy": "initial"
      },
      "params": {
        "accountId": "insurance-account",
        "content": "【保险知识分享】..."
      },
      "result": {
        "status": "success",
        "data": {
          "is_compliant": true,
          "check_passed": true,
          "violations": []
        },
        "executionTime": 1500
      }
    },
    {
      "attemptId": "mcp-xxx-002",
      "attemptNumber": 2,
      "timestamp": "2026-01-05T10:30:02Z",
      "decision": {
        "solutionNum": 2,
        "toolName": "wechat_mp",
        "actionName": "addDraft",
        "reasoning": "合规检查通过，现在上传公众号草稿",
        "strategy": "initial"
      },
      "params": {
        "accountId": "insurance-account",
        "articles": [
          {
            "title": "【保险知识分享】...",
            "content": "...",
            "thumb_media_id": "..."
          }
        ]
      },
 "result": {
        "status": "success",
        "data": {
          "media_id": "1234567890",
          "article_url": "https://mp.weixin.qq.com/..."
        },
        "executionTime": 2500
      }
    }
  ]
}
```

### 验证要点

对于内容发布测试案例，需要验证：

1. **mcp_attempts 数量**：应为 2 条（TC-01C 除外，只有 1 条）
2. **合规检查在前**：compliance_audit 记录应在 wechat_mp 记录之前
3. **合规检查通过**：合规检查的 result.data.is_compliant 应为 true
4. **公众号上传在后**：wechat_mp 记录应在合规检查通过之后

### 特殊案例说明

| 测试案例 | 特殊说明 | mcp_attempts 预期 |
|---------|---------|------------------|
| **TC-01C** | 仅验证合规审核流程，不上传公众号 | 1条（仅合规检查） |
| **TC-02/03** | 仅网页搜索，不涉及内容发布 | 1条（仅搜索） |
| **TC-04** | 仅公众号上传，不涉及合规检查 | 1条（仅公众号上传） |

---

## 2️⃣ 测试案例详情

### 基础功能测试（6个）

---

#### TC-01A：初始不合规→整改→成功上传公众号

**测试目标**：验证内容不合规时的整改流程

**业务场景**：
1. 初始内容违规（夸大宣传、绝对化用语）
2. Agent 识别违规，提示修改
3. 用户整改后重新提交
4. 合规审核通过，成功上传公众号

**预期结果（完整说明）**：

**数据库记录预期**：
- ✅ `agent_sub_tasks_step_history` 表中应有 **≥ 4 条记录**
  - 第1条：`interact_type = "request"` - 执行Agent初始请求
  - 第2条：`interact_type = "response"` - Agent B返回违规提示
  - 第3条：`interact_type = "request"` - 用户整改后重新提交
  - 第4条：`interact_type = "response"` - Agent B审核通过+公众号上传

**interact_content 预期结构**：

**第2条记录（违规提示 response）**：
```json
{
  "interact_type": "response",
  "consultant": "insurance-d",
  "responder": "agent B",
  "question": { ... },
  "response": {
    "decision": {
      "type": "PAUSE_WAITING_FIX",
      "reason_code": "CONTENT_VIOLATION",
      "reasoning": "内容存在违规：夸大宣传、绝对化用语",
      "final_conclusion": "请修改违规内容后重新提交"
    },
    "violations": [
      {
        "rule_id": "RULE_001",
        "description": "夸大宣传",
        "location": "第2段第3行",
        "severity": "high"
      },
      {
        "rule_id": "RULE_002",
        "description": "绝对化用语",
        "location": "标题",
        "severity": "medium"
      }
    ],
    "suggestions": [
      "建议修改标题，避免使用'最佳'、'第一'等绝对化用语",
      "建议调整第2段描述，确保宣传内容真实可信"
    ],
    "mcp_attempts": [],
    "execution_summary": {
      "total_mcp_attempts": 0,
      "successful_mcp_attempts": 0,
      "failed_mcp_attempts": 0
    }
  }
}
```

**第4条记录（审核通过+上传 response）**：
```json
{
  "interact_type": "response",
  "consultant": "insurance-d",
  "responder": "agent B",
  "question": { ... },
  "response": {
    "decision": {
      "type": "COMPLETE",
      "reason_code": "TASK_DONE",
      "reasoning": "内容已合规，成功上传公众号",
      "final_conclusion": "任务完成：文章已成功上传至公众号草稿箱"
    },
    "mcp_attempts": [
      {
        "attempt_id": "mcp-xxx-001",
        "attempt_number": 1,
        "timestamp": "2026-01-05T10:30:00Z",
        "decision": {
          "solution_num": 1,
          "tool_name": "compliance_audit",
          "action_name": "checkContent",
          "reasoning": "先执行合规检查，确保内容合规",
          "strategy": "initial"
        },
        "params": {
          "account_id": "insurance-account",
          "content": "【保险知识分享】..."
        },
        "result": {
          "status": "success",
          "data": {
            "is_compliant": true,
            "check_passed": true,
            "violations": []
          },
          "execution_time": 1500
        }
      },
      {
        "attempt_id": "mcp-xxx-002",
        "attempt_number": 2,
        "timestamp": "2026-01-05T10:30:02Z",
        "decision": {
          "solution_num": 2,
          "tool_name": "wechat_mp",
          "action_name": "addDraft",
          "reasoning": "合规检查通过，现在上传公众号草稿",
          "strategy": "initial"
        },
        "params": {
          "account_id": "insurance-account",
          "articles": [ ... ]
        },
        "result": {
          "status": "success",
          "data": {
            "media_id": "1234567890",
            "article_url": "https://mp.weixin.qq.com/..."
          },
          "execution_time": 2500
        }
      }
    ],
    "execution_summary": {
      "total_mcp_attempts": 2,
      "successful_mcp_attempts": 2,
      "failed_mcp_attempts": 0,
      "total_user_interactions": 1,
      "start_time": "2026-01-05T10:00:00Z",
      "end_time": "2026-01-05T10:35:00Z",
      "total_duration": 2100000
    }
  }
}
```

**验证点清单**：
- ✅ `agent_sub_tasks_step_history` 记录数 ≥ 4
- ✅ 第2条 `interact_content.response.decision.type` = "PAUSE_WAITING_FIX"
- ✅ 第2条 `interact_content.response.violations` 数组不为空
- ✅ 第2条 `interact_content.response.suggestions` 数组不为空
- ✅ 第4条 `interact_content.response.decision.type` = "COMPLETE"
- ✅ 第4条 `interact_content.response.mcp_attempts.length` = 2
- ✅ 第4条 `interact_content.response.mcp_attempts[0].tool_name` = "compliance_audit"
- ✅ 第4条 `interact_content.response.mcp_attempts[1].tool_name` = "wechat_mp"
- ✅ 合规检查在公众号上传之前
- ✅ 第4条 `interact_content.response.mcp_attempts[0].result.status` = "success"

---

#### TC-01B：初始合规→直接上传公众号

**测试目标**：验证内容合规时的直接发布流程

**业务场景**：
1. 初始内容合规
2. Agent 审核通过
3. 直接上传公众号

**预期结果（完整说明）**：

**数据库记录预期**：
- ✅ `agent_sub_tasks_step_history` 表中应有 **2 条记录**
  - 第1条：`interact_type = "request"` - 执行Agent初始请求
  - 第2条：`interact_type = "response"` - Agent B审核通过+公众号上传

**interact_content 预期结构**：

**第2条记录（审核通过+上传 response）**：
```json
{
  "interact_type": "response",
  "consultant": "insurance-d",
  "responder": "agent B",
  "question": {
    "is_need_mcp": true,
    "problem": "需要上传公众号文章",
    "capability_type": "wechat_upload",
    "execution_result": null,
    "is_task_down": false
  },
  "response": {
    "decision": {
      "type": "COMPLETE",
      "reason_code": "TASK_DONE",
      "reasoning": "内容合规，直接执行公众号发布",
      "final_conclusion": "任务完成：文章已成功上传至公众号草稿箱"
    },
    "mcp_attempts": [
      {
        "attempt_id": "mcp-xxx-1",
        "attempt_number": 1,
        "timestamp": "2026-01-05T10:03:00Z",
        "decision": {
          "solution_num": 15,
          "tool_name": "compliance_audit",
          "action_name": "checkContent",
          "reasoning": "强制执行合规检查（两阶段流程第一阶段）",
          "strategy": "initial"
        },
        "params": {
          "account_id": "insurance-account",
          "content": "<h1>合规文章</h1><p>这是一篇合规的测试文章。</p>"
        },
        "result": {
          "status": "success",
          "data": {
            "is_compliant": true,
            "check_passed": true,
            "violations": [],
            "audit_summary": "文章内容合规，未发现违规项"
          },
          "execution_time": 1800
        }
      },
      {
        "attempt_id": "mcp-xxx-2",
        "attempt_number": 2,
        "timestamp": "2026-01-05T10:05:00Z",
        "decision": {
          "solution_num": 21,
          "tool_name": "wechat_mp",
          "action_name": "addDraft",
          "reasoning": "合规检查通过，执行公众号上传（两阶段流程第二阶段）",
          "strategy": "initial"
        },
        "params": {
          "account_id": "insurance-account",
          "articles": [
            {
              "title": "合规测试文章",
              "author": "保险事业部",
              "content": "<h1>合规文章</h1><p>这是一篇合规的测试文章。</p>"
            }
          ]
        },
        "result": {
          "status": "success",
          "data": {
            "media_id": "9876543210",
            "article_url": "https://mp.weixin.qq.com/..."
          },
          "execution_time": 2300
        }
      }
    ],
    "execution_summary": {
      "total_mcp_attempts": 2,
      "successful_mcp_attempts": 2,
      "failed_mcp_attempts": 0,
      "total_user_interactions": 0,
      "start_time": "2026-01-05T10:00:00Z",
      "end_time": "2026-01-05T10:08:00Z",
      "total_duration": 480000
    }
  }
}
```

**验证点清单**：
- ✅ `agent_sub_tasks_step_history` 记录数 = 2
- ✅ 第2条 `interact_content.response.decision.type` = "COMPLETE"
- ✅ 第2条 `interact_content.response.decision.reason_code` = "TASK_DONE"
- ✅ 第2条 `interact_content.response.mcp_attempts.length` = 2
- ✅ 第2条 `interact_content.response.mcp_attempts[0].tool_name` = "compliance_audit"
- ✅ 第2条 `interact_content.response.mcp_attempts[0].action_name` = "checkContent"
- ✅ 第2条 `interact_content.response.mcp_attempts[0].result.status` = "success"
- ✅ 第2条 `interact_content.response.mcp_attempts[0].result.data.is_compliant` = true
- ✅ 第2条 `interact_content.response.mcp_attempts[1].tool_name` = "wechat_mp"
- ✅ 第2条 `interact_content.response.mcp_attempts[1].action_name` = "addDraft"
- ✅ 第2条 `interact_content.response.mcp_attempts[1].result.status` = "success"
- ✅ 第2条 `interact_content.response.mcp_attempts[1].result.data.media_id` 存在
- ✅ 第2条 `interact_content.response.execution_summary.total_mcp_attempts` = 2

---

#### TC-01C：合规审核-流程完整性

**测试目标**：验证合规审核流程的完整性

**业务场景**：
1. 提交内容审核
2. Agent 执行完整审核流程
3. 输出审核结果

**预期结果（完整说明）**：

**数据库记录预期**：
- ✅ `agent_sub_tasks_step_history` 表中应有 **2 条记录**
  - 第1条：`interact_type = "request"` - 执行Agent提交审核请求
  - 第2条：`interact_type = "response"` - Agent B返回审核结果

**interact_content 预期结构**：

**第2条记录（审核结果 response）**：
```json
{
  "interact_type": "response",
  "consultant": "insurance-d",
  "responder": "agent B",
  "question": {
    "is_need_mcp": true,
    "problem": "需要审核文章合规性",
    "capability_type": "compliance_audit",
    "execution_result": null,
    "is_task_down": false
  },
  "response": {
    "decision": {
      "type": "COMPLETE",
      "reason_code": "TASK_DONE",
      "reasoning": "已完成合规审核流程",
      "final_conclusion": "审核完成：文章合规/不合规"
    },
    "mcp_attempts": [
      {
        "attempt_id": "mcp-xxx",
        "attempt_number": 1,
        "timestamp": "2026-01-05T10:10:00Z",
        "decision": {
          "solution_num": 15,
          "tool_name": "compliance_audit",
          "action_name": "checkContent",
          "reasoning": "执行合规审核检查",
          "strategy": "initial"
        },
        "params": {
          "account_id": "insurance-account",
          "content": "<h1>测试文章</h1><p>需要审核的文章内容...</p>"
        },
        "result": {
          "status": "success",
          "data": {
            "is_compliant": true,
            "check_passed": true,
            "violations": [],
            "audit_summary": "文章内容合规，未发现违规项"
          },
          "execution_time": 1800
        }
      }
    ],
    "execution_summary": {
      "total_mcp_attempts": 1,
      "successful_mcp_attempts": 1,
      "failed_mcp_attempts": 0,
      "total_user_interactions": 0,
      "start_time": "2026-01-05T10:08:00Z",
      "end_time": "2026-01-05T10:12:00Z",
      "total_duration": 240000
    }
  }
}
```

**验证点清单**：
- ✅ `agent_sub_tasks_step_history` 记录数 = 2
- ✅ 第2条 `interact_content.response.decision.type` = "COMPLETE"
- ✅ 第2条 `interact_content.response.mcp_attempts.length` = 1
- ✅ 第2条 `interact_content.response.mcp_attempts[0].tool_name` = "compliance_audit"
- ✅ 第2条 `interact_content.response.mcp_attempts[0].action_name` = "checkContent"
- ✅ 第2条 `interact_content.response.mcp_attempts[0].result.status` = "success"
- ✅ 第2条 `interact_content.response.mcp_attempts[0].result.data.is_compliant` 存在（true 或 false）
- ✅ 第2条 `interact_content.response.execution_summary.total_mcp_attempts` = 1

---

#### TC-02：网页搜索带摘要

**测试目标**：验证网页搜索+摘要功能

**业务场景**：
1. 执行网页搜索
2. 生成搜索摘要

**预期结果（完整说明）**：

**数据库记录预期**：
- ✅ `agent_sub_tasks_step_history` 表中应有 **2 条记录**
  - 第1条：`interact_type = "request"` - 执行Agent搜索请求
  - 第2条：`interact_type = "response"` - Agent B返回搜索结果+摘要

**interact_content 预期结构**：

**第2条记录（搜索结果+摘要 response）**：
```json
{
  "interact_type": "response",
  "consultant": "insurance-d",
  "responder": "agent B",
  "question": {
    "is_need_mcp": true,
    "problem": "需要搜索保险行业最新资讯",
    "capability_type": "search",
    "execution_result": null,
    "is_task_down": false
  },
  "response": {
    "decision": {
      "type": "COMPLETE",
      "reason_code": "TASK_DONE",
      "reasoning": "已完成网页搜索并生成摘要",
      "final_conclusion": "搜索完成：已找到相关资讯并生成摘要"
    },
    "mcp_attempts": [
      {
        "attempt_id": "mcp-xxx",
        "attempt_number": 1,
        "timestamp": "2026-01-05T10:15:00Z",
        "decision": {
          "solution_num": 8,
          "tool_name": "web_search",
          "action_name": "searchWithSummary",
          "reasoning": "选择带摘要的网页搜索功能",
          "strategy": "initial"
        },
        "params": {
          "account_id": "insurance-account",
          "query": "保险行业最新政策 2026",
          "num_results": 5
        },
        "result": {
          "status": "success",
          "data": {
            "query": "保险行业最新政策 2026",
            "total_results": 156,
            "results": [
              {
                "title": "2026年保险监管新政策解读",
                "url": "https://example.com/article1",
                "snippet": "银保监会发布2026年最新监管政策..."
              },
              {
                "title": "保险行业数字化转型趋势",
                "url": "https://example.com/article2",
                "snippet": "保险行业加速数字化转型..."
              }
            ],
            "summary": "根据搜索结果，2026年保险行业主要有以下趋势：1. 监管政策趋严；2. 数字化转型加速；3. 产品创新活跃。建议重点关注监管政策变化。"
          },
          "execution_time": 3200
        }
      }
    ],
    "execution_summary": {
      "total_mcp_attempts": 1,
      "successful_mcp_attempts": 1,
      "failed_mcp_attempts": 0,
      "total_user_interactions": 0,
      "start_time": "2026-01-05T10:13:00Z",
      "end_time": "2026-01-05T10:18:00Z",
      "total_duration": 300000
    }
  }
}
```

**验证点清单**：
- ✅ `agent_sub_tasks_step_history` 记录数 = 2
- ✅ 第2条 `interact_content.response.decision.type` = "COMPLETE"
- ✅ 第2条 `interact_content.response.mcp_attempts.length` = 1
- ✅ 第2条 `interact_content.response.mcp_attempts[0].tool_name` = "web_search"
- ✅ 第2条 `interact_content.response.mcp_attempts[0].action_name` = "searchWithSummary"
- ✅ 第2条 `interact_content.response.mcp_attempts[0].result.status` = "success"
- ✅ 第2条 `interact_content.response.mcp_attempts[0].result.data.results` 数组存在
- ✅ 第2条 `interact_content.response.mcp_attempts[0].result.data.summary` 存在（摘要内容）

---

#### TC-03：网页搜索（基础版）

**测试目标**：验证基础网页搜索功能

**业务场景**：
1. 执行基础网页搜索
2. 返回搜索结果

**预期结果（完整说明）**：

**数据库记录预期**：
- ✅ `agent_sub_tasks_step_history` 表中应有 **2 条记录**
  - 第1条：`interact_type = "request"` - 执行Agent搜索请求
  - 第2条：`interact_type = "response"` - Agent B返回搜索结果

**interact_content 预期结构**：

**第2条记录（搜索结果 response）**：
```json
{
  "interact_type": "response",
  "consultant": "insurance-d",
  "responder": "agent B",
  "question": {
    "is_need_mcp": true,
    "problem": "需要搜索相关信息",
    "capability_type": "search",
    "execution_result": null,
    "is_task_down": false
  },
  "response": {
    "decision": {
      "type": "COMPLETE",
      "reason_code": "TASK_DONE",
      "reasoning": "已完成基础网页搜索",
      "final_conclusion": "搜索完成：已返回搜索结果"
    },
    "mcp_attempts": [
      {
        "attempt_id": "mcp-xxx",
        "attempt_number": 1,
        "timestamp": "2026-01-05T10:20:00Z",
        "decision": {
          "solution_num": 7,
          "tool_name": "web_search",
          "action_name": "searchEngine",
          "reasoning": "选择基础网页搜索功能",
          "strategy": "initial"
        },
        "params": {
          "account_id": "insurance-account",
          "query": "保险产品介绍",
          "num_results": 10
        },
        "result": {
          "status": "success",
          "data": {
            "query": "保险产品介绍",
            "total_results": 234,
            "results": [
              {
                "title": "重疾险产品对比",
                "url": "https://example.com/product1",
                "snippet": "多款重疾险产品对比分析..."
              },
              {
                "title": "年金险选购指南",
                "url": "https://example.com/product2",
                "snippet": "如何选择合适的年金险..."
              }
            ]
          },
          "execution_time": 2100
        }
      }
    ],
    "execution_summary": {
      "total_mcp_attempts": 1,
      "successful_mcp_attempts": 1,
      "failed_mcp_attempts": 0,
      "total_user_interactions": 0,
      "start_time": "2026-01-05T10:18:00Z",
      "end_time": "2026-01-05T10:22:00Z",
      "total_duration": 240000
    }
  }
}
```

**验证点清单**：
- ✅ `agent_sub_tasks_step_history` 记录数 = 2
- ✅ 第2条 `interact_content.response.decision.type` = "COMPLETE"
- ✅ 第2条 `interact_content.response.mcp_attempts.length` = 1
- ✅ 第2条 `interact_content.response.mcp_attempts[0].tool_name` = "web_search"
- ✅ 第2条 `interact_content.response.mcp_attempts[0].action_name` = "searchEngine"
- ✅ 第2条 `interact_content.response.mcp_attempts[0].result.status` = "success"
- ✅ 第2条 `interact_content.response.mcp_attempts[0].result.data.results` 数组存在
- ✅ 第2条 `interact_content.response.mcp_attempts[0].result.data.summary` **不存在**（基础版无摘要）

---

#### TC-04：添加草稿

**测试目标**：验证微信公众号添加草稿功能

**业务场景**：
1. 准备文章内容
2. 调用微信公众号添加草稿 API

**预期结果（完整说明）**：

**数据库记录预期**：
- ✅ `agent_sub_tasks_step_history` 表中应有 **2 条记录**
  - 第1条：`interact_type = "request"` - 执行Agent上传请求
  - 第2条：`interact_type = "response"` - Agent B返回上传结果

**interact_content 预期结构**：

**第2条记录（上传结果 response）**：
```json
{
  "interact_type": "response",
  "consultant": "insurance-d",
  "responder": "agent B",
  "question": {
    "is_need_mcp": true,
    "problem": "需要上传公众号草稿",
    "capability_type": "wechat_upload",
    "execution_result": null,
    "is_task_down": false
  },
  "response": {
    "decision": {
      "type": "COMPLETE",
      "reason_code": "TASK_DONE",
      "reasoning": "已成功添加公众号草稿",
      "final_conclusion": "任务完成：草稿已成功添加至公众号"
    },
    "mcp_attempts": [
      {
        "attempt_id": "mcp-xxx",
        "attempt_number": 1,
        "timestamp": "2026-01-05T10:25:00Z",
        "decision": {
          "solution_num": 21,
          "tool_name": "wechat_mp",
          "action_name": "addDraft",
          "reasoning": "选择公众号草稿添加功能",
          "strategy": "initial"
        },
        "params": {
          "account_id": "insurance-account",
          "articles": [
            {
              "title": "测试草稿文章",
              "author": "保险事业部",
              "digest": "这是一篇测试草稿的摘要",
              "content": "<h1>测试草稿</h1><p>这是草稿的正文内容。</p>",
              "show_cover_pic": 0
            }
          ]
        },
        "result": {
          "status": "success",
          "data": {
            "media_id": "1122334455",
            "article_url": "https://mp.weixin.qq.com/s/xxx",
            "draft_id": "draft_12345"
          },
          "execution_time": 2700
        }
      }
    ],
    "execution_summary": {
      "total_mcp_attempts": 1,
      "successful_mcp_attempts": 1,
      "failed_mcp_attempts": 0,
      "total_user_interactions": 0,
      "start_time": "2026-01-05T10:23:00Z",
      "end_time": "2026-01-05T10:28:00Z",
      "total_duration": 300000
    }
  }
}
```

**验证点清单**：
- ✅ `agent_sub_tasks_step_history` 记录数 = 2
- ✅ 第2条 `interact_content.response.decision.type` = "COMPLETE"
- ✅ 第2条 `interact_content.response.mcp_attempts.length` = 1
- ✅ 第2条 `interact_content.response.mcp_attempts[0].tool_name` = "wechat_mp"
- ✅ 第2条 `interact_content.response.mcp_attempts[0].action_name` = "addDraft"
- ✅ 第2条 `interact_content.response.mcp_attempts[0].result.status` = "success"
- ✅ 第2条 `interact_content.response.mcp_attempts[0].result.data.media_id` 存在
- ✅ 第2条 `interact_content.response.mcp_attempts[0].result.data.article_url` 存在

---

### 复杂场景测试（7个）

---

#### TC-05：MCP首次失败重试成功

**测试目标**：验证 MCP 失败重试机制

**业务场景**：
1. 第一次 MCP 调用失败
2. Agent B 重新决策，第二次调用成功
3. 任务完成

**预期结果（完整说明）**：

**数据库记录预期**：
- ✅ `agent_sub_tasks_step_history` 表中应有 **2 条记录**
  - 第1条：`interact_type = "request"` - 执行Agent初始请求
  - 第2条：`interact_type = "response"` - Agent B返回重试+成功结果

**interact_content 预期结构**：

**第2条记录（重试+成功 response）**：
```json
{
  "interact_type": "response",
  "consultant": "insurance-d",
  "responder": "agent B",
  "question": { ... },
  "response": {
    "decision": {
      "type": "COMPLETE",
      "reason_code": "TASK_DONE",
      "reasoning": "首次失败后重试成功",
      "final_conclusion": "任务完成：通过重试机制成功执行"
    },
    "mcp_attempts": [
      {
        "attempt_id": "mcp-xxx-1",
        "attempt_number": 1,
        "timestamp": "2026-01-05T10:30:00Z",
        "decision": {
          "solution_num": 8,
          "tool_name": "web_search",
          "action_name": "searchWithSummary",
          "reasoning": "首次尝试搜索",
          "strategy": "initial"
        },
        "params": {
          "account_id": "insurance-account",
          "query": "保险行业资讯"
        },
        "result": {
          "status": "failed",
          "error": {
            "code": "NETWORK_ERROR",
            "message": "网络连接超时",
            "type": "network"
          },
          "execution_time": 5000
        },
        "failure_analysis": {
          "is_retryable": true,
          "failure_type": "temporary",
          "suggested_next_action": "retry_same"
        }
      },
      {
        "attempt_id": "mcp-xxx-2",
        "attempt_number": 2,
        "timestamp": "2026-01-05T10:30:07Z",
        "decision": {
          "solution_num": 8,
          "tool_name": "web_search",
          "action_name": "searchWithSummary",
          "reasoning": "网络超时，重试同方案",
          "strategy": "retry"
        },
        "params": {
          "account_id": "insurance-account",
          "query": "保险行业资讯"
        },
        "result": {
          "status": "success",
          "data": {
            "query": "保险行业资讯",
            "total_results": 89,
            "results": [ ... ],
            "summary": "搜索成功完成..."
          },
          "execution_time": 2800
        }
      }
    ],
    "execution_summary": {
      "total_mcp_attempts": 2,
      "successful_mcp_attempts": 1,
      "failed_mcp_attempts": 1,
      "total_user_interactions": 0,
      "start_time": "2026-01-05T10:30:00Z",
      "end_time": "2026-01-05T10:30:10Z",
      "total_duration": 10000
    }
  }
}
```

**验证点清单**：
- ✅ `agent_sub_tasks_step_history` 记录数 = 2
- ✅ 第2条 `interact_content.response.mcp_attempts.length` = 2
- ✅ 第2条 `interact_content.response.mcp_attempts[0].result.status` = "failed"
- ✅ 第2条 `interact_content.response.mcp_attempts[0].failure_analysis` 存在
- ✅ 第2条 `interact_content.response.mcp_attempts[1].result.status` = "success"
- ✅ 第2条 `interact_content.response.mcp_attempts[1].decision.strategy` = "retry"
- ✅ 第2条 `interact_content.response.execution_summary.total_mcp_attempts` = 2
- ✅ 第2条 `interact_content.response.execution_summary.successful_mcp_attempts` = 1
- ✅ 第2条 `interact_content.response.decision.type` = "COMPLETE"

---

#### TC-06：MCP多次失败最终失败

**测试目标**：验证 MCP 重试限制机制

**业务场景**：
1. MCP 连续 3 次调用失败
2. 达到 MAX_MCP_ATTEMPTS 限制
3. Agent B 判定失败

**预期结果（完整说明）**：

**数据库记录预期**：
- ✅ `agent_sub_tasks_step_history` 表中应有 **2 条记录**
  - 第1条：`interact_type = "request"` - 执行Agent初始请求
  - 第2条：`interact_type = "response"` - Agent B返回3次失败+最终失败决策

**interact_content 预期结构**：

**第2条记录（3次失败+最终失败 response）**：
```json
{
  "interact_type": "response",
  "consultant": "insurance-d",
  "responder": "agent B",
  "question": { ... },
  "response": {
    "decision": {
      "type": "FAILED",
      "reason_code": "MAX_RETRY_EXCEEDED",
      "reasoning": "MCP连续3次调用失败，达到最大重试限制",
      "final_conclusion": "任务失败：多次尝试后仍无法完成，请稍后重试或联系支持"
    },
    "mcp_attempts": [
      {
        "attempt_id": "mcp-xxx-1",
        "attempt_number": 1,
        "timestamp": "2026-01-05T10:35:00Z",
        "decision": {
          "solution_num": 21,
          "tool_name": "wechat_mp",
          "action_name": "addDraft",
          "reasoning": "首次尝试上传",
          "strategy": "initial"
        },
        "params": { ... },
        "result": {
          "status": "failed",
          "error": {
            "code": "API_ERROR",
            "message": "微信API服务暂时不可用",
            "type": "unknown"
          },
          "execution_time": 3200
        },
        "failure_analysis": {
          "is_retryable": true,
          "failure_type": "temporary",
          "suggested_next_action": "retry_same"
        }
      },
      {
        "attempt_id": "mcp-xxx-2",
        "attempt_number": 2,
        "timestamp": "2026-01-05T10:35:05Z",
        "decision": {
          "solution_num": 21,
          "tool_name": "wechat_mp",
          "action_name": "addDraft",
          "reasoning": "API服务不可用，重试",
          "strategy": "retry"
        },
        "params": { ... },
        "result": {
          "status": "failed",
          "error": {
            "code": "API_ERROR",
            "message": "微信API服务暂时不可用",
            "type": "unknown"
          },
          "execution_time": 3100
        },
        "failure_analysis": {
          "is_retryable": true,
          "failure_type": "temporary",
          "suggested_next_action": "retry_same"
        }
      },
      {
        "attempt_id": "mcp-xxx-3",
        "attempt_number": 3,
        "timestamp": "2026-01-05T10:35:10Z",
        "decision": {
          "solution_num": 21,
          "tool_name": "wechat_mp",
          "action_name": "addDraft",
          "reasoning": "最后一次重试",
          "strategy": "retry"
        },
        "params": { ... },
        "result": {
          "status": "failed",
          "error": {
            "code": "API_ERROR",
            "message": "微信API服务暂时不可用",
            "type": "unknown"
          },
          "execution_time": 3000
        },
        "failure_analysis": {
          "is_retryable": false,
          "failure_type": "resource_unavailable",
          "suggested_next_action": "switch_method"
        }
      }
    ],
    "execution_summary": {
      "total_mcp_attempts": 3,
      "successful_mcp_attempts": 0,
      "failed_mcp_attempts": 3,
      "total_user_interactions": 0,
      "start_time": "2026-01-05T10:35:00Z",
      "end_time": "2026-01-05T10:35:15Z",
      "total_duration": 15000
    },
    "failed_details": {
      "error_type": "MAX_RETRY_EXCEEDED",
      "error_message": "MCP连续3次调用失败，达到最大重试限制",
      "recoverable": false,
      "suggested_fix": "请稍后重试，或检查微信API服务状态"
    }
  }
}
```

**验证点清单**：
- ✅ `agent_sub_tasks_step_history` 记录数 = 2
- ✅ 第2条 `interact_content.response.mcp_attempts.length` = 3
- ✅ 第2条 `interact_content.response.mcp_attempts[0].result.status` = "failed"
- ✅ 第2条 `interact_content.response.mcp_attempts[1].result.status` = "failed"
- ✅ 第2条 `interact_content.response.mcp_attempts[2].result.status` = "failed"
- ✅ 第2条 `interact_content.response.decision.type` = "FAILED"
- ✅ 第2条 `interact_content.response.decision.reason_code` = "MAX_RETRY_EXCEEDED"
- ✅ 第2条 `interact_content.response.failed_details` 存在
- ✅ 第2条 `interact_content.response.execution_summary.total_mcp_attempts` = 3
- ✅ 第2条 `interact_content.response.execution_summary.successful_mcp_attempts` = 0

---

#### TC-07：达到最大迭代次数

**测试目标**：验证最大迭代次数限制

**业务场景**：
1. Agent B 循环决策 5 次
2. 达到 MAX_ITERATIONS 限制
3. 强制终止

**预期结果（完整说明）**：

**数据库记录预期**：
- ✅ `agent_sub_tasks_step_history` 表中应有 **6 条记录**（5次迭代+1次最终终止）
  - 第1-5条：每次迭代的 request/response 对
  - 第6条：最终终止的 response

**interact_content 预期结构**（最后一条终止记录）：

```json
{
  "interact_type": "response",
  "consultant": "insurance-d",
  "responder": "agent B",
  "question": { ... },
  "response": {
    "decision": {
      "type": "FAILED",
      "reason_code": "MAX_ITERATIONS_EXCEEDED",
      "reasoning": "已达到最大迭代次数限制(5次)，任务强制终止",
      "final_conclusion": "任务失败：多次迭代后仍无法完成，请重新梳理任务需求"
    },
    "mcp_attempts": [
      // 5次迭代中的所有MCP尝试记录
      {
        "attempt_id": "mcp-iter1-1",
        "attempt_number": 1,
        "timestamp": "2026-01-05T10:40:00Z",
        "decision": { ... },
        "params": { ... },
        "result": { ... }
      }
      // ... 更多尝试
    ],
    "execution_summary": {
      "total_mcp_attempts": 8,
      "successful_mcp_attempts": 3,
      "failed_mcp_attempts": 5,
      "total_user_interactions": 0,
      "start_time": "2026-01-05T10:40:00Z",
      "end_time": "2026-01-05T10:55:00Z",
      "total_duration": 900000
    },
    "failed_details": {
      "error_type": "MAX_ITERATION",
      "error_message": "达到最大迭代次数限制(5次)",
      "recoverable": false,
      "suggested_fix": "建议重新梳理任务需求，拆分成更小的子任务"
    }
  }
}
```

**验证点清单**：
- ✅ `agent_sub_tasks_step_history` 记录数 ≥ 5
- ✅ 最后1条 `interact_content.response.decision.type` = "FAILED"
- ✅ 最后1条 `interact_content.response.decision.reason_code` = "MAX_ITERATIONS_EXCEEDED"
- ✅ 最后1条 `interact_content.response.execution_summary.total_mcp_attempts` ≥ 5
- ✅ 最后1条 `interact_content.response.failed_details` 存在
- ✅ 最后1条 `interact_content.response.failed_details.error_type` = "MAX_ITERATION"

---

#### TC-08：用户确认后继续执行

**测试目标**：验证用户交互确认机制

**业务场景**：
1. Agent B 输出 NEED_USER 决策
2. 等待用户确认关键字段
3. 用户确认后继续执行
4. 任务完成

**预期结果（完整说明）**：

**数据库记录预期**：
- ✅ `agent_sub_tasks_step_history` 表中应有 **4 条记录**
  - 第1条：`interact_type = "request"` - 执行Agent初始请求
  - 第2条：`interact_type = "response"` - Agent B返回 NEED_USER 决策
  - 第3条：`interact_type = "request"` - 用户确认提交
  - 第4条：`interact_type = "response"` - Agent B继续执行并完成

**interact_content 预期结构**：

**第2条记录（NEED_USER decision）**：
```json
{
  "interact_type": "response",
  "consultant": "insurance-d",
  "responder": "agent B",
  "question": { ... },
  "response": {
    "decision": {
      "type": "NEED_USER",
      "reason_code": "USER_CONFIRM",
      "reasoning": "需要用户确认关键字段后继续",
      "final_conclusion": "请确认以下信息后继续执行"
    },
    "pending_key_fields": [
      {
        "field_id": "article_title",
        "field_name": "文章标题",
        "field_type": "text",
        "description": "请确认公众号文章标题",
        "current_value": "初步拟定的标题",
        "validation_rules": {
          "required": true,
          "min": 5,
          "max": 64
        }
      },
      {
        "field_id": "publish_time",
        "field_name": "发布时间",
        "field_type": "select",
        "description": "请选择发布时间",
        "current_value": "immediate",
        "options": [
          { "value": "immediate", "label": "立即发布" },
          { "value": "schedule", "label": "定时发布" }
        ],
        "validation_rules": {
          "required": true
        }
      }
    ],
    "available_solutions": [
      {
        "solution_id": "v1",
        "label": "方案A：立即发布",
        "description": "选择立即发布到公众号",
        "pros": ["快速上线", "流程简单"],
        "cons": ["无法撤销"]
      },
      {
        "solution_id": "v2",
        "label": "方案B：存为草稿",
        "description": "先存为草稿，确认后再发布",
        "pros": ["可修改", "更安全"],
        "cons": ["多一步操作"]
      }
    ],
    "prompt_message": {
      "title": "请确认发布信息",
      "description": "请确认文章标题和发布方式，确认后将继续执行",
      "priority": "medium"
    },
    "mcp_attempts": [],
    "user_interactions": [],
    "execution_summary": {
      "total_mcp_attempts": 0,
      "successful_mcp_attempts": 0,
      "failed_mcp_attempts": 0
    }
  }
}
```

**第4条记录（用户确认后完成）**：
```json
{
  "interact_type": "response",
  "consultant": "insurance-d",
  "responder": "agent B",
  "question": { ... },
  "response": {
    "decision": {
      "type": "COMPLETE",
      "reason_code": "TASK_DONE",
      "reasoning": "用户已确认，继续执行并完成",
      "final_conclusion": "任务完成：已根据用户确认的信息执行"
    },
    "mcp_attempts": [
      {
        "attempt_id": "mcp-xxx",
        "attempt_number": 1,
        "timestamp": "2026-01-05T10:50:00Z",
        "decision": { ... },
        "params": { ... },
        "result": {
          "status": "success",
          "data": { ... },
          "execution_time": 2500
        }
      }
    ],
    "user_interactions": [
      {
        "interaction_id": "ui-xxx",
        "interaction_number": 1,
        "timestamp": "2026-01-05T10:48:00Z",
        "key_fields_confirmed": [
          {
            "field_id": "article_title",
            "field_name": "文章标题",
            "field_value": "最终确认的标题",
            "original_value": "初步拟定的标题",
            "is_modified": true
          },
          {
            "field_id": "publish_time",
            "field_name": "发布时间",
            "field_value": "immediate",
            "original_value": "immediate",
            "is_modified": false
          }
        ],
        "selected_solution": {
          "solution_id": "v1",
          "solution_label": "方案A：立即发布",
          "solution_description": "选择立即发布到公众号",
          "selected_at": "2026-01-05T10:48:00Z"
        },
        "user_comment": {
          "content": "确认无误，请执行",
          "input_at": "2026-01-05T10:48:00Z"
        },
        "user_info": {
          "user_id": "user-001",
          "user_name": "测试用户",
          "department": "保险事业部"
        },
        "submission": {
          "submitted_at": "2026-01-05T10:48:00Z",
          "status": "completed",
          "processing_time": 120000
        }
      }
    ],
    "execution_summary": {
      "total_mcp_attempts": 1,
      "successful_mcp_attempts": 1,
      "failed_mcp_attempts": 0,
      "total_user_interactions": 1,
      "start_time": "2026-01-05T10:45:00Z",
      "end_time": "2026-01-05T10:52:00Z",
      "total_duration": 420000
    }
  }
}
```

**验证点清单**：
- ✅ `agent_sub_tasks_step_history` 记录数 ≥ 4
- ✅ 第2条 `interact_content.response.decision.type` = "NEED_USER"
- ✅ 第2条 `interact_content.response.pending_key_fields` 数组不为空
- ✅ 第2条 `interact_content.response.available_solutions` 数组不为空
- ✅ 第4条 `interact_content.response.user_interactions.length` ≥ 1
- ✅ 第4条 `interact_content.response.user_interactions[0].key_fields_confirmed` 存在
- ✅ 第4条 `interact_content.response.user_interactions[0].selected_solution` 存在
- ✅ 第4条 `interact_content.response.decision.type` = "COMPLETE"
- ✅ 第4条 `interact_content.response.mcp_attempts.length` ≥ 1

---

#### TC-23：多次违规→多次整改→最终成功上传公众号

**测试目标**：验证多轮违规整改的完整业务流程

**业务场景**：
1. 第1次提交：内容违规 → Agent提示修改
2. 第2次提交：仍然违规 → Agent再次提示
3. 第3次提交：合规 → 审核通过 → 上传公众号

**预期结果（完整说明）**：

**数据库记录预期**：
- ✅ `agent_sub_tasks_step_history` 表中应有 **6 条记录**
  - 第1条：request - 第1次提交
  - 第2条：response - 第1次违规提示
  - 第3条：request - 第2次提交（整改后）
  - 第4条：response - 第2次违规提示
  - 第5条：request - 第3次提交（再次整改后）
  - 第6条：response - 审核通过+公众号上传

**interact_content 预期结构**：

**第2条记录（第1次违规提示）**：
```json
{
  "interact_type": "response",
  "consultant": "insurance-d",
  "responder": "agent B",
  "question": { ... },
  "response": {
    "decision": {
      "type": "PAUSE_WAITING_FIX",
      "reason_code": "CONTENT_VIOLATION",
      "reasoning": "第1次审核：发现多处违规",
      "final_conclusion": "请修改违规内容后重新提交（第1次提示）"
    },
    "violations": [
      {
        "rule_id": "RULE_001",
        "description": "夸大宣传",
        "location": "第1段",
        "severity": "high"
      },
      {
        "rule_id": "RULE_002",
        "description": "绝对化用语",
        "location": "标题",
        "severity": "medium"
      }
    ],
    "suggestions": [
      "建议修改标题，避免使用'最佳'、'第一'等绝对化用语",
      "建议调整第1段描述，确保宣传内容真实可信"
    ],
    "mcp_attempts": [
      {
        "attempt_id": "mcp-audit-1",
        "attempt_number": 1,
        "timestamp": "2026-01-05T11:00:00Z",
        "decision": {
          "solution_num": 15,
          "tool_name": "compliance_audit",
          "action_name": "checkContent",
          "reasoning": "第1次合规审核",
          "strategy": "initial"
        },
        "params": { ... },
        "result": {
          "status": "success",
          "data": {
            "is_compliant": false,
            "check_passed": false,
            "violations": [ ... ]
          },
          "execution_time": 1800
        }
      }
    ],
    "execution_summary": {
      "total_mcp_attempts": 1,
      "successful_mcp_attempts": 1,
      "failed_mcp_attempts": 0,
      "audit_round": 1
    }
  }
}
```

**第4条记录（第2次违规提示）**：
```json
{
  "interact_type": "response",
  "consultant": "insurance-d",
  "responder": "agent B",
  "question": { ... },
  "response": {
    "decision": {
      "type": "PAUSE_WAITING_FIX",
      "reason_code": "CONTENT_VIOLATION",
      "reasoning": "第2次审核：仍有违规项未修改",
      "final_conclusion": "请继续修改违规内容后重新提交（第2次提示）"
    },
    "violations": [
      {
        "rule_id": "RULE_003",
        "description": "敏感词汇",
        "location": "第3段",
        "severity": "high"
      }
    ],
    "suggestions": [
      "第3段仍有敏感词汇，请修改或删除",
      "上次修改的部分已合规，继续保持"
    ],
    "mcp_attempts": [
      {
        "attempt_id": "mcp-audit-2",
        "attempt_number": 2,
        "timestamp": "2026-01-05T11:05:00Z",
        "decision": {
          "solution_num": 15,
          "tool_name": "compliance_audit",
          "action_name": "checkContent",
          "reasoning": "第2次合规审核",
          "strategy": "retry"
        },
        "params": { ... },
        "result": {
          "status": "success",
          "data": {
            "is_compliant": false,
            "check_passed": false,
            "violations": [ ... ]
          },
          "execution_time": 1700
        }
      }
    ],
    "execution_summary": {
      "total_mcp_attempts": 2,
      "successful_mcp_attempts": 2,
      "failed_mcp_attempts": 0,
      "audit_round": 2
    }
  }
}
```

**第6条记录（审核通过+上传）**：
```json
{
  "interact_type": "response",
  "consultant": "insurance-d",
  "responder": "agent B",
  "question": { ... },
  "response": {
    "decision": {
      "type": "COMPLETE",
      "reason_code": "TASK_DONE",
      "reasoning": "第3次审核通过，执行公众号上传",
      "final_conclusion": "任务完成：经过3次审核，文章已合规并成功上传"
    },
    "mcp_attempts": [
      {
        "attempt_id": "mcp-audit-3",
        "attempt_number": 3,
        "timestamp": "2026-01-05T11:10:00Z",
        "decision": {
          "solution_num": 15,
          "tool_name": "compliance_audit",
          "action_name": "checkContent",
          "reasoning": "第3次合规审核",
          "strategy": "retry"
        },
        "params": { ... },
        "result": {
          "status": "success",
          "data": {
            "is_compliant": true,
            "check_passed": true,
            "violations": [],
            "audit_summary": "文章内容合规，所有违规项已修改"
          },
          "execution_time": 1600
        }
      },
      {
        "attempt_id": "mcp-upload-1",
        "attempt_number": 4,
        "timestamp": "2026-01-05T11:10:03Z",
        "decision": {
          "solution_num": 21,
          "tool_name": "wechat_mp",
          "action_name": "addDraft",
          "reasoning": "审核通过，执行公众号上传",
          "strategy": "initial"
        },
        "params": { ... },
        "result": {
          "status": "success",
          "data": {
            "media_id": "3344556677",
            "article_url": "https://mp.weixin.qq.com/..."
          },
          "execution_time": 2600
        }
      }
    ],
    "execution_summary": {
      "total_mcp_attempts": 4,
      "successful_mcp_attempts": 4,
      "failed_mcp_attempts": 0,
      "total_user_interactions": 2,
      "audit_rounds": 3,
      "start_time": "2026-01-05T11:00:00Z",
      "end_time": "2026-01-05T11:15:00Z",
      "total_duration": 900000
    }
  }
}
```

**验证点清单**：
- ✅ `agent_sub_tasks_step_history` 记录数 ≥ 6
- ✅ 第2条 `interact_content.response.decision.type` = "PAUSE_WAITING_FIX"
- ✅ 第2条 `interact_content.response.violations` 数组不为空
- ✅ 第4条 `interact_content.response.decision.type` = "PAUSE_WAITING_FIX"
- ✅ 第4条 `interact_content.response.violations` 数组不为空
- ✅ 第6条 `interact_content.response.decision.type` = "COMPLETE"
- ✅ 第6条 `interact_content.response.mcp_attempts.length` ≥ 2
- ✅ 第6条 `interact_content.response.mcp_attempts[0].tool_name` = "compliance_audit"
- ✅ 第6条 `interact_content.response.mcp_attempts[1].tool_name` = "wechat_mp"
- ✅ 第6条 `interact_content.response.execution_summary.audit_rounds` = 3

---

#### TC-24：合规通过-正常发布流程

**测试目标**：验证合规内容的完整正常发布流程

**业务场景**：
1. 内容合规
2. Agent 审核通过
3. 直接执行公众号发布流程
4. 成功上传公众号

**预期结果（完整说明）**：

**数据库记录预期**：
- ✅ `agent_sub_tasks_step_history` 表中应有 **2 条记录**
  - 第1条：`interact_type = "request"` - 执行Agent初始请求
  - 第2条：`interact_type = "response"` - Agent B审核通过+公众号上传

**interact_content 预期结构**：

**第2条记录（审核通过+上传 response）**：
```json
{
  "interact_type": "response",
  "consultant": "insurance-d",
  "responder": "agent B",
  "question": {
    "is_need_mcp": true,
    "problem": "需要审核并发布公众号文章",
    "capability_type": "compliance_and_publish",
    "execution_result": null,
    "is_task_down": false
  },
  "response": {
    "decision": {
      "type": "COMPLETE",
      "reason_code": "TASK_DONE",
      "reasoning": "内容合规，直接执行正常发布流程",
      "final_conclusion": "任务完成：文章合规，已成功上传至公众号"
    },
    "mcp_attempts": [
      {
        "attempt_id": "mcp-audit",
        "attempt_number": 1,
        "timestamp": "2026-01-05T11:20:00Z",
        "decision": {
          "solution_num": 15,
          "tool_name": "compliance_audit",
          "action_name": "checkContent",
          "reasoning": "执行合规审核",
          "strategy": "initial"
        },
        "params": {
          "account_id": "insurance-account",
          "content": "<h1>合规文章</h1><p>这是一篇完全合规的测试文章，没有任何违规内容。</p>"
        },
        "result": {
          "status": "success",
          "data": {
            "is_compliant": true,
            "check_passed": true,
            "violations": [],
            "audit_summary": "文章内容合规，未发现任何违规项"
          },
          "execution_time": 1500
        }
      },
      {
        "attempt_id": "mcp-upload",
        "attempt_number": 2,
        "timestamp": "2026-01-05T11:20:03Z",
        "decision": {
          "solution_num": 21,
          "tool_name": "wechat_mp",
          "action_name": "addDraft",
          "reasoning": "审核通过，执行公众号上传",
          "strategy": "initial"
        },
        "params": {
          "account_id": "insurance-account",
          "articles": [
            {
              "title": "合规测试文章",
              "author": "保险事业部",
              "content": "<h1>合规文章</h1><p>这是一篇完全合规的测试文章。</p>"
            }
          ]
        },
        "result": {
          "status": "success",
          "data": {
            "media_id": "5566778899",
            "article_url": "https://mp.weixin.qq.com/s/yyy",
            "draft_id": "draft_67890"
          },
          "execution_time": 2400
        }
      }
    ],
    "execution_summary": {
      "total_mcp_attempts": 2,
      "successful_mcp_attempts": 2,
      "failed_mcp_attempts": 0,
      "total_user_interactions": 0,
      "start_time": "2026-01-05T11:20:00Z",
      "end_time": "2026-01-05T11:20:08Z",
      "total_duration": 8000
    }
  }
}
```

**验证点清单**：
- ✅ `agent_sub_tasks_step_history` 记录数 = 2
- ✅ 第2条 `interact_content.response.decision.type` = "COMPLETE"
- ✅ 第2条 `interact_content.response.mcp_attempts.length` = 2
- ✅ 第2条 `interact_content.response.mcp_attempts[0].tool_name` = "compliance_audit"
- ✅ 第2条 `interact_content.response.mcp_attempts[0].result.data.is_compliant` = true
- ✅ 第2条 `interact_content.response.mcp_attempts[1].tool_name` = "wechat_mp"
- ✅ 第2条 `interact_content.response.mcp_attempts[1].result.status` = "success"
- ✅ 第2条 `interact_content.response.execution_summary.total_mcp_attempts` = 2

---

#### TC-25：合规不通过-提示修改后重试

**测试目标**：验证违规后提示修改再重试的流程

**业务场景**：
1. 内容违规
2. Agent 识别违规，提示具体修改建议
3. 用户根据提示修改
4. 修改后重新提交
5. 合规通过，成功上传

**预期结果（完整说明）**：

**数据库记录预期**：
- ✅ `agent_sub_tasks_step_history` 表中应有 **4 条记录**
  - 第1条：`interact_type = "request"` - 第1次提交
  - 第2条：`interact_type = "response"` - 违规提示+修改建议
  - 第3条：`interact_type = "request"` - 修改后重新提交
  - 第4条：`interact_type = "response"` - 审核通过+公众号上传

**interact_content 预期结构**：

**第2条记录（违规提示+修改建议）**：
```json
{
  "interact_type": "response",
  "consultant": "insurance-d",
  "responder": "agent B",
  "question": { ... },
  "response": {
    "decision": {
      "type": "PAUSE_WAITING_FIX",
      "reason_code": "CONTENT_VIOLATION",
      "reasoning": "内容存在违规，已生成具体修改建议",
      "final_conclusion": "请根据以下建议修改后重新提交"
    },
    "violations": [
      {
        "rule_id": "RULE_004",
        "description": "虚假承诺",
        "location": "第2段第5行",
        "severity": "high",
        "original_text": "保证100%赔付",
        "suggested_replacement": "按合同约定赔付"
      },
      {
        "rule_id": "RULE_005",
        "description": "误导性表述",
        "location": "第3段",
        "severity": "medium",
        "original_text": "收益率最高",
        "suggested_replacement": "收益率处于行业中等水平"
      }
    ],
    "suggestions": [
      "建议将第2段'保证100%赔付'修改为'按合同约定赔付'",
      "建议将第3段'收益率最高'修改为'收益率处于行业中等水平'",
      "修改完成后请重新提交审核"
    ],
    "mcp_attempts": [
      {
        "attempt_id": "mcp-audit-1",
        "attempt_number": 1,
        "timestamp": "2026-01-05T11:30:00Z",
        "decision": {
          "solution_num": 15,
          "tool_name": "compliance_audit",
          "action_name": "checkContent",
          "reasoning": "执行合规审核，发现违规项",
          "strategy": "initial"
        },
        "params": { ... },
        "result": {
          "status": "success",
          "data": {
            "is_compliant": false,
            "check_passed": false,
            "violations": [ ... ],
            "audit_summary": "发现2处违规，已提供具体修改建议"
          },
          "execution_time": 1900
        }
      }
    ],
    "execution_summary": {
      "total_mcp_attempts": 1,
      "successful_mcp_attempts": 1,
      "failed_mcp_attempts": 0,
      "has_modification_suggestions": true
    }
  }
}
```

**第4条记录（审核通过+上传）**：
```json
{
  "interact_type": "response",
  "consultant": "insurance-d",
  "responder": "agent B",
  "question": { ... },
  "response": {
    "decision": {
      "type": "COMPLETE",
      "reason_code": "TASK_DONE",
      "reasoning": "用户已根据建议修改，审核通过",
      "final_conclusion": "任务完成：修改后合规，已成功上传公众号"
    },
    "mcp_attempts": [
      {
        "attempt_id": "mcp-audit-2",
        "attempt_number": 2,
        "timestamp": "2026-01-05T11:35:00Z",
        "decision": {
          "solution_num": 15,
          "tool_name": "compliance_audit",
          "action_name": "checkContent",
          "reasoning": "用户修改后重新审核",
          "strategy": "retry"
        },
        "params": { ... },
        "result": {
          "status": "success",
          "data": {
            "is_compliant": true,
            "check_passed": true,
            "violations": [],
            "audit_summary": "所有违规项已按建议修改，文章合规"
          },
          "execution_time": 1600
        }
      },
      {
        "attempt_id": "mcp-upload",
        "attempt_number": 3,
        "timestamp": "2026-01-05T11:35:03Z",
        "decision": {
          "solution_num": 21,
          "tool_name": "wechat_mp",
          "action_name": "addDraft",
          "reasoning": "审核通过，执行公众号上传",
          "strategy": "initial"
        },
        "params": { ... },
        "result": {
          "status": "success",
          "data": {
            "media_id": "7788990011",
            "article_url": "https://mp.weixin.qq.com/s/zzz"
          },
          "execution_time": 2500
        }
      }
    ],
    "execution_summary": {
      "total_mcp_attempts": 3,
      "successful_mcp_attempts": 3,
      "failed_mcp_attempts": 0,
      "total_user_interactions": 1,
      "modifications_made": true,
      "start_time": "2026-01-05T11:30:00Z",
      "end_time": "2026-01-05T11:36:00Z",
      "total_duration": 360000
    }
  }
}
```

**验证点清单**：
- ✅ `agent_sub_tasks_step_history` 记录数 ≥ 4
- ✅ 第2条 `interact_content.response.decision.type` = "PAUSE_WAITING_FIX"
- ✅ 第2条 `interact_content.response.violations[0].suggested_replacement` 存在（有具体修改建议）
- ✅ 第2条 `interact_content.response.suggestions` 数组不为空
- ✅ 第4条 `interact_content.response.decision.type` = "COMPLETE"
- ✅ 第4条 `interact_content.response.mcp_attempts.length` ≥ 2
- ✅ 第4条 `interact_content.response.mcp_attempts[0].result.data.is_compliant` = true
- ✅ 第4条 `interact_content.response.mcp_attempts[1].tool_name` = "wechat_mp"
- ✅ 第4条 `interact_content.response.execution_summary.modifications_made` = true


---

## 3️⃣ 测试执行说明

### 3.1 快速开始（3步完成）

#### 步骤 1：清理历史数据

```bash
curl -X POST 'http://localhost:5000/api/test/cleanup-data' \
  -H "Content-Type: application/json" \
  -d '{"tables":["agent_sub_tasks","agent_sub_tasks_step_history","daily_task"]}'
```

**预期结果**：
```json
{
  "success": true,
  "cleanupSummary": {
    "agent_sub_tasks": 5,
    "agent_sub_tasks_step_history": 15,
    "daily_task": 2
  }
}
```

---

#### 步骤 2：执行全部测试

```bash
curl 'http://localhost:5000/api/test/run-all-tests?suite=full&validation=true'
```

**参数说明**：
- `suite=full` - 执行全部13个测试
- `validation=true` - 同时验证数据库数据完整性

**预期结果**：
```json
{
  "success": true,
  "suite": "full",
  "testGroupId": "84e89eb4-0a64-4337-959a-d38e8bfc3bbd",
  "summary": {
    "total": 13,
    "completed": 11,
    "failed": 1,
    "waitingUser": 1
  },
  "queryEndpoint": "/api/test/run-all-tests?query=true&testGroupId=84e89eb4..."
}
```

---

#### 步骤 3：查询详细结果

使用步骤 2 返回的 `testGroupId` 查询详细结果：

```bash
curl 'http://localhost:5000/api/test/run-all-tests?query=true&testGroupId=<testGroupId>'
```

**预期结果**：
```json
{
  "success": true,
  "testGroupId": "84e89eb4-0a64-4337-959a-d38e8bfc3bbd",
  "results": [
    {
      "testCaseId": "TC-01A",
      "name": "初始不合规→整改→成功上传公众号",
      "status": "completed",
      "validation": {
        "interact_content": "valid",
        "step_history": "valid"
      }
    },
    // ... 其他12个测试案例
  ],
  "summary": {
    "total": 13,
    "passed": 12,
    "failed": 1
  }
}
```

---

### 3.2 分步执行（按需选择）

#### 只执行基础功能测试（6个）

```bash
curl 'http://localhost:5000/api/test/run-all-tests?suite=basic'
```

包含：TC-01A, TC-01B, TC-01C, TC-02, TC-03, TC-04

---

#### 只执行复杂场景测试（7个）

```bash
curl 'http://localhost:5000/api/test/run-all-tests?suite=complex'
```

包含：TC-05, TC-06, TC-07, TC-08, TC-23, TC-24, TC-25

---

#### 执行单个测试案例

```bash
# 只执行 TC-23（多次违规整改）
curl 'http://localhost:5000/api/test/run-all-tests?testCase=TC-23'

# 只执行 TC-01A 和 TC-05
curl 'http://localhost:5000/api/test/run-all-tests?testCase=TC-01A,TC-05'
```

---

### 3.3 数据验证说明

当使用 `validation=true` 参数时，系统会自动验证：

| 表名 | 验证内容 |
|------|---------|
| `agent_sub_tasks` | 任务状态、execution_result 完整性 |
| `agent_sub_tasks_step_history` | interact_content 数据结构、mcp_attempts 完整性 |
| `daily_task` | 主任务记录完整性 |

**interact_content 验证清单**：

### 3.4 查看测试数据

测试执行后，可以通过以下 API 查看生成的数据：

#### 查看 interact_content 完整结构

```bash
curl 'http://localhost:5000/api/test/show-interact-content?commandResultId=<commandResultId>'
```

#### 查看 Agent 交互完整链路

```bash
curl 'http://localhost:5000/api/test/show-agent-interaction?commandResultId=<commandResultId>'
```

#### 查看 interact_content 详细说明

```bash
curl 'http://localhost:5000/api/test/detail-interact-content?commandResultId=<commandResultId>'
```

#### 查看完整 interact_content 示例

```bash
curl 'http://localhost:5000/api/test/full-interact-content?commandResultId=<commandResultId>'
```

---

## 📊 测试结果判定标准

| 状态 | 说明 |
|------|------|
| ✅ **completed** | 测试通过，所有验证点都符合预期 |
| ⏳ **waitingUser** | 测试通过，但需要用户交互（TC-08, TC-25） |
| ❌ **failed** | 测试失败，需要排查问题 |

---

## 🔍 常见问题排查

### Q: 测试返回 "waitingUser" 状态怎么办？

**A**: 这是正常的！TC-08 和 TC-25 需要用户交互，可以通过以下方式继续：
```bash
# 查询等待用户确认的任务
curl 'http://localhost:5000/api/test/pending-user-tasks'

# 模拟用户确认
curl -X POST 'http://localhost:5000/api/test/simulate-user-confirm' \
  -H "Content-Type: application/json" \
  -d '{"taskId":"<taskId>","confirmed":true}'
```

---

### Q: 如何查看具体哪个验证点失败了？

**A**: 使用查询接口获取详细结果：
```bash
curl 'http://localhost:5000/api/test/run-all-tests?query=true&testGroupId=<testGroupId>&details=true'
```

---

### Q: 测试数据会影响正式数据吗？

**A**: 不会！测试数据都有特殊标记（`is_test=true`），可以安全清理：
```bash
curl -X POST 'http://localhost:5000/api/test/cleanup-data' \
  -H "Content-Type: application/json" \
  -d '{"tables":["agent_sub_tasks","agent_sub_tasks_step_history"],"onlyTestData":true}'
```

---

## 3️⃣ 第二部分：f1bafc6 新功能测试案例详情（v2.0，8个案例）

### 表结构说明


**核心字段**：
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | bigserial | 主键 |
| `step_history_id` | bigint | 关联的 agent_sub_tasks_step_history 记录 ID |
| `mcp_server_name` | text | MCP 服务器名称（如 "mcp_compliance_check"） |
| `tool_name` | text | 工具名称（如 "check_compliance"） |
| `tool_args` | jsonb | 工具调用参数（JSON 格式） |
| `result` | jsonb | 工具执行结果（JSON 格式） |
| `start_time` | timestamptz | 执行开始时间 |
| `end_time` | timestamptz | 执行结束时间 |
| `success` | boolean | 是否执行成功 |
| `error_message` | text | 错误信息（如有） |
| `created_at` | timestamptz | 创建时间 |

### 迁移与验证 API

**执行迁移**：
```bash
curl 'http://localhost:5000/api/test/migrate-mcp-full-results'
```

**验证新表**：
```bash
curl 'http://localhost:5000/api/test/verify-mcp-full-results'
```

### 验证要求

**每个涉及 MCP 调用的测试案例都应验证**：
2. ✅ 记录与 `agent_sub_tasks_step_history` 表正确关联
3. ✅ 所有必填字段（`step_history_id`, `mcp_server_name`, `tool_name`）都存在
4. ✅ `tool_args` 和 `result` 是有效的 JSON 格式
5. ✅ 执行时间戳合理

---

---

## 3️⃣ 第二部分：f1bafc6 新功能测试案例详情（v2.0，8个案例）

### 3.1 MCP 执行审计表测试（4个案例）

#### TC-MCP-01：MCP执行审计表-基础写入验证

**测试目标**：验证 agent_sub_tasks_mcp_executions 表能正确记录 MCP 执行信息

**业务场景**：
1. 执行任意 MCP 调用
2. 验证新表能正确记录基础信息

**预期结果**：

**数据库记录预期（agent_sub_tasks_mcp_executions 表）**：
- ✅ 有对应 step_history_id 的记录
- ✅ attempt_id 字段存在且唯一
- ✅ attempt_number 字段存在（从1开始）
- ✅ tool_name 和 action_name 字段正确记录
- ✅ strategy 字段为 "initial"（首次尝试）
- ✅ result_status 为 "success" 或 "failed"
- ✅ execution_time_ms 字段记录执行耗时
- ✅ params 字段记录调用参数（JSON 格式）
- ✅ result_data 字段记录执行结果（JSON 格式）

**验证点清单**：
- ✅ `agent_sub_tasks_mcp_executions` 表中至少有 1 条记录
- ✅ 记录的 `step_history_id` 能关联到有效的 `agent_sub_tasks_step_history` 记录
- ✅ `attempt_id` 格式正确（如 "mcp-xxx-001"）
- ✅ `tool_name` 和 `action_name` 与实际调用一致
- ✅ `strategy` 字段值正确（initial/retry/switch_type/degrade）
- ✅ `result_status` 为 "in_process" / "success" / "failed" 之一
- ✅ `execution_time_ms` > 0

---

#### TC-MCP-02：MCP执行审计表-重试场景验证

**测试目标**：验证重试场景下的 strategy 字段（initial/retry）

**业务场景**：
1. 第一次 MCP 调用失败（strategy = "initial"）
2. Agent B 决策重试，第二次调用（strategy = "retry"）
3. 验证两次调用在新表中的记录

**预期结果**：

**agent_sub_tasks_mcp_executions 表预期**：
- ✅ 有 2 条记录，对应同一次 step_history_id
- ✅ 第1条记录：`attempt_number` = 1, `strategy` = "initial"
- ✅ 第2条记录：`attempt_number` = 2, `strategy` = "retry"
- ✅ 两条记录的 `tool_name` 和 `action_name` 相同

**验证点清单**：
- ✅ 同一 `step_history_id` 下有多条记录
- ✅ `attempt_number` 按顺序递增（1, 2, 3...）
- ✅ 首次尝试的 `strategy` = "initial"
- ✅ 重试尝试的 `strategy` = "retry"
- ✅ 所有记录的 `tool_name` 和 `action_name` 一致（重试相同方案）

---

#### TC-MCP-03：MCP执行审计表-失败分析验证

**测试目标**：验证失败时的 isRetryable/failure_type/suggested_next_action

**业务场景**：
1. MCP 调用失败
2. Agent B 分析失败原因，给出建议
3. 验证新表中的失败分析字段

**预期结果**：

**agent_sub_tasks_mcp_executions 表预期（失败记录）**：
- ✅ `result_status` = "failed"
- ✅ `error_code` 和 `error_message` 字段记录错误信息
- ✅ `error_type` 字段记录错误类型（如 "network" / "api" / "timeout"）
- ✅ `is_retryable` 字段为 true/false（Agent B 分析结果）
- ✅ `failure_type` 字段记录失败类型（如 "temporary" / "resource_unavailable"）
- ✅ `suggested_next_action` 字段记录建议（如 "retry_same" / "switch_method"）

**验证点清单**：
- ✅ 失败记录的 `result_status` = "failed"
- ✅ `error_code` 和 `error_message` 不为空
- ✅ `is_retryable` 是 boolean 类型
- ✅ `failure_type` 有值（如失败）
- ✅ `suggested_next_action` 有值（如失败）
- ✅ 这些字段与 `interact_content.response.mcp_attempts[].failure_analysis` 一致

---

#### TC-MCP-04：MCP执行审计表-两阶段流程验证

**测试目标**：验证合规检查+公众号上传在新表中的记录

**业务场景**：
1. 先执行合规检查（compliance_audit/checkContent）
2. 再执行公众号上传（wechat_mp/addDraft）
3. 验证两阶段在新表中的记录顺序

**预期结果**：

**agent_sub_tasks_mcp_executions 表预期**：
- ✅ 有 2 条记录（TC-01C 除外，只有 1 条）
- ✅ 第1条：`tool_name` = "compliance_audit", `action_name` = "checkContent"
- ✅ 第2条：`tool_name` = "wechat_mp", `action_name` = "addDraft"
- ✅ 合规检查记录在公众号上传记录之前（order_index 更小）
- ✅ 两条记录的 `command_result_id` 相同

**验证点清单**：
- ✅ `agent_sub_tasks_mcp_executions` 表中至少有 1 条记录
- ✅ 存在 `tool_name` = "compliance_audit" 的记录
- ✅ 存在 `tool_name` = "wechat_mp" 的记录（TC-01C 除外）
- ✅ 合规检查记录的 `order_index` < 公众号上传记录的 `order_index`
- ✅ 合规检查记录的 `result_data.is_compliant` = true 或 `check_passed` = true
- ✅ 公众号上传记录的 `result_status` = "success"

---

### 3.2 NEED_USER 决策流程测试（4个案例）

#### TC-NEED-01：NEED_USER-用户确认字段

**测试目标**：验证用户确认关键字段的完整流程

**业务场景**：
1. Agent B 输出 NEED_USER 决策
2. 任务状态变为 waiting_user
3. 用户确认关键字段（如发布时间）
4. 用户提交后任务继续执行
5. 任务完成

**预期结果**：

**数据库记录预期**：
- ✅ `agent_sub_tasks` 表：状态从 pending → in_progress → waiting_user → in_progress → completed
- ✅ `agent_sub_tasks_step_history` 表中应有 **4 条记录**：
  - 第1条：`interact_type` = "request" - 初始请求
  - 第2条：`interact_type` = "response" - Agent B 返回 NEED_USER 决策
  - 第3条：`interact_type` = "request" - 用户确认提交
  - 第4条：`interact_type` = "response" - Agent B 继续执行并完成

**interact_content 预期结构（第2条记录 - NEED_USER 决策）**：
```json
{
  "interact_type": "response",
  "consultant": "insurance-d",
  "responder": "agent B",
  "question": { ... },
  "response": {
    "decision": {
      "type": "NEED_USER",
      "reason_code": "PENDING_KEY_FIELDS",
      "reasoning": "需要用户确认关键字段",
      "final_conclusion": "请确认以下字段后继续"
    },
    "pendingKeyFields": [
      {
        "fieldId": "publish_time",
        "fieldName": "发布时间",
        "fieldType": "datetime",
        "description": "请选择文章发布时间",
        "currentValue": null,
        "validationRules": { "required": true }
      }
    ],
    "mcp_attempts": [],
    "execution_summary": { ... }
  }
}
```

**验证点清单**：
- ✅ `agent_sub_tasks.status` 经历 waiting_user 状态
- ✅ `agent_sub_tasks_step_history` 记录数 ≥ 4
- ✅ 第2条 `interact_content.response.decision.type` = "NEED_USER"
- ✅ 第2条 `interact_content.response.pendingKeyFields` 数组存在且不为空
- ✅ 第3条 `interact_type` = "request"（用户提交）
- ✅ 第4条 `interact_content.response.decision.type` = "COMPLETE"

---

#### TC-NEED-02：NEED_USER-用户选择方案

**测试目标**：验证用户选择可选方案的流程

**业务场景**：
1. Agent B 输出 NEED_USER 决策，包含多个可选方案
2. 用户选择其中一个方案
3. 任务按用户选择的方案继续执行
4. 任务完成

**预期结果**：

**agent_sub_tasks_step_history 表预期**：
- ✅ 第2条 `interact_content.response.decision.type` = "NEED_USER"
- ✅ 第2条 `interact_content.response.availableSolutions` 数组存在
- ✅ `availableSolutions` 中至少有 2 个方案
- ✅ 每个方案包含 `solutionId`、`label`、`description`
- ✅ 第3条记录用户选择了一个方案
- ✅ 第4条记录按选择的方案执行完成

**验证点清单**：
- ✅ `interact_content.response.availableSolutions` 数组存在
- ✅ 每个方案有 `solutionId`、`label`、`description`
- ✅ 用户交互记录中包含选择的方案 ID
- ✅ 最终执行使用了用户选择的方案

---

#### TC-NEED-03：NEED_USER-字段+方案混合

**测试目标**：验证字段确认和方案选择的混合场景

**业务场景**：
1. Agent B 输出 NEED_USER 决策
2. 既有关键字段需要确认，又有可选方案需要选择
3. 用户填写字段并选择方案
4. 任务继续执行并完成

**预期结果**：
- ✅ `pendingKeyFields` 和 `availableSolutions` 同时存在
- ✅ 用户既填写了字段，又选择了方案
- ✅ 任务按用户选择执行

---

#### TC-NEED-04：NEED_USER-字段验证失败

**测试目标**：验证必填字段未填写时的处理

**业务场景**：
1. Agent B 输出 NEED_USER 决策，要求必填字段
2. 用户未填写必填字段就提交
3. 系统提示验证失败
4. 用户重新填写并提交
5. 任务继续执行

**预期结果**：
- ✅ 第一次提交后返回验证错误
- ✅ 错误信息指出哪些字段未填写
- ✅ 任务状态保持 waiting_user
- ✅ 用户重新填写后能正常提交

---

## 📝 总结

本文档包含（v2.0）：
- ✅ **测试方案** - 测试目标、范围、环境要求
- ✅ **核心功能测试案例** - 13个案例的详细说明和验证点（v1.0）
- ✅ **f1bafc6 新功能测试案例** - 8个案例的详细说明（v2.0）
  - MCP 执行审计表测试（4个）
  - NEED_USER 决策流程测试（4个）
- ✅ **测试执行说明** - 3步快速开始、分步执行、数据验证
- ✅ **agent_sub_tasks_mcp_executions 表验证** - f1bafc6 新增审计表

**统一测试入口**：`/api/test/run-all-tests`

**测试套件选择**：
```bash
# 完整测试（21个案例）
curl 'http://localhost:5000/api/test/run-all-tests'

# 仅新功能测试（8个案例）
curl 'http://localhost:5000/api/test/run-all-tests?suite=new-feature'

# 仅 f1bafc6 版本
curl 'http://localhost:5000/api/test/run-all-tests?suite=f1bafc6'

# 仅重点案例
curl 'http://localhost:5000/api/test/run-all-tests?suite=priority'
```

**测试案例统计**：
- 核心功能测试（v1.0）：13个
- f1bafc6 新功能测试（v2.0）：8个
- **总计**：21个测试案例
curl -X POST 'http://localhost:5000/api/test/cleanup-data' \
  -H "Content-Type: application/json" \

# 2. 执行全部13个测试
curl 'http://localhost:5000/api/test/run-all-tests?suite=full&validation=true'
```

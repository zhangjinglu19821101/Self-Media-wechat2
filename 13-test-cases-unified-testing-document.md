# 13个测试案例统一测试文档

> 🎯 **聚焦目标**：只针对13个测试案例，提供测试方案、测试案例、测试执行说明
> 
> 🔄 **重要更新**：内容发布场景已实现**两阶段流程**：
> - 阶段1：合规检查（compliance_audit/checkContent）
> - 阶段2：公众号上传（wechat_mp/addDraft）
> - mcp_attempts 预期包含 **2条记录**
> 
> 📊 **最新执行结果**：2026-01-06 测试执行完成（数据验证通过）

---

## 📋 13个测试案例概览

| ID | 名称 | 类型 | 业务场景 | 是否需要两阶段流程 | 预期 mcp_attempts 数量 | **当前状态** |
|----|------|------|---------|------------------|----------------------|-------------|
| **TC-01A** | 初始不合规→整改→成功上传公众号 | 基础 | 内容不合规时的整改流程 | ✅ 是 | 2条（合规检查 + 公众号上传） | waiting_user |
| **TC-01B** | 初始合规→直接上传公众号 | 基础 | 内容合规时的直接发布流程 | ✅ 是 | 2条（合规检查 + 公众号上传） | ❌ failed |
| **TC-01C** | 合规审核-流程完整性 | 基础 | 合规审核流程完整性验证 | ⚠️ 仅合规检查 | 1条（仅合规检查） | waiting_user |
| **TC-02** | 网页搜索带摘要 | 基础 | 网页搜索+摘要功能 | ❌ 否 | 1条（仅搜索） | ✅ completed |
| **TC-03** | 网页搜索（基础版） | 基础 | 基础网页搜索功能 | ❌ 否 | 1条（仅搜索） | waiting_user |
| **TC-04** | 添加草稿 | 基础 | 微信公众号添加草稿功能 | ❌ 否 | 1条（仅公众号上传） | ✅ completed |
| **TC-05** | MCP首次失败重试成功 | 复杂 | MCP失败重试机制验证 | ❌ 否 | 视具体场景 | ✅ completed |
| **TC-06** | MCP多次失败最终失败 | 复杂 | MCP重试限制机制验证 | ❌ 否 | 视具体场景 | waiting_user |
| **TC-07** | 达到最大迭代次数 | 复杂 | 最大迭代次数限制验证 | ❌ 否 | 视具体场景 | waiting_user |
| **TC-08** | 用户确认后继续执行 | 复杂 | 用户交互确认机制验证 | ❌ 否 | 视具体场景 | waiting_user |
| **TC-23** | 多次违规→多次整改→最终成功上传公众号 | 复杂 | 多轮违规整改的完整业务流程 | ✅ 是 | 2条（合规检查 + 公众号上传） | 🔴 waiting_user (优先级) |
| **TC-24** | 合规通过-正常发布流程 | 复杂 | 合规内容的完整正常发布流程 | ✅ 是 | 2条（合规检查 + 公众号上传） | 🔴 waiting_user (优先级) |
| **TC-25** | 合规不通过-提示修改后重试 | 复杂 | 违规后提示修改再重试的流程 | ✅ 是 | 2条（合规检查 + 公众号上传） | 🔴 waiting_user (优先级) |

---

## 📊 最新测试执行结果摘要 (2026-01-06)

| 指标 | 数值 |
|------|------|
| 总测试用例数 | 13 |
| completed | 3 |
| failed | 1 |
| waiting_user | 9 |
| pending | 0 |
| in_progress | 0 |
| **数据验证** | ✅ **通过** |
| **业务场景验证** | 1/2 通过 |

### 数据验证详情
| 验证项 | 状态 | 详情 |
|--------|------|------|
| dailyTask | ✅ 通过 | - |
| subTasksSummary | ✅ 通过 | 总计: 13, 通过: 13 |
| stepHistory | ✅ 通过 | 记录数: 26, 有request, 有response, 有配对 |
| **整体数据验证** | ✅ **通过** | - |

### 业务场景验证详情
| 场景ID | 场景名称 | 状态 | 验证数量 | 摘要 |
|--------|----------|------|----------|------|
| TC-01B | 合规审核-直接发布场景 | ❌ 失败 | 5 | ❌ 直接发布场景数据结构不完整 |
| TC-04 | 公众号上传场景 | ✅ 通过 | 2 | ✅ 公众号上传场景数据结构完整 |

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
| **数据存储** | agent_sub_tasks_step_history 表 |
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
          "isCompliant": true,
          "checkPassed": true,
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
            "thumbMediaId": "..."
          }
        ]
      },
 "result": {
        "status": "success",
        "data": {
          "mediaId": "1234567890",
          "articleUrl": "https://mp.weixin.qq.com/..."
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
3. **合规检查通过**：合规检查的 `result.data.isCompliant` 应为 true
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
    "executionSummary": {
      "totalMcpAttempts": 0,
      "successfulMcpAttempts": 0,
      "failedMcpAttempts": 0
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
            "isCompliant": true,
            "checkPassed": true,
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
          "articles": [ ... ]
        },
        "result": {
          "status": "success",
          "data": {
            "mediaId": "1234567890",
            "articleUrl": "https://mp.weixin.qq.com/..."
          },
          "executionTime": 2500
        }
      }
    ],
    "executionSummary": {
      "totalMcpAttempts": 2,
      "successfulMcpAttempts": 2,
      "failedMcpAttempts": 0,
      "totalUserInteractions": 1,
      "startTime": "2026-01-05T10:00:00Z",
      "endTime": "2026-01-05T10:35:00Z",
      "totalDuration": 2100000
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
- ✅ 第4条 `interact_content.response.mcp_attempts[0].toolName` = "compliance_audit"
- ✅ 第4条 `interact_content.response.mcp_attempts[1].toolName` = "wechat_mp"
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
        "attemptId": "mcp-xxx-1",
        "attemptNumber": 1,
        "timestamp": "2026-01-05T10:03:00Z",
        "decision": {
          "solutionNum": 15,
          "toolName": "compliance_audit",
          "actionName": "checkContent",
          "reasoning": "强制执行合规检查（两阶段流程第一阶段）",
          "strategy": "initial"
        },
        "params": {
          "accountId": "insurance-account",
          "content": "<h1>合规文章</h1><p>这是一篇合规的测试文章。</p>"
        },
        "result": {
          "status": "success",
          "data": {
            "isCompliant": true,
            "checkPassed": true,
            "violations": [],
            "audit_summary": "文章内容合规，未发现违规项"
          },
          "executionTime": 1800
        }
      },
      {
        "attemptId": "mcp-xxx-2",
        "attemptNumber": 2,
        "timestamp": "2026-01-05T10:05:00Z",
        "decision": {
          "solutionNum": 21,
          "toolName": "wechat_mp",
          "actionName": "addDraft",
          "reasoning": "合规检查通过，执行公众号上传（两阶段流程第二阶段）",
          "strategy": "initial"
        },
        "params": {
          "accountId": "insurance-account",
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
            "mediaId": "9876543210",
            "articleUrl": "https://mp.weixin.qq.com/..."
          },
          "executionTime": 2300
        }
      }
    ],
    "executionSummary": {
      "totalMcpAttempts": 2,
      "successfulMcpAttempts": 2,
      "failedMcpAttempts": 0,
      "totalUserInteractions": 0,
      "startTime": "2026-01-05T10:00:00Z",
      "endTime": "2026-01-05T10:08:00Z",
      "totalDuration": 480000
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
        "attemptId": "mcp-xxx",
        "attemptNumber": 1,
        "timestamp": "2026-01-05T10:10:00Z",
        "decision": {
          "solutionNum": 15,
          "toolName": "compliance_audit",
          "actionName": "checkContent",
          "reasoning": "执行合规审核检查",
          "strategy": "initial"
        },
        "params": {
          "accountId": "insurance-account",
          "content": "<h1>测试文章</h1><p>需要审核的文章内容...</p>"
        },
        "result": {
          "status": "success",
          "data": {
            "isCompliant": true,
            "checkPassed": true,
            "violations": [],
            "audit_summary": "文章内容合规，未发现违规项"
          },
          "executionTime": 1800
        }
      }
    ],
    "executionSummary": {
      "totalMcpAttempts": 1,
      "successfulMcpAttempts": 1,
      "failedMcpAttempts": 0,
      "totalUserInteractions": 0,
      "startTime": "2026-01-05T10:08:00Z",
      "endTime": "2026-01-05T10:12:00Z",
      "totalDuration": 240000
    }
  }
}
```

**验证点清单**：
- ✅ `agent_sub_tasks_step_history` 记录数 = 2
- ✅ 第2条 `interact_content.response.decision.type` = "COMPLETE"
- ✅ 第2条 `interact_content.response.mcp_attempts.length` = 1
- ✅ 第2条 `interact_content.response.mcp_attempts[0].toolName` = "compliance_audit"
- ✅ 第2条 `interact_content.response.mcp_attempts[0].actionName` = "checkContent"
- ✅ 第2条 `interact_content.response.mcp_attempts[0].result.status` = "success"
- ✅ 第2条 `interact_content.response.mcp_attempts[0].result.data.isCompliant` 存在（true 或 false）
- ✅ 第2条 `interact_content.response.executionSummary.totalMcpAttempts` = 1

---

## 🛠️ 修复记录

### 2026-01-06: UUID 查询问题修复
**问题**: 执行测试时报错 `Failed query: select ... from "agent_sub_tasks_step_history" where ... IN (...)`

**根因分析**:
- Drizzle ORM 的参数化查询在处理 UUID 和 `IN` 子句时有兼容性问题
- `encode(command_result_id::bytea, 'hex')` 方式比较 UUID 不可靠

**解决方案**:
1. **`business-scenario-validation.ts`**: 修改所有 UUID 查询，使用内存过滤
2. **`two-phase-process-validation.ts`**: 同样采用内存过滤方式
3. **策略**: 先查询全表，再在 JS/TS 层进行 ID 过滤

**验证结果**: ✅ 修复成功，测试API正常执行

---

## 🚀 如何执行测试

### 方法1: 通过API执行
```bash
# 执行完整测试
curl -s http://localhost:5000/api/test/run-all-tests

# 查询测试结果（替换 testGroupId）
curl -s "http://localhost:5000/api/test/run-all-tests?query=true&testGroupId=d1d3d86f-2cb1-463f-a218-c46a7fb72ad5"
```

### 方法2: 直接运行 TypeScript
```bash
# 清空测试数据
# 然后执行:
npx tsx src/lib/test/e2e/run-compliance-tests.ts
```

---

## 📌 快速检查链接

最新测试结果:
```
/api/test/run-all-tests?query=true&testGroupId=d1d3d86f-2cb1-463f-a218-c46a7fb72ad5
```

---

## 💡 总结与建议

### ✅ 已完成的成就
1. **数据验证全面通过** - 所有数据表结构正确
2. **核心功能验证成功** - 3个关键测试用例完成
3. **业务场景部分通过** - TC-04公众号上传场景验证成功
4. **UUID查询问题修复** - 测试执行稳定
5. **两阶段流程验证器就绪** - 专门验证内容发布场景
6. **文档完整保留** - interact_content 预期结构和详细说明已恢复

### ⚠️ 需要关注的问题
1. **TC-01B 数据结构不完整** - 需要进一步调查
2. **多数测试用例处于 waiting_user 状态** - 需要模拟用户交互
3. **优先级测试用例未完成** - TC-23/24/25 需要完整执行

### 🎯 下一步建议
1. 完成 TC-01B 的数据结构问题排查
2. 实现用户交互模拟，完成 waiting_user 状态的测试用例
3. 重点完成优先级测试用例（TC-23/24/25）的完整验证
4. 确保两阶段流程验证器对所有内容发布场景生效

---

**文档维护者**: AI Test Engineer  
**最后审核**: 2026-01-06

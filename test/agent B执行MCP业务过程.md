# Agent B 执行 MCP 业务过程 - 完整测试报告

## 📋 报告概述

| 项目 | 内容 |
|------|------|
| **报告标题** | Agent B 执行 MCP 业务过程测试报告 |
| **测试范围** | 13个端到端测试案例 + f1bafc6 新功能 |
| **测试类型** | 端到端集成测试 |
| **测试日期** | 2026-03-08 |
| **测试环境** | 开发环境 |
| **报告版本** | v2.0 |
| **支持版本** | f1bafc6 (新增 MCP 执行审计表 + NEED_USER 流程) |

---

## 🆕 f1bafc6 版本新功能说明

### 新增功能一览

| 功能 | 描述 | 优先级 | 状态 |
|------|------|--------|------|
| **1. `agent_sub_tasks_mcp_executions` 表** | MCP 执行详细审计表 | 🔴 P0 | ✅ 已集成到测试 |
| **2. NEED_USER 决策用户处理** | 用户交互确认流程 | 🔴 P0 | ⏳ 待测试案例补充 |

### 1. agent_sub_tasks_mcp_executions 表（f1bafc6 新增）


**关键字段**：
- `step_history_id` - 关联 `agent_sub_tasks_step_history.id`
- `attempt_id` - MCP 尝试唯一标识
- `attempt_number` - 尝试次数（1, 2, 3...）
- `tool_name` / `action_name` - 工具和动作名称
- `strategy` - 策略类型（initial/retry/switch_type/degrade）
- `result_status` - 执行状态（in_process/success/failed）
- `is_retryable` - Agent B 分析：是否可重试
- `failure_type` - 失败类型
- `suggested_next_action` - Agent B 建议：retry_same/switch_method

**测试验证**：
- ✅ 已集成到 `business-scenario-validation.ts`
- ✅ 已集成到 `route.ts` 的数据完整性验证
- ✅ 容错处理：表不存在时也能通过验证

---

## 🎯 测试目标

验证 Agent B 在执行 MCP 业务过程中的核心功能：

1. ✅ 合规审核流程（初始不合规→整改→合规→发布）
2. ✅ 网页搜索功能（带摘要/基础版）
3. ✅ 微信公众号草稿添加
4. ✅ MCP失败重试机制
5. ✅ 最大迭代次数限制
6. ✅ 用户交互确认流程
7. ✅ interact_content 数据结构完整性
9. ✅ 两阶段流程（合规检查+公众号上传）

---

## 📊 测试案例清单

### 基础功能测试（6个）

| ID | 名称 | 优先级 | 状态 | 两阶段流程 |
|----|------|--------|------|-----------|
| **TC-01A** | 初始不合规→整改→成功上传公众号 | 🔴 P0 | ⏳ 待测试 | ✅ 是 |
| **TC-01B** | 初始合规→直接上传公众号 | 🔴 P0 | ⏳ 待测试 | ✅ 是 |
| **TC-01C** | 合规审核-流程完整性 | 🟡 P1 | ⏳ 待测试 | ⚠️ 仅合规 |
| **TC-02** | 网页搜索带摘要 | 🟡 P1 | ⏳ 待测试 | ❌ 否 |
| **TC-03** | 网页搜索（基础版） | 🟡 P1 | ⏳ 待测试 | ❌ 否 |
| **TC-04** | 添加草稿 | 🟡 P1 | ⏳ 待测试 | ❌ 否 |

### 复杂场景测试（7个）

| ID | 名称 | 优先级 | 状态 | 两阶段流程 |
|----|------|--------|------|-----------|
| **TC-05** | MCP首次失败重试成功 | 🟡 P1 | ⏳ 待测试 | ❌ 否 |
| **TC-06** | MCP多次失败最终失败 | 🟡 P1 | ⏳ 待测试 | ❌ 否 |
| **TC-07** | 达到最大迭代次数 | 🟢 P2 | ⏳ 待测试 | ❌ 否 |
| **TC-08** | 用户确认后继续执行 | 🟡 P1 | ⏳ 待测试 | ❌ 否 |
| **TC-23** | 多次违规→多次整改→最终成功上传公众号 | 🔴 P0 | ⏳ 待测试 | ✅ 是 |
| **TC-24** | 合规通过-正常发布流程 | 🔴 P0 | ⏳ 待测试 | ✅ 是 |
| **TC-25** | 合规不通过-提示修改后重试 | 🔴 P0 | ⏳ 待测试 | ✅ 是 |

---

## 🔄 两阶段流程详细说明

### 流程概述

对于**内容发布场景**（TC-01A/B, TC-23/24/25），系统已实现**两阶段流程**：

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

---

## 🧪 测试案例详情

### TC-01A：初始不合规→整改→成功上传公众号

**测试目标**：验证内容不合规时的整改流程

**业务场景**：
1. 初始内容违规（夸大宣传、绝对化用语）
2. Agent 识别违规，提示修改
3. 用户整改后重新提交
4. 合规审核通过，成功上传公众号

**预期结果**：
- `agent_sub_tasks_step_history` 表中应有 **≥ 4 条记录**
- 第2条 `interact_content.response.decision.type` = "PAUSE_WAITING_FIX"
- 第4条 `interact_content.response.decision.type` = "COMPLETE"
- 第4条 `interact_content.response.mcp_attempts.length` = 2

---

### TC-01B：初始合规→直接上传公众号

**测试目标**：验证内容合规时的直接发布流程

**业务场景**：
1. 初始内容合规
2. Agent 审核通过
3. 直接上传公众号

**预期结果**：
- `agent_sub_tasks_step_history` 表中应有 **2 条记录**
- `interact_content.response.mcp_attempts.length` = 2
- `interact_content.response.mcp_attempts[0].tool_name` = "compliance_audit"
- `interact_content.response.mcp_attempts[1].tool_name` = "wechat_mp"
- 合规检查在公众号上传之前

---

### TC-23：多次违规→多次整改→最终成功上传公众号

**测试目标**：验证多轮违规整改的完整业务流程

**业务场景**：
1. 第1次提交：内容违规
2. Agent 提示修改，用户整改
3. 第2次提交：仍有违规
4. Agent 再次提示修改，用户继续整改
5. 第3次提交：内容合规
6. 成功上传公众号

**优先级**：🔴 P0（重点）

---

### TC-24：合规通过-正常发布流程

**测试目标**：验证合规内容的完整正常发布流程

**业务场景**：
1. 提交合规内容
2. 合规审核通过
3. 直接上传公众号

**优先级**：🔴 P0（重点）

---

### TC-25：合规不通过-提示修改后重试

**测试目标**：验证违规后提示修改再重试的流程

**业务场景**：
1. 提交违规内容
2. 合规审核不通过，提示修改
3. 用户修改后重新提交
4. 合规审核通过，成功上传

**优先级**：🔴 P0（重点）

---

## 📋 数据完整性验证清单

### 1. daily_task 表验证

| 检查项 | 预期结果 | 状态 |
|---------|----------|------|
| 记录存在 | ✅ 应找到对应 testGroupId 的记录 | ⏳ |
| taskTitle 正确 | ✅ 应为"端到端统一测试-13个案例" | ⏳ |
| executionStatus 正确 | ✅ 应为 "completed" 或 "in_progress" | ⏳ |

### 2. agent_sub_tasks 表验证

| 检查项 | 预期结果 | 状态 |
|---------|----------|------|
| 记录数量正确 | ✅ 应为 13 条 | ⏳ |
| 状态正确 | ✅ 应为 completed/failed/waiting_user | ⏳ |
| metadata 包含 testCaseId | ✅ 每个子任务都应有 testCaseId | ⏳ |

### 3. agent_sub_tasks_step_history 表验证

| 检查项 | 预期结果 | 状态 |
|---------|----------|------|
| 记录数量足够 | ✅ 每个案例至少 2 条记录 | ⏳ |
| 有 request 记录 | ✅ 存在 interactType = "request" 的记录 | ⏳ |
| 有 response 记录 | ✅ 存在 interactType = "response" 的记录 | ⏳ |
| request/response 成对 | ✅ 同一 interactNum 下有 request 和 response | ⏳ |
| interact_content 结构完整 | ✅ 包含 question、response、decision 等 | ⏳ |


| 检查项 | 预期结果 | 状态 |
|---------|----------|------|
| stepHistoryId 关联正确 | ✅ 关联到有效的 agent_sub_tasks_step_history 记录 | ⏳ |
| mcpServerName 存在 | ✅ 记录 MCP 服务器名称 | ⏳ |
| toolName 存在 | ✅ 记录工具名称 | ⏳ |
| toolArgs 存在 | ✅ 记录工具调用参数（JSON） | ⏳ |
| result 存在 | ✅ 记录工具执行结果（JSON） | ⏳ |
| start_time / end_time 存在 | ✅ 记录执行时间戳 | ⏳ |
| success 字段正确 | ✅ 记录是否执行成功 | ⏳ |

### 5. agent_sub_tasks_mcp_executions 表验证（f1bafc6 新增）

| 检查项 | 预期结果 | 状态 |
|---------|----------|------|
| stepHistoryId 关联正确 | ✅ 关联到有效的 agent_sub_tasks_step_history 记录 | ⏳ |
| attemptId 存在 | ✅ MCP 尝试唯一标识 | ⏳ |
| attemptNumber 存在 | ✅ 尝试次数（1, 2, 3...） | ⏳ |
| toolName / actionName 存在 | ✅ 工具和动作名称 | ⏳ |
| strategy 存在 | ✅ 策略类型（initial/retry/switch_type/degrade） | ⏳ |
| resultStatus 存在 | ✅ 执行状态（in_process/success/failed） | ⏳ |
| isRetryable 存在 | ✅ Agent B 分析：是否可重试 | ⏳ |
| failureType 存在（如失败） | ✅ 失败类型 | ⏳ |
| suggestedNextAction 存在（如失败） | ✅ Agent B 建议：retry_same/switch_method | ⏳ |
| executionTimeMs 存在 | ✅ 执行耗时（毫秒） | ⏳ |

---

## 🚀 测试执行指南

### 前置条件

1. ✅ 数据库连接正常（PostgreSQL）
2. ✅ 服务运行在端口 5000
3. ✅ 所有 MCP 服务器可访问
4. ✅ 测试数据已清理（可选）

### 执行命令

#### 完整测试（13个案例）
```bash
curl 'http://localhost:5000/api/test/run-all-tests'
```

#### 仅重点案例（TC-23/24/25等）
```bash
# 注：需要在 route.ts 中配置套件选择功能
curl 'http://localhost:5000/api/test/run-all-tests?suite=priority'
```

#### 数据清理
```bash
curl 'http://localhost:5000/api/test/cleanup-data'
```

### 执行步骤

1. **环境检查**
   ```bash
   curl -I http://localhost:5000
   ```

2. **数据清理（可选）**
   ```bash
   curl 'http://localhost:5000/api/test/cleanup-data'
   ```

3. **执行测试**
   ```bash
   curl 'http://localhost:5000/api/test/run-all-tests'
   ```

4. **查看结果**
   - 检查控制台输出
   - 查询数据库验证数据
   - 使用 quickCheck 链接快速查询

---

## 📊 测试结果记录模板

### 测试执行概览

| 指标 | 值 |
|------|-----|
| 开始时间 | `YYYY-MM-DD HH:MM:SS` |
| 结束时间 | `YYYY-MM-DD HH:MM:SS` |
| 总耗时 | `X 分 Y 秒` |
| 总测试案例 | 13 |
| 通过 | `?` |
| 失败 | `?` |
| 待执行 | `?` |
| 通过率 | `?%` |

### 重点案例结果

| 测试案例 | 状态 | 耗时 | 备注 |
|----------|------|------|------|
| TC-01A | ⏳ | - | |
| TC-01B | ⏳ | - | |
| TC-23 | ⏳ | - | 🔴 重点 |
| TC-24 | ⏳ | - | 🔴 重点 |
| TC-25 | ⏳ | - | 🔴 重点 |

### 数据完整性验证结果

| 验证项 | 状态 | 详情 |
|--------|------|------|
| daily_task | ⏳ | |
| agent_sub_tasks | ⏳ | |
| agent_sub_tasks_step_history | ⏳ | |
| 两阶段流程验证 | ⏳ | |

---

## 🔍 问题排查指南

### 常见问题

#### 问题1：测试执行超时
**可能原因**：
- MCP 服务器响应慢
- 数据库查询慢
- 任务执行引擎卡住

**排查步骤**：
1. 检查 `/app/work/logs/bypass/app.log`
2. 检查数据库连接
3. 手动验证 MCP 服务器可用性

#### 问题2：数据验证失败
**可能原因**：
- 表结构变更
- 数据写入逻辑变更
- 验证逻辑过期

**排查步骤**：
1. 检查数据库表结构
2. 对比实际数据与预期结构
3. 更新验证逻辑

#### 问题3：两阶段流程验证失败
**可能原因**：
- 合规检查未执行
- 公众号上传未执行
- 顺序错误

**排查步骤**：
1. 查询 agent_sub_tasks_step_history 表
2. 检查 interact_content.response.mcp_attempts
3. 验证 tool_name 和 action_name

---

## 📝 附录

### A. 相关文档

| 文档名称 | 路径 | 说明 |
|---------|------|------|
| 13个测试案例统一测试文档 | `docs/13-test-cases-unified-testing-document.md` | 详细的测试案例说明 |
| 测试案例详细定义 | `src/lib/test/test-cases-detailed.ts` | 测试案例的 TypeScript 定义 |
| 业务场景验证 | `src/lib/test/business-scenario-validation.ts` | 业务场景验证逻辑 |
| 两阶段流程验证 | `src/lib/test/two-phase-process-validation.ts` | 两阶段流程专项验证 |

### B. 数据库表清单

| 表名 | 用途 |
|------|------|
| daily_task | 主任务表 |
| agent_sub_tasks | 子任务表 |
| agent_sub_tasks_step_history | 交互历史记录表 |

### C. 快速 SQL 查询

```sql
-- 查询测试组的所有子任务
SELECT * FROM agent_sub_tasks 
WHERE command_result_id = '${testGroupId}'
ORDER BY order_index;

-- 查询交互历史记录
SELECT * FROM agent_sub_tasks_step_history 
WHERE command_result_id = '${testGroupId}'
ORDER BY interact_time;

-- 查询 MCP 执行结果
JOIN agent_sub_tasks_step_history ash 
  ON mfr.step_history_id = ash.id
WHERE ash.command_result_id = '${testGroupId}';
```

---

## ✅ 总结

本报告提供了 Agent B 执行 MCP 业务过程的完整测试方案：

1. **13个测试案例** - 覆盖基础功能和复杂场景
2. **两阶段流程验证** - 确保合规检查在公众号上传之前
3. **数据完整性检查** - 4个核心表的数据验证
4. **详细的执行指南** - 包含前置条件、执行命令、排查指南

**下一步**：
- [ ] 执行完整测试
- [ ] 记录测试结果到本报告
- [ ] 分析失败案例并修复
- [ ] 回归测试验证

---

**报告生成时间**：2026-03-08  
**报告维护者**：测试团队  
**下次更新**：测试执行完成后

# 13个测试案例分析与 step-history 数据结构验证

---

## 📋 13个测试案例概览

| ID | 名称 | 类型 | 重点 | 业务场景 |
|----|------|------|------|---------|
| **1A** | TC-01A | 基础 | ❌ | 初始不合规→整改→成功上传公众号 |
| **1B** | TC-01B | 基础 | ❌ | 初始合规→直接上传公众号 |
| **1C** | TC-01C | 基础 | ❌ | 合规审核-流程完整性 |
| **2** | TC-02 | 基础 | ❌ | 网页搜索带摘要 |
| **3** | TC-03 | 基础 | ❌ | 网页搜索（基础版） |
| **4** | TC-04 | 基础 | ❌ | 添加草稿 |
| **5** | TC-05 | 复杂 | ❌ | MCP首次失败重试成功 |
| **6** | TC-06 | 复杂 | ❌ | MCP多次失败最终失败 |
| **7** | TC-07 | 复杂 | ❌ | 达到最大迭代次数 |
| **8** | TC-08 | 复杂 | ❌ | 用户确认后继续执行 |
| **23** | TC-23 | 复杂 | ✅ | 多次违规→多次整改→最终成功上传公众号 |
| **24** | TC-24 | 复杂 | ✅ | 合规通过-正常发布流程 |
| **25** | TC-25 | 复杂 | ✅ | 合规不通过-提示修改后重试 |

---

## 🔍 每个案例的业务场景分析

### 基础功能 (6个)

#### TC-01A: 初始不合规→整改→成功上传公众号
- **测试目标**: 验证内容不合规时的整改流程
- **关键场景**:
  1. 初始内容违规（夸大宣传、绝对化用语）
  2. Agent 识别违规，提示修改
  3. 用户整改后重新提交
  4. 合规审核通过，成功上传公众号
- **step-history 数据预期**:
  - 有多次交互（request/response 成对）
  - 有合规审核 decision
  - 有用户整改交互记录
  - 最终有公众号上传 mcp_attempts

#### TC-01B: 初始合规→直接上传公众号
- **测试目标**: 验证内容合规时的直接发布流程
- **关键场景**:
  1. 初始内容合规
  2. Agent 审核通过
  3. 直接上传公众号
- **step-history 数据预期**:
  - 有 request/response 成对
  - 有合规审核 decision (COMPLETE)
  - 有公众号上传 mcp_attempts

#### TC-01C: 合规审核-流程完整性
- **测试目标**: 验证合规审核流程的完整性
- **关键场景**:
  1. 提交内容审核
  2. Agent 执行完整审核流程
  3. 输出审核结果
- **step-history 数据预期**:
  - 有完整的 request/response 交互
  - 有合规审核 decision
  - 有 execution_summary

#### TC-02: 网页搜索带摘要
- **测试目标**: 验证网页搜索+摘要功能
- **关键场景**:
  1. 执行网页搜索
  2. 生成搜索摘要
- **step-history 数据预期**:
  - 有 search 类型的 mcp_attempts
  - decision 包含搜索相关 reasoning
  - result 包含搜索结果和摘要

#### TC-03: 网页搜索（基础版）
- **测试目标**: 验证基础网页搜索功能
- **关键场景**:
  1. 执行基础网页搜索
  2. 返回搜索结果
- **step-history 数据预期**:
  - 有 search 类型的 mcp_attempts
  - result 包含搜索结果（无摘要）

#### TC-04: 添加草稿
- **测试目标**: 验证微信公众号添加草稿功能
- **关键场景**:
  1. 准备文章内容
  2. 调用微信公众号添加草稿 API
- **step-history 数据预期**:
  - 有 wechat.add_draft 的 mcp_attempts
  - decision 包含公众号发布相关 reasoning
  - result 包含草稿添加结果

---

### 复杂场景 (7个，重点TC-23/24/25)

#### TC-05: MCP首次失败重试成功
- **测试目标**: 验证 MCP 失败重试机制
- **关键场景**:
  1. 第一次 MCP 调用失败
  2. Agent 自动重试
  3. 第二次调用成功
- **step-history 数据预期**:
  - mcp_attempts 数组有 2+ 条记录
  - 第一条: businessSuccess = false, hasError = true
  - 最后一条: businessSuccess = true
  - 有 attemptNumber 编号

#### TC-06: MCP多次失败最终失败
- **测试目标**: 验证 MCP 重试限制机制
- **关键场景**:
  1. 第一次 MCP 调用失败
  2. Agent 多次重试（达到最大重试次数）
  3. 最终放弃，返回失败
- **step-history 数据预期**:
  - mcp_attempts 数组有 N 条记录（N = 最大重试次数）
  - 所有记录: businessSuccess = false
  - decision.type = FAILED
  - 有 execution_summary 说明失败原因

#### TC-07: 达到最大迭代次数
- **测试目标**: 验证最大迭代次数限制
- **关键场景**:
  1. Agent 执行多轮迭代
  2. 达到最大迭代次数限制
  3. 停止执行
- **step-history 数据预期**:
  - 有多轮 step/interact 记录
  - 最后 decision 包含迭代终止原因
  - execution_summary 说明达到最大迭代

#### TC-08: 用户确认后继续执行
- **测试目标**: 验证用户交互确认机制
- **关键场景**:
  1. Agent 执行需要用户确认的操作
  2. 暂停等待用户确认
  3. 用户确认后继续执行
- **step-history 数据预期**:
  - decision.type = NEED_USER
  - 有用户交互记录 (interact_user = 用户)
  - 确认后继续执行的记录

---

### 【重点】业务流程测试案例 (3个)

#### TC-23: 多次违规→多次整改→最终成功上传公众号
- **测试目标**: 验证多轮违规整改的完整业务流程
- **关键场景**:
  1. 第1次内容违规 → Agent 提示修改
  2. 用户整改 → 第2次仍然违规 → Agent 再次提示
  3. 用户再次整改 → 第3次合规
  4. 成功上传公众号
- **step-history 数据预期**:
  - ✅ 有多轮 request/response 成对（至少3轮交互）
  - ✅ 有多次合规审核 decision
  - ✅ 前几次 decision 包含违规说明
  - ✅ 最后一次 decision = COMPLETE
  - ✅ 有用户整改交互记录
  - ✅ 有公众号上传 mcp_attempts
  - ✅ mcp_attempts 可能包含失败重试
  - ✅ 有完整的 execution_summary

#### TC-24: 合规通过-正常发布流程
- **测试目标**: 验证合规内容的完整正常发布流程
- **关键场景**:
  1. 内容合规 → Agent 审核通过
  2. 直接执行公众号发布流程
  3. 成功上传公众号
- **step-history 数据预期**:
  - ✅ 有 request/response 成对
  - ✅ 合规审核 decision = COMPLETE
  - ✅ 有公众号发布相关 mcp_attempts
  - ✅ mcp_attempts 业务成功
  - ✅ 有 execution_summary 说明发布成功

#### TC-25: 合规不通过-提示修改后重试
- **测试目标**: 验证违规后提示修改再重试的流程
- **关键场景**:
  1. 内容违规 → Agent 提示具体修改意见
  2. 用户根据提示修改
  3. 修改后合规 → 成功上传公众号
- **step-history 数据预期**:
  - ✅ 有2轮以上 request/response 成对
  - ✅ 第一次 decision 包含违规说明和修改建议
  - ✅ 有用户修改交互记录
  - ✅ 第二次 decision = COMPLETE
  - ✅ 有公众号上传 mcp_attempts
  - ✅ 有 execution_summary

---

## ✅ step-history 数据结构统一验证清单

### 基础数据结构检查（所有案例）

| 检查项 | 说明 | 必需 |
|-------|------|------|
| `command_result_id` | 关联 ID | ✅ |
| `step_no` | 步骤编号 | ✅ |
| `interact_num` | 交互编号 | ✅ |
| `interact_type` | 'request' 或 'response' | ✅ |
| `interact_user` | 交互用户 | ✅ |
| `interact_time` | 交互时间 | ✅ |
| `interact_content` | 交互内容 | ✅ |

### interact_content.response 数据结构检查

| 字段 | 说明 | 必需 |
|------|------|------|
| `decision` | 决策数据 | ✅ |
| `decision.type` | 决策类型 (COMPLETE/FAILED/NEED_USER) | ✅ |
| `decision.reasoning` | 推理过程 | ✅ |
| `mcp_attempts` | MCP 调用数组 | ✅（如有MCP调用） |
| `execution_summary` | 执行摘要 | ✅ |
| `user_interactions` | 用户交互数组 | ✅（如有用户交互） |

### mcp_attempts 单条记录数据结构

| 字段 | 说明 | 必需 |
|------|------|------|
| `attemptNumber` | 尝试编号 | ✅ |
| `decision.toolName` | 工具名称 | ✅ |
| `decision.actionName` | 动作名称 | ✅ |
| `decision.reasoning` | 调用推理 | ✅ |
| `result.data.success` | 业务是否成功 | ✅ |
| `result.data.error` | 错误信息（如失败） | ✅（如有错误） |
| `params` | 调用参数 | ✅ |
| `timestamp` | 调用时间 | ✅ |

---

## 🎯 分案例验证重点

### TC-05/TC-06 重试场景验证重点

1. ✅ mcp_attempts.length ≥ 2
2. ✅ 有 attemptNumber 递增
3. ✅ 前面的 attempt: result.data.success = false
4. ✅ 有 error 信息
5. ✅ (TC-05) 最后一条: result.data.success = true
6. ✅ (TC-06) 所有: result.data.success = false, decision.type = FAILED

### TC-08 用户确认场景验证重点

1. ✅ 有 decision.type = NEED_USER
2. ✅ 有用户交互记录 (interact_user = 用户)
3. ✅ 确认后有继续执行的记录

### TC-23/24/25 重点业务场景验证重点

#### TC-23: 多次违规→多次整改
1. ✅ interact_num ≥ 3（多轮交互）
2. ✅ 有多轮 request/response 成对
3. ✅ 前几次 decision 包含违规说明
4. ✅ 最后 decision.type = COMPLETE
5. ✅ 有用户整改的交互记录
6. ✅ 有公众号上传 mcp_attempts

#### TC-24: 合规正常发布
1. ✅ 有 request/response 成对
2. ✅ decision.type = COMPLETE
3. ✅ 有公众号发布 mcp_attempts
4. ✅ mcp_attempts 业务成功

#### TC-25: 违规→提示修改→重试
1. ✅ interact_num ≥ 2
2. ✅ 第一次 decision 包含违规说明和修改建议
3. ✅ 有用户修改的交互记录
4. ✅ 第二次 decision.type = COMPLETE
5. ✅ 有公众号上传 mcp_attempts

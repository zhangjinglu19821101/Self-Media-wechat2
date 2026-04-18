# Agent 任务执行测试指南

## 📋 概述

本文档提供了 Agent 任务执行与定时调度系统的测试指南，包括：
- 模拟数据测试（不修改数据库）
- 实际数据库操作测试（修改数据库）
- 测试结果验证

---

## 🔧 测试 API 列表

### 1. 模拟数据测试 API（推荐先运行）

**端点：** `POST /api/test/agent-task-execution`

**特点：**
- ✅ 不修改数据库
- ✅ 纯内存模拟
- ✅ 安全，可以多次运行
- ✅ 测试所有类型定义和辅助函数

**使用方法：**
```bash
curl -X POST http://localhost:5000/api/test/agent-task-execution
```

**测试内容：**
1. 创建初始 articleMetadata
2. 更新 articleMetadata - 步骤 1 进行中
3. 更新 articleMetadata - 步骤 1 成功
4. 更新 articleMetadata - 步骤 2 成功
5. 更新 articleMetadata - 步骤 8 完成（填充微信数据）
6. 创建 agent_sub_tasks_step_history 记录 - Agent 咨询
7. 创建 agent_sub_tasks_step_history 记录 - Agent 回应
8. 创建 agent_sub_tasks_step_history 记录 - 人工确认
9. 创建 agent_sub_tasks_step_history 记录 - 系统提示（超时）
10. 创建 agent_sub_tasks_step_history 记录 - Agent 总结（第5次交互）
11. 模拟交互次数递增逻辑

---

### 2. 实际数据库操作测试 API（需谨慎）

**端点：** `POST /api/test/agent-task-database`

**⚠️ 警告：**
- ❌ 这个 API 会**实际修改数据库**
- ✅ 建议先在测试环境运行
- ✅ 执行前务必备份数据库
- ✅ 测试完成后需要手动清理测试数据

**特点：**
- 实际创建 agent_sub_tasks 记录
- 实际更新 article_metadata 字段
- 实际创建 agent_sub_tasks_step_history 记录
- 实际测试交互次数递增逻辑
- 可以验证数据库字段值的更新

**使用方法：**
```bash
curl -X POST http://localhost:5000/api/test/agent-task-database
```

**测试内容：**
1. 实际创建 agent_sub_tasks 测试记录
2. 实际更新 article_metadata 字段 - 步骤 1 进行中
3. 实际更新 article_metadata 字段 - 步骤 1 成功
4. 实际创建 agent_sub_tasks_step_history 记录 - 第 1 次交互
5. 实际更新 agent_sub_tasks_step_history 记录 - 第 2 次交互
6. 查询验证数据

---

## 🚀 快速开始

### 步骤 1：运行模拟数据测试（推荐）

```bash
# 运行模拟数据测试
curl -X POST http://localhost:5000/api/test/agent-task-execution
```

**预期结果：**
- ✅ 所有 11 个测试通过
- ✅ 返回详细的测试结果
- ✅ 数据库**不会**被修改

---

### 步骤 2：运行实际数据库测试（可选）

**⚠️ 重要提醒：**
1. 先备份数据库
2. 确保在测试环境运行
3. 测试完成后记得清理测试数据

```bash
# 运行实际数据库测试
curl -X POST http://localhost:5000/api/test/agent-task-database
```

**预期结果：**
- ✅ 所有 6 个测试通过
- ✅ 实际创建数据库记录
- ✅ 实际更新数据库字段
- ✅ 返回详细的测试结果和测试数据 ID

---

## 📊 测试结果验证

### 验证 article_metadata 字段更新

```sql
-- 查询测试任务的 article_metadata
SELECT 
  id,
  command_result_id,
  status,
  article_metadata
FROM agent_sub_tasks
WHERE id = '<test_sub_task_id>';
```

**预期结果：**
- `article_metadata.current_step.step_status` 应该是 `'success'`
- `article_metadata.current_step.step_no` 应该是 `1`
- `article_metadata.article_basic.article_title` 应该包含测试标题

---

### 验证 agent_sub_tasks_step_history 记录

```sql
-- 查询测试任务的 step_history 记录
SELECT 
  id,
  command_result_id,
  step_no,
  interact_num,
  interact_user,
  interact_time,
  interact_content
FROM agent_sub_tasks_step_history
WHERE command_result_id = '<test_command_result_id>';
```

**预期结果：**
- 应该有 1 条记录
- `interact_num` 应该是 `2`
- `interact_content` 应该包含 Agent 回应的内容

---

## 🧹 清理测试数据

**⚠️ 仅在运行了实际数据库测试后需要执行！**

```sql
-- 删除测试的 step_history 记录
DELETE FROM agent_sub_tasks_step_history
WHERE command_result_id = '<test_command_result_id>';

-- 删除测试的 agent_sub_tasks 记录
DELETE FROM agent_sub_tasks
WHERE id = '<test_sub_task_id>';
```

---

## 📝 测试检查清单

### 模拟数据测试检查清单

- [ ] 运行 `curl -X POST http://localhost:5000/api/test/agent-task-execution`
- [ ] 确认返回 `success: true`
- [ ] 确认所有 11 个测试都通过
- [ ] 检查 articleMetadata 的更新逻辑是否正确
- [ ] 检查 InteractContent 的创建是否正确
- [ ] 检查交互次数递增逻辑是否正确

### 实际数据库测试检查清单

- [ ] 备份数据库
- [ ] 运行 `curl -X POST http://localhost:5000/api/test/agent-task-database`
- [ ] 确认返回 `success: true`
- [ ] 记录测试数据的 ID（`testSubTaskId` 和 `testCommandResultId`）
- [ ] 用 SQL 查询验证 agent_sub_tasks 记录是否创建成功
- [ ] 验证 article_metadata 字段是否正确更新
- [ ] 用 SQL 查询验证 agent_sub_tasks_step_history 记录是否创建成功
- [ ] 验证 interact_num 字段是否正确递增（从 1 到 2）
- [ ] 清理测试数据

---

## 🎯 重点关注字段

### agent_sub_tasks 表

| 字段 | 说明 | 预期值 |
|------|------|--------|
| `article_metadata` | 文章元数据（JSONB） | 包含 `article_basic`、`current_step`、`wechat_mp_core_data` |
| `article_metadata.current_step.step_status` | 当前步骤状态 | `'success'` |
| `article_metadata.current_step.step_no` | 当前步骤编号 | `1` |
| `status` | 任务状态 | `'completed'` |

### agent_sub_tasks_step_history 表

| 字段 | 说明 | 预期值 |
|------|------|--------|
| `interact_num` | 交互次数 | `2`（第 2 次交互） |
| `interact_content` | 交互内容（JSONB） | 包含 `interact_type`、`consultant`、`responder` 等 |
| `interact_content.interact_type` | 交互类型 | `'agent_response'` |

---

## 🐛 故障排查

### 问题 1：模拟测试返回错误

**可能原因：**
- TypeScript 类型错误
- 导入路径错误

**解决方法：**
1. 查看服务器日志
2. 检查文件是否存在
3. 检查导入路径是否正确

---

### 问题 2：数据库测试返回错误

**可能原因：**
- 数据库连接失败
- 表不存在（需要先运行数据库迁移）
- 字段不存在（需要先运行数据库迁移）

**解决方法：**
1. 先运行数据库迁移：`curl -X POST http://localhost:5000/api/db/add-agent-sub-task-step-history`
2. 检查数据库连接
3. 查看服务器日志

---

### 问题 3：interact_num 没有正确递增

**可能原因：**
- 唯一约束问题
- 更新逻辑错误

**解决方法：**
1. 检查 `idx_command_result_step_no` 唯一约束是否存在
2. 查看测试日志中的详细信息
3. 用 SQL 手动查询验证

---

## 📚 相关文档

- [Agent 任务执行与定时调度系统完整方案](./agent-task-execution-and-scheduling-system.md)
- [测试报告](../TEST-REPORT-agent-task-scheduling.md)

---

**文档版本：** v1.0  
**最后更新：** 2026-02-24

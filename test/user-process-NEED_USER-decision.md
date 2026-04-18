# Agent B NEED_USER 决策用户处理测试案例

## 📋 测试案例概述

本文档包含 Agent B NEED_USER 决策用户处理流程的完整测试案例。

**版本**: v1.0
**日期**: 2026-03-08
**状态**: 待执行

---

## 🧪 测试案例列表

### 测试案例 1: 基础流程测试 - 用户确认字段

**测试 ID**: TC-NEED_USER-001
**优先级**: P0 (高)
**类型**: 功能测试
**前置条件**: 系统正常运行

#### 测试步骤

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| 1 | 创建测试任务 | 任务创建成功，状态为 `in_progress` |
| 2 | Agent B 输出 NEED_USER 决策 | 任务状态更新为 `waiting_user` |
| 3 | 检查待办任务列表 | 任务出现在待办列表中 |
| 4 | 用户点击待办任务 | 打开用户交互对话框 |
| 5 | 用户填写待确认字段 | 字段验证通过 |
| 6 | 用户提交 | API 调用成功，任务状态更新为 `in_progress` |
| 7 | 验证数据 | 所有数据库表数据正确 |

#### 测试数据

**待确认字段**:
```json
{
  "pendingKeyFields": [
    {
      "fieldId": "publish_time",
      "fieldName": "发布时间",
      "fieldType": "datetime",
      "description": "请选择文章发布时间",
      "currentValue": null,
      "validationRules": { "required": true }
    }
  ]
}
```

**用户输入**:
```json
{
  "fieldValues": {
    "publish_time": "2026-03-09 09:00:00"
  },
  "notes": "用户选择了明早9点发布"
}
```

#### 预期数据库变化

**agent_sub_tasks 表**:
- 状态从 `in_progress` → `waiting_user` → `in_progress`
- updatedAt 被更新两次

**agent_sub_tasks_step_history 表**:
- 新增 2 条记录：
  1. Agent B 的 NEED_USER 决策 (interactUser = 'agent B')
  2. 用户的交互 (interactUser = 'human')

---

### 测试案例 2: 用户选择方案

**测试 ID**: TC-NEED_USER-002
**优先级**: P0 (高)
**类型**: 功能测试
**前置条件**: 系统正常运行

#### 测试步骤

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| 1 | 创建测试任务 | 任务创建成功，状态为 `in_progress` |
| 2 | Agent B 输出 NEED_USER 决策 | 任务状态更新为 `waiting_user` |
| 3 | 检查待办任务列表 | 任务出现在待办列表中，包含可选方案 |
| 4 | 用户点击待办任务 | 打开用户交互对话框，显示可选方案 |
| 5 | 用户选择一个方案 | 方案被选中 |
| 6 | 用户提交 | API 调用成功，任务状态更新为 `in_progress` |
| 7 | 验证数据 | 所有数据库表数据正确 |

#### 测试数据

**可选方案**:
```json
{
  "availableSolutions": [
    {
      "solutionId": "sol-1",
      "label": "立即发布",
      "description": "立即发布到公众号",
      "pros": ["时效性强"],
      "cons": ["可能错过最佳发布时间"]
    },
    {
      "solutionId": "sol-2",
      "label": "明天早上发布",
      "description": "明天早上9点发布",
      "pros": ["阅读量可能更高"],
      "cons": ["需要等待"]
    }
  ]
}
```

**用户选择**:
```json
{
  "selectedSolution": "sol-2",
  "notes": "用户选择了明天早上发布"
}
```

---

### 测试案例 3: 字段 + 方案混合

**测试 ID**: TC-NEED_USER-003
**优先级**: P1 (中)
**类型**: 功能测试
**前置条件**: 系统正常运行

#### 测试步骤

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| 1 | 创建测试任务 | 任务创建成功 |
| 2 | Agent B 输出 NEED_USER 决策 | 包含待确认字段和可选方案 |
| 3 | 用户填写字段并选择方案 | 两者都能正常操作 |
| 4 | 用户提交 | API 调用成功 |
| 5 | 验证数据 | 所有数据都被正确保存 |

#### 测试数据

**待确认字段 + 可选方案**:
```json
{
  "pendingKeyFields": [
    {
      "fieldId": "title",
      "fieldName": "文章标题",
      "fieldType": "text",
      "description": "请输入文章标题",
      "currentValue": null,
      "validationRules": { "required": true, "min": 5, "max": 50 }
    }
  ],
  "availableSolutions": [
    {
      "solutionId": "sol-1",
      "label": "快速发布",
      "description": "使用快速通道发布",
      "pros": ["速度快"],
      "cons": ["审核可能较严格"]
    },
    {
      "solutionId": "sol-2",
      "label": "标准发布",
      "description": "使用标准流程发布",
      "pros": ["审核通过率高"],
      "cons": ["速度较慢"]
    }
  ]
}
```

**用户输入**:
```json
{
  "fieldValues": {
    "title": "2026年保险产品全新升级"
  },
  "selectedSolution": "sol-1",
  "notes": "用户填写了标题并选择了快速发布"
}
```

---

### 测试案例 4: 字段验证 - 必填字段未填写

**测试 ID**: TC-NEED_USER-004
**优先级**: P1 (中)
**类型**: 边界测试
**前置条件**: 系统正常运行

#### 测试步骤

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| 1 | 创建测试任务 | 任务创建成功 |
| 2 | Agent B 输出 NEED_USER 决策 | 包含必填字段 |
| 3 | 用户不填写必填字段直接提交 | 显示验证错误，不提交 |
| 4 | 用户填写必填字段后提交 | 提交成功 |

#### 验证规则

```json
{
  "pendingKeyFields": [
    {
      "fieldId": "required_field",
      "fieldName": "必填字段",
      "fieldType": "text",
      "description": "这是一个必填字段",
      "currentValue": null,
      "validationRules": { "required": true }
    }
  ]
}
```

---

### 测试案例 5: 字段验证 - 数字范围

**测试 ID**: TC-NEED_USER-005
**优先级**: P2 (低)
**类型**: 边界测试
**前置条件**: 系统正常运行

#### 测试步骤

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| 1 | 创建测试任务 | 任务创建成功 |
| 2 | Agent B 输出 NEED_USER 决策 | 包含数字字段，范围 1-100 |
| 3 | 用户输入 0 | 显示验证错误 |
| 4 | 用户输入 101 | 显示验证错误 |
| 5 | 用户输入 50 | 验证通过 |

#### 验证规则

```json
{
  "pendingKeyFields": [
    {
      "fieldId": "age",
      "fieldName": "年龄",
      "fieldType": "number",
      "description": "请输入年龄 (1-100)",
      "currentValue": null,
      "validationRules": { "required": true, "min": 1, "max": 100 }
    }
  ]
}
```

---

### 测试案例 6: 多选字段

**测试 ID**: TC-NEED_USER-006
**优先级**: P2 (低)
**类型**: 功能测试
**前置条件**: 系统正常运行

#### 测试步骤

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| 1 | 创建测试任务 | 任务创建成功 |
| 2 | Agent B 输出 NEED_USER 决策 | 包含 select 类型字段 |
| 3 | 用户点击下拉框 | 显示所有选项 |
| 4 | 用户选择一个选项 | 选项被选中 |
| 5 | 用户提交 | 提交成功 |

#### 测试数据

```json
{
  "pendingKeyFields": [
    {
      "fieldId": "category",
      "fieldName": "文章分类",
      "fieldType": "select",
      "description": "请选择文章分类",
      "currentValue": null,
      "options": [
        { "value": "insurance", "label": "保险知识" },
        { "value": "product", "label": "产品介绍" },
        { "value": "news", "label": "公司新闻" }
      ],
      "validationRules": { "required": true }
    }
  ]
}
```

---

### 测试案例 7: 日期字段

**测试 ID**: TC-NEED_USER-007
**优先级**: P2 (低)
**类型**: 功能测试
**前置条件**: 系统正常运行

#### 测试步骤

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| 1 | 创建测试任务 | 任务创建成功 |
| 2 | Agent B 输出 NEED_USER 决策 | 包含 date 类型字段 |
| 3 | 用户选择日期 | 日期选择器正常工作 |
| 4 | 用户提交 | 提交成功 |

#### 测试数据

```json
{
  "pendingKeyFields": [
    {
      "fieldId": "publish_date",
      "fieldName": "发布日期",
      "fieldType": "date",
      "description": "请选择发布日期",
      "currentValue": null,
      "validationRules": { "required": true }
    }
  ]
}
```

---

### 测试案例 8: 布尔字段

**测试 ID**: TC-NEED_USER-008
**优先级**: P2 (低)
**类型**: 功能测试
**前置条件**: 系统正常运行

#### 测试步骤

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| 1 | 创建测试任务 | 任务创建成功 |
| 2 | Agent B 输出 NEED_USER 决策 | 包含 boolean 类型字段 |
| 3 | 用户勾选复选框 | 复选框状态改变 |
| 4 | 用户提交 | 提交成功 |

#### 测试数据

```json
{
  "pendingKeyFields": [
    {
      "fieldId": "is_important",
      "fieldName": "是否重要",
      "fieldType": "boolean",
      "description": "请标记是否为重要文章",
      "currentValue": false,
      "validationRules": { "required": false }
    }
  ]
}
```

---

### 测试案例 9: 取消操作

**测试 ID**: TC-NEED_USER-009
**优先级**: P1 (中)
**类型**: 功能测试
**前置条件**: 系统正常运行

#### 测试步骤

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| 1 | 创建测试任务 | 任务创建成功 |
| 2 | Agent B 输出 NEED_USER 决策 | 任务状态为 waiting_user |
| 3 | 用户点击待办任务 | 打开对话框 |
| 4 | 用户填写部分信息 | 信息被保留 |
| 5 | 用户点击取消 | 对话框关闭，任务仍在待办列表 |
| 6 | 用户再次点击待办任务 | 对话框打开，之前的信息被清空 |

---

### 测试案例 10: 多个待办任务

**测试 ID**: TC-NEED_USER-010
**优先级**: P1 (中)
**类型**: 功能测试
**前置条件**: 系统正常运行

#### 测试步骤

| 步骤 | 操作 | 预期结果 |
|------|------|---------|
| 1 | 创建 3 个测试任务 | 3 个任务都创建成功 |
| 2 | Agent B 为所有任务输出 NEED_USER 决策 | 3 个任务状态都为 waiting_user |
| 3 | 检查待办任务列表 | 显示 3 个待办任务 |
| 4 | 检查统计信息 | waitingUser: 3, total: 3 |
| 5 | 用户依次处理 3 个任务 | 每个都能正常处理 |

---

## 📊 测试数据准备

### 数据库测试数据脚本

```sql
-- 清理测试数据
DELETE FROM agent_sub_tasks_step_history WHERE commandResultId LIKE 'test-%';
DELETE FROM agent_sub_tasks WHERE id LIKE 'test-%';
DELETE FROM daily_task WHERE id LIKE 'test-%';

-- 创建测试 daily_task
INSERT INTO daily_task (
  id,
  taskId,
  taskTitle,
  taskDescription,
  taskPriority,
  executor,
  executionDate,
  createdAt,
  updatedAt
) VALUES (
  'test-daily-001',
  'test-task-001',
  '测试任务：发布保险产品文章',
  '请发布一篇关于新产品的公众号文章',
  'normal',
  'insurance-d',
  CURRENT_DATE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- 创建测试 agent_sub_task
INSERT INTO agent_sub_tasks (
  id,
  taskTitle,
  taskDescription,
  status,
  fromParentsExecutor,
  commandResultId,
  orderIndex,
  metadata,
  createdAt,
  startedAt,
  updatedAt
) VALUES (
  'test-subtask-001',
  '发布保险产品介绍文章',
  '请发布一篇关于新产品的公众号文章',
  'in_progress',
  'insurance-d',
  'test-daily-001',
  1,
  '{}',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
```

---

## 🎯 验收标准

### 功能验收标准

- [ ] 所有 P0 测试案例通过
- [ ] 所有 P1 测试案例通过
- [ ] 至少 80% 的 P2 测试案例通过
- [ ] 数据流完整，所有数据库表操作正确
- [ ] 用户体验流畅，无明显 bug

### 性能验收标准

- [ ] 待办任务列表加载时间 < 2 秒
- [ ] 用户交互对话框打开时间 < 1 秒
- [ ] 提交操作响应时间 < 3 秒

### 兼容性验收标准

- [ ] 在 Chrome 最新版本中正常工作
- [ ] 在 Firefox 最新版本中正常工作
- [ ] 在 Safari 最新版本中正常工作

---

## 📝 测试执行记录

| 测试案例 ID | 测试日期 | 测试人员 | 测试结果 | 备注 |
|------------|---------|---------|---------|------|
| TC-NEED_USER-001 | | | | |
| TC-NEED_USER-002 | | | | |
| TC-NEED_USER-003 | | | | |
| TC-NEED_USER-004 | | | | |
| TC-NEED_USER-005 | | | | |
| TC-NEED_USER-006 | | | | |
| TC-NEED_USER-007 | | | | |
| TC-NEED_USER-008 | | | | |
| TC-NEED_USER-009 | | | | |
| TC-NEED_USER-010 | | | | |

---

**文档结束**


# 三个表关联关系分析

## 📊 表关联关系图

```
┌─────────────────────────────────────────────────────────┐
│                    daily_task 表                          │
│  (每日任务 - 主表)                                         │
├─────────────────────────────────────────────────────────┤
│  id (UUID, 主键)                                          │
│  task_id (唯一)                                            │
│  ...                                                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ 1:N 关系
                     │
                     ↓
┌─────────────────────────────────────────────────────────┐
│                agent_sub_tasks 表                        │
│  (子任务 - 步骤表)                                         │
├─────────────────────────────────────────────────────────┤
│  id (UUID, 主键)                                          │
│  command_result_id 🔥 (外键 → daily_task.id)             │
│  order_index (步骤序号)                                    │
│  status                                                   │
│  ...                                                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ 1:N 关系
                     │
                     ↓
┌─────────────────────────────────────────────────────────┐
│          agent_sub_tasks_step_history 表                  │
│  (子任务步骤交互历史 - 沟通记录表)                          │
├─────────────────────────────────────────────────────────┤
│  id (bigserial, 主键)                                     │
│  command_result_id 🔥 (外键 → agent_sub_tasks.command_result_id) │
│  step_no (对应 agent_sub_tasks.order_index)              │
│  interact_num (交互次数)                                   │
│  ...                                                       │
└─────────────────────────────────────────────────────────┘
```

## 🔗 详细关联关系

### 1. daily_task → agent_sub_tasks 关联

| 字段 | 说明 |
|------|------|
| `agent_sub_tasks.command_result_id` | 外键 → `daily_task.id` |
| 关联关系 | 1:N（一个 daily_task 有多个 agent_sub_tasks） |
| 级联删除 | `onDelete: 'cascade'` |

**示例：**
```typescript
// 一个 daily_task 可以有多个 agent_sub_tasks（按 order_index 排序）
daily_task.id = "abc-123"
  ↓
agent_sub_tasks 1: command_result_id = "abc-123", order_index = 1
agent_sub_tasks 2: command_result_id = "abc-123", order_index = 2
agent_sub_tasks 3: command_result_id = "abc-123", order_index = 3
```

---

### 2. agent_sub_tasks → agent_sub_tasks_step_history 关联

| 字段 | 说明 |
|------|------|
| `agent_sub_tasks_step_history.command_result_id` | 外键 → `agent_sub_tasks.command_result_id` |
| `agent_sub_tasks_step_history.step_no` | 对应 `agent_sub_tasks.order_index` |
| 关联关系 | 1:N（一个 agent_sub_tasks 步骤有多个交互历史） |
| 级联删除 | `onDelete: 'cascade'` |

**示例：**
```typescript
// 一个 agent_sub_tasks 步骤可以有多个交互历史（按 interact_num 递增）
agent_sub_tasks: command_result_id = "abc-123", order_index = 1
  ↓
agent_sub_tasks_step_history 1: command_result_id = "abc-123", step_no = 1, interact_num = 1
agent_sub_tasks_step_history 2: command_result_id = "abc-123", step_no = 1, interact_num = 2
agent_sub_tasks_step_history 3: command_result_id = "abc-123", step_no = 1, interact_num = 3
```

---

### 3. 关键业务约束

| 约束 | 说明 |
|------|------|
| `agent_sub_tasks` 唯一约束 | `unique_task_order`: `command_result_id + order_index` |
| `agent_sub_tasks_step_history` 唯一约束 | `idx_command_result_step_no`: `command_result_id + step_no` |
| `interact_num` | 从 1 开始递增，最多 5 次 |

---

## ⚠️ 当前测试的问题

### 问题 1: 缺少 daily_task 表的测试
- ❌ 我们的测试没有创建 `daily_task` 记录
- ❌ 直接创建 `agent_sub_tasks` 记录，但没有对应的 `daily_task` 父记录

### 问题 2: 关联关系完整性测试缺失
- ❌ 没有测试 `agent_sub_tasks.command_result_id` 必须引用存在的 `daily_task.id`
- ❌ 没有测试 `agent_sub_tasks_step_history.command_result_id` 必须引用存在的 `agent_sub_tasks.command_result_id`

### 问题 3: 外键约束验证缺失
- ❌ 没有测试如果 `daily_task` 不存在，创建 `agent_sub_tasks` 应该失败
- ❌ 没有测试如果 `agent_sub_tasks` 不存在，创建 `agent_sub_tasks_step_history` 应该失败

---

## ✅ 正确的测试流程应该是

### 完整的 3 表关联测试流程：

```
1. 创建 daily_task 记录（父表）
   ↓
2. 创建 agent_sub_tasks 记录（子表，引用 daily_task.id）
   ↓
3. 创建 agent_sub_tasks_step_history 记录（孙表，引用 agent_sub_tasks.command_result_id）
   ↓
4. 验证关联关系完整性
   ↓
5. 测试级联删除（可选）
```

---

## 📝 需要补充的测试

| 测试项 | 说明 | 优先级 |
|--------|------|--------|
| 1. 创建完整的 3 表关联数据 | 按正确顺序创建 daily_task → agent_sub_tasks → step_history | 🔥 高 |
| 2. 验证外键约束 | 测试引用不存在的记录时应该失败 | 🔥 高 |
| 3. 验证唯一约束 | 测试重复的 command_result_id + order_index/step_no 应该失败 | 🔥 高 |
| 4. 测试查询关联数据 | 通过 daily_task.id 查询所有 agent_sub_tasks 和 step_history | 🔥 高 |


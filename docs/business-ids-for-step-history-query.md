# 数据库查询业务ID指南

## 📊 核心业务ID

### 主任务信息
| 字段 | 值 |
|-----|-----|
| **daily_task.task_id** | `e2e-test-1772801252` |
| **daily_task.id (command_result_id)** | `7b005762-6480-4e39-8678-73d6b1233d2d` |
| **daily_task.task_name** | `端到端功能测试-full` |

---

## 📋 13 个子任务业务ID对应表

| order_index | task_title (子任务名称) | task_id | 对应的测试案例 |
|-------------|----------------------|---------|-------------|
| **1** | **合规审核测试-违规识别并整改** | e2e-test-1772801252 | TC-01A |
| **2** | **合规审核测试-合规直接发布** | e2e-test-1772801252 | TC-01B |
| **3** | **合规审核测试-流程完整性验证** | e2e-test-1772801252 | TC-01C |
| **4** | **网页搜索带摘要测试-搜索保险市场趋势** | e2e-test-1772801252 | TC-02 |
| **5** | **网页搜索测试-基础搜索** | e2e-test-1772801252 | TC-03 |
| **6** | **添加草稿测试-微信公众号草稿** | e2e-test-1772801252 | TC-04 |
| **7** | **重试策略测试-首次失败重试成功** | e2e-test-1772801252 | TC-05 |
| **8** | **重试限制测试-多次失败** | e2e-test-1772801252 | TC-06 |
| **9** | **迭代限制测试-最大迭代** | e2e-test-1772801252 | TC-07 |
| **10** | **用户交互测试-确认后继续** | e2e-test-1772801252 | TC-08 |
| **11** | **复杂审核流程-多次违规整改后发布** | e2e-test-1772801252 | TC-23 |
| **12** | **正常发布流程-合规内容直接发布** | e2e-test-1772801252 | TC-24 |
| **13** | **审核不通过-提示修改后重试发布** | e2e-test-1772801252 | TC-25 |

---

## 🔍 直接查询数据库的 SQL 语句

### 1. 查询指定子任务的所有 step-history 记录

```sql
-- 用法：修改 ast.order_index = 1 为你想要查询的子任务序号
SELECT 
    'ash-' || ash.id as step_history_id,
    ast.order_index,
    ast.task_title,
    dt.task_id,
    ash.step_no,
    ash.interact_num,
    ash.interact_type,
    ash.interact_user,
    ash.interact_time,
    ash.interact_content
FROM agent_sub_tasks_step_history ash
LEFT JOIN agent_sub_tasks ast ON ash.command_result_id = ast.command_result_id
LEFT JOIN daily_task dt ON ast.command_result_id = dt.id
WHERE ast.command_result_id = '7b005762-6480-4e39-8678-73d6b1233d2d'
  AND ast.order_index = 1  -- 修改这里的数字查询不同子任务
ORDER BY ash.step_no, ash.interact_num;
```

### 2. 查询所有子任务的 step-history 记录概览

```sql
SELECT 
    'ash-' || ash.id as step_history_id,
    ast.order_index,
    ast.task_title,
    dt.task_id,
    ash.step_no,
    ash.interact_num,
    ash.interact_type,
    ash.interact_user
FROM agent_sub_tasks_step_history ash
LEFT JOIN agent_sub_tasks ast ON ash.command_result_id = ast.command_result_id
LEFT JOIN daily_task dt ON ast.command_result_id = dt.id
WHERE ast.command_result_id = '7b005762-6480-4e39-8678-73d6b1233d2d'
ORDER BY ast.order_index, ash.step_no, ash.interact_num;
```

### 3. 查询单个 step-history 记录的完整内容

```sql
-- 用法：修改 ash.id = 333 为你想要查询的记录ID
SELECT 
    'ash-' || ash.id as step_history_id,
    ast.order_index,
    ast.task_title,
    dt.task_id,
    ash.step_no,
    ash.interact_num,
    ash.interact_type,
    ash.interact_user,
    ash.interact_time,
    ash.interact_content
FROM agent_sub_tasks_step_history ash
LEFT JOIN agent_sub_tasks ast ON ash.command_result_id = ast.command_result_id
LEFT JOIN daily_task dt ON ast.command_result_id = dt.id
WHERE ash.id = 333;  -- 修改这里的ID查询特定记录
```

### 4. 查询某个子任务有多少条 step-history 记录

```sql
SELECT 
    ast.order_index,
    ast.task_title,
    COUNT(*) as step_history_count
FROM agent_sub_tasks_step_history ash
LEFT JOIN agent_sub_tasks ast ON ash.command_result_id = ast.command_result_id
WHERE ast.command_result_id = '7b005762-6480-4e39-8678-73d6b1233d2d'
GROUP BY ast.order_index, ast.task_title
ORDER BY ast.order_index;
```

---

## 📊 当前数据实际情况查询结果

### order_index = 1（合规审核测试-违规识别并整改）的记录

| step_history_id | step_no | interact_num | interact_type | interact_user |
|----------------|---------|-------------|--------------|--------------|
| ash-333 | 1 | 1 | request | insurance-d |
| ash-335 | 1 | 1 | response | agent B |
| ash-336 | 2 | 1 | request | insurance-d |
| ash-338 | 2 | 4 | response | agent B |
| ash-339 | 3 | 1 | request | insurance-d |
| ash-340 | 3 | 1 | response | agent B |
| ash-345 | 4 | 1 | request | insurance-d |
| ash-346 | 4 | 2 | response | agent B |
| ash-347 | 5 | 1 | request | insurance-d |
| ash-348 | 5 | 2 | response | agent B |
| ash-353 | 6 | 1 | request | insurance-d |
| ash-354 | 6 | 2 | response | agent B |
| ash-359 | 7 | 1 | request | insurance-d |
| ash-365 | 7 | 2 | response | agent B |
| ash-368 | 8 | 1 | request | insurance-d |
| ... | ... | ... | ... | ... |

---

## 🎯 如何使用这些业务ID查询

### 示例 1：查询"合规审核测试-违规识别并整改"（order_index = 1）的所有数据

```sql
SELECT 
    'ash-' || ash.id as step_history_id,
    ast.order_index,
    ast.task_title,
    dt.task_id,
    ash.step_no,
    ash.interact_num,
    ash.interact_type,
    ash.interact_user,
    ash.interact_content
FROM agent_sub_tasks_step_history ash
LEFT JOIN agent_sub_tasks ast ON ash.command_result_id = ast.command_result_id
LEFT JOIN daily_task dt ON ast.command_result_id = dt.id
WHERE ast.command_result_id = '7b005762-6480-4e39-8678-73d6b1233d2d'
  AND ast.order_index = 1
ORDER BY ash.step_no, ash.interact_num;
```

### 示例 2：查询"网页搜索带摘要测试"（order_index = 4）的所有数据

```sql
SELECT 
    'ash-' || ash.id as step_history_id,
    ast.order_index,
    ast.task_title,
    dt.task_id,
    ash.step_no,
    ash.interact_num,
    ash.interact_type,
    ash.interact_user,
    ash.interact_content
FROM agent_sub_tasks_step_history ash
LEFT JOIN agent_sub_tasks ast ON ash.command_result_id = ast.command_result_id
LEFT JOIN daily_task dt ON ast.command_result_id = dt.id
WHERE ast.command_result_id = '7b005762-6480-4e39-8678-73d6b1233d2d'
  AND ast.order_index = 4
ORDER BY ash.step_no, ash.interact_num;
```

### 示例 3：查询单条记录的完整 interact_content

```sql
SELECT 
    'ash-' || ash.id as step_history_id,
    ast.order_index,
    ast.task_title,
    dt.task_id,
    ash.interact_content
FROM agent_sub_tasks_step_history ash
LEFT JOIN agent_sub_tasks ast ON ash.command_result_id = ast.command_result_id
LEFT JOIN daily_task dt ON ast.command_result_id = dt.id
WHERE ash.id = 333;
```

---

## 📝 总结

| 业务字段 | 说明 | 示例值 |
|---------|------|-------|
| **dt.task_id** | 主任务ID | `e2e-test-1772801252` |
| **dt.id (command_result_id)** | 命令结果ID（UUID） | `7b005762-6480-4e39-8678-73d6b1233d2d` |
| **ast.order_index** | 子任务序号（1-13） | `1` |
| **ast.task_title** | 子任务名称 | `合规审核测试-违规识别并整改` |
| **ash.id** | step-history 记录ID | `333` |
| **ash.step_no** | 步骤号 | `1` |
| **ash.interact_num** | 交互序号 | `1` |

你可以直接用这些 SQL 语句查询数据库中的实际数据！

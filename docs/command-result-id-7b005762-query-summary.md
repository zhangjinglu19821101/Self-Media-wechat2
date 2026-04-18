# command_result_id: 7b005762-6480-4e39-8678-73d6b1233d2d 查询总结

---

## 📊 完整查询语句

### 1. 核心查询：agent_sub_tasks_step_history 表
```sql
SELECT 
    id,
    command_result_id,
    step_no,
    interact_num,
    interact_type,
    interact_user,
    interact_time,
    interact_content
FROM agent_sub_tasks_step_history
WHERE command_result_id = '7b005762-6480-4e39-8678-73d6b1233d2d'
ORDER BY step_no, interact_num;
```

### 2. 关联查询：daily_task 表
```sql
SELECT 
    id,
    task_id,
    related_task_id,
    task_title,
    executor,
    execution_status,
    sub_task_count,
    created_at
FROM daily_task
WHERE id = '7b005762-6480-4e39-8678-73d6b1233d2d';
```

### 3. 关联查询：agent_sub_tasks 表
```sql
SELECT 
    id,
    command_result_id,
    task_title,
    status,
    order_index,
    created_at
FROM agent_sub_tasks
WHERE command_result_id = '7b005762-6480-4e39-8678-73d6b1233d2d'
ORDER BY order_index;
```

---

## 📋 查询结果概览

### 1. daily_task 表信息
| 字段 | 值 |
|------|-----|
| **id** | `7b005762-6480-4e39-8678-73d6b1233d2d` |
| **task_id** | `e2e-test-1772801252` |
| **related_task_id** | `e2e-master-9bee7bc5-aeab-415d-a39f-0febead38620` |
| **task_title** | `端到端功能测试-full` |
| **executor** | `insurance-d` |
| **execution_status** | `in_progress` |
| **sub_task_count** | `13` |
| **created_at** | `2026-03-06 12:47:32.931 +0000 UTC` |

### 2. agent_sub_tasks_step_history 表信息
- **总记录数**: 23 条
- **时间范围**: 2026-03-06 12:47:33 ~ 13:28:28
- **交互 Agent**: `insurance-d` ↔ `agent B`

---

## 📈 step-history 记录详情

| 序号 | step_no | interact_num | interact_type | interact_user | interact_time |
|------|---------|-------------|---------------|---------------|---------------|
| 1 | 1 | 1 | request | insurance-d | 2026-03-06 12:47:33 |
| 2 | 1 | 1 | response | agent B | 2026-03-06 12:47:54 |
| 3 | 2 | 1 | request | insurance-d | 2026-03-06 12:47:57 |
| 4 | 2 | 4 | response | agent B | 2026-03-06 12:49:36 |
| 5 | 3 | 1 | request | insurance-d | 2026-03-06 12:49:40 |
| 6 | 3 | 1 | response | agent B | 2026-03-06 12:49:53 |
| 7 | 4 | 1 | request | insurance-d | 2026-03-06 12:50:27 |
| 8 | 4 | 2 | response | agent B | 2026-03-06 12:50:44 |
| 9 | 5 | 1 | request | insurance-d | 2026-03-06 12:50:47 |
| 10 | 5 | 2 | response | agent B | 2026-03-06 12:50:57 |
| 11 | 6 | 1 | request | insurance-d | 2026-03-06 12:52:51 |
| 12 | 6 | 2 | response | agent B | 2026-03-06 12:53:00 |
| 13 | 7 | 1 | request | insurance-d | 2026-03-06 12:56:02 |
| 14 | 7 | 2 | response | agent B | 2026-03-06 12:56:17 |
| 15 | 8 | 1 | request | insurance-d | 2026-03-06 12:58:00 |
| 16 | 8 | 3 | response | agent B | 2026-03-06 12:58:38 |
| 17 | 9 | 1 | request | insurance-d | 2026-03-06 13:00:01 |
| 18 | 9 | 5 | response | agent B | 2026-03-06 13:00:37 |
| 19 | 10 | 1 | request | insurance-d | 2026-03-06 13:02:01 |
| 20 | 10 | 3 | response | agent B | 2026-03-06 13:02:23 |
| 21 | 11 | 1 | request | insurance-d | 2026-03-06 13:04:00 |
| 22 | 12 | 1 | request | insurance-d | 2026-03-06 13:26:11 |
| 23 | 12 | 4 | response | agent B | 2026-03-06 13:27:56 |
| 24 | 13 | 1 | request | insurance-d | 2026-03-06 13:28:02 |
| 25 | 13 | 3 | response | agent B | 2026-03-06 13:28:28 |

---

## 🔍 快速查询：只看 interact_content 字段

```sql
SELECT 
    step_no,
    interact_num,
    interact_type,
    interact_user,
    interact_content
FROM agent_sub_tasks_step_history
WHERE command_result_id = '7b005762-6480-4e39-8678-73d6b1233d2d'
ORDER BY step_no, interact_num;
```

---

## 📊 数据统计查询

```sql
SELECT 
    'agent_sub_tasks_step_history' as table_name,
    COUNT(*) as record_count
FROM agent_sub_tasks_step_history
WHERE command_result_id = '7b005762-6480-4e39-8678-73d6b1233d2d'
UNION ALL
SELECT 
    'agent_sub_tasks' as table_name,
    COUNT(*) as record_count
FROM agent_sub_tasks
WHERE command_result_id = '7b005762-6480-4e39-8678-73d6b1233d2d';
```

---

## 📝 总结

- **command_result_id**: `7b005762-6480-4e39-8678-73d6b1233d2d`
- **task_id**: `e2e-test-1772801252`
- **任务名称**: `端到端功能测试-full`
- **执行 Agent**: `insurance-d`
- **子任务数**: 13 个
- **step-history 记录数**: 23 条
- **测试时间**: 2026-03-06 12:47 ~ 13:28（约 41 分钟）

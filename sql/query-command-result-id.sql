-- 查询指定 command_result_id 的 agent_sub_tasks_step_history 记录
-- 完整查询这个 command_result_id: 7b005762-6480-4e39-8678-73d6b1233d2d

-- ========================================================
-- 1. 查询 agent_sub_tasks_step_history 表（最核心的表）
-- ========================================================
SELECT 
    id,
    command_result_id,
    step_no,
    interact_num,
    interact_type,
    interact_user,
    interact_time,
    interact_content  -- 这就是我们要分析的字段！
FROM agent_sub_tasks_step_history
WHERE command_result_id = '7b005762-6480-4e39-8678-73d6b1233d2d'
ORDER BY step_no, interact_num;

-- ========================================================
-- 2. 查询 agent_sub_tasks 表（关联的子任务）
-- ========================================================
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

-- ========================================================
-- 3. 查询 daily_task 表（关联的每日任务）
-- ========================================================
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

-- ========================================================
-- 4. 联合查询：step-history + sub-tasks（完整数据）
-- ========================================================
SELECT 
    ash.step_no,
    ash.interact_num,
    ash.interact_type,
    ash.interact_user,
    ash.interact_time,
    ast.task_title,
    ast.status,
    ash.interact_content
FROM agent_sub_tasks_step_history ash
LEFT JOIN agent_sub_tasks ast ON ash.command_result_id = ast.command_result_id
WHERE ash.command_result_id = '7b005762-6480-4e39-8678-73d6b1233d2d'
ORDER BY ash.step_no, ash.interact_num;

-- ========================================================
-- 5. 只查询 interact_content 字段（用于分析）
-- ========================================================
SELECT 
    step_no,
    interact_num,
    interact_type,
    interact_user,
    interact_content
FROM agent_sub_tasks_step_history
WHERE command_result_id = '7b005762-6480-4e39-8678-73d6b1233d2d'
ORDER BY step_no, interact_num;

-- ========================================================
-- 6. 统计这个 command_result_id 的数据量
-- ========================================================
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


-- ========================================================
-- 检查 daily_task 表的数据
-- ========================================================

-- ========================================================
-- 1. 查询 daily_task 表的所有数据（限制20条）
-- ========================================================
SELECT 
    id,
    task_id,
    related_task_id,
    task_title,
    executor,
    execution_status,
    execution_date,
    (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS created_at_beijing
FROM daily_task
ORDER BY created_at DESC
LIMIT 20;

-- ========================================================
-- 2. 统计 daily_task 表的总记录数
-- ========================================================
SELECT COUNT(*) AS total_daily_tasks FROM daily_task;

-- ========================================================
-- 3. 查询 agent_tasks 表的相关记录
-- ========================================================
SELECT 
    id,
    task_id,
    task_name,
    task_status,
    split_status,
    (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS created_at_beijing
FROM agent_tasks
ORDER BY created_at DESC
LIMIT 10;

-- ========================================================
-- 4. 查询 agent_sub_tasks 表的相关记录
-- ========================================================
SELECT 
    id,
    task_id,
    command_result_id,
    task_title,
    status,
    order_index,
    (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS created_at_beijing
FROM agent_sub_tasks
ORDER BY created_at DESC
LIMIT 20;


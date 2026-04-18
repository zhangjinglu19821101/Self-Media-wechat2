
-- ========================================================
-- 快速查询：北京时间格式
-- ========================================================
-- 日常使用的简化查询语句
-- ========================================================

-- ========================================================
-- 1. 查询最新20条子任务（北京时间）
-- ========================================================
SELECT 
    id,
    task_id,
    from_agent_id,
    to_agent_id,
    status,
    order_index,
    (started_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS started_at,
    (completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS completed_at,
    (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS created_at,
    subtask_type,
    SUBSTRING(description, 1, 50) AS description
FROM agent_sub_tasks
ORDER BY created_at DESC
LIMIT 20;

-- ========================================================
-- 2. 查询今日任务（北京时间）
-- ========================================================
SELECT 
    id,
    task_id,
    status,
    order_index,
    (started_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS started_at,
    SUBSTRING(description, 1, 50) AS description
FROM agent_sub_tasks
WHERE DATE(started_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') = CURRENT_DATE AT TIME ZONE 'Asia/Shanghai'
ORDER BY order_index;

-- ========================================================
-- 3. 查询正在执行的任务
-- ========================================================
SELECT 
    id,
    task_id,
    status,
    order_index,
    (started_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS started_at,
    ROUND(EXTRACT(EPOCH FROM (NOW() - started_at)) / 60, 1) AS execution_minutes,
    SUBSTRING(description, 1, 50) AS description
FROM agent_sub_tasks
WHERE status = 'in_progress'
ORDER BY started_at;

-- ========================================================
-- 4. 查询最新20条执行历史（北京时间）
-- ========================================================
SELECT 
    id,
    subtask_id,
    step_type,
    step_name,
    status,
    (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS created_at,
    (updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS updated_at
FROM agent_sub_tasks_step_history
ORDER BY created_at DESC
LIMIT 20;

-- ========================================================
-- 5. 查看当前北京时间
-- ========================================================
SELECT (NOW() AT TIME ZONE 'Asia/Shanghai') AS current_beijing_time;

-- ========================================================
-- 6. 查询特定任务的详情（替换 YOUR_TASK_ID）
-- ========================================================
-- SELECT 
--     id,
--     task_id,
--     from_agent_id,
--     to_agent_id,
--     executor,
--     status,
--     order_index,
--     (started_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS started_at,
--     (completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS completed_at,
--     (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS created_at,
--     (updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS updated_at,
--     subtask_type,
--     description,
--     metadata
-- FROM agent_sub_tasks
-- WHERE task_id = 'YOUR_TASK_ID'
-- ORDER BY order_index;


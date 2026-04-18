
-- ========================================================
-- 检查 agent_sub_tasks 表的实际数据
-- ========================================================

-- ========================================================
-- 1. 查询最新20条任务，查看 execution_date 和状态
-- ========================================================
SELECT 
    id,
    task_id,
    from_agent_id,
    to_agent_id,
    status,
    order_index,
    execution_date,
    (started_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS started_at_beijing,
    (completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS completed_at_beijing,
    (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS created_at_beijing,
    (updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS updated_at_beijing,
    subtask_type,
    SUBSTRING(description, 1, 50) AS description
FROM agent_sub_tasks
ORDER BY created_at DESC
LIMIT 20;

-- ========================================================
-- 2. 查询 today 的任务（使用北京时间）
-- ========================================================
SELECT 
    id,
    task_id,
    status,
    order_index,
    execution_date,
    (started_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS started_at_beijing,
    SUBSTRING(description, 1, 50) AS description
FROM agent_sub_tasks
WHERE execution_date = CURRENT_DATE AT TIME ZONE 'Asia/Shanghai'
ORDER BY order_index;

-- ========================================================
-- 3. 查看当前北京时间和 today 的日期值
-- ========================================================
SELECT 
    (NOW() AT TIME ZONE 'Asia/Shanghai') AS current_beijing_time,
    CURRENT_DATE AT TIME ZONE 'Asia/Shanghai' AS today_date,
    TO_CHAR((NOW() AT TIME ZONE 'Asia/Shanghai'), 'YYYY-MM-DD') AS today_string;

-- ========================================================
-- 4. 查询所有 pending 和 in_progress 状态的任务
-- ========================================================
SELECT 
    id,
    task_id,
    status,
    order_index,
    execution_date,
    (started_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS started_at_beijing,
    (NOW() - started_at) AS elapsed_time,
    SUBSTRING(description, 1, 50) AS description
FROM agent_sub_tasks
WHERE status IN ('pending', 'in_progress')
ORDER BY created_at DESC;

-- ========================================================
-- 5. 检查 execution_date 字段的格式和值
-- ========================================================
SELECT 
    DISTINCT execution_date,
    COUNT(*) AS task_count
FROM agent_sub_tasks
GROUP BY execution_date
ORDER BY execution_date DESC
LIMIT 10;


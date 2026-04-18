
-- ========================================================
-- 数据库查询：北京时间格式显示
-- ========================================================
-- 这个文件包含了在查询时将 UTC 时间转换为北京时间的 SQL 示例
-- ========================================================

-- ========================================================
-- 示例1：查询 agent_sub_tasks 表，显示北京时间
-- ========================================================
SELECT 
    id,
    task_id,
    from_agent_id,
    to_agent_id,
    executor,
    status,
    order_index,
    
    -- 时间字段：转换为北京时间格式 (CST, UTC+8)
    -- 格式：YYYY-MM-DD HH24:MI:SS
    (started_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS started_at_beijing,
    (completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS completed_at_beijing,
    (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS created_at_beijing,
    (updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS updated_at_beijing,
    
    -- 原始 UTC 时间（用于对比）
    started_at AS started_at_utc,
    completed_at AS completed_at_utc,
    
    subtask_type,
    description,
    metadata
FROM agent_sub_tasks
ORDER BY created_at DESC
LIMIT 20;

-- ========================================================
-- 示例2：查询 agent_sub_tasks_step_history 表，显示北京时间
-- ========================================================
SELECT 
    id,
    subtask_id,
    step_type,
    step_name,
    status,
    
    -- 时间字段：转换为北京时间格式
    (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS created_at_beijing,
    (updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS updated_at_beijing,
    
    -- 原始 UTC 时间（用于对比）
    created_at AS created_at_utc,
    
    input_data,
    output_data,
    metadata
FROM agent_sub_tasks_step_history
ORDER BY created_at DESC
LIMIT 20;

-- ========================================================
-- 示例3：查询今日任务（使用北京时间进行日期过滤）
-- ========================================================
SELECT 
    id,
    task_id,
    status,
    order_index,
    (started_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS started_at_beijing,
    description
FROM agent_sub_tasks
WHERE 
    -- 使用北京时间进行日期过滤
    DATE(started_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') = CURRENT_DATE AT TIME ZONE 'Asia/Shanghai'
ORDER BY order_index;

-- ========================================================
-- 示例4：查询正在执行的任务及其执行时长（北京时间）
-- ========================================================
SELECT 
    id,
    task_id,
    status,
    order_index,
    (started_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS started_at_beijing,
    
    -- 计算执行时长（分钟）
    EXTRACT(EPOCH FROM (NOW() - started_at)) / 60 AS execution_minutes,
    
    description
FROM agent_sub_tasks
WHERE status = 'in_progress'
ORDER BY started_at;

-- ========================================================
-- 示例5：创建一个视图（View）：agent_sub_tasks_with_beijing_time
-- ========================================================
-- 如果你想永久使用北京时间视图，可以执行以下语句创建视图
-- 注意：创建视图只需要执行一次

/*
CREATE OR REPLACE VIEW agent_sub_tasks_with_beijing_time AS
SELECT 
    id,
    task_id,
    from_agent_id,
    to_agent_id,
    executor,
    status,
    order_index,
    
    -- 北京时间格式
    (started_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS started_at_beijing,
    (completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS completed_at_beijing,
    (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS created_at_beijing,
    (updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS updated_at_beijing,
    
    subtask_type,
    description,
    metadata
FROM agent_sub_tasks;

-- 使用视图查询示例：
-- SELECT * FROM agent_sub_tasks_with_beijing_time ORDER BY created_at_beijing DESC LIMIT 20;
*/

-- ========================================================
-- 示例6：创建一个视图（View）：agent_sub_tasks_step_history_with_beijing_time
-- ========================================================
/*
CREATE OR REPLACE VIEW agent_sub_tasks_step_history_with_beijing_time AS
SELECT 
    id,
    subtask_id,
    step_type,
    step_name,
    status,
    
    -- 北京时间格式
    (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS created_at_beijing,
    (updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS updated_at_beijing,
    
    input_data,
    output_data,
    metadata
FROM agent_sub_tasks_step_history;
*/

-- ========================================================
-- 时间转换说明
-- ========================================================
/*
PostgreSQL 时间转换语法：
- (timestamp_column AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai')
  含义：
  1. 首先告诉 PostgreSQL，这个 timestamp 是 UTC 时间
  2. 然后将其转换为 'Asia/Shanghai' 时区（北京时间）

常用时区名称：
- 'UTC' - 协调世界时
- 'Asia/Shanghai' - 北京时间（UTC+8）
- 'Asia/Hong_Kong' - 香港时间
- 'Asia/Tokyo' - 东京时间

日期格式化（如果需要特定格式）：
- TO_CHAR(timestamp, 'YYYY-MM-DD HH24:MI:SS') - 格式化为字符串
*/

-- ========================================================
-- 快速查询：查看当前北京时间
-- ========================================================
SELECT 
    NOW() AS current_time_utc,
    (NOW() AT TIME ZONE 'Asia/Shanghai') AS current_time_beijing,
    TO_CHAR((NOW() AT TIME ZONE 'Asia/Shanghai'), 'YYYY-MM-DD HH24:MI:SS') AS current_time_beijing_formatted;


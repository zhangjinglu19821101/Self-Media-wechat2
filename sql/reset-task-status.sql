
-- ========================================================
-- 重置异常的任务状态
-- ========================================================

-- ========================================================
-- 1. 查看当前所有 pending 和 in_progress 状态的任务
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
WHERE status IN ('pending', 'in_progress')
ORDER BY order_index;

-- ========================================================
-- 2. 重置任务状态（谨慎使用！先确认后再执行！
-- ========================================================
-- 把所有 in_progress 状态的任务重置为 pending
-- 注意：只在确认需要时才执行这个语句！
--
-- UPDATE agent_sub_tasks
-- SET 
--     status = 'pending',
--     started_at = NULL,
--     updated_at = NOW()
-- WHERE status = 'in_progress';
--

-- ========================================================
-- 3. 重置特定 order_index 的任务（更安全的方式）
-- ========================================================
-- 只重置 order_index &gt; 1 的任务，保留第一个任务保持 in_progress
--
-- UPDATE agent_sub_tasks
-- SET 
--     status = 'pending',
--     started_at = NULL,
--     updated_at = NOW()
-- WHERE status = 'in_progress'
--   AND order_index &gt; 1;
--

-- ========================================================
-- 4. 查看重置后的结果
-- ========================================================
-- SELECT 
--     id,
--     task_id,
--     status,
--     order_index,
--     SUBSTRING(description, 1, 50) AS description
-- FROM agent_sub_tasks
-- WHERE status IN ('pending', 'in_progress')
-- ORDER BY order_index;


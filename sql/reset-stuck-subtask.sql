-- ============================================
-- 查看和重置卡住的子任务
-- ============================================

-- 1. 查看当前所有 in_progress 的子任务
SELECT 
  id::text,
  task_title,
  executor,
  status,
  order_index,
  started_at,
  NOW() as current_time,
  (NOW() - started_at) as running_duration
FROM agent_sub_tasks 
WHERE status = 'in_progress'
ORDER BY started_at ASC;

-- 2. 如果任务运行超过 10 分钟，可以重置为 pending
-- 取消下面的注释来执行重置
-- UPDATE agent_sub_tasks 
-- SET 
--   status = 'pending',
--   started_at = NULL,
--   updated_at = NOW()
-- WHERE 
--   status = 'in_progress' 
--   AND started_at < NOW() - INTERVAL '10 minutes';

-- 3. 查看重置后的状态
-- SELECT id::text, task_title, executor, status FROM agent_sub_tasks ORDER BY created_at DESC LIMIT 10;

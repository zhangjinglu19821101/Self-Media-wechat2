-- 重置卡住的 in_progress 任务回 pending 状态
UPDATE agent_sub_tasks 
SET 
  status = 'pending',
  started_at = NULL,
  updated_at = NOW()
WHERE 
  status = 'in_progress'
  AND started_at < NOW() - INTERVAL '10 minutes';

-- 查看重置后的任务状态
SELECT 
  id,
  task_title,
  status,
  order_index,
  execution_date,
  started_at,
  created_at
FROM agent_sub_tasks
ORDER BY created_at DESC
LIMIT 10;

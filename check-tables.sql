
-- ============================================
-- 快速检查三个表的统计信息
-- ============================================

-- 1. 三个表的记录数统计
SELECT 'daily_task' as table_name, count(*) as record_count FROM daily_task
UNION ALL
SELECT 'agent_sub_tasks' as table_name, count(*) as record_count FROM agent_sub_tasks
UNION ALL
SELECT 'agent_sub_tasks_step_history' as table_name, count(*) as record_count 
FROM information_schema.tables 
WHERE table_name = 'agent_sub_tasks_step_history';

-- 2. 检查 agent_sub_tasks 的引用完整性
SELECT 
  'agent_sub_tasks' as table_name,
  count(*) as total_records,
  count(DISTINCT command_result_id) as unique_command_result_ids
FROM agent_sub_tasks;

-- 3. 检查有多少 agent_sub_tasks 有对应的 daily_task
SELECT 
  'Valid reference' as reference_status,
  count(*) as count
FROM agent_sub_tasks st
WHERE EXISTS (
  SELECT 1 FROM daily_task dt WHERE dt.id = st.command_result_id
)
UNION ALL
SELECT 
  'Invalid reference' as reference_status,
  count(*) as count
FROM agent_sub_tasks st
WHERE NOT EXISTS (
  SELECT 1 FROM daily_task dt WHERE dt.id = st.command_result_id
);

-- 4. 查看一个有完整关联关系的示例
SELECT 
  dt.id as daily_task_id,
  dt.task_id,
  dt.task_title,
  dt.executor,
  count(st.id) as sub_task_count
FROM daily_task dt
LEFT JOIN agent_sub_tasks st ON dt.id = st.command_result_id
GROUP BY dt.id, dt.task_id, dt.task_title, dt.executor
HAVING count(st.id) > 0
ORDER BY sub_task_count DESC
LIMIT 3;


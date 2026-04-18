-- 获取测试案例的 task_id 和业务场景信息
SELECT 
    id,
    task_id,
    task_name,
    task_type,
    core_command,
    executor,
    task_status,
    split_status,
    created_at
FROM agent_tasks
WHERE task_name LIKE '%TC-0%' 
   OR task_name LIKE '%TC-2%'
   OR core_command LIKE '%TC-0%'
   OR core_command LIKE '%TC-2%'
ORDER BY created_at DESC
LIMIT 20;

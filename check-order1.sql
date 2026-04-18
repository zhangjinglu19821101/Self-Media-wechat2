-- 查询 agent_sub_tasks 表中 order_index=1 的记录详情
SELECT 
    id,
    command_result_id,
    from_parents_executor,
    task_title,
    task_description,
    status,
    order_index,
    started_at,
    completed_at,
    dialogue_session_id,
    dialogue_rounds,
    dialogue_status,
    last_dialogue_at,
    execution_result,
    status_proof,
    is_dispatched,
    dispatched_at,
    timeout_handling_count,
    escalated,
    escalated_at,
    escalated_reason,
    metadata::text,
    feedback_history::text,
    created_at,
    updated_at
FROM agent_sub_tasks
WHERE order_index = 1
ORDER BY created_at DESC
LIMIT 10;

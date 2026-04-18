
-- ============================================
-- 简单版：插入测试数据
-- ============================================

-- 1. 先插入一条 daily_task 记录
WITH inserted_daily AS (
  INSERT INTO daily_task (
    id, 
    task_id, 
    related_task_id, 
    task_title, 
    task_description, 
    executor, 
    task_priority, 
    execution_date, 
    execution_deadline_start, 
    execution_deadline_end, 
    deliverables, 
    execution_status, 
    splitter, 
    entry_user, 
    from_agent_id, 
    to_agent_id, 
    task_type,
    completed_sub_tasks, 
    sub_task_count, 
    question_status,
    dialogue_rounds, 
    dialogue_status, 
    report_count, 
    requires_intervention,
    dependencies, 
    sort_order,
    output_data, 
    metrics, 
    attachments,
    metadata,
    created_at, 
    updated_at
  ) VALUES (
    gen_random_uuid(),
    'daily-task-mcp-simple-' || floor(extract(epoch from now())::text),
    'test-master-simple',
    'MCP 简单测试任务',
    '用于测试 MCP 功能的简单任务',
    'insurance-d',
    'normal',
    CURRENT_DATE,
    NOW(),
    NOW() + INTERVAL '4 hours',
    '测试报告',
    'in_progress',
    'test',
    'test',
    'test',
    'insurance-d',
    'daily',
    0, 3, 'none',
    0, 'none', 0, false,
    '{}'::jsonb, 0,
    '{}'::jsonb, '{}'::jsonb, '[]'::jsonb,
    '{}'::jsonb,
    NOW(), NOW()
  )
  RETURNING id
)

-- 2. 插入 3 条 agent_sub_tasks 记录
INSERT INTO agent_sub_tasks (
  id, 
  command_result_id, 
  from_parents_executor, 
  task_title, 
  task_description,
  status, 
  order_index, 
  execution_date, 
  metadata,
  created_at, 
  updated_at
)
VALUES
  (
    gen_random_uuid(),
    (SELECT id FROM inserted_daily),
    'insurance-d',
    '网页搜索带摘要',
    '搜索"2025年保险市场趋势"，联网并生成摘要',
    'in_progress',
    1,
    CURRENT_DATE,
    '{"mcpCapability": "web_search", "searchQuery": "2025年保险市场趋势"}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    (SELECT id FROM inserted_daily),
    'insurance-d',
    '合规校验功能',
    '检查文章内容的合规性',
    'pending',
    2,
    CURRENT_DATE,
    '{"mcpCapability": "compliance_check", "contentToCheck": "这是最好的保险产品"}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    (SELECT id FROM inserted_daily),
    'insurance-d',
    '上传一个摘要到微信公众',
    '将摘要上传到微信公众号素材库',
    'pending',
    3,
    CURRENT_DATE,
    '{"mcpCapability": "wechat_public", "articleSummary": "本文介绍了2025年保险市场趋势"}'::jsonb,
    NOW(),
    NOW()
  );

-- 3. 查询结果
SELECT 'daily_task' as table_name, id, task_id, task_title, execution_status FROM daily_task WHERE task_id LIKE 'daily-task-mcp-simple-%';
SELECT 'agent_sub_tasks' as table_name, id, task_title, status, order_index FROM agent_sub_tasks WHERE command_result_id IN (SELECT id FROM daily_task WHERE task_id LIKE 'daily-task-mcp-simple-%');


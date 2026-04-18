
-- ============================================
-- 插入 3 条 MCP 功能测试记录
-- ============================================

-- 第一步：先插入一个 daily_task 记录
WITH inserted_daily_task AS (
  INSERT INTO daily_task (
    id, task_id, related_task_id, task_title, task_description, 
    executor, task_priority, execution_date, 
    execution_deadline_start, execution_deadline_end, 
    deliverables, execution_status, splitter, entry_user, 
    from_agent_id, to_agent_id, task_type,
    completed_sub_tasks, sub_task_count, question_status,
    dialogue_rounds, dialogue_status, report_count, requires_intervention,
    created_at, updated_at
  ) VALUES (
    gen_random_uuid(), 
    'daily-task-mcp-test-' || floor(extract(epoch from now())),
    'test-mcp-master-task',
    'MCP 功能测试任务',
    '用于测试 MCP 功能的综合任务',
    'insurance-d',
    'normal',
    CURRENT_DATE,
    NOW(),
    NOW() + INTERVAL '4 hours',
    'MCP 功能测试报告',
    'new',
    'test',
    'test',
    'test',
    'insurance-d',
    'daily',
    0, 0, 'none',
    0, 'none', 0, false,
    NOW(), NOW()
  )
  RETURNING id
)

-- 第二步：插入 3 条 agent_sub_tasks 记录
INSERT INTO agent_sub_tasks (
  id, command_result_id, from_parents_executor, task_title, task_description,
  status, order_index, execution_date, metadata, created_at, updated_at
)
VALUES
  -- 1. 网页搜索带摘要
  (
    gen_random_uuid(),
    (SELECT id FROM inserted_daily_task),
    'insurance-d',
    '网页搜索带摘要',
    '使用 MCP 网页搜索功能搜索"2025年保险市场趋势"，并生成搜索摘要。要求：1. 搜索最近3个月的相关资讯；2. 提取关键信息和数据；3. 生成结构化摘要。',
    'pending',
    1,
    CURRENT_DATE,
    '{
      "mcpCapability": "web_search",
      "searchQuery": "2025年保险市场趋势",
      "searchTimeRange": "3个月",
      "taskType": "mcp_web_search",
      "estimatedHours": 0.5,
      "acceptanceCriteria": "1. 成功调用 MCP 网页搜索接口；2. 返回相关搜索结果；3. 生成结构化摘要"
    }'::jsonb,
    NOW(),
    NOW()
  ),
  -- 2. 合规校验功能
  (
    gen_random_uuid(),
    (SELECT id FROM inserted_daily_task),
    'insurance-d',
    '合规校验功能',
    '使用 MCP 合规校验功能检查以下文章内容的合规性。文章内容："这是最好的保险产品，收益率最高，绝对安全，保本保息！" 要求：1. 检查是否有绝对化用语；2. 检查是否有违规承诺；3. 生成合规修改建议。',
    'pending',
    2,
    CURRENT_DATE,
    '{
      "mcpCapability": "compliance_check",
      "contentToCheck": "这是最好的保险产品，收益率最高，绝对安全，保本保息！",
      "taskType": "mcp_compliance_check",
      "estimatedHours": 0.5,
      "acceptanceCriteria": "1. 成功调用 MCP 合规校验接口；2. 识别出违规内容；3. 提供修改建议"
    }'::jsonb,
    NOW(),
    NOW()
  ),
  -- 3. 上传一个摘要到微信公众
  (
    gen_random_uuid(),
    (SELECT id FROM inserted_daily_task),
    'insurance-d',
    '上传一个摘要到微信公众',
    '使用 MCP 微信公众号功能上传文章摘要到草稿箱。文章摘要："本文详细介绍了2025年保险市场的最新趋势，包括利率走势、产品创新和监管政策变化，帮助读者了解保险市场动态。" 要求：1. 生成标题和封面建议；2. 上传到微信公众号草稿箱；3. 返回草稿链接。',
    'pending',
    3,
    CURRENT_DATE,
    '{
      "mcpCapability": "wechat_public",
      "articleSummary": "本文详细介绍了2025年保险市场的最新趋势，包括利率走势、产品创新和监管政策变化，帮助读者了解保险市场动态。",
      "taskType": "mcp_wechat_upload",
      "estimatedHours": 0.5,
      "acceptanceCriteria": "1. 成功调用 MCP 微信公众号接口；2. 生成标题和封面建议；3. 上传到草稿箱并返回链接"
    }'::jsonb,
    NOW(),
    NOW()
  );

-- ============================================
-- 查询插入的结果
-- ============================================
SELECT 
  'daily_task' AS table_name,
  id,
  task_id,
  task_title
FROM daily_task 
WHERE task_id LIKE 'daily-task-mcp-test-%'
ORDER BY created_at DESC
LIMIT 1;

SELECT 
  'agent_sub_tasks' AS table_name,
  id,
  task_title,
  order_index,
  status
FROM agent_sub_tasks 
WHERE command_result_id IN (
  SELECT id FROM daily_task WHERE task_id LIKE 'daily-task-mcp-test-%'
)
ORDER BY order_index;


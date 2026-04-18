import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

async function queryExceptionTask() {
  try {
    const client = postgres(DATABASE_URL, { ssl: 'require' });
    
    // 查询异常测试任务
    const tasks = await client`
      SELECT task_id, task_name, task_status, created_at
      FROM agent_tasks
      WHERE task_id = ${'exception-test-1770720627595'}
    `;
    
    console.log('📋 异常测试任务状态:');
    console.table(tasks);

    // 查询异常补偿表
    const failures = await client`
      SELECT failure_id, task_id, task_name, exception_status, failure_reason, retry_count, created_at
      FROM split_failures
      ORDER BY created_at DESC
      LIMIT 5
    `;
    
    console.log('\n📋 异常补偿表记录（最近5条）:');
    console.table(failures);
    
    await client.end();
  } catch (error) {
    console.error('❌ 查询失败:', error);
  }
}

queryExceptionTask();

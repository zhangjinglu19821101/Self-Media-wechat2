/**
 * 直接查询数据库，检查任务是否创建
 */

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/multi_platform_publish_db?sslmode=require&channel_binding=require';

async function queryTasks() {
  try {
    const client = postgres(DATABASE_URL, { ssl: 'require' });
    
    // 查询最近创建的任务
    const tasks = await client`
      SELECT task_id, task_name, task_status, from_agent_id, to_agent_id, created_at
      FROM agent_tasks
      ORDER BY created_at DESC
      LIMIT 10
    `;
    
    console.log('📋 数据库中的最近10条任务:');
    console.table(tasks);
    
    await client.end();
  } catch (error) {
    console.error('❌ 查询数据库失败:', error);
  }
}

queryTasks();

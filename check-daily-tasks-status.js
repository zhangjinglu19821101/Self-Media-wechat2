#!/usr/bin/env node
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

async function main() {
  const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1 });
  try {
    console.log('🔍 检查 daily_task 状态...\n');
    
    const taskIdsToCheck = [
      '4a886929-93a0-444b-91d4-7e57e817bc35',
      'e301e076-1402-4370-a2b9-465021ed98eb',
      '8b3f5236-635e-45e4-86cb-3148d81fcff3',
    ];

    const records = await sql`
      SELECT 
        id,
        task_id,
        task_title,
        executor,
        execution_status,
        sub_task_count,
        retry_status,
        metadata::text
      FROM daily_task 
      WHERE id IN ${sql(taskIdsToCheck)}
      ORDER BY created_at DESC;
    `;
    
    console.log(`✅ 查询到 ${records.length} 条记录\n`);
    
    records.forEach((record, index) => {
      console.log(`=== 任务 ${index + 1} ===`);
      console.log(`  ID: ${record.id}`);
      console.log(`  Task ID: ${record.task_id}`);
      console.log(`  Title: ${record.task_title}`);
      console.log(`  Status: ${record.execution_status}`);
      console.log(`  Retry Status: ${record.retry_status}`);
      console.log(`  Sub-task Count: ${record.sub_task_count}`);
      
      if (record.metadata) {
        try {
          const metadata = JSON.parse(record.metadata);
          console.log(`  Insurance Split Confirmed: ${metadata.insuranceDSplitConfirmed}`);
        } catch (e) {}
      }
      console.log('');
    });

    // 检查 agent_sub_tasks 表
    console.log('🔍 检查 agent_sub_tasks 表...\n');
    const subTasks = await sql`
      SELECT COUNT(*) as count
      FROM agent_sub_tasks
      WHERE command_result_id IN ${sql(taskIdsToCheck)};
    `;
    console.log(`✅ agent_sub_tasks 表中有 ${subTasks[0].count} 条子任务\n`);

  } catch (e) { console.error('❌ 错误:', e); }
  finally { await sql.end(); }
}
main();

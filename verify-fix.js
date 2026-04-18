#!/usr/bin/env node
/**
 * 验证修复后的任务状态
 */

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

async function main() {
  const sql = postgres(DATABASE_URL, {
    ssl: 'require',
    max: 1,
  });

  try {
    console.log('🔍 验证修复后的任务状态...\n');
    
    const taskIdsToCheck = [
      'f467ae87-d336-4aa6-bf4f-fc6daa025891',
      '14e66a01-5ce6-4324-971f-ab55130c2c83',
      '41560269-e30f-4363-9b97-142a2d02ee56',
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
      console.log(`  Executor: ${record.executor}`);
      console.log(`  Status: ${record.execution_status}`);
      console.log(`  Retry Status: ${record.retry_status}`);
      console.log(`  Sub-task Count: ${record.sub_task_count}`);
      
      if (record.metadata) {
        try {
          const metadata = JSON.parse(record.metadata);
          console.log(`  Metadata:`);
          console.log(`    splitRejected: ${metadata.splitRejected}`);
          console.log(`    rejectionCount: ${metadata.rejectionCount}`);
          if (metadata.rejectionReason) {
            console.log(`    rejectionReason: ${metadata.rejectionReason}`);
          }
        } catch (e) {
          console.log(`  Metadata: (parse failed)`);
        }
      }
      console.log('');
    });

  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    await sql.end();
  }
}

main();

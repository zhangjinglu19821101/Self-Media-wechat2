#!/usr/bin/env node
/**
 * 查询 daily_task 表的详细数据
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
    console.log('🔍 查询 daily_task 表数据...\n');
    
    // 查询所有 insurance-d 的任务
    const records = await sql`
      SELECT 
        id,
        task_id,
        task_title,
        executor,
        execution_status,
        sub_task_count,
        to_agent_id,
        retry_status,
        metadata::text
      FROM daily_task 
      WHERE executor = 'insurance-d' OR to_agent_id = 'insurance-d'
      ORDER BY created_at DESC;
    `;
    
    console.log(`✅ 找到 ${records.length} 条 insurance-d 相关任务\n`);
    
    records.forEach((record, index) => {
      console.log(`=== 任务 ${index + 1} ===`);
      console.log(`  ID: ${record.id}`);
      console.log(`  Task ID: ${record.task_id}`);
      console.log(`  Title: ${record.task_title}`);
      console.log(`  Executor: ${record.executor}`);
      console.log(`  To Agent: ${record.to_agent_id}`);
      console.log(`  Status: ${record.execution_status}`);
      console.log(`  Retry Status: ${record.retry_status}`);
      console.log(`  Sub-task Count: ${record.sub_task_count}`);
      
      if (record.metadata) {
        try {
          const metadata = JSON.parse(record.metadata);
          console.log(`  Metadata:`, {
            splitRejected: metadata.splitRejected,
            splitAt: metadata.splitAt,
            lastSplitAt: metadata.lastSplitAt,
            rejectionReason: metadata.rejectionReason,
            rejectionCount: metadata.rejectionCount,
          });
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

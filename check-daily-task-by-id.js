#!/usr/bin/env node
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

async function main() {
  const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1 });
  try {
    console.log('🔍 验证 daily_task 表的 ID...\n');
    
    // 用 UUID 查询
    const uuidToCheck = '6097a118-0b4d-47e4-899b-17f73ce9d875';
    console.log(`尝试用 UUID 查询: ${uuidToCheck}`);
    
    const taskByUuid = await sql`
      SELECT id, task_id, execution_status, executor
      FROM daily_task
      WHERE id = ${uuidToCheck};
    `;
    
    if (taskByUuid.length > 0) {
      console.log('✅ 通过 UUID 找到任务:');
      console.log('  id (UUID):', taskByUuid[0].id);
      console.log('  task_id (业务ID):', taskByUuid[0].task_id);
    } else {
      console.log('❌ 未通过 UUID 找到任务');
    }

    // 用业务 ID 查询
    const businessIdToCheck = 'daily-task-insurance-d-2026-02-25-004';
    console.log(`\n尝试用业务 ID 查询: ${businessIdToCheck}`);
    
    const taskByBusinessId = await sql`
      SELECT id, task_id, execution_status, executor
      FROM daily_task
      WHERE task_id = ${businessIdToCheck};
    `;
    
    if (taskByBusinessId.length > 0) {
      console.log('✅ 通过业务 ID 找到任务:');
      console.log('  id (UUID):', taskByBusinessId[0].id);
      console.log('  task_id (业务ID):', taskByBusinessId[0].task_id);
    } else {
      console.log('❌ 未通过业务 ID 找到任务');
    }

    console.log('\n📋 总结:');
    console.log('  - daily_task.id = UUID（主键）');
    console.log('  - daily_task.task_id = 业务 ID（如 daily-task-insurance-d-2026-02-25-004）');
    console.log('  - notification.metadata.dailyTaskIds = 真正的 UUID 数组！');

  } catch (e) { console.error('❌ 错误:', e); }
  finally { await sql.end(); }
}
main();

#!/usr/bin/env node
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

async function main() {
  const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1 });
  try {
    console.log('🔄 重置单个任务，准备完整测试...\n');
    
    const taskId = '250dc85e-8a75-4061-8a7f-e7c1ce4d243e';

    // 1. 删除该任务的子任务
    const deletedSubTasks = await sql`
      DELETE FROM agent_sub_tasks
      WHERE command_result_id = ${taskId};
    `;
    console.log(`🗑️  删除子任务: ${deletedSubTasks.count} 条`);

    // 2. 重置 daily_task 状态
    await sql`
      UPDATE daily_task
      SET 
        execution_status = ${'pending_review'},
        sub_task_count = 0,
        updated_at = NOW()
      WHERE id = ${taskId};
    `;
    console.log(`🔄 重置任务状态为 pending_review`);

    // 3. 显示当前状态
    const task = await sql`
      SELECT id, task_id, execution_status, sub_task_count
      FROM daily_task
      WHERE id = ${taskId};
    `;
    
    console.log('\n✅ 任务状态:');
    console.log('  task_id:', task[0].task_id);
    console.log('  execution_status:', task[0].execution_status);
    console.log('  sub_task_count:', task[0].sub_task_count);

    console.log('\n✅ 准备完成！现在可以测试了！');

  } catch (e) { console.error('❌ 错误:', e); }
  finally { await sql.end(); }
}
main();

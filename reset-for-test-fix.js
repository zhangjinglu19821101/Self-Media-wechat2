#!/usr/bin/env node
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

async function main() {
  const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1 });
  try {
    console.log('🔄 重置任务状态，准备测试修复版...\n');
    
    const affectedTaskIds = [
      '250dc85e-8a75-4061-8a7f-e7c1ce4d243e',
      'a10b2474-c1e6-46e3-bdd0-0407eb74a678',
      '7f221218-be79-4416-be68-114d29174911'
    ];

    for (const taskId of affectedTaskIds) {
      // 1. 删除该任务的子任务
      const deletedSubTasks = await sql`
        DELETE FROM agent_sub_tasks
        WHERE command_result_id = ${taskId};
      `;
      console.log(`🗑️  删除任务 ${taskId} 的子任务: ${deletedSubTasks.count} 条`);

      // 2. 重置 daily_task 状态
      await sql`
        UPDATE daily_task
        SET 
          execution_status = ${'pending_review'},
          sub_task_count = 0,
          updated_at = NOW()
        WHERE id = ${taskId};
      `;
      console.log(`🔄 重置任务 ${taskId} 状态为 pending_review`);
    }

    // 3. 显示更新后的状态
    console.log('\n✅ 重置完成！当前任务状态：');
    const tasks = await sql`
      SELECT id, task_id, execution_status, sub_task_count, executor
      FROM daily_task
      WHERE id IN (${affectedTaskIds})
      ORDER BY created_at DESC;
    `;
    
    tasks.forEach((t, i) => {
      console.log(`  ${i+1}. ${t.task_id} (${t.id})`);
      console.log(`     状态: ${t.execution_status}, 子任务数: ${t.sub_task_count}, executor: ${t.executor}`);
    });

    // 4. 显示最新通知
    console.log('\n📋 最新通知（用于测试）：');
    const notifications = await sql`
      SELECT id, notification_id, notification_type, is_read, created_at
      FROM agent_notifications
      WHERE notification_type = 'split_result'
      ORDER BY created_at DESC
      LIMIT 3;
    `;
    
    notifications.forEach((n, i) => {
      console.log(`  ${i+1}. id: ${n.id}`);
      console.log(`     notification_id: ${n.notification_id}`);
      console.log(`     is_read: ${n.is_read}, created_at: ${n.created_at}`);
    });

    console.log('\n✅ 现在可以在前端点击确认按钮测试修复版 API 了！');
    console.log('📌 API 地址: /api/agent-sub-tasks/confirm-split-fix');

  } catch (e) { console.error('❌ 错误:', e); }
  finally { await sql.end(); }
}
main();

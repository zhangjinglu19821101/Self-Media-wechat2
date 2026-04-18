#!/usr/bin/env node
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

async function main() {
  const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1 });
  try {
    console.log('🔍 检查当前任务状态...\n');
    
    // 显示最近的 3 个任务
    const tasks = await sql`
      SELECT id, task_id, execution_status, sub_task_count, executor, created_at
      FROM daily_task
      WHERE executor = 'insurance-d'
      ORDER BY created_at DESC
      LIMIT 3;
    `;
    
    console.log('✅ 当前 insurance-d 任务:');
    tasks.forEach((t, i) => {
      console.log(`  ${i+1}. ${t.task_id}`);
      console.log(`     id: ${t.id}`);
      console.log(`     状态: ${t.execution_status}, 子任务数: ${t.sub_task_count}`);
      console.log(`     创建时间: ${t.created_at}`);
    });

    // 显示最新通知
    console.log('\n📋 最新通知:');
    const notifications = await sql`
      SELECT id, notification_id, notification_type, is_read, created_at
      FROM agent_notifications
      ORDER BY created_at DESC
      LIMIT 3;
    `;
    
    notifications.forEach((n, i) => {
      console.log(`  ${i+1}. 类型: ${n.notification_type}`);
      console.log(`     id: ${n.id}`);
      console.log(`     is_read: ${n.is_read}`);
    });

    console.log('\n✅ 准备完成！现在可以在前端点击确认按钮测试修复版 API！');
    console.log('📌 修复版 API 地址: /api/agent-sub-tasks/confirm-split-fix');

  } catch (e) { console.error('❌ 错误:', e); }
  finally { await sql.end(); }
}
main();

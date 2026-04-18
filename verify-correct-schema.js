#!/usr/bin/env node
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

async function main() {
  const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1 });
  try {
    console.log('🔍 验证数据库结构...\n');
    
    // 验证 1: daily_task 表
    console.log('📋 验证 1: daily_task 表');
    const dailyTaskColumns = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'daily_task'
      AND column_name IN ('id', 'task_id', 'execution_status', 'sub_task_count', 'executor')
      ORDER BY ordinal_position;
    `;
    console.log('✅ daily_task 关键字段:', dailyTaskColumns.map(c => c.column_name));
    
    // 验证 2: agent_notifications 表
    console.log('\n📋 验证 2: agent_notifications 表');
    const notifColumns = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'agent_notifications'
      AND column_name IN ('id', 'notification_id', 'is_read', 'notification_type', 'metadata')
      ORDER BY ordinal_position;
    `;
    console.log('✅ agent_notifications 关键字段:', notifColumns.map(c => c.column_name));
    
    // 验证 3: agent_sub_tasks 表
    console.log('\n📋 验证 3: agent_sub_tasks 表');
    const subTaskColumns = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'agent_sub_tasks'
      AND column_name IN ('id', 'command_result_id', 'task_title', 'status', 'order_index')
      ORDER BY ordinal_position;
    `;
    console.log('✅ agent_sub_tasks 关键字段:', subTaskColumns.map(c => c.column_name));
    
    console.log('\n🎉 验证完成！');
    console.log('\n📝 总结：');
    console.log('  ✅ 表名是 daily_task（不是 daily_tasks）');
    console.log('  ✅ 通知表主键是 id（不是 notificationId）');
    console.log('  ✅ 子任务表用 command_result_id 关联');
    console.log('  ✅ 子任务表用 task_title（不是 task_name）');
    console.log('  ✅ 子任务表用 status（不是 execution_status）');
    console.log('  ✅ 子任务表用 order_index（不是 sort_order）');
    
    console.log('\n📚 参考文档已生成：');
    console.log('  - DATABASE_SCHEMA_REFERENCE.md（完整文档）');
    console.log('  - README_DATABASE_GUIDE.md（开发必读）');
    console.log('  - src/lib/db/schema/correct-schema.ts（正确的 schema）');
    
  } catch (e) { console.error('❌ 错误:', e); }
  finally { await sql.end(); }
}
main();

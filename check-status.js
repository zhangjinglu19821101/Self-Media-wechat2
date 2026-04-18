#!/usr/bin/env node
/**
 * 检查 order_index=1 的当前状态
 */

const postgres = require('postgres');

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

async function checkCurrentStatus() {
  console.log('🔍 查询 order_index=1 的当前状态...\n');

  const client = postgres(DATABASE_URL, {
    ssl: 'require',
    max: 10,
    idle_timeout: 20,
    connect_timeout: 60,
  });

  try {
    // 查询 order_index=1 的记录
    const subtasks = await client.unsafe('SELECT * FROM agent_sub_tasks WHERE order_index = $1', [1]);

    if (subtasks.length === 0) {
      console.log('❌ 未找到 order_index=1 的记录\n');
      return;
    }

    const task = subtasks[0];
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 order_index=1 当前状态');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('ID:', task.id);
    console.log('status:', task.status);
    console.log('dialogue_status:', task.dialogue_status);
    console.log('completed_at:', task.completed_at);
    console.log('updated_at:', task.updated_at);
    console.log('');

    // 判断问题是否还存在
    const problemStillExists = task.status === 'waiting_user' && task.completed_at !== null;
    
    if (problemStillExists) {
      console.log('🔴 ⚠️  问题仍然存在！');
      console.log('   status = waiting_user 但 completed_at 有值');
      console.log('');
      console.log('建议：可以手动修复这条记录');
    } else if (task.status === 'completed') {
      console.log('✅ 状态正确！');
      console.log('   status = completed');
    } else {
      console.log('当前状态:', task.status);
    }
    console.log('');

    // 显示 result_data 的内容
    if (task.result_data) {
      console.log('📦 result_data 内容:');
      const resultData = typeof task.result_data === 'string' ? JSON.parse(task.result_data) : task.result_data;
      console.log('  isNeedMcp:', resultData.isNeedMcp);
      console.log('  isTaskDown:', resultData.isTaskDown);
      console.log('');
    }

    // 查询所有记录概览
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 所有记录概览');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const allTasks = await client.unsafe(
      'SELECT id, order_index, status, dialogue_status, task_title, created_at, updated_at FROM agent_sub_tasks ORDER BY order_index'
    );
    allTasks.forEach(t => {
      console.log(`[${t.order_index}] ${t.id.substring(0, 8)}... | ${t.status} | ${t.dialogue_status} | ${t.task_title.substring(0, 30)}...`);
    });

  } catch (error) {
    console.error('❌ 查询失败:', error);
  } finally {
    await client.end();
  }
}

checkCurrentStatus().then(() => {
  console.log('\n✅ 查询完成！');
  process.exit(0);
}).catch((error) => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});

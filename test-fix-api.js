#!/usr/bin/env node
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

async function main() {
  const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1 });
  try {
    console.log('🔍 获取测试数据...\n');
    
    // 获取最新的未读通知
    const notifications = await sql`
      SELECT *
      FROM agent_notifications
      WHERE notification_type = 'insurance_d_split_result'
      ORDER BY created_at DESC
      LIMIT 1;
    `;

    if (notifications.length === 0) {
      console.log('❌ 没有找到通知');
      return;
    }

    const notification = notifications[0];
    console.log('✅ 找到通知:');
    console.log('  id:', notification.id);
    console.log('  notification_id:', notification.notification_id);
    console.log('  notification_type:', notification.notification_type);

    // 获取任务
    const tasks = await sql`
      SELECT *
      FROM daily_task
      WHERE executor = 'insurance-d'
      ORDER BY created_at DESC
      LIMIT 1;
    `;

    if (tasks.length === 0) {
      console.log('❌ 没有找到任务');
      return;
    }

    const task = tasks[0];
    console.log('\n✅ 找到任务:');
    console.log('  id:', task.id);
    console.log('  task_id:', task.task_id);
    console.log('  execution_status:', task.execution_status);
    console.log('  sub_task_count:', task.sub_task_count);

    // 解析 metadata
    let splitResult = null;
    if (notification.metadata) {
      try {
        const meta = typeof notification.metadata === 'string' 
          ? JSON.parse(notification.metadata) 
          : notification.metadata;
        
        console.log('\n✅ 通知 metadata:', Object.keys(meta));
        
        // 尝试获取 splitResult
        if (meta.pendingSubTasksByTask) {
          const taskIds = Object.keys(meta.pendingSubTasksByTask);
          if (taskIds.length > 0) {
            splitResult = { subTasks: meta.pendingSubTasksByTask[taskIds[0]] };
            console.log(`✅ 从 pendingSubTasksByTask 解析到 ${splitResult.subTasks.length} 个子任务`);
          }
        }
      } catch (e) {
        console.log('⚠️ 解析 metadata 失败:', e);
      }
    }

    if (!splitResult) {
      // 创建一个模拟的 splitResult
      console.log('\n⚠️ 未找到 splitResult，创建模拟数据');
      splitResult = {
        subTasks: [
          {
            taskName: '测试子任务 1',
            taskDescription: '这是测试子任务 1 的描述',
            executor: 'Agent B',
            taskPriority: 'normal',
            deliverables: '测试交付物 1'
          },
          {
            taskName: '测试子任务 2',
            taskDescription: '这是测试子任务 2 的描述',
            executor: 'Agent B',
            taskPriority: 'high',
            deliverables: '测试交付物 2'
          }
        ]
      };
    }

    console.log('\n🚀 调用修复版 API...');
    console.log('📌 测试数据:');
    console.log('  - notificationId:', notification.id);
    console.log('  - taskId:', task.id);
    console.log('  - subTasks:', splitResult.subTasks?.length || 0);

    // 调用修复版 API
    const response = await fetch('http://localhost:5000/api/agent-sub-tasks/confirm-split-fix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notificationId: notification.id,
        splitResult: splitResult,
        taskId: task.id
      })
    });

    console.log('\n📡 API 响应状态:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API 调用失败:', errorText);
    } else {
      const result = await response.json();
      console.log('✅ API 调用成功:', result);
    }

    // 检查结果
    console.log('\n🔍 检查最终状态...');
    
    const updatedTask = await sql`
      SELECT * FROM daily_task WHERE id = ${task.id};
    `;
    
    console.log('✅ 任务更新后:');
    console.log('  execution_status:', updatedTask[0].execution_status);
    console.log('  sub_task_count:', updatedTask[0].sub_task_count);

    const subTasks = await sql`
      SELECT * FROM agent_sub_tasks WHERE command_result_id = ${task.id};
    `;
    
    console.log(`✅ 子任务数量: ${subTasks.length}`);
    subTasks.forEach((st, i) => {
      console.log(`  ${i+1}. ${st.task_name}`);
    });

  } catch (e) { console.error('❌ 错误:', e); }
  finally { await sql.end(); }
}
main();

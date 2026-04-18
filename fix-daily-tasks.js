#!/usr/bin/env node
/**
 * 修复 daily_task 表中需要重新拆解的任务
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
    console.log('🔍 找到需要修复的任务...\n');
    
    // 需要修复的任务ID列表
    const taskIdsToFix = [
      'f467ae87-d336-4aa6-bf4f-fc6daa025891', // 任务4 - 被拒绝的
      '14e66a01-5ce6-4324-971f-ab55130c2c83', // 任务5 - 卡在splitting
      '41560269-e30f-4363-9b97-142a2d02ee56', // 任务6 - 卡在splitting
    ];

    console.log('📋 准备修复以下任务:');
    taskIdsToFix.forEach((id, index) => {
      console.log(`  ${index + 1}. ${id}`);
    });
    console.log('');

    // 查询这些任务的当前状态
    const currentTasks = await sql`
      SELECT id, task_id, task_title, execution_status, sub_task_count, metadata::text
      FROM daily_task 
      WHERE id IN ${sql(taskIdsToFix)}
      ORDER BY created_at DESC;
    `;

    console.log('📊 当前状态:');
    currentTasks.forEach(task => {
      console.log(`\n  任务: ${task.task_title}`);
      console.log(`    ID: ${task.id}`);
      console.log(`    Status: ${task.execution_status}`);
      console.log(`    Sub-tasks: ${task.sub_task_count}`);
      if (task.metadata) {
        try {
          const metadata = JSON.parse(task.metadata);
          console.log(`    Rejected: ${metadata.splitRejected}`);
          if (metadata.rejectionReason) {
            console.log(`    Reason: ${metadata.rejectionReason}`);
          }
        } catch (e) {}
      }
    });

    console.log('\n🔧 开始修复...\n');

    // 1. 重置所有需要修复的任务
    for (const taskId of taskIdsToFix) {
      console.log(`\n处理任务: ${taskId}`);
      
      // 获取当前任务数据
      const [task] = await sql`
        SELECT metadata::text
        FROM daily_task 
        WHERE id = ${taskId};
      `;

      let currentMetadata = {};
      if (task && task.metadata) {
        try {
          currentMetadata = JSON.parse(task.metadata);
        } catch (e) {}
      }

      // 更新任务状态
      await sql`
        UPDATE daily_task
        SET 
          execution_status = 'pending_review',
          retry_status = 'pending',
          sub_task_count = 0,
          completed_sub_tasks = 0,
          metadata = ${sql.json({
            ...currentMetadata,
            splitRejected: true, // 🔥 关键：设置为已拒绝，这样会触发重新拆解
            splitRejectedAt: new Date().toISOString(),
            // 保留原来的拒绝原因（如果有）
            rejectionReason: currentMetadata.rejectionReason || '需要重新拆解',
            rejectionCount: (currentMetadata.rejectionCount || 0) + 1,
            // 清除拆分相关字段
            splitResult: undefined,
            splitAt: undefined,
            lastSplitAt: undefined,
            splitCompletedAt: undefined,
            splitStartTime: undefined,
          })}::jsonb,
          updated_at = NOW()
        WHERE id = ${taskId};
      `;

      console.log(`  ✅ 已重置任务状态`);

      // 删除相关的子任务
      await sql`
        DELETE FROM agent_sub_tasks
        WHERE command_result_id = ${taskId};
      `;

      console.log(`  ✅ 已删除相关子任务`);
    }

    console.log('\n✅ 所有任务已重置完成！');

    // 验证修复结果
    const fixedTasks = await sql`
      SELECT id, task_id, task_title, execution_status, sub_task_count, metadata::text
      FROM daily_task 
      WHERE id IN ${sql(taskIdsToFix)}
      ORDER BY created_at DESC;
    `;

    console.log('\n🔍 验证修复结果:');
    fixedTasks.forEach(task => {
      console.log(`\n  任务: ${task.task_title}`);
      console.log(`    ID: ${task.id}`);
      console.log(`    Status: ${task.execution_status}`);
      console.log(`    Sub-tasks: ${task.sub_task_count}`);
      if (task.metadata) {
        try {
          const metadata = JSON.parse(task.metadata);
          console.log(`    Rejected: ${metadata.splitRejected}`);
          console.log(`    Rejection Count: ${metadata.rejectionCount}`);
        } catch (e) {}
      }
    });

    console.log('\n🎉 修复完成！');
    console.log('\n📋 下一步: 通过 API 触发重新拆解');
    console.log('任务 IDs:');
    taskIdsToFix.forEach(id => {
      console.log(`  - ${id}`);
    });

  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    await sql.end();
  }
}

main();

#!/usr/bin/env node
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

async function main() {
  const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1 });
  try {
    console.log('🔧 重置任务，用于重新测试确认流程...\n');
    
    const taskIdsToReset = [
      '4a886929-93a0-444b-91d4-7e57e817bc35',
      'e301e076-1402-4370-a2b9-465021ed98eb',
      '8b3f5236-635e-45e4-86cb-3148d81fcff3',
    ];

    console.log('📋 任务列表:');
    taskIdsToReset.forEach((id, i) => console.log(`  ${i+1}. ${id}`));
    console.log('');

    for (const taskId of taskIdsToReset) {
      console.log(`重置任务: ${taskId}`);
      
      const [task] = await sql`SELECT metadata::text FROM daily_task WHERE id = ${taskId}`;
      let currentMetadata = {};
      if (task && task.metadata) {
        try { currentMetadata = JSON.parse(task.metadata); } catch (e) {}
      }

      await sql`
        UPDATE daily_task
        SET 
          execution_status = 'pending_review',
          retry_status = 'pending',
          sub_task_count = 0,
          completed_sub_tasks = 0,
          metadata = ${sql.json({
            ...currentMetadata,
            // 清除确认相关标记
            insuranceDSplitConfirmed: undefined,
            insuranceDSplitConfirmedAt: undefined,
            splitNotificationId: undefined,
          })}::jsonb,
          updated_at = NOW()
        WHERE id = ${taskId};
      `;
      
      // 删除可能存在的子任务
      await sql`DELETE FROM agent_sub_tasks WHERE command_result_id = ${taskId}`;
      
      console.log('  ✅ 完成\n');
    }

    console.log('✅ 全部重置完成！\n');
    console.log('📋 现在可以重新测试确认流程了！\n');
    console.log('📝 测试步骤：');
    console.log('  1. 刷新页面');
    console.log('  2. 看到 insurance-d 拆解弹框');
    console.log('  3. 点击确认按钮');
    console.log('  4. 验证确认成功！');

  } catch (e) { console.error('❌ 错误:', e); }
  finally { await sql.end(); }
}
main();

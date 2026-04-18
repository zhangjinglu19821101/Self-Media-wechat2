#!/usr/bin/env node
const { db } = require('../.next/server/app/lib/db');
const { agentSubTasks } = require('../.next/server/app/lib/db/schema');
const { eq } = require('drizzle-orm');

async function main() {
  console.log('=== 查找并更新 order_index=4 任务状态...\n');
  
  try {
    // 查找 order_index=4 的任务
    const order4Tasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.orderIndex, 4));
    
    console.log(`找到 ${order4Tasks.length} 个 order_index=4 的任务:\n`);
    
    for (const task of order4Tasks) {
      console.log(`  ID: ${task.id}`);
      console.log(`  当前状态: ${task.status}`);
      console.log(`  任务标题: ${task.taskTitle}`);
      console.log(`  Command Result ID: ${task.commandResultId}`);
      console.log();
      
      // 如果状态是 waiting_user，更新为 pending
      if (task.status === 'waiting_user') {
        console.log(`  🔄 将状态从 waiting_user 更新为 pending...`);
        
        await db
          .update(agentSubTasks)
          .set({
            status: 'pending',
            startedAt: null, // 清空开始时间，让系统重新开始
          })
          .where(eq(agentSubTasks.id, task.id));
        
        console.log(`  ✅ 更新完成！`);
        console.log();
      }
    }
    
    console.log('=== 操作完成 ===');
  } catch (error) {
    console.error('错误:', error);
  }
}

main();
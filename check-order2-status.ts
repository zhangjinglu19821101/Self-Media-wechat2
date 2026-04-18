
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

async function checkOrder2Status() {
  console.log('🔍 查询 order_index = 2 的任务状态...');
  
  const tasks = await db
    .select()
    .from(agentSubTasks)
    .where(eq(agentSubTasks.orderIndex, 2))
    .orderBy(agentSubTasks.createdAt);
  
  console.log(`\n📊 找到 ${tasks.length} 个 order_index = 2 的任务：\n`);
  
  for (const task of tasks) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`任务ID: ${task.id}`);
    console.log(`order_index: ${task.orderIndex}`);
    console.log(`状态: ${task.status}`);
    console.log(`任务标题: ${task.taskTitle}`);
    console.log(`执行者: ${task.fromParentsExecutor}`);
    console.log(`startedAt: ${task.startedAt?.toISOString() || 'null'}`);
    console.log(`updatedAt: ${task.updatedAt?.toISOString() || 'null'}`);
    
    if (task.startedAt) {
      const now = new Date();
      const elapsedMs = now.getTime() - task.startedAt.getTime();
      const elapsedMinutes = elapsedMs / 1000 / 60;
      console.log(`⏱️  已执行时间: ${elapsedMinutes.toFixed(2)} 分钟`);
    }
    
    console.log('');
  }
  
  console.log('✅ 查询完成');
}

checkOrder2Status().catch(console.error);



import { db } from './src/lib/db';
import { agentSubTasks } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

console.log('🔍 调试特定任务的执行结果');
console.log('='.repeat(80));

async function debugSpecificTask() {
  try {
    // 查询 order_index=2, status=waiting_user 的任务
    const tasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.status, 'waiting_user'));
    
    console.log(`找到 ${tasks.length} 个 waiting_user 状态的任务`);
    
    if (tasks.length === 0) {
      console.log('没有找到 waiting_user 状态的任务');
      return;
    }
    
    // 详细分析第一个任务
    const task = tasks[0];
    console.log('\n📋 任务详情:');
    console.log('  task_id:', task.id);
    console.log('  order_index:', task.orderIndex);
    console.log('  status:', task.status);
    console.log('  executor:', task.fromParentsExecutor);
    console.log('  task_title:', task.taskTitle);
    console.log('  created_at:', task.createdAt?.toISOString());
    console.log('  started_at:', task.startedAt?.toISOString());
    console.log('  updated_at:', task.updatedAt?.toISOString());
    
    // 检查 execution_result
    console.log('\n💾 execution_result:');
    console.log('  存在:', !!task.executionResult);
    console.log('  长度:', task.executionResult?.length || 0);
    
    if (task.executionResult) {
      console.log('  内容:', task.executionResult);
      try {
        const parsed = JSON.parse(task.executionResult);
        console.log('  解析结果:', parsed);
      } catch (e) {
        console.log('  解析失败:', e);
      }
    }
    
    // 查看同组其他任务
    if (task.commandResultId) {
      console.log('\n👥 同组其他任务:');
      const groupTasks = await db
        .select()
        .from(agentSubTasks)
        .where(eq(agentSubTasks.commandResultId, task.commandResultId))
        .orderBy(agentSubTasks.orderIndex);
      
      groupTasks.forEach((t, i) => {
        console.log(`  ${i+1}. order=${t.orderIndex}, status=${t.status}, exec_result=!!${!!t.executionResult}`);
      });
      
      // 查看 order_index=1 的任务
      const order1Task = groupTasks.find(t => t.orderIndex === 1);
      if (order1Task) {
        console.log('\n📌 order_index=1 的任务:');
        console.log('  status:', order1Task.status);
        console.log('  has_execution_result:', !!order1Task.executionResult);
        if (order1Task.executionResult) {
          console.log('  execution_result:', order1Task.executionResult);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ 调试出错:', error);
  }
}

debugSpecificTask();


import { db } from './src/lib/db';
import { agentSubTasks } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

console.log('🔍 测试 order_index=1 任务的执行');
console.log('='.repeat(80));

async function testOrder1Execution() {
  try {
    // 1. 查询 order_index=1 的任务
    console.log('\n📊 步骤1: 查询 order_index=1 的任务...');
    const tasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.orderIndex, 1))
      .limit(1);
    
    if (tasks.length === 0) {
      console.log('❌ 没有找到 order_index=1 的任务');
      return;
    }
    
    const task = tasks[0];
    console.log('✅ 找到任务:');
    console.log('  id:', task.id);
    console.log('  order_index:', task.orderIndex);
    console.log('  status:', task.status);
    console.log('  executor:', task.fromParentsExecutor);
    console.log('  task_title:', task.taskTitle);
    console.log('  has_execution_result:', !!task.executionResult);
    
    // 2. 查看同组任务
    if (task.commandResultId) {
      console.log('\n👥 步骤2: 查看同组任务...');
      const groupTasks = await db
        .select()
        .from(agentSubTasks)
        .where(eq(agentSubTasks.commandResultId, task.commandResultId))
        .orderBy(agentSubTasks.orderIndex);
      
      console.log(`  同组共 ${groupTasks.length} 个任务:`);
      groupTasks.forEach((t, i) => {
        console.log(`    ${i+1}. order=${t.orderIndex}, status=${t.status}, has_exec_result=!!${!!t.executionResult}`);
      });
    }
    
    // 3. 显示当前的 execution_result
    if (task.executionResult) {
      console.log('\n💾 步骤3: 当前 execution_result:');
      console.log('  长度:', task.executionResult.length);
      try {
        const parsed = JSON.parse(task.executionResult);
        console.log('  解析结果:', JSON.stringify(parsed, null, 2));
      } catch (e) {
        console.log('  解析失败:', e);
        console.log('  原始内容:', task.executionResult);
      }
    }
    
    console.log('\n✅ 查询完成！');
    console.log('='.repeat(80));
    console.log('\n📝 要测试执行，可以:');
    console.log('1. 把该任务的 status 改为 pending');
    console.log('2. 清空 execution_result');
    console.log('3. 触发执行引擎');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

testOrder1Execution();

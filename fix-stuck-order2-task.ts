
import { db } from '@/lib/db';
import { agentSubTasks, agentSubTasksStepHistory } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCurrentBeijingTime } from '@/lib/utils/date-time';

async function fixStuckOrder2Task() {
  console.log('🔧 修复 order_index = 2 的卡住任务...\n');
  
  // 1. 查询 order_index = 2 的任务
  const tasks = await db
    .select()
    .from(agentSubTasks)
    .where(eq(agentSubTasks.orderIndex, 2))
    .orderBy(agentSubTasks.createdAt);
  
  if (tasks.length === 0) {
    console.log('❌ 没有找到 order_index = 2 的任务');
    return;
  }
  
  const task = tasks[0];
  console.log('📋 当前任务信息：');
  console.log(`   任务ID: ${task.id}`);
  console.log(`   当前状态: ${task.status}`);
  console.log(`   任务标题: ${task.taskTitle}`);
  console.log(`   commandResultId: ${task.commandResultId}`);
  
  if (task.status !== 'waiting_user') {
    console.log('⚠️  任务状态不是 waiting_user，不需要修复');
    return;
  }
  
  // 2. 查询历史记录，提取合规审核结果
  console.log(`\n📜 查询历史记录...`);
  
  const historyRecords = await db
    .select()
    .from(agentSubTasksStepHistory)
    .where(
      and(
        eq(agentSubTasksStepHistory.commandResultId, task.commandResultId),
        eq(agentSubTasksStepHistory.stepNo, task.orderIndex)
      )
    )
    .orderBy(agentSubTasksStepHistory.interactTime);
  
  console.log(`   找到 ${historyRecords.length} 条历史记录`);
  
  // 从历史记录中提取合规审核结果
  let complianceResult: any = null;
  
  for (const record of historyRecords) {
    if (record.interactContent) {
      try {
        const content = typeof record.interactContent === 'string' 
          ? JSON.parse(record.interactContent) 
          : record.interactContent;
        
        // 检查是否包含合规审核结果
        if (content.question?.result?.scores || 
            content.question?.result?.summary || 
            content.question?.result?.findings) {
          complianceResult = content.question.result;
          console.log('✅ 从历史记录中找到合规审核结果');
          console.log('   审核结果:', JSON.stringify(complianceResult, null, 2).substring(0, 500));
          break;
        }
      } catch (e) {
        console.log('   解析历史记录失败:', e);
      }
    }
  }
  
  if (!complianceResult) {
    console.log('❌ 没有找到合规审核结果，无法修复');
    return;
  }
  
  // 3. 更新任务状态为 completed
  console.log(`\n🔧 更新任务状态为 completed...`);
  
  const completionResult = {
    success: true,
    complianceResult: complianceResult,
    completionType: 'mcp_audit_complete',
    message: '合规审核已完成',
    completedAt: getCurrentBeijingTime().toISOString()
  };
  
  await db
    .update(agentSubTasks)
    .set({
      status: 'completed',
      resultText: JSON.stringify(completionResult),
      completedAt: getCurrentBeijingTime(),
      updatedAt: getCurrentBeijingTime()
    })
    .where(eq(agentSubTasks.id, task.id));
  
  console.log('✅ 任务状态已更新为 completed');
  
  // 4. 查询更新后的状态验证
  const updatedTask = await db
    .select()
    .from(agentSubTasks)
    .where(eq(agentSubTasks.id, task.id));
  
  if (updatedTask.length > 0) {
    console.log('\n📊 验证修复结果：');
    console.log(`   任务ID: ${updatedTask[0].id}`);
    console.log(`   新状态: ${updatedTask[0].status}`);
    console.log(`   completedAt: ${updatedTask[0].completedAt?.toISOString() || 'null'}`);
  }
  
  console.log('\n✅ 修复完成！order_index = 2 的任务已从 waiting_user 状态恢复为 completed');
}

fixStuckOrder2Task().catch(console.error);


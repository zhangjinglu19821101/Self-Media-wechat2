
import { db } from '@/lib/db';
import { agentSubTasks, agentSubTasksStepHistory } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

async function analyzeHistorySchema() {
  console.log('🔍 分析历史记录表结构和数据...\n');
  
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
  
  console.log('📋 任务信息：');
  console.log(`   任务ID: ${task.id}`);
  console.log(`   状态: ${task.status}`);
  console.log(`   commandResultId: ${task.commandResultId}`);
  console.log(`   order_index: ${task.orderIndex}`);
  
  if (task.resultText) {
    console.log(`   📝 resultText:`);
    try {
      const result = JSON.parse(task.resultText);
      console.log(JSON.stringify(result, null, 2));
    } catch (e) {
      console.log(`   (原始): ${task.resultText}`);
    }
  }
  
  // 2. 查询历史记录
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
  
  console.log(`   找到 ${historyRecords.length} 条历史记录\n`);
  
  for (let i = 0; i < historyRecords.length; i++) {
    const record = historyRecords[i];
    console.log(`   ━━━━━━━━ 历史记录 ${i + 1}/${historyRecords.length} ━━━━━━━━`);
    console.log(`      ID: ${record.id}`);
    console.log(`      interactType: ${record.interactType}`);
    console.log(`      interactNum: ${record.interactNum}`);
    console.log(`      interactUser: ${record.interactUser}`);
    console.log(`      interactTime: ${record.interactTime?.toISOString() || 'null'}`);
    
    // 检查 interactContent 字段
    if (record.interactContent) {
      console.log(`      📦 有 interactContent 数据`);
      try {
        const content = typeof record.interactContent === 'string' 
          ? JSON.parse(record.interactContent) 
          : record.interactContent;
        console.log(`      interactContent:`, JSON.stringify(content, null, 2).substring(0, 800));
      } catch (e) {
        console.log(`      interactContent (原始):`, String(record.interactContent).substring(0, 400));
      }
    } else {
      console.log(`      ❌ 无 interactContent 数据`);
    }
    
    console.log(``);
  }
  
  // 3. 检查字段映射问题
  console.log(`\n🔍 检查代码中使用的字段名...`);
  console.log(`   表结构字段: interactContent`);
  console.log(`   代码中可能使用的旧字段: question, response, executionResult`);
  
  console.log('\n✅ 分析完成');
}

analyzeHistorySchema().catch(console.error);


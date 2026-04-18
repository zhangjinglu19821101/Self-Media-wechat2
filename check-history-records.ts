
import { db } from '@/lib/db';
import { agentSubTasks, agentSubTasksStepHistory } from '@/lib/db/schema';
import { agentSubTasksMcpExecutions } from '@/lib/db/schema/agent-sub-tasks-mcp-executions';
import { eq, and, desc } from 'drizzle-orm';

async function checkHistoryRecords() {
  console.log('🔍 查询 order_index = 2 的任务及其历史记录...\n');
  
  // 1. 先查询 order_index = 2 的任务
  const tasks = await db
    .select()
    .from(agentSubTasks)
    .where(eq(agentSubTasks.orderIndex, 2))
    .orderBy(agentSubTasks.createdAt);
  
  if (tasks.length === 0) {
    console.log('❌ 没有找到 order_index = 2 的任务');
    return;
  }
  
  console.log(`📊 找到 ${tasks.length} 个 order_index = 2 的任务：\n`);
  
  for (const task of tasks) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📋 任务信息：`);
    console.log(`   任务ID: ${task.id}`);
    console.log(`   order_index: ${task.orderIndex}`);
    console.log(`   状态: ${task.status}`);
    console.log(`   任务标题: ${task.taskTitle}`);
    console.log(`   commandResultId: ${task.commandResultId}`);
    console.log(`   执行者: ${task.fromParentsExecutor}`);
    console.log(`   startedAt: ${task.startedAt?.toISOString() || 'null'}`);
    console.log(`   updatedAt: ${task.updatedAt?.toISOString() || 'null'}`);
    
    if (task.resultText) {
      console.log(`   📝 有 resultText`);
      try {
        const result = JSON.parse(task.resultText);
        console.log(`   resultText 内容:`, JSON.stringify(result, null, 2).substring(0, 500));
      } catch (e) {
        console.log(`   resultText (原始): ${task.resultText.substring(0, 200)}`);
      }
    } else {
      console.log(`   ❌ 无 resultText`);
    }
    
    // 2. 查询该任务的历史记录
    console.log(`\n📜 查询历史记录 (commandResultId=${task.commandResultId}, stepNo=${task.orderIndex})...`);
    
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
      
      // interactContent 是 JSONB，包含所有交互数据
      if (record.interactContent) {
        console.log(`      📦 有 interactContent 数据`);
        try {
          const content = typeof record.interactContent === 'string' 
            ? JSON.parse(record.interactContent) 
            : record.interactContent;
          console.log(`      interactContent:`, JSON.stringify(content, null, 2).substring(0, 600));
        } catch (e) {
          console.log(`      interactContent (原始):`, String(record.interactContent).substring(0, 300));
        }
      } else {
        console.log(`      ❌ 无 interactContent 数据`);
      }
      
      console.log(``);
    }
    
    // 3. 查询 MCP 执行记录
    console.log(`🔧 查询 MCP 执行记录...`);
    
    const mcpRecords = await db
      .select()
      .from(agentSubTasksMcpExecutions)
      .where(
        and(
          eq(agentSubTasksMcpExecutions.commandResultId, task.commandResultId),
          eq(agentSubTasksMcpExecutions.orderIndex, task.orderIndex)
        )
      )
      .orderBy(desc(agentSubTasksMcpExecutions.createdAt));
    
    console.log(`   找到 ${mcpRecords.length} 条 MCP 执行记录\n`);
    
    for (let i = 0; i < mcpRecords.length; i++) {
      const mcp = mcpRecords[i];
      console.log(`   ━━━━━━━━ MCP 记录 ${i + 1}/${mcpRecords.length} ━━━━━━━━`);
      console.log(`      ID: ${mcp.id}`);
      console.log(`      toolName: ${mcp.toolName}`);
      console.log(`      actionName: ${mcp.actionName}`);
      console.log(`      resultStatus: ${mcp.resultStatus}`);
      console.log(`      createdAt: ${mcp.createdAt?.toISOString() || 'null'}`);
      
      if (mcp.resultData) {
        console.log(`      📊 有 resultData`);
        try {
          const resultData = typeof mcp.resultData === 'string' ? JSON.parse(mcp.resultData) : mcp.resultData;
          console.log(`      resultData:`, JSON.stringify(resultData, null, 2).substring(0, 500));
        } catch (e) {
          console.log(`      resultData (原始):`, String(mcp.resultData).substring(0, 300));
        }
      }
      
      console.log(``);
    }
    
    console.log('\n');
  }
  
  console.log('✅ 查询完成');
}

checkHistoryRecords().catch(console.error);


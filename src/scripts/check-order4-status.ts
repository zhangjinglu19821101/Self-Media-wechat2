#!/usr/bin/env tsx
import { db } from '@/lib/db';
import { agentSubTasks, agentSubTasksStepHistory } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

async function main() {
  console.log('=== 查询当前所有任务状态 ===\n');
  
  // 查询所有任务
  const allTasks = await db
    .select()
    .from(agentSubTasks)
    .orderBy(agentSubTasks.commandResultId, agentSubTasks.orderIndex);
  
  console.log(`共找到 ${allTasks.length} 个任务:\n`);
  
  // 按 commandResultId 分组
  const groupedTasks: Record<string, typeof allTasks> = {};
  for (const task of allTasks) {
    if (!groupedTasks[task.commandResultId]) {
      groupedTasks[task.commandResultId] = [];
    }
    groupedTasks[task.commandResultId].push(task);
  }
  
  // 输出每个分组
  for (const [commandResultId, tasks] of Object.entries(groupedTasks)) {
    console.log(`=== Command Result ID: ${commandResultId} ===`);
    
    for (const task of tasks) {
      console.log(`  order_index=${task.orderIndex}:`);
      console.log(`    - ID: ${task.id}`);
      console.log(`    - 状态: ${task.status}`);
      console.log(`    - 执行器: ${task.fromParentsExecutor}`);
      console.log(`    - 任务标题: ${task.taskTitle?.substring(0, 50)}...`);
      console.log(`    - resultData: ${task.resultData ? '有数据' : '无数据'}`);
      console.log();
    }
  }
  
  // 如果有任务，查询第一个有 order_index=4 的任务的历史记录
  const order4Task = allTasks.find(t => t.orderIndex === 4);
  if (order4Task) {
    console.log('\n=== order_index=4 任务的最近 10 条历史记录 ===\n');
    
    const historyRecords = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(
        and(
          eq(agentSubTasksStepHistory.commandResultId, order4Task.commandResultId),
          eq(agentSubTasksStepHistory.stepNo, 4)
        )
      )
      .orderBy(agentSubTasksStepHistory.interactTime)
      .limit(10);
    
    console.log(`找到 ${historyRecords.length} 条历史记录:\n`);
    
    historyRecords.forEach((record, idx) => {
      console.log(`--- 历史记录 ${idx + 1} ---`);
      console.log(`时间: ${record.interactTime}`);
      console.log(`交互类型: ${record.interactType}`);
      console.log(`交互用户: ${record.interactUser}`);
      
      const requestContent = record.requestContent as any;
      const responseContent = record.responseContent as any;
      
      if (requestContent?.prompt) {
        console.log(`请求提示词长度: ${requestContent.prompt.length}`);
      }
      
      if (responseContent?.type) {
        console.log(`响应类型: ${responseContent.type}`);
      }
      
      console.log();
    });
  }
}

main().catch(console.error);
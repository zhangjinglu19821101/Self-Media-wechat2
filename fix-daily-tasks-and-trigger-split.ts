#!/usr/bin/env node
/**
 * 修复 daily_task 数据并触发 insurance-d 拆解
 */

import { db } from './src/lib/db';
import { dailyTask } from './src/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { insuranceDBatchSplitTask } from './src/lib/services/task-assignment-service';

console.log('🔧 开始修复 daily_task 数据...\n');

async function main() {
  try {
    // 1. 查询当前的 daily_task
    console.log('📋 步骤 1: 查询当前 daily_task...');
    const tasks = await db.select().from(dailyTask);
    console.log(`✅ 找到 ${tasks.length} 条 daily_task 记录\n`);

    if (tasks.length === 0) {
      console.log('⚠️ 没有找到 daily_task 记录，创建测试数据...');
      // 这里可以创建测试数据
      return;
    }

    // 2. 打印当前任务状态
    console.log('📊 当前任务状态:');
    tasks.forEach((task, index) => {
      console.log(`  ${index + 1}. ${task.taskId}`);
      console.log(`     - executor: ${task.executor}`);
      console.log(`     - executionStatus: ${task.executionStatus}`);
      console.log(`     - subTaskCount: ${task.subTaskCount}`);
      console.log(`     - splitRejected: ${task.metadata?.splitRejected ? '是' : '否'}`);
      console.log(`     - rejectionReason: ${task.metadata?.rejectionReason || '无'}`);
    });
    console.log('');

    // 3. 查找需要拆解的任务
    console.log('🔍 步骤 2: 查找需要拆解的任务...');
    const tasksToSplit = tasks.filter(task => {
      // 条件：executor 是 insurance-d，状态是 pending_review，没有子任务
      const isInsuranceD = task.executor === 'insurance-d';
      const isPendingReview = task.executionStatus === 'pending_review';
      const hasNoSubTasks = !task.subTaskCount || task.subTaskCount === 0;
      const isRejected = task.metadata?.splitRejected;
      
      return isInsuranceD && (isPendingReview || isRejected) && hasNoSubTasks;
    });

    console.log(`✅ 找到 ${tasksToSplit.length} 个需要拆解的任务\n`);

    if (tasksToSplit.length === 0) {
      console.log('⚠️ 没有找到需要拆解的任务，尝试修复任务状态...');
      
      // 尝试将一些任务设置为 pending_review 状态
      const insuranceDTasks = tasks.filter(t => t.executor === 'insurance-d');
      if (insuranceDTasks.length > 0) {
        console.log(`🔧 找到 ${insuranceDTasks.length} 个 insurance-d 任务，设置为 pending_review 状态...`);
        
        for (const task of insuranceDTasks.slice(0, 1)) { // 只处理第一个任务
          console.log(`   修复任务: ${task.taskId}`);
          
          await db
            .update(dailyTask)
            .set({
              executionStatus: 'pending_review',
              subTaskCount: 0,
              metadata: {
                ...(task.metadata || {}),
                splitRejected: false,
                rejectionReason: null,
                splitResult: null,
              },
              updatedAt: new Date(),
            })
            .where(eq(dailyTask.id, task.id));
          
          console.log(`   ✅ 任务 ${task.taskId} 已修复为 pending_review 状态`);
          tasksToSplit.push(task);
        }
      }
    }

    if (tasksToSplit.length === 0) {
      console.log('❌ 仍然没有找到可以拆解的任务，退出');
      return;
    }

    // 4. 触发拆解
    console.log('🚀 步骤 3: 触发 insurance-d 拆解...');
    const taskIds = tasksToSplit.map(t => t.id);
    console.log(`   任务 IDs:`, taskIds);
    
    const result = await insuranceDBatchSplitTask(taskIds);
    
    console.log('\n✅ 拆解完成!');
    console.log('   Result:', result);

  } catch (error) {
    console.error('❌ 出错:', error);
    process.exit(1);
  }
}

main();

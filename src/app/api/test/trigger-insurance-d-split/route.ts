/**
 * 测试 API：触发 insurance-d 拆解
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dailyTask } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { insuranceDBatchSplitTask } from '@/lib/services/task-assignment-service';

export async function GET(request: NextRequest) {
  try {
    console.log('🔧 [触发 insurance-d 拆解] 开始...');

    // 1. 查询 insurance-d 的 pending_review 任务
    console.log('📋 查询 insurance-d 任务...');
    const tasks = await db
      .select()
      .from(dailyTask)
      .where(eq(dailyTask.executor, 'insurance-d'));

    console.log(`✅ 找到 ${tasks.length} 个 insurance-d 任务`);

    // 2. 筛选需要拆解的任务
    const tasksToSplit = tasks.filter(task => {
      const isPendingReview = task.executionStatus === 'pending_review';
      const hasNoSubTasks = !task.subTaskCount || task.subTaskCount === 0;
      return isPendingReview && hasNoSubTasks;
    });

    console.log(`✅ 找到 ${tasksToSplit.length} 个需要拆解的任务`);

    if (tasksToSplit.length === 0) {
      return NextResponse.json({
        success: false,
        message: '没有找到需要拆解的 insurance-d 任务',
        data: { allTasks: tasks.map(t => ({ taskId: t.taskId, status: t.executionStatus })) },
      });
    }

    // 3. 打印任务详情
    console.log('📋 任务详情:');
    tasksToSplit.forEach((task, index) => {
      console.log(`  ${index + 1}. ${task.taskId}`);
      console.log(`     - status: ${task.executionStatus}`);
      console.log(`     - subTaskCount: ${task.subTaskCount}`);
    });

    // 4. 触发拆解
    console.log('🚀 开始拆解...');
    const taskIds = tasksToSplit.map(t => t.id);
    const result = await insuranceDBatchSplitTask(taskIds);

    console.log('✅ 拆解完成!');
    console.log('Result:', result);

    return NextResponse.json({
      success: true,
      message: 'insurance-d 拆解已触发',
      data: result,
    });
  } catch (error) {
    console.error('❌ 触发 insurance-d 拆解失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

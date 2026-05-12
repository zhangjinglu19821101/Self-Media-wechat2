/**
 * 简单的 agent_sub_tasks 插入测试
 * POST /api/test/simple-insert-test
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dailyTask, agentSubTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 [测试] 简单的插入测试...');

    // 1. 先查一个任务
    const tasks = await db
      .select()
      .from(dailyTask)
      .where(eq(dailyTask.taskId, 'daily-task-insurance-d-2026-02-21-003'))
      .limit(1);

    if (tasks.length === 0) {
      return NextResponse.json({
        success: false,
        error: '任务不存在',
      });
    }

    const dailyTask = tasks[0];
    console.log(`✅ 找到任务: id=${dailyTask.id}, task_id=${dailyTask.taskId}`);

    // 2. 用最简单的方式插入子任务
    console.log('💾 开始插入测试子任务...');

    try {
      const inserted = await db.insert(agentSubTasks).values({
        commandResultId: dailyTask.id,
        agentId: 'insurance-d',
        taskTitle: '测试子任务 1',
        taskDescription: '这是一个简单的测试子任务',
        status: 'pending',
        orderIndex: 1,
        metadata: {
          test: true,
        },
      });

      console.log('✅ 测试子任务插入成功!');
    } catch (insertError) {
      console.error('❌ 插入子任务失败:', insertError);
      return NextResponse.json({
        success: false,
        error: '插入子任务失败',
        insertError: insertError instanceof Error ? insertError.message : String(insertError),
        stack: insertError instanceof Error ? insertError.stack : undefined,
      });
    }

    // 3. 查询验证
    const savedSubTasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.commandResultId, dailyTask.id));

    return NextResponse.json({
      success: true,
      message: '简单插入测试成功！',
      dailyTaskId: dailyTask.id,
      savedCount: savedSubTasks.length,
      savedSubTasks: savedSubTasks.map(st => ({
        id: st.id,
        taskTitle: st.taskTitle,
        agentId: st.agentId,
      })),
    });
  } catch (error) {
    console.error('❌ [测试] 失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

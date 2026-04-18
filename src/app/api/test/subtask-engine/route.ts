/**
 * 子任务执行引擎测试 API
 * 
 * 用于测试子任务执行引擎的功能验证
 * 
 * 使用方法：
 * curl -X POST http://localhost:5000/api/test/subtask-engine
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks, dailyTask } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { createInitialArticleMetadata } from '@/lib/types/article-metadata';

export const maxDuration = 60;

export async function POST() {
  console.log('[Test API] 开始子任务执行引擎测试');

  try {
    // 1. 查找一个现有的 daily_task
    const existingDailyTask = await db
      .select()
      .from(dailyTask)
      .limit(1);

    if (existingDailyTask.length === 0) {
      return NextResponse.json({
        success: false,
        message: '没有找到 daily_task，请先创建测试数据',
      });
    }

    const dailyTask = existingDailyTask[0];
    console.log('[Test API] 使用 daily_task:', dailyTask.taskId);

    // 2. 创建测试子任务数据（8 个步骤）
    console.log('[Test API] 创建测试子任务...');
    
    const testSubTasks = [];
    const today = new Date().toISOString().split('T')[0];
    const articleId = `ART${Date.now()}`;
    
    const initialMetadata = createInitialArticleMetadata({
      articleId,
      articleTitle: '《年终奖到手，存年金险还是增额寿？》',
      creatorAgent: 'insurance-d',
    });

    const stepNames = [
      '选题与规划',
      '案例与知识点获取',
      '标题创作',
      '内容创作',
      'AI 原创改写',
      '内容合规检查',
      '文章排版',
      '全文整体核对',
    ];

    for (let i = 0; i < 8; i++) {
      const orderIndex = i + 1;
      const taskTitle = stepNames[i];
      
      // 更新 metadata 的当前步骤
      const stepMetadata = {
        ...initialMetadata,
        current_step: {
          ...initialMetadata.current_step,
          step_no: orderIndex,
          step_name: taskTitle,
        },
      };

      const subTask = await db
        .insert(agentSubTasks)
        .values({
          commandResultId: dailyTask.id,
          fromParentsExecutor: dailyTask.executor,
          taskTitle: taskTitle,
          taskDescription: `测试子任务 - ${taskTitle}`,
          status: 'pending',
          orderIndex,
          isDispatched: false,
          timeoutHandlingCount: 0,
          escalated: false,
          executionDate: today,
          dialogueRounds: 0,
          dialogueStatus: 'none',
          articleMetadata: stepMetadata,
          metadata: { test: true },
        })
        .returning();

      testSubTasks.push(subTask[0]);
    }

    console.log(`[Test API] 创建了 ${testSubTasks.length} 个测试子任务`);

    return NextResponse.json({
      success: true,
      message: '测试数据创建成功',
      data: {
        dailyTaskId: dailyTask.id,
        subTaskCount: testSubTasks.length,
        subTasks: testSubTasks.map(t => ({
          id: t.id,
          orderIndex: t.orderIndex,
          taskTitle: t.taskTitle,
          status: t.status,
        })),
      },
    });

  } catch (error) {
    console.error('[Test API] 测试失败:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET 方法用于查询测试数据
 */
export async function GET() {
  console.log('[Test API] 查询测试数据');

  try {
    const subTasks = await db
      .select()
      .from(agentSubTasks)
      .orderBy(agentSubTasks.createdAt)
      .limit(20);

    return NextResponse.json({
      success: true,
      message: '查询成功',
      data: {
        count: subTasks.length,
        subTasks: subTasks.map(t => ({
          id: t.id,
          commandResultId: t.commandResultId,
          taskTitle: t.taskTitle,
          orderIndex: t.orderIndex,
          status: t.status,
          fromParentsExecutor: t.fromParentsExecutor,
          executionDate: t.executionDate,
          startedAt: t.startedAt,
        })),
      },
    });
  } catch (error) {
    console.error('[Test API] 查询失败:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

/**
 * DELETE 方法用于清理测试数据
 */
export async function DELETE() {
  console.log('[Test API] 清理测试数据');

  try {
    // 删除所有测试子任务（简化版：删除最近创建的）
    const recentSubTasks = await db
      .select()
      .from(agentSubTasks)
      .orderBy(agentSubTasks.createdAt)
      .limit(10);

    for (const subTask of recentSubTasks) {
      await db
        .delete(agentSubTasks)
        .where(eq(agentSubTasks.id, subTask.id));
    }

    return NextResponse.json({
      success: true,
      message: `已清理 ${recentSubTasks.length} 条测试数据`,
    });
  } catch (error) {
    console.error('[Test API] 清理失败:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

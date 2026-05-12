import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dailyTask, agentTasks } from '@/lib/db/schema';

/**
 * 创建测试用的 commandResult
 *
 * 用于测试子任务拆分和状态更新功能
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      agentId = 'insurance-d',
      taskName = '测试任务：创作保险科普文章',
      commandContent = '请创作一篇关于重疾险的科普文章，字数1500-1600字，内容要合规、真实、实用。',
      fromAgentId = 'A',
      toAgentId = 'insurance-d',
    } = body;

    console.log(`🧪 创建测试 commandResult`);
    console.log(`📍 Agent ID: ${agentId}`);
    console.log(`📋 任务名称: ${taskName}`);

    // 1. 先创建一个测试任务
    const [newTask] = await db.insert(agentTasks).values({
      taskId: `task-test-${Date.now()}`,
      taskName,
      coreCommand: commandContent,
      executor: agentId,
      acceptanceCriteria: '创作符合要求的保险科普文章',
      taskType: 'master',
      splitStatus: 'completed',
      taskDurationStart: new Date(),
      taskDurationEnd: new Date(Date.now() + 24 * 60 * 60 * 1000),
      totalDeliverables: '1 篇保险科普文章',
      taskPriority: 'normal',
      taskStatus: 'pending',
      creator: 'test',
      fromAgentId,
      toAgentId,
      commandType: 'instruction',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    console.log(`✅ 创建测试任务: ${newTask.taskId}`);

    // 2. 创建 commandResult
    const [newCommandResult] = await db.insert(dailyTask).values({
      commandId: `cmd-test-${Date.now()}`,
      relatedTaskId: newTask.taskId,
      commandContent,
      executor: agentId,
      commandPriority: 'normal',
      executionDeadlineStart: new Date(),
      executionDeadlineEnd: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24小时后
      deliverables: '保险科普文章',
      executionStatus: 'new',
      splitter: 'agent B',
      entryUser: 'test',
      taskType: 'daily',
      executionDate: new Date().toISOString().split('T')[0],
      fromAgentId,
      toAgentId,
      originalCommand: commandContent,
      taskName,
      subTaskCount: 0,
      completedSubTasks: 0,
    }).returning();

    console.log(`✅ 创建测试 commandResult: ${newCommandResult.id}`);

    return NextResponse.json({
      success: true,
      message: '测试数据创建成功',
      data: {
        task: {
          taskId: newTask.taskId,
          taskName: newTask.taskName,
          status: newTask.status,
        },
        commandResult: {
          id: newCommandResult.id,
          commandId: newCommandResult.commandId,
          taskName: newCommandResult.taskName,
          executionStatus: newCommandResult.executionStatus,
        },
      },
    });
  } catch (error) {
    console.error('❌ 创建测试数据失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

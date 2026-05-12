/**
 * 测试接口：调用 Agent B 评审
 * POST /api/test/agent-b-review
 * 用于测试 Agent B 评审 pre_need_support 状态的任务
 */

import { NextRequest, NextResponse } from 'next/server';
import { SubtaskExecutionEngine } from '@/lib/services/subtask-execution-engine';

/**
 * POST /api/test/agent-b-review
 * 调用 Agent B 评审特定的任务
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { commandResultId, taskId } = body;

    if (!commandResultId || !taskId) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必填参数: commandResultId 和 taskId',
        },
        { status: 400 }
      );
    }

    console.log('🔔 [测试接口] 开始调用 Agent B 评审...');
    console.log('🔔 [测试接口] 参数:', {
      commandResultId,
      taskId,
    });

    // 1. 实例化子任务执行引擎
    const engine = new SubtaskExecutionEngine();
    
    // 2. 先查询任务信息
    const { db } = await import('@/lib/db');
    const { agentSubTasks } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');
    
    const task = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, taskId))
      .then(res => res[0]);
    
    if (!task) {
      return NextResponse.json(
        {
          success: false,
          error: '找不到任务',
        },
        { status: 404 }
      );
    }
    
    console.log('🔔 [测试接口] 找到任务:', {
      taskId: task.id,
      status: task.status,
      taskTitle: task.taskTitle,
    });
    
    // 3. 调用 Agent B 评审
    await engine.executeAgentBReviewWorkflow(task);
    
    console.log('✅ [测试接口] Agent B 评审完成');

    // 4. 查询更新后的任务状态
    const updatedTask = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, taskId))
      .then(res => res[0]);

    return NextResponse.json({
      success: true,
      message: 'Agent B 评审完成',
      data: {
        task: updatedTask,
      },
    });
  } catch (error) {
    console.error('❌ [测试接口] 调用 Agent B 评审失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '执行失败',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/test/agent-b-review
 * 获取测试接口信息
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    name: 'test-agent-b-review',
    description: '测试调用 Agent B 评审任务',
    usage: {
      method: 'POST',
      endpoint: '/api/test/agent-b-review',
      body: {
        commandResultId: 'string (必填) - 指令结果 ID',
        taskId: 'string (必填) - 任务 ID',
      },
      example: {
        commandResultId: 'e70ee6e8-8391-4b11-9f31-5e69f24a38e5',
        taskId: 'c5154b32-8180-457b-9359-816c1a27ca2e',
      },
    },
  });
}

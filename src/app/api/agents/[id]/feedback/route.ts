import { NextRequest, NextResponse } from 'next/server';
import { agentTask } from '@/lib/services/agent-task';

/**
 * GET /api/agents/[agentId]/feedback
 * 获取Agent收到的反馈（已完成任务的结果）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // 获取已完成的任务
    const tasks = await agentTask.getAgentTasks(agentId, {
      status: 'completed',
      limit,
      offset,
    });

    // 过滤出有结果的反馈
    const feedbacks = tasks.filter(task => task.result).map(task => ({
      taskId: task.taskId,
      fromAgent: task.fromAgentId,
      command: task.command,
      result: task.result,
      completedAt: task.completedAt,
      commandType: task.commandType,
      priority: task.priority,
    }));

    return NextResponse.json({
      success: true,
      data: {
        feedbacks,
        total: feedbacks.length,
      },
    });
  } catch (error) {
    console.error('Error fetching agent feedback:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取反馈失败',
      },
      { status: 500 }
    );
  }
}

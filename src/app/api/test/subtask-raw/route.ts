import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const subTaskId = searchParams.get('id');

    if (!subTaskId) {
      return NextResponse.json({
        success: false,
        error: 'Missing subTaskId parameter',
      }, { status: 400 });
    }

    const tasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, subTaskId));

    if (tasks.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Subtask not found',
      }, { status: 404 });
    }

    const task = tasks[0];

    let executionResult = null;
    let executionResultPreview = null;

    if (task.executionResult) {
      try {
        executionResult = JSON.parse(task.executionResult);
        executionResultPreview = {
          success: executionResult.success,
          hasOutput: !!executionResult.result?.output,
          outputLength: executionResult.result?.output?.length || 0,
          issuesCount: executionResult.issues?.length || 0,
        };
      } catch (error) {
        executionResultPreview = {
          parseError: true,
          rawLength: task.executionResult.length,
          preview: task.executionResult.substring(0, 200),
        };
      }
    }

    return NextResponse.json({
      success: true,
      task: {
        id: task.id,
        agentId: task.agentId,
        taskTitle: task.taskTitle,
        status: task.status,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
        executionResultLength: task.executionResult ? task.executionResult.length : 0,
        executionResultPreview,
      },
      rawExecutionResult: task.executionResult ? task.executionResult.substring(0, 500) : null,
    });
  } catch (error) {
    console.error('获取子任务详情失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

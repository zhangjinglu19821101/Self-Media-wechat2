/**
 * 异常解决 API
 * 提交手动拆解结果并保存到 dailyTask 表
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { splitFailures, dailyTask } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/context';

interface ResolveRequest {
  manualSplitResult: {
    subTasks: Array<{
      taskTitle: string;
      commandContent: string;
      executor: string;
      taskType: string;
      priority: string;
      deadline?: string;
      estimatedHours?: number;
      acceptanceCriteria?: string;
    }>;
    totalDeliverables?: string;
    timeFrame?: string;
    summary?: string;
  };
  resolutionMethod: 'manual' | 'agent_assist' | 'other';
  processingNotes?: string;
  resolvedBy: string;
}

/**
 * PUT /api/exceptions/:failureId/resolve
 * 解决异常（提交拆解结果）
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ failureId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { failureId } = await params;
    const body: ResolveRequest = await request.json();
    const { manualSplitResult, resolutionMethod, processingNotes, resolvedBy } = body;

    // 验证参数
    if (!manualSplitResult || !manualSplitResult.subTasks || manualSplitResult.subTasks.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少有效的拆解结果',
        },
        { status: 400 }
      );
    }

    if (!resolvedBy) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少 resolvedBy 参数',
        },
        { status: 400 }
      );
    }

    // 查询异常记录
    const [failureRecord] = await db
      .select()
      .from(splitFailures)
      .where(eq(splitFailures.failureId, failureId));

    if (!failureRecord) {
      return NextResponse.json(
        {
          success: false,
          error: '异常记录不存在',
        },
        { status: 404 }
      );
    }

    // 🔥 将拆解结果保存到 dailyTask 表
    const commandResultRecords = [];
    for (let i = 0; i < manualSplitResult.subTasks.length; i++) {
      const subTask = manualSplitResult.subTasks[i];
      const commandId = `cmd-${failureRecord.taskId}-${(i + 1).toString().padStart(3, '0')}`;
      
      const [record] = await db
        .insert(dailyTask)
        .values({
          commandId,
          relatedTaskId: failureRecord.taskId,
          commandContent: subTask.commandContent,
          executor: subTask.executor,
          commandPriority: subTask.priority === '高' ? 'urgent' : 'normal',
          executionDeadlineStart: new Date(),
          executionDeadlineEnd: subTask.deadline ? new Date(subTask.deadline) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          deliverables: subTask.acceptanceCriteria || '待定',
          executionStatus: 'new',
          taskType: subTask.taskType,
          taskTitle: subTask.taskTitle,
          executionDate: subTask.deadline || new Date().toISOString().split('T')[0],
          fromAgentId: failureRecord.fromAgentId,
          toAgentId: failureRecord.toAgentId,
          originalCommand: failureRecord.coreCommand,
          splitter: 'manual',
          entryUser: resolvedBy,
          estimatedDuration: subTask.estimatedHours ? `${subTask.estimatedHours}小时` : '未定',
          // 🔥 新增：从原任务继承用户观点和素材
          userOpinion: (failureRecord as any).user_opinion || null,
          materialIds: (failureRecord as any).material_ids || [],
          // 🔥 Phase 6 多用户：工作空间归属
          workspaceId: authResult.workspaceId,
        })
        .returning();
      
      commandResultRecords.push(record);
    }

    // 🔥 更新异常记录状态
    const [updatedRecord] = await db
      .update(splitFailures)
      .set({
        manualSplitResult,
        processingNotes,
        exceptionStatus: 'resolved',
        resolvedBy,
        resolvedAt: new Date(),
        resolutionMethod,
        resolutionResult: {
          success: true,
          subTaskCount: manualSplitResult.subTasks.length,
          dailyTask: commandResultRecords,
        },
        updatedAt: new Date(),
      })
      .where(eq(splitFailures.failureId, failureId))
      .returning();

    return NextResponse.json({
      success: true,
      data: {
        exception: updatedRecord,
        dailyTask: commandResultRecords,
      },
      message: `异常已解决，已创建 ${commandResultRecords.length} 条子任务`,
    });
  } catch (error) {
    console.error('解决异常失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '解决异常失败',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/agents/[id]/waiting-tasks
 * 获取指定 Agent 的待办任务列表（status='waiting_user'）
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { db } from '@/lib/db';
import { agentSubTasks, agentSubTasksStepHistory, dailyTask } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const { id: agentId } = await params;

    console.log(`📋 获取 Agent ${agentId} 的待办任务列表（waiting_user）`);

    // 查询 agent_sub_tasks 中 status='waiting_user' 的任务
    const subTasks = await db
      .select()
      .from(agentSubTasks)
      .where(
        and(
          eq(agentSubTasks.fromParentsExecutor, agentId),
          eq(agentSubTasks.status, 'waiting_user')
        )
      )
      .orderBy(desc(agentSubTasks.createdAt))
      .limit(50);

    // 关联查询更多信息
    const tasks = [];
    for (const subTask of subTasks) {
      try {
        // 查询关联的 daily_task
        const dailyTaskResult = await db
          .select()
          .from(dailyTask)
          .where(eq(dailyTask.id, subTask.commandResultId))
          .limit(1);

        const relatedDailyTask = dailyTaskResult.length > 0 ? dailyTaskResult[0] : null;

        // 查询交互历史，获取待确认字段和可选方案
        const stepHistory = await db
          .select()
          .from(agentSubTasksStepHistory)
          .where(
            and(
              eq(agentSubTasksStepHistory.commandResultId, subTask.commandResultId),
              eq(agentSubTasksStepHistory.stepNo, subTask.orderIndex)
            )
          )
          .orderBy(desc(agentSubTasksStepHistory.interactTime))
          .limit(1);

        let pendingKeyFields = [];
        let availableSolutions = [];
        let promptMessage = null;

        if (stepHistory.length > 0) {
          const lastRecord = stepHistory[0];
          const content = lastRecord.interactContent as any;
          
          // 同时检查 response 和 question（向后兼容）
          if (content?.response) {
            pendingKeyFields = content.response.pending_key_fields || [];
            availableSolutions = content.response.available_solutions || [];
            promptMessage = content.response.prompt_message || null;
          } else if (content?.question) {
            pendingKeyFields = content.question.pending_key_fields || [];
            availableSolutions = content.question.available_solutions || [];
            promptMessage = content.question.prompt_message || null;
          }
        }

        tasks.push({
          id: subTask.id,
          taskTitle: subTask.taskTitle,
          taskDescription: subTask.taskDescription,
          status: subTask.status,
          priority: relatedDailyTask?.taskPriority || 'normal',
          orderIndex: subTask.orderIndex,
          isCritical: subTask.metadata?.isCritical || false,
          executor: subTask.fromParentsExecutor,
          createdAt: subTask.createdAt,
          startedAt: subTask.startedAt,
          updatedAt: subTask.updatedAt,
          metadata: {
            ...subTask.metadata,
            acceptanceCriteria: subTask.metadata?.acceptanceCriteria || '',
          },
          relatedDailyTask: relatedDailyTask ? {
            id: relatedDailyTask.id,
            taskId: relatedDailyTask.taskId,
            executionDate: relatedDailyTask.executionDate,
            executionDeadlineStart: relatedDailyTask.executionDeadlineStart,
            executionDeadlineEnd: relatedDailyTask.executionDeadlineEnd,
            deliverables: relatedDailyTask.deliverables,
            commandContent: relatedDailyTask.commandContent,
          } : null,
          // 待办任务特有的信息
          pendingKeyFields,
          availableSolutions,
          promptMessage,
        });
      } catch (error) {
        console.error(`❌ 查询关联信息失败:`, error);
      }
    }

    // 统计待办任务数量
    const stats = {
      total: tasks.length,
      waitingUser: tasks.length,
      withKeyFields: tasks.filter(t => t.pendingKeyFields.length > 0).length,
      withSolutions: tasks.filter(t => t.availableSolutions.length > 0).length,
    };

    console.log(`✅ 找到 ${tasks.length} 个待办任务`, stats);

    return NextResponse.json({
      success: true,
      data: {
        tasks,
        stats,
      },
    });
  } catch (error) {
    console.error('❌ 获取待办任务列表失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取待办任务列表失败',
      },
      { status: 500 }
    );
  }
}

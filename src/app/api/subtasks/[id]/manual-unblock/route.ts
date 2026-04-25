/**
 * 手动解锁 blocked 任务
 *
 * POST /api/subtasks/:id/manual-unblock
 *
 * 功能：
 * 1. 允许用户在 blocked 任务上直接输入文章内容
 * 2. 将文章存入 task.metadata.manualSourceArticle
 * 3. 解锁任务（blocked → pending）
 * 4. 触发引擎执行
 *
 * 使用场景：
 * - 两阶段架构中，阶段2（平台适配）的首个任务初始状态为 blocked
 * - 用户已有现成文章，希望跳过等待基础文章定稿，直接触发适配
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { db } from '@/lib/db';
import { agentSubTasks, agentSubTasksStepHistory } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCurrentBeijingTime } from '@/lib/utils/date-time';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  const workspaceId = authResult.workspaceId;

  try {
    const { id: subTaskId } = await params;
    const body = await request.json();
    const { articleContent, articleTitle } = body;

    // 1. 参数校验
    if (!articleContent || typeof articleContent !== 'string') {
      return NextResponse.json(
        { success: false, error: '文章内容不能为空' },
        { status: 400 }
      );
    }

    if (articleContent.trim().length < 50) {
      return NextResponse.json(
        { success: false, error: '文章内容过短，请输入至少50字' },
        { status: 400 }
      );
    }

    // 2. 查询任务，加 workspaceId 隔离
    const [subTask] = await db
      .select()
      .from(agentSubTasks)
      .where(
        and(
          eq(agentSubTasks.id, subTaskId),
          eq(agentSubTasks.workspaceId, workspaceId)
        )
      );

    if (!subTask) {
      return NextResponse.json(
        { success: false, error: '未找到任务' },
        { status: 404 }
      );
    }

    // 3. 状态校验：必须是 blocked
    if (subTask.status !== 'blocked') {
      return NextResponse.json(
        { success: false, error: `仅 blocked 状态的任务可以手动解锁，当前状态: ${subTask.status}` },
        { status: 400 }
      );
    }

    // 4. 幂等性守卫：如果 manualSourceArticle 已存在，说明此前已手动解锁过
    //    直接返回幂等成功，避免并发请求导致 409 或引擎重复触发
    const currentMetadata = (subTask.metadata as Record<string, any>) || {};
    const existingManualArticle = currentMetadata?.manualSourceArticle;
    if (existingManualArticle?.content) {
      console.log('[Manual Unblock] 幂等命中：任务已手动解锁过', {
        subTaskId,
        currentStatus: subTask.status,
        existingArticleLength: existingManualArticle.content.length,
      });
      return NextResponse.json({
        success: true,
        message: '此任务已手动解锁过，无需重复操作',
        data: {
          taskId: subTaskId,
          status: subTask.status,
          taskTitle: subTask.taskTitle,
          idempotent: true,
        },
      });
    }

    console.log('[Manual Unblock] 手动解锁 blocked 任务:', {
      subTaskId,
      taskTitle: subTask.taskTitle,
      articleContentLength: articleContent.length,
      articleTitle: articleTitle || '(无标题)',
    });

    // 5. 将文章存入 metadata.manualSourceArticle
    const updatedMetadata = {
      ...currentMetadata,
      manualSourceArticle: {
        content: articleContent.trim(),
        title: articleTitle?.trim() || '',
        providedAt: getCurrentBeijingTime().toISOString(),
        source: 'manual_input',
      },
    };

    // 6. 原子性更新：blocked → pending + 写入 metadata
    const updateResult = await db
      .update(agentSubTasks)
      .set({
        status: 'pending',
        metadata: updatedMetadata,
        updatedAt: getCurrentBeijingTime(),
      })
      .where(
        and(
          eq(agentSubTasks.id, subTaskId),
          eq(agentSubTasks.status, 'blocked') // 二次校验防并发
        )
      )
      .returning();

    if (updateResult.length === 0) {
      return NextResponse.json(
        { success: false, error: '解锁失败，任务状态可能已变更' },
        { status: 409 }
      );
    }

    console.log('[Manual Unblock] 任务已解锁:', {
      subTaskId,
      newStatus: 'pending',
    });

    // 7. 记录操作日志到 step_history
    try {
      // 获取当前最大 interactNum
      const existingHistory = await db
        .select({ interactNum: agentSubTasksStepHistory.interactNum })
        .from(agentSubTasksStepHistory)
        .where(
          and(
            eq(agentSubTasksStepHistory.commandResultId, subTask.commandResultId),
            eq(agentSubTasksStepHistory.stepNo, subTask.orderIndex)
          )
        );

      const nextInteractNum = existingHistory.length > 0
        ? Math.max(...existingHistory.map(h => h.interactNum || 0)) + 1
        : 1;

      await db.insert(agentSubTasksStepHistory).values({
        commandResultId: subTask.commandResultId,
        stepNo: subTask.orderIndex,
        interactType: 'manual_unblock',
        interactUser: 'human',
        interactTime: getCurrentBeijingTime(),
        interactNum: nextInteractNum,
        interactContent: {
          type: 'manual_unblock',
          action: '用户手动输入文章并解锁任务',
          articleContentLength: articleContent.length,
          articleTitle: articleTitle || '(无标题)',
          previousStatus: 'blocked',
          newStatus: 'pending',
        },
      });
    } catch (historyError) {
      console.warn('[Manual Unblock] 记录操作日志失败（不影响主流程）:', historyError);
    }

    // 8. 触发引擎执行（带并发安全守卫）
    try {
      const { SubtaskExecutionEngine } = await import('@/lib/services/subtask-execution-engine');

      if (SubtaskExecutionEngine.isCurrentlyExecuting()) {
        // 引擎正在执行其他任务，当前 execute() 会被锁跳过
        // 注册延迟重试：等当前执行结束后再触发一次，确保新解锁的 pending 任务被拾取
        console.log('[Manual Unblock] 引擎正在执行中，注册延迟重试');
        const retryInterval = setInterval(() => {
          if (!SubtaskExecutionEngine.isCurrentlyExecuting()) {
            clearInterval(retryInterval);
            const retryEngine = new SubtaskExecutionEngine();
            retryEngine.execute().catch((err: unknown) => {
              console.error('[Manual Unblock] 延迟重试引擎执行失败:', err);
            });
            console.log('[Manual Unblock] 延迟重试已触发');
          }
        }, 2000); // 每 2 秒检查一次引擎状态

        // 安全兜底：最多等待 30 秒，防止泄漏
        setTimeout(() => clearInterval(retryInterval), 30000);
      } else {
        // 引擎空闲，直接触发
        const engine = new SubtaskExecutionEngine();
        engine.execute().catch((err: unknown) => {
          console.error('[Manual Unblock] 引擎执行失败:', err);
        });
        console.log('[Manual Unblock] 引擎已触发执行');
      }
    } catch (engineError) {
      console.warn('[Manual Unblock] 触发引擎失败（不影响解锁）:', engineError);
    }

    return NextResponse.json({
      success: true,
      message: '任务已解锁并开始执行',
      data: {
        taskId: subTaskId,
        status: 'pending',
        taskTitle: subTask.taskTitle,
        articleContentLength: articleContent.length,
      },
    });
  } catch (error) {
    console.error('[Manual Unblock] 手动解锁失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '手动解锁失败',
      },
      { status: 500 }
    );
  }
}

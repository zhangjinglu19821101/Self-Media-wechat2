/**
 * 小红书预览数据 API（公开，供 Playwright 截图使用）
 *
 * GET /api/xiaohongshu-preview?taskId=xxx
 *
 * 此接口不需要认证，因为 Playwright 从后端访问无 session。
 * 仅返回小红书图文内容，不暴露敏感信息。
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks, agentSubTasksStepHistory } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const taskId = request.nextUrl.searchParams.get('taskId');

  if (!taskId) {
    return NextResponse.json({ success: false, error: '缺少 taskId 参数' }, { status: 400 });
  }

  try {
    // 查询子任务
    const tasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, taskId))
      .limit(1);

    if (tasks.length === 0) {
      return NextResponse.json({ success: false, error: '任务不存在' }, { status: 404 });
    }

    const task = tasks[0];

    // 只允许 insurance-xiaohongshu 类型的任务通过此接口访问
    if (task.fromParentsExecutor !== 'insurance-xiaohongshu') {
      return NextResponse.json({ success: false, error: '非小红书任务' }, { status: 403 });
    }

    // 查询执行历史
    const stepHistory = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(
        and(
          eq(agentSubTasksStepHistory.commandResultId, task.commandResultId),
          eq(agentSubTasksStepHistory.stepNo, task.orderIndex),
        )
      )
      .orderBy(agentSubTasksStepHistory.interactTime);

    // 提取内容
    let rawContent: string | object | null = null;

    for (const step of stepHistory) {
      const interactContent = step.interactContent as any;
      if (interactContent?.executorOutput?.output) {
        rawContent = typeof interactContent.executorOutput.output === 'object'
          ? interactContent.executorOutput.output
          : String(interactContent.executorOutput.output);
        break;
      }
      if (interactContent?.resultSummary) {
        rawContent = interactContent.resultSummary;
        break;
      }
    }

    if (!rawContent && task.resultData) {
      const rd = task.resultData as any;
      if (rd.executorOutput?.output) {
        rawContent = typeof rd.executorOutput.output === 'object'
          ? rd.executorOutput.output
          : String(rd.executorOutput.output);
      } else if (rd.result) {
        rawContent = typeof rd.result === 'object' ? rd.result : String(rd.result);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        taskId: task.id,
        taskTitle: task.taskTitle,
        status: task.status,
        executor: task.fromParentsExecutor,
        rawContent,
      },
    });
  } catch (error) {
    console.error('[XhsPreviewAPI] 加载失败:', error);
    return NextResponse.json(
      { success: false, error: '加载失败' },
      { status: 500 }
    );
  }
}

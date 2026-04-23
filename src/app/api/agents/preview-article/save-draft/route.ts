/**
 * 预览文章保存草稿 API
 *
 * POST /api/agents/preview-article/save-draft
 *
 * 功能：
 * 1. 只保存用户修改的内容到 resultData，不改变任务状态
 * 2. 保持任务在 waiting_user 状态
 * 3. 记录用户保存草稿到 step_history
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { db } from '@/lib/db';
import { agentSubTasks, agentSubTasksStepHistory } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  const workspaceId = authResult.workspaceId;

  try {
    const body = await request.json();
    const { taskId, commandResultId, content, title, platform } = body;

    if (!taskId) {
      return NextResponse.json(
        { success: false, error: '缺少 taskId 参数' },
        { status: 400 }
      );
    }

    // 1. 查询任务
    const task = await db.query.agentSubTasks.findFirst({
      where: and(
        eq(agentSubTasks.id, taskId),
        eq(agentSubTasks.workspaceId, workspaceId)
      ),
    });

    if (!task) {
      return NextResponse.json(
        { success: false, error: '未找到任务' },
        { status: 404 }
      );
    }

    // 2. 读取当前 resultData
    let currentResultData: any = {};
    try {
      currentResultData = typeof task.resultData === 'string'
        ? JSON.parse(task.resultData)
        : task.resultData || {};
    } catch {
      currentResultData = {};
    }

    // 3. 读取原始 platformRenderData
    let originalPlatformRenderData = currentResultData.platformRenderData || null;

    // 4. 更新 platformRenderData（从哪个字段展示就保存回哪个字段）
    const previewPlatform = platform || currentResultData.platform || 'wechat_official';
    let updatedPlatformRenderData = originalPlatformRenderData;

    if (previewPlatform === 'wechat_official') {
      updatedPlatformRenderData = {
        ...(originalPlatformRenderData || {}),
        htmlContent: content,
      };
    } else if (previewPlatform === 'xiaohongshu') {
      try {
        const jsonMatch = content.match(/\{[\s\S]*"title"[\s\S]*"points"[\s\S]*\}/);
        if (jsonMatch) {
          const xhsData = JSON.parse(jsonMatch[0]);
          updatedPlatformRenderData = {
            ...(originalPlatformRenderData || {}),
            ...xhsData,
          };
        }
      } catch {
        // 解析失败，保持原样
      }
    }

    // 5. 构建更新后的 resultData
    const updatedResultData = {
      ...currentResultData,
      articleContent: content,
      articleTitle: title,
      platform: previewPlatform,
      platformRenderData: updatedPlatformRenderData,
      // 标记为草稿状态
      isDraft: true,
      draftSavedAt: new Date().toISOString(),
    };

    // 6. 只更新 resultData，不改变状态
    await db
      .update(agentSubTasks)
      .set({
        resultData: updatedResultData,
        updatedAt: new Date(),
      })
      .where(eq(agentSubTasks.id, taskId));

    // 7. 记录到 step_history
    const historyRecords = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(
        and(
          eq(agentSubTasksStepHistory.commandResultId, commandResultId || task.commandResultId),
          eq(agentSubTasksStepHistory.stepNo, task.orderIndex)
        )
      )
      .orderBy(agentSubTasksStepHistory.interactTime);

    const nextInteractNum = historyRecords.length > 0
      ? Math.max(...historyRecords.map(h => h.interactNum || 1)) + 1
      : 1;

    await db.insert(agentSubTasksStepHistory).values({
      commandResultId: commandResultId || task.commandResultId,
      stepNo: task.orderIndex,
      interactType: 'response',
      interactContent: {
        type: 'save_draft',
        action: 'save_draft',
        contentLength: content?.length || 0,
        title,
        timestamp: new Date().toISOString(),
      } as any,
      interactUser: 'human',
      interactTime: new Date(),
      interactNum: nextInteractNum,
    });

    console.log('[Save Draft] ✅ 草稿已保存:', {
      taskId,
      contentLength: content?.length || 0,
      platform: previewPlatform,
    });

    return NextResponse.json({
      success: true,
      message: '草稿已保存',
      data: {
        taskId,
        savedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('[Save Draft] 保存草稿失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '保存草稿失败' },
      { status: 500 }
    );
  }
}

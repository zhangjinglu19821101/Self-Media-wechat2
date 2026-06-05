/**
 * 文章预览 API
 * 
 * GET /api/agents/preview-article - 获取文章预览内容
 * 
 * 【设计原则 - 单一数据源】
 * articleContent 是唯一的内容来源，前端只消费此字段。
 * platformRenderData 提供平台结构化数据（如小红书卡片），不作为内容来源。
 * 
 * 内容选择优先级（严格按序）：
 * 1. resultData.articleContent（用户编辑保存的草稿 — 最高优先级）
 * 2. metadata.providedArticle（直接发文模式用户提供的原文）
 * 3. 从前序写作任务的 resultText 提取（首次加载，从未编辑过）
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq, and, lt, desc } from 'drizzle-orm';
import { isWritingAgent, getPlatformForExecutor } from '@/lib/agents/agent-registry';

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  const workspaceId = authResult.workspaceId;

  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json(
        { success: false, error: '缺少 taskId 参数' },
        { status: 400 }
      );
    }

    // 查询任务（workspaceId 隔离）
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

    // 解析 resultData
    let resultData: Record<string, any> = {};
    try {
      resultData = typeof task.resultData === 'string'
        ? JSON.parse(task.resultData)
        : task.resultData || {};
    } catch {
      resultData = {};
    }

    // 解析 metadata
    const taskMetadata: Record<string, any> = 
      typeof task.metadata === 'object' && task.metadata !== null
        ? task.metadata as Record<string, unknown> as Record<string, any>
        : {};

    // ========== 单一数据源：articleContent ==========
    // 优先级1: 用户编辑保存的草稿（最高优先级，不可被覆盖）
    let articleContent: string = resultData.articleContent || '';
    let articleTitle: string = resultData.articleTitle || '';
    let platform: string = resultData.platform || '';
    const writingTaskId = resultData.writingTaskId || null;
    let platformRenderData = resultData.platformRenderData || null;
    const isDraft = resultData.isDraft === true;

    // 优先级2: 直接发文模式下用户提供的原文
    // 🔥🔥🔥 【关键修复】5步流程（有格式化步骤）时，不使用 providedArticle 覆盖
    // 因为前序格式化步骤（insurance-d 等）已经输出了 HTML，优先使用格式化结果
    // 4步流程（无格式化步骤，如头条/微博）时，才使用 providedArticle
    const isDirectPublish = taskMetadata.creationMode === 'direct_publish';
    const providedArticle = typeof taskMetadata.providedArticle === 'string' ? taskMetadata.providedArticle : '';
    const providedArticleTitle = typeof taskMetadata.providedArticleTitle === 'string' ? taskMetadata.providedArticleTitle : '';

    if (isDirectPublish && providedArticle && (!articleContent || articleContent.length < providedArticle.length * 0.5)) {
      // 5步流程检查：当前节点之前是否有已完成的写作Agent（格式化步骤）
      // 如果有，说明格式化步骤已完成，不应使用纯文本的 providedArticle
      const previousTasksForFormatCheck = await db
        .select({ fromParentsExecutor: agentSubTasks.fromParentsExecutor, status: agentSubTasks.status })
        .from(agentSubTasks)
        .where(
          and(
            eq(agentSubTasks.commandResultId, task.commandResultId),
            lt(agentSubTasks.orderIndex, task.orderIndex)
          )
        );
      const hasCompletedFormattingStep = previousTasksForFormatCheck.some(t =>
        isWritingAgent(t.fromParentsExecutor) && t.status === 'completed'
      );

      if (hasCompletedFormattingStep) {
        // 5步流程：格式化步骤已完成，不用 providedArticle 覆盖，让优先级3从前序任务提取 HTML
        console.log('[Preview Article] 直接发文5步流程：跳过 providedArticle，使用格式化结果');
      } else {
        // 4步流程（无格式化步骤）：使用用户提供的原文
        articleContent = providedArticle;
        if (providedArticleTitle && !articleTitle) {
          articleTitle = providedArticleTitle;
        }
        console.log('[Preview Article] 直接发文4步流程：使用 providedArticle', {
          providedContentLength: providedArticle.length,
        });
      }
    }

    // 优先级3: 从前序写作任务提取（仅当 articleContent 为空且非草稿状态时）
    const needExtractFromWritingTask = !isDraft && !articleContent;

    console.log('[Preview Article] 内容来源决策:', {
      hasArticleContent: !!articleContent,
      isDraft,
      isDirectPublish,
      needExtractFromWritingTask,
    });

    if (needExtractFromWritingTask) {
      const previousTasks = await db
        .select()
        .from(agentSubTasks)
        .where(
          and(
            eq(agentSubTasks.commandResultId, task.commandResultId),
            lt(agentSubTasks.orderIndex, task.orderIndex)
          )
        )
        .orderBy(desc(agentSubTasks.orderIndex));

      const writingTask = previousTasks.find(t => isWritingAgent(t.fromParentsExecutor));

      if (writingTask) {
        let writingResultData: Record<string, any> = {};
        try {
          writingResultData = typeof writingTask.resultData === 'string'
            ? JSON.parse(writingTask.resultData)
            : writingTask.resultData || {};
        } catch (parseError) {
          console.error('[Preview Article] 解析 writingTask.resultData 失败:', parseError);
        }

        const executorOutput = writingResultData?.executorOutput;
        const structuredResult = executorOutput?.structuredResult;
        const platformData = structuredResult?.resultContent?.platformData ||
                            structuredResult?.platformData;
        const writingPlatform = getPlatformForExecutor(writingTask.fromParentsExecutor);

        // 提取 platformRenderData
        if (writingPlatform && !platformRenderData) {
          try {
            const { extractPlatformRenderData } = await import('@/lib/platform-render/extractors');
            platformRenderData = extractPlatformRenderData(
              writingPlatform,
              writingTask.resultData,
              taskMetadata
            );
          } catch (extractErr) {
            console.error('[Preview Article] 平台渲染数据提取失败:', extractErr);
          }
        }

        // 提取 articleContent（仅当仍为空时）
        if (!articleContent) {
          if (platformData && platformData.platform === 'xiaohongshu') {
            articleContent = structuredResult?.resultContent?.content || writingTask.resultText || '';
            articleTitle = platformData.title || structuredResult?.resultContent?.articleTitle || '';
            platform = 'xiaohongshu';
          } else if (writingPlatform === 'wechat_official') {
            // 公众号：从写作任务获取内容
            articleContent = structuredResult?.resultContent?.content ||
                            structuredResult?.resultContent?.htmlContent ||
                            writingTask.resultText || '';
            articleTitle = extractArticleTitleFromResultData(writingTask.resultData, writingTask.taskTitle);
            platform = 'wechat_official';
          } else {
            articleContent = writingTask.resultText || '';
            articleTitle = extractArticleTitleFromResultData(writingTask.resultData, writingTask.taskTitle);
            platform = resultData.platform || writingPlatform;
          }
        } else {
          // articleContent 已有值（来自 providedArticle），只更新平台信息
          if (!platform) platform = writingPlatform || '';
          if (!articleTitle) articleTitle = extractArticleTitleFromResultData(writingTask.resultData, writingTask.taskTitle);
        }
      }
    }

    // LLM 格式化兜底（仅当 platformRenderData 为空且需要格式化时）
    const shouldFormat = !platformRenderData && articleContent && platform;

    if (shouldFormat) {
      try {
        const { formatDirectPublishArticle } = await import('@/lib/services/direct-publish-formatter-service');
        const VALID_CARD_MODES = ['3-card', '5-card', '7-card'] as const;
        const rawCardCountMode = (taskMetadata.cardCountMode as string) || (taskMetadata.imageCountMode as string) || undefined;
        const cardCountMode = rawCardCountMode && VALID_CARD_MODES.includes(rawCardCountMode as typeof VALID_CARD_MODES[number])
          ? rawCardCountMode as typeof VALID_CARD_MODES[number]
          : undefined;
        const generated = await formatDirectPublishArticle({
          textContent: articleContent,
          platform,
          articleTitle,
          cardCountMode,
          workspaceId: task.workspaceId || undefined,
        });
        if (generated) {
          platformRenderData = generated;
          console.log('[Preview Article] LLM格式化 platformRenderData 成功');
        }
      } catch (genErr) {
        console.error('[Preview Article] LLM格式化失败，降级到简单文本处理:', genErr);
        try {
          const { generatePlatformRenderDataFromText } = await import('@/lib/platform-render/text-to-render');
          const generated = generatePlatformRenderDataFromText(articleContent, platform, articleTitle);
          if (generated) {
            platformRenderData = generated;
          }
        } catch (fallbackErr) {
          console.error('[Preview Article] 降级文本处理也失败:', fallbackErr);
        }
      }
    }

    // ========== 关键：同步 platformRenderData.htmlContent ==========
    // 草稿状态下，htmlContent 必须与 articleContent 保持一致
    // 这是防止旧 htmlContent 泄漏的最后一道防线
    if (platformRenderData && typeof platformRenderData === 'object' && 'htmlContent' in platformRenderData) {
      const htmlContent = String((platformRenderData as Record<string, unknown>).htmlContent || '');
      // 如果 htmlContent 是旧内容（与 articleContent 不同），同步为 articleContent
      if (htmlContent && articleContent && htmlContent !== articleContent) {
        console.log('[Preview Article] 同步 htmlContent 为最新 articleContent', {
          htmlContentLength: htmlContent.length,
          articleContentLength: articleContent.length,
          isDraft,
        });
        (platformRenderData as Record<string, unknown>).htmlContent = articleContent;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        taskId: task.id,
        taskTitle: task.taskTitle,
        articleContent,
        articleTitle,
        platform,
        writingTaskId,
        canEdit: resultData.canEdit !== false,
        canSkip: resultData.canSkip !== false,
        platformRenderData,
        isDraft,
        draftSavedAt: resultData.draftSavedAt || null,
      },
    });
  } catch (error) {
    console.error('[Preview Article] 获取预览内容失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '获取预览内容失败' },
      { status: 500 }
    );
  }
}

// ========== 辅助函数 ==========

function extractArticleTitleFromResultData(resultData: any, fallbackTitle: string): string {
  try {
    const data = typeof resultData === 'string' ? JSON.parse(resultData) : resultData;
    // 信封格式: executorOutput.structuredResult.resultContent.articleTitle
    const title = data?.executorOutput?.structuredResult?.resultContent?.articleTitle ||
                  data?.executorOutput?.structuredResult?.articleTitle ||
                  data?.articleTitle || '';
    if (title && typeof title === 'string' && title.length > 0 && title.length <= 50) {
      return title;
    }
  } catch {}
  return fallbackTitle || '';
}

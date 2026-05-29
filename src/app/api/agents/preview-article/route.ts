/**
 * 文章预览 API
 * 
 * GET /api/agents/preview-article - 获取文章预览内容
 * 
 * 功能：
 * 1. 获取指定预览节点任务的文章内容
 * 2. 从 resultData 中提取文章内容（由 executeUserPreviewEditTask 写入）
 * 3. 返回平台信息供前端选择合适的预览组件
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq, and, lt, desc } from 'drizzle-orm';
// 🔥🔥🔥 【P1-3修复】统一使用 agent-registry 中的平台映射
import { isWritingAgent, getPlatformForExecutor } from '@/lib/agents/agent-registry';

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  // 🔴 P0-2 修复：获取 workspaceId 用于隔离验证
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

    // 🔴 P0-2 修复：查询时增加 workspaceId 隔离，防止越权访问
    const task = await db.query.agentSubTasks.findFirst({
      where: and(
        eq(agentSubTasks.id, taskId),
        eq(agentSubTasks.workspaceId, workspaceId)  // 强制隔离
      ),
    });

    if (!task) {
      return NextResponse.json(
        { success: false, error: '未找到任务' },
        { status: 404 }
      );
    }

    // 2. 从 resultData 提取预览数据
    let resultData: any = {};
    try {
      resultData = typeof task.resultData === 'string' 
        ? JSON.parse(task.resultData) 
        : task.resultData || {};
    } catch {
      resultData = {};
    }

    // 🔥🔥🔥 【直接发文修复】直接发文模式下，优先使用用户提供的原文
    // 问题：insurance-d 可能只输出 briefResponse 而没有实际文章内容，
    // 导致 articleContent 是简短摘要而非用户原文
    const taskMetadata = typeof task.metadata === 'object' && task.metadata !== null
      ? task.metadata as Record<string, unknown>
      : {};
    const isDirectPublish = taskMetadata.creationMode === 'direct_publish' || !!taskMetadata.providedArticle;
    const providedArticle = typeof taskMetadata.providedArticle === 'string' ? taskMetadata.providedArticle : '';
    const providedArticleTitle = typeof taskMetadata.providedArticleTitle === 'string' ? taskMetadata.providedArticleTitle : '';

    // 从 resultData 中获取预存内容（由 executeUserPreviewEditTask 写入）
    let articleContent: string = resultData.articleContent || '';
    let articleTitle: string = resultData.articleTitle || '';
    let platform: string = resultData.platform || '';
    const writingTaskId = resultData.writingTaskId || null;
    // 🔥🔥🔥 【架构改造】平台渲染数据（独立于 articleContent 纯文本）
    let platformRenderData = resultData.platformRenderData || null;

    // 直接发文模式：用用户提供的原文替换从写作任务提取的 briefResponse
    // insurance-d 在直接发文模式下可能只输出 briefResponse 而没有实际文章内容
    if (isDirectPublish && providedArticle) {
      if (!articleContent || articleContent.length < providedArticle.length * 0.5) {
        console.log('[Preview Article] 直接发文模式：使用 providedArticle 替换 articleContent', {
          oldLength: articleContent?.length || 0,
          newLength: providedArticle.length,
        });
        articleContent = providedArticle;
      }
      if (providedArticleTitle && !articleTitle) {
        articleTitle = providedArticleTitle;
      }
    }

    // 3. 如果没有预存内容（兼容旧流程），从前序写作任务获取
    // 条件：articleContent 为空，或小红书平台缺少 platformRenderData（小红书必须有卡片数据）
    // 注意：公众号的 platformRenderData 为空时不需要重新提取，因为 LLM 格式化会生成
    const needExtractFromWritingTask = !articleContent || 
      (!platformRenderData && platform === 'xiaohongshu');
    
    console.log('[Preview Article] needExtractFromWritingTask:', needExtractFromWritingTask, {
      articleContentEmpty: !articleContent,
      platformRenderDataEmpty: !platformRenderData,
      isXiaohongshu: platform === 'xiaohongshu',
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
        let writingResultData: any = {};
        try {
          writingResultData = typeof writingTask.resultData === 'string'
            ? JSON.parse(writingTask.resultData)
            : writingTask.resultData || {};
        } catch (parseError) {
          console.error('[Preview Article] 解析 writingTask.resultData 失败:', parseError);
          writingResultData = {};
        }
        
        const executorOutput = writingResultData?.executorOutput;
        const structuredResult = executorOutput?.structuredResult;
        const platformData = structuredResult?.resultContent?.platformData || 
                            structuredResult?.platformData;
        
        const writingPlatform = getPlatformForExecutor(writingTask.fromParentsExecutor);
        
        if (writingPlatform && !platformRenderData) {
          try {
            const { extractPlatformRenderData } = await import('@/lib/platform-render/extractors');
            const writingTaskMetadata = typeof task.metadata === 'object' && task.metadata !== null
              ? task.metadata as Record<string, unknown>
              : {};
            platformRenderData = extractPlatformRenderData(
              writingPlatform,
              writingTask.resultData,
              writingTaskMetadata
            );
          } catch (extractErr) {
            console.error('[Preview Article] 平台渲染数据提取失败:', extractErr);
          }
        }

        // 【直接发文修复】直接发文模式下，已有 providedArticle 作为 articleContent，
        // 不需要从写作任务的 briefResponse/structuredResult 覆盖
        // 但仍需提取 platformRenderData（上面的代码已处理）
        if (isDirectPublish && articleContent && articleContent.length > 50) {
          // 直接发文模式已有正确内容，只更新 platform 信息
          if (!platform) platform = writingPlatform || '';
          if (!articleTitle) articleTitle = extractArticleTitleFromResultData(writingTask.resultData, writingTask.taskTitle);
        } else if (platformData && platformData.platform === 'xiaohongshu') {
          // 小红书：articleContent 保持纯文本，platformRenderData 提供卡片数据
          articleContent = structuredResult?.resultContent?.content || writingTask.resultText || '';
          articleTitle = platformData.title || structuredResult?.resultContent?.articleTitle || '';
          platform = 'xiaohongshu';
        } else if (writingPlatform === 'wechat_official') {
          // 公众号：优先使用 platformRenderData 中的 htmlContent
          if (platformRenderData && typeof platformRenderData === 'object' && 'htmlContent' in platformRenderData) {
            articleContent = (platformRenderData as any).htmlContent || '';
          } else {
            // 兜底：使用信封格式中的 result.content
            articleContent = structuredResult?.resultContent?.content || 
                            structuredResult?.resultContent?.htmlContent || 
                            writingTask.resultText || '';
          }
          articleTitle = extractArticleTitleFromResultData(writingTask.resultData, writingTask.taskTitle);
          platform = 'wechat_official';
        } else {
          // 其他平台使用 resultText
          articleContent = writingTask.resultText || '';
          articleTitle = extractArticleTitleFromResultData(writingTask.resultData, writingTask.taskTitle);
          platform = resultData.platform || writingPlatform;
        }
      }
    }

    // 【直接发文兜底】如果 platformRenderData 仍为空，
    // 使用 LLM 格式化（微信应用公众号 HTML 样式、小红书智能提取要点）
    // 注意：公众号的 LLM 格式化就是"样式改造"功能，即使 articleContent 已经是 HTML
    // 也需要经过格式化来添加公众号风格的排版样式（标题/分割线/重点标注等）
    const shouldFormat = !platformRenderData && articleContent && platform;
    
    if (shouldFormat) {
      try {
        const { formatDirectPublishArticle } = await import('@/lib/services/direct-publish-formatter-service');
        const taskMetadata = typeof task.metadata === 'object' && task.metadata !== null
          ? task.metadata as Record<string, unknown>
          : {};
        const VALID_CARD_MODES = ['3-card', '5-card', '7-card'] as const;
        const rawCardCountMode = (taskMetadata.cardCountMode as string) || (taskMetadata.imageCountMode as string) || undefined;
        const cardCountMode = rawCardCountMode && VALID_CARD_MODES.includes(rawCardCountMode as typeof VALID_CARD_MODES[number])
          ? rawCardCountMode as typeof VALID_CARD_MODES[number]
          : undefined;
        const workspaceId = task.workspaceId || undefined;
        const generated = await formatDirectPublishArticle({
          textContent: articleContent,
          platform,
          articleTitle,
          cardCountMode,
          workspaceId,
        });
        if (generated) {
          platformRenderData = generated;
          console.log('[Preview Article] LLM格式化 platformRenderData 成功:', {
            platform,
            dataType: Object.keys(generated).join(','),
          });
        }
      } catch (genErr) {
        console.error('[Preview Article] LLM格式化失败，降级到简单文本处理:', genErr);
        // 降级：使用简单文本处理
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
        // 🔥🔥🔥 【架构改造】返回平台渲染数据
        // 前端组件根据此字段渲染平台专属UI（如小红书卡片）
        // articleContent 保持纯文本，platformRenderData 提供结构化数据
        platformRenderData,
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

function extractArticleTitleFromResultData(resultData: any, fallbackTitle?: string | null): string {
  if (!resultData) return fallbackTitle || '';
  try {
    const data = typeof resultData === 'string' ? JSON.parse(resultData) : resultData;
    if (data?.result?.articleTitle) return data.result.articleTitle;
    if (data?.articleTitle) return data.articleTitle;
    if (data?.executorOutput?.structuredResult?.articleTitle) return data.executorOutput.structuredResult.articleTitle;
  } catch {
    // ignore
  }
  return fallbackTitle || '';
}

// 🔥🔥🔥 【P1-3修复】已删除本地 getPlatformFromExecutor 函数
// 统一使用 agent-registry.ts 中的 getPlatformForExecutor

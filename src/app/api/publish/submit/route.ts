/**
 * 发布提交 API
 * 
 * POST /api/publish/submit
 * 支持单平台模式（subTaskId + platforms）和多平台模式（platformArticles）
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getWorkspaceId } from '@/lib/auth/context';
import { contentAdapter, ArticleSource } from '@/lib/services/publish/content-adapter';
import { publishQueue } from '@/lib/services/publish/publish-queue';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * 从子任务结果中提取文章内容
 */
function extractArticleFromTaskResult(task: any): ArticleSource {
  const result = task.resultData || task.result || {};
  const content = result.content || result.html || result.text || '';
  // P2-2 修复：taskName 不存在于 agentSubTasks，应使用 taskTitle
  const title = result.title || task.taskTitle || '未命名文章';

  // 提取图片
  const images: Array<{ url: string; alt?: string }> = [];
  const imgRegex = /<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"?/g;
  let match;
  while ((match = imgRegex.exec(content)) !== null) {
    images.push({ url: match[1], alt: match[2] });
  }

  // 纯文本
  const plainText = content.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();

  return {
    title,
    content,
    plainText,
    images,
    tags: result.tags || [],
    wordCount: plainText.length,
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const workspaceId = await getWorkspaceId(request);
    const body = await request.json();
    const { subTaskId, platforms, scheduledAt, platformArticles } = body;

    // 🔥 多平台模式：每个平台使用自己的文章版本
    if (platformArticles && Array.isArray(platformArticles) && platformArticles.length > 0) {
      const results: Array<{ platform: string; accountId: string; recordId: string; articleTitle: string }> = [];
      // P1-3 修复：记录失败的平台，返回汇总报告
      const failedPlatforms: Array<{ subTaskId: string; platform?: string; reason: string }> = [];

      for (const item of platformArticles) {
        const { subTaskId: itemSubTaskId, platform: itemPlatform, accountId: itemAccountId } = item;

        if (!itemSubTaskId || !itemPlatform) {
          failedPlatforms.push({ subTaskId: itemSubTaskId || '', platform: itemPlatform, reason: '缺少必填参数 subTaskId 或 platform' });
          continue;
        }

        // 1. 获取子任务结果
        const [subTask] = await db.select()
          .from(agentSubTasks)
          .where(eq(agentSubTasks.id, itemSubTaskId))
          .limit(1);

        if (!subTask) {
          console.warn(`[Publish] 多平台模式：子任务 ${itemSubTaskId} 不存在，跳过`);
          failedPlatforms.push({ subTaskId: itemSubTaskId, platform: itemPlatform, reason: '子任务不存在' });
          continue;
        }

        // 2. 提取文章内容
        const article = extractArticleFromTaskResult(subTask);

        // 3. 内容适配（单平台）
        const adaptedContents = contentAdapter.adaptAll(article, [itemPlatform]);
        const adaptedContent = adaptedContents[itemPlatform];

        if (!adaptedContent) {
          console.warn(`[Publish] 多平台模式：平台 ${itemPlatform} 内容适配失败，跳过`);
          failedPlatforms.push({ subTaskId: itemSubTaskId, platform: itemPlatform, reason: '内容适配失败' });
          continue;
        }

        // 4. 提交发布队列
        try {
          const recordIds = await publishQueue.submit({
            workspaceId,
            subTaskId: itemSubTaskId,
            platforms: [{ platform: itemPlatform, accountId: itemAccountId }],
            adaptedContents: { [itemPlatform]: adaptedContent },
            scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
            submittedBy: session.user.id,
          });

          if (recordIds.length > 0) {
            results.push({
              platform: itemPlatform,
              accountId: itemAccountId || '',
              recordId: recordIds[0],
              articleTitle: article.title,
            });
          } else {
            failedPlatforms.push({ subTaskId: itemSubTaskId, platform: itemPlatform, reason: '发布队列入队返回空记录' });
          }
        } catch (queueError: any) {
          console.error(`[Publish] 多平台模式：平台 ${itemPlatform} 提交发布队列失败:`, queueError);
          failedPlatforms.push({ subTaskId: itemSubTaskId, platform: itemPlatform, reason: queueError.message || '提交发布队列异常' });
        }
      }

      // P1-3 修复：部分失败时返回 warnings，success 仅在全部成功时为 true
      const partialFailure = failedPlatforms.length > 0;
      const allFailed = results.length === 0 && partialFailure;

      return NextResponse.json({
        success: !partialFailure,
        data: {
          mode: 'multi-platform',
          platformCount: results.length,
          totalExpected: platformArticles.length,
          results,
          status: allFailed
            ? 'failed'
            : (scheduledAt ? 'scheduled' : (partialFailure ? 'partial' : 'pending')),
          ...(partialFailure ? { warnings: failedPlatforms } : {}),
        },
        ...(partialFailure && !allFailed ? { message: `部分平台发布成功(${results.length}/${platformArticles.length})，${failedPlatforms.length}个平台发布失败` } : {}),
        ...(allFailed ? { error: '所有平台发布均失败' } : {}),
      }, { status: allFailed ? 500 : 200 });
    }

    // ========== 单平台兼容模式：原有逻辑 ==========
    if (!subTaskId || !platforms || !Array.isArray(platforms) || platforms.length === 0) {
      return NextResponse.json(
        { error: '缺少必填参数: subTaskId, platforms（或 platformArticles）' },
        { status: 400 }
      );
    }

    // 1. 获取子任务结果
    const [subTask] = await db.select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, subTaskId))
      .limit(1);

    if (!subTask) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }

    // 2. 提取文章内容
    const article = extractArticleFromTaskResult(subTask);

    // 3. 内容适配
    const platformNames = platforms.map((p: any) => p.platform);
    const adaptedContents = contentAdapter.adaptAll(article, platformNames);

    // 4. 提交发布队列
    const recordIds = await publishQueue.submit({
      workspaceId,
      subTaskId,
      platforms,
      adaptedContents,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      submittedBy: session.user.id,
    });

    return NextResponse.json({
      success: true,
      data: {
        mode: 'single-platform',
        recordIds,
        status: scheduledAt ? 'scheduled' : 'pending',
        articleTitle: article.title,
        wordCount: article.wordCount,
        platformCount: platformNames.length,
      },
    });
  } catch (error: any) {
    console.error('[Publish] 提交发布失败:', error);
    return NextResponse.json(
      { error: error.message || '提交发布失败' },
      { status: 500 }
    );
  }
}

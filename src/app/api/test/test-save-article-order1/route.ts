/**
 * 测试保存文章内容（使用 order_index=1 的任务）
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { ArticleContentService } from '@/lib/services/article-content-service';

export async function GET() {
  try {
    // 找到最近完成的 order_index=1 的 insurance-d 任务
    console.log('🔍 查找最近完成的 order_index=1 insurance-d 任务...');

    const subTasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.fromParentsExecutor, 'insurance-d'))
      .orderBy(agentSubTasks.completedAt)
      .limit(10);

    const order1Task = subTasks.find(t => t.orderIndex === 1);

    if (!order1Task) {
      return NextResponse.json({
        success: false,
        error: '没有找到 order_index=1 的 insurance-d 任务',
      });
    }

    console.log('✅ 找到任务:', {
      id: order1Task.id,
      taskTitle: order1Task.taskTitle,
      orderIndex: order1Task.orderIndex,
      commandResultId: order1Task.commandResultId,
    });

    // 测试保存
    const articleContentService = ArticleContentService.getInstance();
    const savedArticle = await articleContentService.saveArticleContent(order1Task);

    if (savedArticle) {
      console.log('✅ 文章保存成功:', savedArticle.articleId);
      return NextResponse.json({
        success: true,
        message: '文章保存成功',
        article: {
          articleId: savedArticle.articleId,
          title: savedArticle.articleTitle,
          contentLength: savedArticle.articleContent?.length || 0,
          creatorAgent: savedArticle.creatorAgent,
          contentStatus: savedArticle.contentStatus,
        },
      });
    } else {
      console.log('⚠️ 文章保存失败或跳过');
      return NextResponse.json({
        success: false,
        error: '文章保存失败或跳过',
        taskId: order1Task.id,
      });
    }
  } catch (error) {
    console.error('❌ 测试失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    });
  }
}

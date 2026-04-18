/**
 * 测试完整的文章内容获取修复
 * 
 * 验证：
 * 1. 从 article_content 表获取
 * 2. 从历史记录中提取
 * 3. 从 resultData 中获取
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { ArticleContentService } from '@/lib/services/article-content-service';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const commandResultId = searchParams.get('commandResultId');

  try {
    if (!commandResultId) {
      // 找到最近的 insurance-d 任务
      const subTasks = await db
        .select()
        .from(agentSubTasks)
        .where(eq(agentSubTasks.fromParentsExecutor, 'insurance-d'))
        .orderBy(agentSubTasks.completedAt)
        .limit(3);

      return NextResponse.json({
        success: true,
        message: '请提供 commandResultId 参数',
        recentTasks: subTasks.map(t => ({
          id: t.id,
          commandResultId: t.commandResultId,
          taskTitle: t.taskTitle,
          orderIndex: t.orderIndex,
        })),
      });
    }

    console.log('🔍 测试获取文章内容, commandResultId:', commandResultId);

    const articleContentService = ArticleContentService.getInstance();
    const result = await articleContentService.getArticleContent(commandResultId);

    if (result) {
      return NextResponse.json({
        success: true,
        message: '✅ 成功获取文章内容',
        commandResultId,
        title: result.title,
        contentLength: result.content.length,
        contentPreview: result.content.substring(0, 300) + '...',
      });
    } else {
      return NextResponse.json({
        success: false,
        message: '❌ 未找到文章内容',
        commandResultId,
      });
    }
  } catch (error) {
    console.error('❌ 测试失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

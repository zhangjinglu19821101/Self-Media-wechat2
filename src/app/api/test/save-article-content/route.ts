import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { ArticleContentService } from '@/lib/services/article-content-service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { taskId } = body;

    if (!taskId) {
      return NextResponse.json({ 
        success: false, 
        error: '缺少 taskId 参数' 
      }, { status: 400 });
    }

    // 查询子任务
    const subtask = await db.query.agentSubTasks.findFirst({
      where: eq(agentSubTasks.id, taskId)
    });

    if (!subtask) {
      return NextResponse.json({ 
        success: false, 
        error: '任务不存在' 
      }, { status: 404 });
    }

    console.log('[API] 手动触发保存文章内容, 任务:', {
      taskId: subtask.id,
      taskTitle: subtask.taskTitle,
      orderIndex: subtask.orderIndex,
      commandResultId: subtask.commandResultId
    });

    // 手动触发保存文章内容
    const articleContentService = ArticleContentService.getInstance();
    const savedArticle = await articleContentService.saveArticleContent(subtask);

    if (savedArticle) {
      console.log('[API] ✅ 文章内容保存成功:', savedArticle.articleId);
      return NextResponse.json({
        success: true,
        message: '文章内容保存成功',
        data: {
          articleId: savedArticle.articleId,
          title: savedArticle.articleTitle,
          contentLength: savedArticle.articleContent.length
        }
      });
    } else {
      console.log('[API] 文章内容不满足保存条件，跳过');
      return NextResponse.json({
        success: false,
        message: '文章内容不满足保存条件'
      });
    }
  } catch (error) {
    console.error('[API] 保存文章内容失败:', error);
    return NextResponse.json({ 
      success: false, 
      error: '保存失败: ' + (error as Error).message 
    }, { status: 500 });
  }
}

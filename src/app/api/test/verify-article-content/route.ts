/**
 * 验证文章内容是否保存成功
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { articleContent } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

export async function GET() {
  const taskId = '58ea520c-e7f1-4c27-bd24-2b3aab034066';
  
  try {
    // 查询所有文章
    const allArticles = await db
      .select()
      .from(articleContent)
      .orderBy(desc(articleContent.createTime))
      .limit(10);
    
    // 查询指定任务的文章
    const taskArticles = await db
      .select()
      .from(articleContent)
      .where(eq(articleContent.taskId, taskId))
      .limit(1);
    
    return NextResponse.json({
      success: true,
      allArticlesCount: allArticles.length,
      allArticles: allArticles.map(a => ({
        articleId: a.articleId,
        taskId: a.taskId,
        articleTitle: a.articleTitle,
        contentStatus: a.contentStatus,
        createTime: a.createTime,
        contentLength: a.articleContent?.length || 0,
      })),
      taskArticleFound: taskArticles.length > 0,
      taskArticle: taskArticles.length > 0 ? {
        ...taskArticles[0],
        articleContent: taskArticles[0].articleContent?.substring(0, 200) + '...',
      } : null,
    });
    
  } catch (error) {
    console.error('❌ 查询失败:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

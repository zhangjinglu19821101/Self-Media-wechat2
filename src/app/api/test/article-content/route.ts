/**
 * 查询 article_content 表中的文章数据
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { articleContent } from '@/lib/db/schema';

export async function GET() {
  try {
    console.log('🔍 查询 article_content 表...');
    
    const articles = await db
      .select()
      .from(articleContent)
      .orderBy(articleContent.createTime);

    console.log(`✅ 查询到 ${articles.length} 篇文章`);

    if (articles.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          count: 0,
          articles: [],
          message: 'article_content 表中没有文章数据'
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        count: articles.length,
        articles: articles.map(article => ({
          articleId: article.articleId,
          taskId: article.taskId,
          creatorAgent: article.creatorAgent,
          articleTitle: article.articleTitle,
          articleSubtitle: article.articleSubtitle,
          contentLength: article.articleContent?.length || 0,
          coreKeywords: article.coreKeywords,
          createTime: article.createTime,
          updateTime: article.updateTime,
          version: article.version,
          contentStatus: article.contentStatus,
          rejectReason: article.rejectReason,
          wechatMpUrl: article.wechatMpUrl,
          wechatMpPublishTime: article.wechatMpPublishTime,
          extInfo: article.extInfo,
        }))
      }
    });
  } catch (error: any) {
    console.error('❌ 查询 article_content 表失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '查询失败'
      },
      { status: 500 }
    );
  }
}

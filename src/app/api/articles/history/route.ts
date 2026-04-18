import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { articleContent, agentSubTasks, agentSubTasksStepHistory } from '@/lib/db/schema';
import { eq, and, desc, or } from 'drizzle-orm';
import { requireAuth, getWorkspaceId } from '@/lib/auth/context';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    
    const workspaceId = await getWorkspaceId(request);

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const commandResultId = searchParams.get('commandResultId');
    
    if (!taskId && !commandResultId) {
      return NextResponse.json(
        { error: '需要提供 taskId 或 commandResultId' },
        { status: 400 }
      );
    }

    console.log('[API] 获取文章历史版本:', { taskId, commandResultId });

    // 1. 从 article_content 表获取所有版本
    let articles: any[] = [];
    
    if (commandResultId) {
      // 先验证 commandResultId 属于当前 workspace
      const validTasks = await db
        .select({ id: agentSubTasks.id })
        .from(agentSubTasks)
        .where(and(
          eq(agentSubTasks.commandResultId, commandResultId),
          eq(agentSubTasks.workspaceId, workspaceId)
        ))
        .limit(1);

      if (validTasks.length === 0) {
        return NextResponse.json({ error: '无权访问' }, { status: 403 });
      }

      articles = await db
        .select()
        .from(articleContent)
        .where(eq(articleContent.taskId, commandResultId))
        .orderBy(desc(articleContent.createTime));
    } else if (taskId) {
      // 通过 taskId 查找对应的 commandResultId（带 workspaceId 隔离）
      const subTasks = await db
        .select()
        .from(agentSubTasks)
        .where(and(
          eq(agentSubTasks.id, taskId),
          eq(agentSubTasks.workspaceId, workspaceId)
        ));
      
      if (subTasks.length > 0) {
        articles = await db
          .select()
          .from(articleContent)
          .where(eq(articleContent.taskId, subTasks[0].commandResultId))
          .orderBy(desc(articleContent.createTime));
      }
    }

    // 2. 从 agentSubTasksStepHistory 表提取历史版本（作为补充）
    let historyVersions: any[] = [];
    
    if (commandResultId) {
      const historyRecords = await db
        .select()
        .from(agentSubTasksStepHistory)
        .where(
          and(
            eq(agentSubTasksStepHistory.commandResultId, commandResultId),
            eq(agentSubTasksStepHistory.stepNo, 1) // order_index=1 是初稿
          )
        )
        .orderBy(agentSubTasksStepHistory.interactTime);
      
      // 从历史记录中提取文章内容
      for (const record of historyRecords) {
        const content = record.interactContent as any;
        
        // 尝试从不同位置提取文章内容
        let articleContentText = '';
        let articleTitle = '历史版本';
        
        if (content?.question?.result && typeof content.question.result === 'string') {
          articleContentText = content.question.result;
          // 尝试提取标题
          const titleMatch = articleContentText.match(/^#{1,3}\s*([^\n]+)/);
          if (titleMatch) {
            articleTitle = titleMatch[1].trim();
          }
        } else if (content?.question?.structuredResult?.resultContent) {
          articleContentText = content.question.structuredResult.resultContent;
          const titleMatch = articleContentText.match(/^#{1,3}\s*([^\n]+)/);
          if (titleMatch) {
            articleTitle = titleMatch[1].trim();
          }
        }
        
        if (articleContentText && articleContentText.length > 100) {
          historyVersions.push({
            versionType: 'history',
            source: 'step_history',
            title: articleTitle,
            content: articleContentText,
            timestamp: record.interactTime,
            stepNo: record.stepNo,
            interactNum: record.interactNum,
            interactType: record.interactType,
          });
        }
      }
    }

    // 3. 合并所有版本
    // 🔥 P2: 在返回中增加 extInfo 字段，包含小红书卡片信息
    const allVersions = [
      ...articles.map(article => ({
        versionType: 'saved',
        source: 'article_content',
        articleId: article.articleId,
        title: article.articleTitle,
        content: article.articleContent,
        timestamp: article.createTime,
        updateTime: article.updateTime,
        contentStatus: article.contentStatus,
        version: article.version,
        // 🔥 P2: 返回 extInfo，包含小红书卡片信息
        extInfo: (article as any).extInfo || null,
        // 🔥 P2: 便捷字段 - 小红书卡片相关信息
        xhsCardGroupId: (article as any).extInfo?.xhsCardGroupId || null,
        xhsCardStorageKeys: (article as any).extInfo?.xhsCardStorageKeys || null,
        xhsCardUrls: (article as any).extInfo?.xhsCardUrls || null,
        xhsFullText: (article as any).extInfo?.xhsFullText || null,
        xhsTags: (article as any).extInfo?.xhsTags || null,
      })),
      ...historyVersions,
    ];

    // 按时间排序
    allVersions.sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeB - timeA;
    });

    console.log('[API] 找到文章版本数量:', allVersions.length);

    return NextResponse.json({
      success: true,
      versions: allVersions,
      totalCount: allVersions.length,
    });
  } catch (error) {
    console.error('[API] 获取文章历史版本失败:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '获取失败' 
      },
      { status: 500 }
    );
  }
}

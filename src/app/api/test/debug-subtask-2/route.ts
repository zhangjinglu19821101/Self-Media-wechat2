/**
 * 调试步骤2子任务
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks, agentSubTasksStepHistory, articleContent } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET() {
  const subTaskId = '5030be99-e402-4637-bdad-d41c175b4d77';
  
  try {
    // 1. 查询子任务
    const subTasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, subTaskId))
      .limit(1);
    
    if (subTasks.length === 0) {
      return NextResponse.json({
        success: false,
        error: '找不到子任务',
      });
    }
    
    const subTask = subTasks[0];
    
    // 2. 查询相关的文章
    const articles = await db
      .select()
      .from(articleContent)
      .where(eq(articleContent.taskId, subTask.commandResultId))
      .limit(1);
    
    // 3. 查询步骤历史
    const stepHistory = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(
        and(
          eq(agentSubTasksStepHistory.commandResultId, subTask.commandResultId),
          eq(agentSubTasksStepHistory.stepNo, subTask.orderIndex)
        )
      )
      .orderBy(agentSubTasksStepHistory.interactNum);
    
    return NextResponse.json({
      success: true,
      subTask: {
        id: subTask.id,
        taskTitle: subTask.taskTitle,
        orderIndex: subTask.orderIndex,
        status: subTask.status,
        hasArticleMetadata: !!subTask.articleMetadata,
        articleMetadataIsEmpty: !subTask.articleMetadata || Object.keys(subTask.articleMetadata).length === 0,
        articleMetadata: subTask.articleMetadata,
      },
      articleFound: articles.length > 0,
      article: articles.length > 0 ? {
        articleId: articles[0].articleId,
        articleTitle: articles[0].articleTitle,
        contentStatus: articles[0].contentStatus,
        hasContent: !!articles[0].articleContent,
        contentLength: articles[0].articleContent?.length || 0,
      } : null,
      stepHistoryCount: stepHistory.length,
      stepHistory: stepHistory.map(h => ({
        interactNum: h.interactNum,
        interactType: h.interactType,
        interactUser: h.interactUser,
        hasContent: !!h.interactContent,
      })),
    });
    
  } catch (error) {
    console.error('❌ 调试失败:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

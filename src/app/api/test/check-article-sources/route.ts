/**
 * 详细检查文章内容来源
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks, agentSubTasksStepHistory } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const commandResultId = '250d659b-2731-491f-95ce-e58a799829bb';
    
    console.log('🔍 详细检查文章内容来源...');

    // 1. 检查 article_content 表
    const { articleContent } = await import('@/lib/db/schema');
    const articles = await db
      .select()
      .from(articleContent)
      .where(eq(articleContent.taskId, commandResultId))
      .limit(1);

    // 2. 检查 agent_sub_tasks.resultData
    const subTasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.commandResultId, commandResultId))
      .orderBy(agentSubTasks.orderIndex);

    // 3. 检查 agent_sub_tasks_step_history
    const history = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(eq(agentSubTasksStepHistory.commandResultId, commandResultId))
      .orderBy(agentSubTasksStepHistory.stepNo, agentSubTasksStepHistory.interactNum);

    return NextResponse.json({
      success: true,
      commandResultId,
      articleContentTable: articles.length > 0 ? {
        articleId: articles[0].articleId,
        title: articles[0].articleTitle,
        contentLength: articles[0].articleContent?.length || 0,
      } : null,
      agentSubTasks: subTasks.map(t => {
        const resultDataObj = typeof t.resultData === 'object' && t.resultData !== null 
          ? t.resultData 
          : {};
        return {
          id: t.id,
          orderIndex: t.orderIndex,
          taskTitle: t.taskTitle,
          hasResultData: !!t.resultData,
          resultDataKeys: t.resultData ? Object.keys(resultDataObj) : [],
        };
      }),
      stepHistory: history.map(h => ({
        id: h.id,
        stepNo: h.stepNo,
        interactNum: h.interactNum,
        interactType: h.interactType,
        hasResponseContentKeys: h.interactContent ? Object.keys(h.interactContent as object) : [],
      })),
    });
  } catch (error) {
    console.error('❌ 检查失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * 测试文章内容提取修复
 * 
 * 验证 extractArticleFromHistory 方法是否能正确从 responseContent.resultSummary 字段提取文章内容
 * 
 * 使用方法：
 *   GET /api/test/test-article-extraction
 *   GET /api/test/test-article-extraction?taskId=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { ArticleContentService } from '@/lib/services/article-content-service';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('taskId');

  try {
    if (taskId) {
      // 测试指定任务
      console.log('🔍 测试任务ID:', taskId);

      // 获取子任务信息
      const subTasks = await db
        .select()
        .from(agentSubTasks)
        .where(eq(agentSubTasks.id, taskId as any))
        .limit(1);

      if (subTasks.length === 0) {
        return NextResponse.json({
          success: false,
          error: '任务不存在',
          taskId,
        });
      }

      const subTask = subTasks[0];
      const articleContentService = ArticleContentService.getInstance();
      const result = await articleContentService.extractArticleFromHistory(subTask.commandResultId as string);

      return NextResponse.json({
        success: true,
        taskId,
        commandResultId: subTask.commandResultId,
        fromParentsExecutor: subTask.fromParentsExecutor,
        extractionResult: result,
      });
    }

    // 默认测试：找到最近完成的 insurance-d 任务
    console.log('🔍 查找最近完成的 insurance-d 任务...');

    const subTasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.fromParentsExecutor, 'insurance-d'))
      .orderBy(agentSubTasks.completedAt)
      .limit(5);

    if (subTasks.length === 0) {
      return NextResponse.json({
        success: false,
        error: '没有找到 insurance-d 任务',
      });
    }

    // 测试第一个任务
    const subTask = subTasks[0];
    const articleContentService = ArticleContentService.getInstance();
    const result = await articleContentService.extractArticleFromHistory(subTask.commandResultId as string);

    return NextResponse.json({
      success: true,
      testType: 'insurance-d latest task',
      taskId: subTask.id,
      commandResultId: subTask.commandResultId,
      taskTitle: subTask.taskTitle,
      fromParentsExecutor: subTask.fromParentsExecutor,
      extractionResult: result,
    });
  } catch (error) {
    console.error('❌ 测试失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    });
  }
}

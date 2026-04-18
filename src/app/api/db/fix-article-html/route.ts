/**
 * 修复公众号任务的 result_text 字段
 * 
 * 问题：extractFromResultContentObject 没有检查 articleHtml 字段
 * 导致公众号文章的 result_text 只有 briefResponse（约100字），而非完整 HTML
 * 
 * 修复：从 resultContent.articleHtml 提取完整文章
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq, and, isNotNull, sql } from 'drizzle-orm';
import { extractFromResultContentObject } from '@/lib/services/result-text-extractor';

export async function GET(request: NextRequest) {
  try {
    // 1. 查找公众号任务，result_text 较短的
    const tasks = await db
      .select({
        id: agentSubTasks.id,
        taskTitle: agentSubTasks.taskTitle,
        resultText: agentSubTasks.resultText,
        resultData: agentSubTasks.resultData,
      })
      .from(agentSubTasks)
      .where(
        and(
          eq(agentSubTasks.fromParentsExecutor, 'insurance-d'),
          eq(agentSubTasks.status, 'completed'),
          sql`LENGTH(COALESCE(result_text, '')) < 500` // 只修复短的 result_text
        )
      );

    console.log(`[FixArticleHtml] 找到 ${tasks.length} 个需要修复的公众号任务`);

    const results: Array<{
      id: string;
      taskTitle: string;
      beforeLength: number;
      afterLength: number;
      fixed: boolean;
    }> = [];

    for (const task of tasks) {
      const beforeLength = task.resultText?.length || 0;
      
      // 从 resultData 提取 articleHtml
      let resultData: any = {};
      try {
        resultData = typeof task.resultData === 'string'
          ? JSON.parse(task.resultData)
          : task.resultData || {};
      } catch {
        continue;
      }

      const resultContent = resultData?.executorOutput?.structuredResult?.resultContent;
      if (!resultContent) continue;

      const articleHtml = extractFromResultContentObject(resultContent, 'insurance-d');
      if (!articleHtml || articleHtml.length <= beforeLength) {
        continue;
      }

      // 更新 result_text
      await db
        .update(agentSubTasks)
        .set({
          resultText: articleHtml,
          updatedAt: new Date(),
        })
        .where(eq(agentSubTasks.id, task.id));

      results.push({
        id: task.id,
        taskTitle: task.taskTitle || '',
        beforeLength,
        afterLength: articleHtml.length,
        fixed: true,
      });

      console.log(
        `[FixArticleHtml] 任务 "${task.taskTitle}" 已修复: ${beforeLength} → ${articleHtml.length} 字`
      );
    }

    const totalFixed = results.filter(r => r.fixed).length;

    return NextResponse.json({
      success: true,
      totalTasks: tasks.length,
      totalFixed,
      results,
    });
  } catch (error) {
    console.error('[FixArticleHtml] 执行失败:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

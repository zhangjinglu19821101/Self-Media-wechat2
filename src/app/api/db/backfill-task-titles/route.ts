/**
 * GET /api/db/backfill-task-titles
 * 一次性回填：从已有 insurance-d 执行结果中提取 articleTitle，更新 taskTitle
 * 同 commandResultId 的所有子任务都会被同步更新
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq, and, desc, sql, isNotNull } from 'drizzle-orm';

export async function GET() {
  try {
    console.log('[BackfillTaskTitles] 🔥 开始回填 taskTitle...');

    // 1. 查找所有 insurance-d 已完成的任务
    const completedTasks = await db
      .select()
      .from(agentSubTasks)
      .where(
        and(
          eq(agentSubTasks.fromParentsExecutor, 'insurance-d'),
          eq(agentSubTasks.status, 'completed'),
          isNotNull(agentSubTasks.resultData),
        )
      )
      .orderBy(desc(agentSubTasks.createdAt))
      .limit(200);

    console.log(`[BackfillTaskTitles] 找到 ${completedTasks.length} 条 insurance-d 已完成任务`);

    let updatedCount = 0;
    const errors: string[] = [];

    for (const task of completedTasks) {
      try {
        // 2. 从 resultData 中提取 articleTitle
        const resultData = typeof task.resultData === 'string' 
          ? JSON.parse(task.resultData) 
          : task.resultData;

        let articleTitle: string | null = null;

        // 优先级1：标准 articleTitle 字段
        if (resultData?.articleTitle && typeof resultData.articleTitle === 'string') {
          articleTitle = resultData.articleTitle.trim();
        }

        // 优先级2：从 executorOutput 中提取
        if (!articleTitle && resultData?.executorOutput) {
          const output = resultData.executorOutput;
          if (output.articleTitle) {
            articleTitle = output.articleTitle.trim();
          }
        }

        // 优先级3：从 HTML 内容中提取 <h2> 标签
        if (!articleTitle) {
          const htmlContent = resultData?.executorOutput?.output || resultData?.output || '';
          if (typeof htmlContent === 'string' && htmlContent.includes('<h2')) {
            const h2Match = htmlContent.match(/<h2[^>]*>([^<]+)/);
            if (h2Match && h2Match[1]) {
              articleTitle = h2Match[1].trim()
                .replace(/^[一二三四五六七八九十]+[、.]\s*/, '')
                .substring(0, 50);
            }
          }
        }

        // 过滤通用标题
        const genericTitles = ['生成创作大纲', '生成大纲', '根据确认大纲生成全文', '文章初稿', '创作完成', '生成全文'];
        if (articleTitle && genericTitles.some(g => articleTitle === g || articleTitle.includes(g))) {
          articleTitle = null;
        }

        if (!articleTitle) continue;

        // 3. 更新当前任务的 taskTitle
        await db
          .update(agentSubTasks)
          .set({ taskTitle: articleTitle })
          .where(eq(agentSubTasks.id, task.id));

        // 4. 仅更新当前任务，不同步到同组其他子任务
        // 避免覆盖"生成创作大纲"、"合规校验"等原始标题

        updatedCount++;
        console.log(`[BackfillTaskTitles] ✅ 更新标题: "${task.taskTitle?.substring(0, 30)}" → "${articleTitle}"`);

      } catch (err) {
        const errMsg = `任务 ${task.id} 回填失败: ${err instanceof Error ? err.message : String(err)}`;
        errors.push(errMsg);
        console.error(`[BackfillTaskTitles] ❌ ${errMsg}`);
      }
    }

    // 5. 对于没有 articleTitle 的任务，尝试从 userOpinion 回填
    const tasksWithoutTitle = await db
      .select()
      .from(agentSubTasks)
      .where(
        and(
          eq(agentSubTasks.status, 'completed'),
          sql`(${agentSubTasks.taskTitle} = '生成创作大纲' OR ${agentSubTasks.taskTitle} = '根据确认大纲生成全文' OR ${agentSubTasks.taskTitle} = '生成大纲')`,
        )
      )
      .limit(100);

    let userOpinionUpdatedCount = 0;

    for (const task of tasksWithoutTitle) {
      try {
        const userOpinion = (task as any).userOpinion;
        if (!userOpinion || typeof userOpinion !== 'string' || userOpinion.trim().length === 0) continue;

        const title = userOpinion.trim().substring(0, 30) + (userOpinion.trim().length > 30 ? '...' : '');

        await db
          .update(agentSubTasks)
          .set({ taskTitle: title })
          .where(eq(agentSubTasks.id, task.id));

        // 仅更新当前任务，不同步到同组（避免污染其他子任务标题）

        userOpinionUpdatedCount++;
      } catch (err) {
        console.error(`[BackfillTaskTitles] ❌ userOpinion 回填失败:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      completedTasksScanned: completedTasks.length,
      articleTitleUpdated: updatedCount,
      userOpinionUpdated: userOpinionUpdatedCount,
      tasksWithoutTitle: tasksWithoutTitle.length,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error('[BackfillTaskTitles] ❌ 整体失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    }, { status: 500 });
  }
}

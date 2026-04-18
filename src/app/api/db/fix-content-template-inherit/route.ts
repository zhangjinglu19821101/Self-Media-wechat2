/**
 * 修复小红书任务的 contentTemplateId 继承问题
 * 
 * 问题：大纲确认拆分后的子任务没有继承 metadata（包含 contentTemplateId）
 * 修复：从同组主任务继承 metadata 到所有子任务
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq, and, isNotNull, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    // 1. 找到有 contentTemplateId 的主任务
    const mainTasks = await db
      .select({
        id: agentSubTasks.id,
        commandResultId: agentSubTasks.commandResultId,
        metadata: agentSubTasks.metadata,
      })
      .from(agentSubTasks)
      .where(
        and(
          isNotNull(agentSubTasks.metadata),
          sql`metadata->>'contentTemplateId' IS NOT NULL`
        )
      );

    console.log(`[FixTemplateInherit] 找到 ${mainTasks.length} 个有模板的主任务`);

    const results: Array<{
      commandResultId: string;
      mainTaskId: string;
      templateId: string;
      fixedCount: number;
    }> = [];

    for (const mainTask of mainTasks) {
      if (!mainTask.commandResultId) continue;

      const templateId = (mainTask.metadata as any)?.contentTemplateId;
      if (!templateId) continue;

      // 2. 查找同组没有 contentTemplateId 的任务
      const siblingTasks = await db
        .select({
          id: agentSubTasks.id,
          taskTitle: agentSubTasks.taskTitle,
          metadata: agentSubTasks.metadata,
        })
        .from(agentSubTasks)
        .where(
          and(
            eq(agentSubTasks.commandResultId, mainTask.commandResultId),
            sql`COALESCE(metadata->>'contentTemplateId', '') = ''`
          )
        );

      if (siblingTasks.length === 0) {
        continue;
      }

      // 3. 批量更新，继承主任务的 metadata
      const inheritedMetadata = {
        ...(typeof mainTask.metadata === 'object' ? mainTask.metadata : {}),
      };

      for (const sibling of siblingTasks) {
        const mergedMetadata = {
          ...(typeof sibling.metadata === 'object' ? sibling.metadata : {}),
          ...inheritedMetadata,
        };

        await db
          .update(agentSubTasks)
          .set({
            metadata: mergedMetadata,
            updatedAt: new Date(),
          })
          .where(eq(agentSubTasks.id, sibling.id));
      }

      results.push({
        commandResultId: mainTask.commandResultId,
        mainTaskId: mainTask.id,
        templateId,
        fixedCount: siblingTasks.length,
      });

      console.log(
        `[FixTemplateInherit] 已修复 ${siblingTasks.length} 个任务，继承模板 ${templateId}`
      );
    }

    const totalFixed = results.reduce((sum, r) => sum + r.fixedCount, 0);

    return NextResponse.json({
      success: true,
      totalMainTasks: mainTasks.length,
      totalFixed,
      details: results,
    });
  } catch (error) {
    console.error('[FixTemplateInherit] 执行失败:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

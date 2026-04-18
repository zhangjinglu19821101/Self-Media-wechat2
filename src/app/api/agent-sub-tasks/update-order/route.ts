import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq, and, lt, gt, gte, lte } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/context';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { taskId, newOrderIndex } = body;

    if (!taskId || !newOrderIndex || newOrderIndex < 1) {
      return NextResponse.json({
        success: false,
        error: '缺少必要参数：taskId, newOrderIndex（必须大于等于1）',
      }, { status: 400 });
    }

    // 开始事务
    const result = await db.transaction(async (tx) => {
      // 1. 获取要修改的任务
      const [targetTask] = await tx
        .select({
          id: agentSubTasks.id,
          commandResultId: agentSubTasks.commandResultId,
          orderIndex: agentSubTasks.orderIndex,
        })
        .from(agentSubTasks)
        .where(eq(agentSubTasks.id, taskId));

      if (!targetTask) {
        return NextResponse.json({
          success: false,
          error: '任务不存在',
        }, { status: 404 });
      }

      const oldOrderIndex = targetTask.orderIndex;
      const commandResultId = targetTask.commandResultId;

      // 2. 获取该 commandResultId 下的所有任务，计算最大序号
      const allTasks = await tx
        .select({
          id: agentSubTasks.id,
          orderIndex: agentSubTasks.orderIndex,
        })
        .from(agentSubTasks)
        .where(eq(agentSubTasks.commandResultId, commandResultId))
        .orderBy(agentSubTasks.orderIndex);

      const maxOrderIndex = Math.max(...allTasks.map(t => t.orderIndex));

      if (newOrderIndex > maxOrderIndex) {
        return NextResponse.json({
          success: false,
          error: `新序号不能超过最大序号 ${maxOrderIndex}`,
        }, { status: 400 });
      }

      if (oldOrderIndex === newOrderIndex) {
        return NextResponse.json({
          success: true,
          message: '序号未变化',
          data: { updatedCount: 0 },
        });
      }

      // 3. 调整其他任务的序号
      let updatedCount = 0;

      if (newOrderIndex < oldOrderIndex) {
        // 向前移动：将 [newOrderIndex, oldOrderIndex-1] 范围内的任务序号 +1
        await tx
          .update(agentSubTasks)
          .set({
            orderIndex: agentSubTasks.orderIndex + 1,
            updatedAt: new Date(),
          })
          .where(and(
            eq(agentSubTasks.commandResultId, commandResultId),
            gte(agentSubTasks.orderIndex, newOrderIndex),
            lt(agentSubTasks.orderIndex, oldOrderIndex)
          ));
        
        updatedCount = oldOrderIndex - newOrderIndex;
      } else {
        // 向后移动：将 [oldOrderIndex+1, newOrderIndex] 范围内的任务序号 -1
        await tx
          .update(agentSubTasks)
          .set({
            orderIndex: agentSubTasks.orderIndex - 1,
            updatedAt: new Date(),
          })
          .where(and(
            eq(agentSubTasks.commandResultId, commandResultId),
            gt(agentSubTasks.orderIndex, oldOrderIndex),
            lte(agentSubTasks.orderIndex, newOrderIndex)
          ));
        
        updatedCount = newOrderIndex - oldOrderIndex;
      }

      // 4. 更新目标任务的序号
      await tx
        .update(agentSubTasks)
        .set({
          orderIndex: newOrderIndex,
          updatedAt: new Date(),
        })
        .where(eq(agentSubTasks.id, taskId));

      return NextResponse.json({
        success: true,
        message: `序号修改成功！已调整 ${updatedCount} 个任务的顺序`,
        data: {
          taskId,
          oldOrderIndex,
          newOrderIndex,
          updatedCount,
        },
      });
    });

    return result;
  } catch (error) {
    console.error('[Update Order API] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '修改序号失败',
    }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * 查询子任务列表（包含关键子任务标记）
 *
 * 用于验证数据库中是否正确保存了 isCritical 和 criticalReason 字段
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const commandResultId = searchParams.get('commandResultId');

    console.log(`🔍 查询子任务列表`);
    console.log(`📍 CommandResult ID: ${commandResultId || '全部'}`);

    let subTasks;

    if (commandResultId) {
      // 查询指定 commandResult 的子任务
      subTasks = await db.select()
        .from(agentSubTasks)
        .where(eq(agentSubTasks.commandResultId, commandResultId))
        .orderBy(agentSubTasks.orderIndex);
    } else {
      // 查询最近的子任务
      subTasks = await db.select()
        .from(agentSubTasks)
        .orderBy(agentSubTasks.createdAt)
        .limit(10);
    }

    console.log(`✅ 查询到 ${subTasks.length} 个子任务`);

    // 格式化输出，提取关键信息
    const formattedSubTasks = subTasks.map(st => ({
      id: st.id,
      commandResultId: st.commandResultId,
      agentId: st.agentId,
      taskTitle: st.taskTitle,
      status: st.status,
      orderIndex: st.orderIndex,
      metadata: st.metadata,
      isCritical: st.metadata?.isCritical,
      criticalReason: st.metadata?.criticalReason,
      acceptanceCriteria: st.metadata?.acceptanceCriteria,
      createdAt: st.createdAt,
      updatedAt: st.updatedAt,
    }));

    // 统计关键子任务
    const criticalTasks = formattedSubTasks.filter(t => t.isCritical);
    const nonCriticalTasks = formattedSubTasks.filter(t => !t.isCritical);

    console.log(`🔥 关键子任务: ${criticalTasks.length} 个`);
    console.log(`⚪ 非关键子任务: ${nonCriticalTasks.length} 个`);

    return NextResponse.json({
      success: true,
      message: '子任务列表查询成功',
      data: {
        total: formattedSubTasks.length,
        criticalCount: criticalTasks.length,
        nonCriticalCount: nonCriticalTasks.length,
        subTasks: formattedSubTasks,
      },
    });
  } catch (error) {
    console.error('❌ 查询失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

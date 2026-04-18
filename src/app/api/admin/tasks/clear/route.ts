/**
 * POST /api/admin/tasks/clear
 * 清空所有指令数据
 *
 * 此 API 会清空 agent_tasks 表中的所有任务记录
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, schema } from '@/lib/db';
import { agentTasks } from '@/lib/db/schema';

export async function POST(request: NextRequest) {
  console.log('🗑️ === 开始清空所有指令数据 ===');

  try {
    const db = getDatabase();

    // 先查询当前有多少条记录
    const currentTasks = await db.select().from(agentTasks);
    const currentCount = currentTasks.length;

    console.log(`📊 当前有 ${currentCount} 条任务记录`);

    if (currentCount === 0) {
      return NextResponse.json({
        success: true,
        message: '当前没有需要清空的指令数据',
        data: {
          cleared: 0,
        },
      });
    }

    // 清空所有任务记录
    await db.delete(agentTasks);

    console.log(`✅ 已清空 ${currentCount} 条任务记录`);

    return NextResponse.json({
      success: true,
      message: `成功清空 ${currentCount} 条指令数据`,
      data: {
        cleared: currentCount,
      },
    });
  } catch (error) {
    console.error('Error clearing tasks:', error);
    return NextResponse.json(
      {
        success: false,
        error: '清空指令数据失败',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

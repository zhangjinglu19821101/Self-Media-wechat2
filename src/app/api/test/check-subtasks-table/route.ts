/**
 * 检查 agent_sub_tasks 表
 * GET /api/test/check-subtasks-table
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [检查] 查询 agent_sub_tasks 表...');

    const subTasks = await db.select().from(agentSubTasks);

    console.log(`✅ [检查] 找到 ${subTasks.length} 条子任务`);

    return NextResponse.json({
      success: true,
      count: subTasks.length,
      subTasks: subTasks.map(st => ({
        id: st.id,
        taskTitle: st.taskTitle,
        agentId: st.agentId,
        status: st.status,
        commandResultId: st.commandResultId,
      })),
    });
  } catch (error) {
    console.error('❌ [检查] 失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

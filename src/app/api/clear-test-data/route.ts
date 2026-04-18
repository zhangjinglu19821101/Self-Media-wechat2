import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasksStepHistory, agentSubTasksMcpExecutions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: Request) {
  try {
    console.log('🗑️  [清理测试数据] 开始清理...');

    // 清空 step_history 表（只清空测试数据，保留表结构）
    const deleteStepHistory = await db.delete(agentSubTasksStepHistory);
    console.log('🗑️  已清空 agent_sub_tasks_step_history 表');

    // 清空 mcp_executions 表
    const deleteMcpExecutions = await db.delete(agentSubTasksMcpExecutions);
    console.log('🗑️  已清空 agent_sub_tasks_mcp_executions 表');

    return NextResponse.json({
      success: true,
      message: '测试数据清理完成',
      deletedStepHistory: deleteStepHistory,
      deletedMcpExecutions: deleteMcpExecutions
    });
  } catch (error: any) {
    console.error('❌ [清理测试数据] 失败:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

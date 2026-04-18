import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasksStepHistory, agentSubTasksMcpExecutions } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    console.log('📊 [检查记录] 开始查询...');

    // ========== 简单查询 1: step_history 表的记录数和 Agent 分布 ==========
    const stepHistoryResult = await db.execute(sql`
      SELECT 
        COUNT(*) as total_count,
        interact_user,
        COUNT(*) as user_count
      FROM agent_sub_tasks_step_history
      GROUP BY interact_user
      ORDER BY user_count DESC
    `);

    // ========== 简单查询 2: mcp_executions 表的记录数 ==========
    const mcpResult = await db.execute(sql`
      SELECT COUNT(*) as total_count
      FROM agent_sub_tasks_mcp_executions
    `);

    // ========== 简单查询 3: 最新 10 条 step_history 记录 ==========
    const recentRecords = await db.execute(sql`
      SELECT id, command_result_id, step_no, interact_type, interact_user, interact_num, interact_time
      FROM agent_sub_tasks_step_history
      ORDER BY id DESC
      LIMIT 10
    `);

    console.log('📊 [检查记录] 查询完成');

    return NextResponse.json({
      success: true,
      stepHistoryStats: stepHistoryResult.rows,
      mcpStats: mcpResult.rows,
      recentRecords: recentRecords.rows
    });
  } catch (error: any) {
    console.error('❌ [检查记录] 失败:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

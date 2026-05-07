import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    console.log('🔍 [详细检查] 开始查询...');

    // ========== 查询 1: step_history 总记录数 ==========
    const countResult = await db.execute(sql`
      SELECT COUNT(*) as total_count
      FROM agent_sub_tasks_step_history
    `);

    // ========== 查询 2: 按 Agent 分组统计 ==========
    const agentStatsResult = await db.execute(sql`
      SELECT 
        interact_user,
        COUNT(*) as record_count
      FROM agent_sub_tasks_step_history
      GROUP BY interact_user
      ORDER BY record_count DESC
    `);

    // ========== 查询 3: 最新 20 条记录（简化字段） ==========
    const recentRecordsResult = await db.execute(sql`
      SELECT 
        id,
        command_result_id,
        step_no,
        interact_type,
        interact_user,
        interact_num,
        interact_time
      FROM agent_sub_tasks_step_history
      ORDER BY id DESC
      LIMIT 20
    `);

    console.log('🔍 [详细检查] 查询完成');
    console.log('   - 总记录数:', countResult.rows);
    console.log('   - Agent 分布:', agentStatsResult.rows);

    return NextResponse.json({
      success: true,
      totalCount: (countResult as { rows: { total_count: number }[] }).rows,
      agentStats: (agentStatsResult as { rows: { interact_user: string; record_count: number }[] }).rows,
      recentRecords: (recentRecordsResult as { rows: Record<string, unknown>[] }).rows
    });
  } catch (error: any) {
    console.error('❌ [详细检查] 失败:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

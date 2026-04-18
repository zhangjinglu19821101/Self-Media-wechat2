import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * 创建 agent_sub_tasks 表的复合索引
 * 优化 PrecedentInfoExtractor.extractPreviousTaskResults 查询性能
 * 
 * GET /api/db/create-subtasks-index
 */
export async function GET() {
  try {
    console.log('[CreateIndex] 开始创建 agent_sub_tasks 复合索引...');

    // 创建复合索引：(command_result_id, order_index)
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_agent_sub_tasks_cmd_order 
      ON agent_sub_tasks(command_result_id, order_index);
    `);

    console.log('[CreateIndex] 复合索引创建成功');

    // 验证索引
    const result = await db.execute(sql`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'agent_sub_tasks' 
      AND indexname = 'idx_agent_sub_tasks_cmd_order';
    `);

    const rows = result.rows || [];

    return NextResponse.json({
      success: true,
      message: '复合索引创建成功',
      index: rows.length > 0 ? rows[0] : null,
      indexCount: rows.length
    });

  } catch (error) {
    console.error('[CreateIndex] 创建索引失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

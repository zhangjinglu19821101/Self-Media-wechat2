/**
 * 执行 SQL 查询 API
 * POST /api/test/exec-sql
 * 
 * 用于手动执行 SQL 查询（只读操作
 * 注意：仅用于测试环境使用！
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { sql } = await request.json();

    if (!sql) {
      return NextResponse.json(
        { success: false, error: '缺少 sql 参数' },
        { status: 400 }
      );
    }

    console.log('🔍 执行 SQL:', sql);

    // 执行 SQL
    const result = await db.execute(sql);

    console.log('✅ SQL 执行结果:', result);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('❌ SQL 执行失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/test/exec-sql
 * 获取使用说明
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'SQL 执行 API',
    usage: {
      method: 'POST',
      endpoint: '/api/test/exec-sql',
      body: {
        sql: 'SELECT * FROM agent_sub_tasks LIMIT 10',
      },
      example: `
# 查询示例:
curl -X POST http://localhost:5000/api/test/exec-sql \\
  -H "Content-Type: application/json" \\
  -d '{"sql": "SELECT * FROM agent_sub_tasks LIMIT 10"}'
      `,
    },
  });
}

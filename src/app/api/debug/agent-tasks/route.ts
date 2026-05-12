import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/multi_platform_publish_db?sslmode=require&channel_binding=require';

export async function GET(request: NextRequest) {
  try {
    const sql = postgres(DATABASE_URL, {
      ssl: 'require',
      max: 10,
    });

    // 查询最近的 agent_tasks
    const tasks = await sql`
      SELECT id, task_id, task_name, task_status, from_agent_id, to_agent_id, created_at
      FROM agent_tasks
      ORDER BY created_at DESC
      LIMIT 10
    `;

    // 统计总数
    const count = await sql`SELECT COUNT(*) as total FROM agent_tasks`;

    await sql.end();

    return NextResponse.json({
      success: true,
      data: {
        tasks,
        total: count[0].total,
      },
    });
  } catch (error) {
    console.error('❌ 查询失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { db } from '@/lib/db';
import { agentReports, dailyTask } from '@/lib/db/schema';
import { eq, desc, and, isNull, isNotNull } from 'drizzle-orm';

/**
 * GET /api/reports - 获取报告列表
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    console.log('API: 获取报告列表', { filter, limit, offset });

    // 构建查询条件
    const conditions = [];

    if (filter === 'pending') {
      conditions.push(eq(agentReports.status, 'pending'));
    } else if (filter === 'reviewed') {
      conditions.push(eq(agentReports.status, 'reviewed'));
    } else if (filter === 'processing') {
      conditions.push(eq(agentReports.status, 'processing'));
    } else if (filter === 'processed') {
      conditions.push(eq(agentReports.status, 'processed'));
    } else if (filter === 'dismissed') {
      conditions.push(eq(agentReports.status, 'dismissed'));
    }

    // 构建查询 where 子句
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    console.log('API: whereClause', whereClause);

    // 查询报告 - 简化版本，先不关联 dailyTask
    const reports = await db
      .select()
      .from(agentReports)
      .where(whereClause)
      .orderBy(desc(agentReports.createdAt))
      .limit(limit)
      .offset(offset);

    console.log('API: 查询到的报告数量', reports.length);

    // 查询总数
    const totalCount = await db
      .select({ count: agentReports.id })
      .from(agentReports)
      .where(whereClause);

    return NextResponse.json({
      success: true,
      data: reports,
      total: totalCount.length,
    });
  } catch (error) {
    console.error('获取报告列表失败:', error);
    console.error('错误堆栈:', error instanceof Error ? error.stack : String(error));
    return NextResponse.json(
      {
        success: false,
        error: '获取报告列表失败',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

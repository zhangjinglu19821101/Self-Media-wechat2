/**
 * 异常补偿 API
 * 提供异常补偿记录的查询、分配、解决等功能
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { splitFailures } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

/**
 * GET /api/exceptions
 * 查询所有异常补偿记录
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status'); // 异常状态筛选
    const priority = searchParams.get('priority'); // 优先级筛选
    const limit = parseInt(searchParams.get('limit') || '20'); // 每页数量

    let query = db
      .select()
      .from(splitFailures)
      .orderBy(desc(splitFailures.createdAt));

    // 状态筛选
    if (status) {
      query = query.where(eq(splitFailures.exceptionStatus, status as any));
    }

    // 优先级筛选
    if (priority) {
      query = query.where(eq(splitFailures.exceptionPriority, priority as any));
    }

    const records = await query.limit(limit);

    return NextResponse.json({
      success: true,
      data: records,
      total: records.length,
    });
  } catch (error) {
    console.error('查询异常补偿记录失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '查询异常补偿记录失败',
      },
      { status: 500 }
    );
  }
}

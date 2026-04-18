/**
 * 单个异常补偿记录 API
 * 提供查询、分配、解决、删除等功能
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { splitFailures } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/exceptions/:failureId
 * 查询单个异常补偿记录
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ failureId: string }> }
) {
  try {
    const { failureId } = await params;

    const [record] = await db
      .select()
      .from(splitFailures)
      .where(eq(splitFailures.failureId, failureId));

    if (!record) {
      return NextResponse.json(
        {
          success: false,
          error: '异常记录不存在',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: record,
    });
  } catch (error) {
    console.error('查询异常记录失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '查询异常记录失败',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/exceptions/:failureId
 * 删除异常补偿记录
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ failureId: string }> }
) {
  try {
    const { failureId } = await params;

    await db
      .delete(splitFailures)
      .where(eq(splitFailures.failureId, failureId));

    return NextResponse.json({
      success: true,
      message: '异常记录已删除',
    });
  } catch (error) {
    console.error('删除异常记录失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '删除异常记录失败',
      },
      { status: 500 }
    );
  }
}

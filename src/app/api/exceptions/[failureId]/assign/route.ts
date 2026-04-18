/**
 * 异常分配 API
 * 将异常分配给处理人
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { splitFailures } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * PUT /api/exceptions/:failureId/assign
 * 分配异常给处理人
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ failureId: string }> }
) {
  try {
    const { failureId } = await params;
    const body = await request.json();
    const { assignedTo, notes } = body;

    // 验证参数
    if (!assignedTo) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少 assignedTo 参数',
        },
        { status: 400 }
      );
    }

    // 更新异常记录
    const [updatedRecord] = await db
      .update(splitFailures)
      .set({
        assignedTo,
        assignedAt: new Date(),
        exceptionStatus: 'processing',
        processingNotes: notes,
        updatedAt: new Date(),
      })
      .where(eq(splitFailures.failureId, failureId))
      .returning();

    if (!updatedRecord) {
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
      data: updatedRecord,
      message: '异常已分配',
    });
  } catch (error) {
    console.error('分配异常失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '分配异常失败',
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { db } from '@/lib/db';
import { agentReports } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/reports/[id] - 获取报告详情
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { id: reportId } = await params;

    const report = await db
      .select()
      .from(agentReports)
      .where(eq(agentReports.id, reportId))
      .limit(1);

    if (report.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '报告不存在',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: report[0],
    });
  } catch (error) {
    console.error('获取报告详情失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取报告详情失败',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/reports/[id] - 更新报告状态（审核）
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reportId } = await params;
    const body = await req.json();
    const { status, reviewedBy, dismissedReason } = body;

    if (!status || !reviewedBy) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必要参数',
        },
        { status: 400 }
      );
    }

    // 更新报告状态
    const updated = await db
      .update(agentReports)
      .set({
        status,
        reviewedAt: new Date(),
        reviewedBy,
        dismissedReason,
      })
      .where(eq(agentReports.id, reportId))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '报告不存在',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updated[0],
    });
  } catch (error) {
    console.error('更新报告失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '更新报告失败',
      },
      { status: 500 }
    );
  }
}

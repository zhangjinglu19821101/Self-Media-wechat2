/**
 * PUT /api/command-results/:resultId
 * 更新指令执行结果
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { commandResultService } from '@/lib/services/command-result-service';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ resultId: string }> }
) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const { resultId } = await params;
    const body = await request.json();

    // 验证执行结果是否存在
    const existingResult = await commandResultService.getResult(resultId);
    if (!existingResult) {
      return NextResponse.json(
        {
          success: false,
          error: '执行结果不存在',
        },
        { status: 404 }
      );
    }

    // 更新执行结果
    const updateParams = {
      resultId,
      executionStatus: body.executionStatus,
      executionResult: body.executionResult,
      outputData: body.outputData,
      metrics: body.metrics,
      attachments: body.attachments,
      completedAt: body.completedAt,
    };

    const result = await commandResultService.updateResult(updateParams);

    return NextResponse.json({
      success: true,
      data: result,
      message: '执行结果更新成功',
    });
  } catch (error) {
    console.error('更新执行结果失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '更新执行结果失败',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/command-results/:resultId
 * 获取单个指令执行结果
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ resultId: string }> }
) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const { resultId } = await params;

    const result = await commandResultService.getResult(resultId);

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: '执行结果不存在',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('获取执行结果失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取执行结果失败',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/command-results/:resultId
 * 删除指令执行结果
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ resultId: string }> }
) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const { resultId } = await params;

    const result = await commandResultService.deleteResult(resultId);

    return NextResponse.json({
      success: true,
      data: result,
      message: '执行结果删除成功',
    });
  } catch (error) {
    console.error('删除执行结果失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '删除执行结果失败',
      },
      { status: 500 }
    );
  }
}

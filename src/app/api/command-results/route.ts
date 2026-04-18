/**
 * POST /api/command-results
 * 创建指令执行结果
 */

import { NextRequest, NextResponse } from 'next/server';
import { commandResultService } from '@/lib/services/command-result-service';
import { CreateCommandResultParams } from '@/lib/types/command-result';
import { requireAuth } from '@/lib/auth/context';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();

    // 验证必填字段
    if (!body.taskId || !body.fromAgentId || !body.toAgentId || !body.originalCommand) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必填字段: taskId, fromAgentId, toAgentId, originalCommand',
        },
        { status: 400 }
      );
    }

    // 创建执行结果
    const params: CreateCommandResultParams = {
      taskId: body.taskId,
      commandId: body.commandId,
      fromAgentId: body.fromAgentId,
      toAgentId: body.toAgentId,
      originalCommand: body.originalCommand,
      executionStatus: body.executionStatus || 'in_progress',
      executionResult: body.executionResult,
      outputData: body.outputData,
      metrics: body.metrics,
      attachments: body.attachments,
    };

    const result = await commandResultService.createResult(params);

    return NextResponse.json({
      success: true,
      data: result,
      message: '执行结果创建成功',
    });
  } catch (error) {
    console.error('创建执行结果失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '创建执行结果失败',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/command-results
 * 查询指令执行结果列表
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const searchParams = request.nextUrl.searchParams;

    // 解析查询参数
    const params = {
      toAgentId: searchParams.get('toAgentId') || undefined,
      fromAgentId: searchParams.get('fromAgentId') || undefined,
      taskId: searchParams.get('taskId') || undefined,
      executionStatus: searchParams.get('executionStatus') as any || undefined,
      startDate: searchParams.get('startDate')
        ? new Date(searchParams.get('startDate')!)
        : undefined,
      endDate: searchParams.get('endDate')
        ? new Date(searchParams.get('endDate')!)
        : undefined,
      limit: searchParams.get('limit')
        ? parseInt(searchParams.get('limit')!)
        : 50,
      offset: searchParams.get('offset')
        ? parseInt(searchParams.get('offset')!)
        : 0,
    };

    const results = await commandResultService.getResults(params);

    return NextResponse.json({
      success: true,
      data: results,
      total: results.length,
    });
  } catch (error) {
    console.error('查询执行结果失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '查询执行结果失败',
      },
      { status: 500 }
    );
  }
}

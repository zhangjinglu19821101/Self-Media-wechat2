/**
 * 问题处理 API
 * PUT /api/agents/problem-report/[id]/solve
 * 
 * 用于架构师（Agent B）处理问题并更新状态
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { getDatabase, schema } from '@/lib/db';
import { problemReports } from '@/lib/db/problem-schema';
import { ProblemSolutionType, ProblemStatus } from '@/lib/problem-report/types';
import { eq } from 'drizzle-orm';
import { wsServer } from '@/lib/websocket-server';

/**
 * PUT /api/agents/problem-report/[id]/solve
 * 解决问题
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const { id } = await params;
    const body = await request.json();
    const {
      solutionType,         // 解决方式：automatic（自动）或 manual（人工）
      solution,             // 解决方案描述
      solutionLogs,         // 解决过程日志
      humanInterventionNeeded, // 是否需要人类介入
      assignedTo,           // 分配给谁
    } = body;

    // 验证必需参数
    if (!solutionType || !solution) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必需参数：solutionType, solution',
        },
        { status: 400 }
      );
    }

    // 验证解决方式
    const validSolutionTypes: ProblemSolutionType[] = ['automatic', 'manual'];
    if (!validSolutionTypes.includes(solutionType)) {
      return NextResponse.json(
        {
          success: false,
          error: `无效的解决方式，有效值：${validSolutionTypes.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const db = getDatabase();

    // 更新问题状态
    const newStatus: ProblemStatus = 
      solutionType === 'manual' 
        ? 'human_review' 
        : 'solved';

    const [updatedProblem] = await db
      .update(problemReports)
      .set({
        status: newStatus,
        solutionType,
        solution,
        solutionLogs: solutionLogs || [],
        humanInterventionNeeded: humanInterventionNeeded || false,
        assignedTo: assignedTo || 'B',
        updatedAt: new Date(),
        resolvedAt: newStatus === 'solved' ? new Date() : undefined,
      })
      .where(eq(problemReports.id, id))
      .returning();

    if (!updatedProblem) {
      return NextResponse.json(
        {
          success: false,
          error: '问题不存在',
        },
        { status: 404 }
      );
    }

    // 🔥 如果问题已解决，通过 WebSocket 通知上报的 Agent
    if (newStatus === 'solved') {
      const wsSuccess = wsServer.sendToAgent(updatedProblem.fromAgentId as any, {
        type: 'problem_solved',
        problemId: updatedProblem.id,
        solution,
        timestamp: new Date().toISOString(),
      });

      console.log(`📤 WebSocket push to Agent ${updatedProblem.fromAgentId}: ${wsSuccess ? 'Success' : 'Failed'}`);
    }

    return NextResponse.json({
      success: true,
      data: {
        problem: updatedProblem,
        message: newStatus === 'solved' ? '问题已解决' : '问题已更新，等待人工审核',
      },
    });
  } catch (error) {
    console.error('Error solving problem:', error);
    return NextResponse.json(
      {
        success: false,
        error: '问题处理失败',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/agents/problem-report/[id]
 * 获取单个问题详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const { id } = await params;

    const db = getDatabase();
    const [problem] = await db
      .select()
      .from(problemReports)
      .where(eq(problemReports.id, id));

    if (!problem) {
      return NextResponse.json(
        {
          success: false,
          error: '问题不存在',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: problem,
    });
  } catch (error) {
    console.error('Error fetching problem:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取问题详情失败',
      },
      { status: 500 }
    );
  }
}

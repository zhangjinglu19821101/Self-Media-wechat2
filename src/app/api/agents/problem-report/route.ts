/**
 * 问题上报 API
 * POST /api/agents/problem-report
 * 
 * 用于 Agent C、D 等在执行任务遇到困难时上报问题
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { getDatabase, schema } from '@/lib/db';
import { problemReports } from '@/lib/db/problem-schema';
import { ProblemReport, ProblemType, ProblemPriority } from '@/lib/problem-report/types';
import { wsServer } from '@/lib/websocket-server';
import { like, desc } from 'drizzle-orm';

/**
 * POST /api/agents/problem-report
 * Agent 上报问题
 */
export async function POST(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const body = await request.json();
    const {
      fromAgentId,
      fromAgentName,
      problemType,
      priority,
      title,
      description,
      context,
      suggestedSolution,
    } = body;

    // 验证必需参数
    if (!fromAgentId || !fromAgentName || !problemType || !priority || !title || !description) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必需参数：fromAgentId, fromAgentName, problemType, priority, title, description',
        },
        { status: 400 }
      );
    }

    // 验证 Agent ID
    const validAgents = ['C', 'D', 'insurance-c', 'insurance-d'];
    if (!validAgents.includes(fromAgentId)) {
      return NextResponse.json(
        {
          success: false,
          error: '无效的 Agent ID，只有 C、D、insurance-c、insurance-d 可以上报问题',
        },
        { status: 400 }
      );
    }

    // 验证问题类型
    const validProblemTypes: ProblemType[] = ['technical', 'data', 'resource', 'permission', 'external', 'unknown'];
    if (!validProblemTypes.includes(problemType)) {
      return NextResponse.json(
        {
          success: false,
          error: `无效的问题类型，有效值：${validProblemTypes.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // 验证优先级
    const validPriorities: ProblemPriority[] = ['critical', 'high', 'normal', 'low'];
    if (!validPriorities.includes(priority)) {
      return NextResponse.json(
        {
          success: false,
          error: `无效的优先级，有效值：${validPriorities.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const db = getDatabase();

    // 插入问题记录
    const [problem] = await db
      .insert(problemReports)
      .values({
        fromAgentId,
        fromAgentName,
        problemType,
        priority,
        title,
        description,
        context: context || {},
        suggestedSolution: suggestedSolution || null,
        status: 'pending',
        humanInterventionNeeded: priority === 'critical', // 紧急问题默认需要人类介入
      })
      .returning();

    // 🔥 通过 WebSocket 推送给架构师（Agent B）
    const wsSuccess = wsServer.sendToAgent('B', {
      type: 'new_problem',
      problemId: problem.id,
      fromAgentId,
      fromAgentName,
      problemType,
      priority,
      title,
      description,
      timestamp: new Date().toISOString(),
    });

    console.log(`📤 WebSocket push to Agent B: ${wsSuccess ? 'Success' : 'Failed (agent B not connected)'}`);

    return NextResponse.json({
      success: true,
      data: {
        problemId: problem.id,
        message: '问题上报成功',
        wsNotified: wsSuccess,
      },
    });
  } catch (error) {
    console.error('Error reporting problem:', error);
    return NextResponse.json(
      {
        success: false,
        error: '问题上报失败',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/agents/problem-report
 * 获取问题列表（架构师查询）
 */
export async function GET(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || 'pending';
    const priority = searchParams.get('priority');
    const fromAgentId = searchParams.get('fromAgentId');
    const limit = parseInt(searchParams.get('limit') || '50');

    const db = getDatabase();
    let query = db
      .select()
      .from(problemReports)
      .where(like(problemReports.status, status))
      .orderBy(desc(problemReports.createdAt))
      .limit(limit);

    // 可选筛选条件
    if (priority) {
      // TODO: 添加优先级筛选
    }
    if (fromAgentId) {
      // TODO: 添加 Agent ID 筛选
    }

    const problems = await query;

    return NextResponse.json({
      success: true,
      data: {
        problems,
        count: problems.length,
      },
    });
  } catch (error) {
    console.error('Error fetching problems:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取问题列表失败',
      },
      { status: 500 }
    );
  }
}

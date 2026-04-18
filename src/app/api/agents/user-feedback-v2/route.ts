/**
 * 用户反馈 API v2
 *
 * POST /api/agents/user-feedback-v2
 *
 * 更清晰的命名和结构，支持完整的历史记录恢复
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { UserFeedbackService, UserFeedbackRequestV2 } from '@/lib/user-feedback';

/**
 * POST /api/agents/user-feedback-v2
 * 提交用户反馈（优化版）
 */
export async function POST(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    // 1. 解析请求体
    const body = await request.json();
    const { dailyTaskId, userFeedback, agentId, metadata } = body;

    // 2. 参数验证
    if (!dailyTaskId) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必要参数: dailyTaskId',
        },
        { status: 400 }
      );
    }

    if (!userFeedback || userFeedback.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '用户反馈内容不能为空',
        },
        { status: 400 }
      );
    }

    if (!agentId) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必要参数: agentId',
        },
        { status: 400 }
      );
    }

    console.log('[UserFeedbackV2 API] 收到请求:', {
      dailyTaskId,
      userFeedbackLength: userFeedback.length,
      agentId,
    });

    // 3. 调用服务处理
    const requestData: UserFeedbackRequestV2 = {
      dailyTaskId,
      userFeedback,
      agentId,
      metadata,
    };

    const result = await UserFeedbackService.handleUserFeedback(requestData);

    // 4. 返回响应
    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 500 });
    }
  } catch (error) {
    console.error('[UserFeedbackV2 API] 处理失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '处理用户反馈失败',
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/agents/user-feedback-v2
 * CORS 预检请求
 */
export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

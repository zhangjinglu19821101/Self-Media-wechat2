import { NextRequest, NextResponse } from 'next/server';
import { FeedbackManager } from '@/lib/services/feedback-manager';

/**
 * GET /api/feedback?toAgentId=A&status=pending
 * 获取反馈列表
 */
export async function GET(request: NextRequest) {
  console.log('📥 === /api/feedback 收到查询请求 ===');

  try {
    const searchParams = request.nextUrl.searchParams;
    const toAgentId = searchParams.get('toAgentId');
    const fromAgentId = searchParams.get('fromAgentId');
    const status = searchParams.get('status');
    const taskId = searchParams.get('taskId');

    console.log('📦 查询参数:', { toAgentId, fromAgentId, status, taskId });

    let feedbacks = [];

    // 根据参数查询
    if (toAgentId) {
      if (status === 'pending') {
        feedbacks = await FeedbackManager.getPendingFeedbacks(toAgentId);
      } else {
        feedbacks = await FeedbackManager.getFeedbacksByToAgent(toAgentId);
      }
    } else if (fromAgentId) {
      feedbacks = await FeedbackManager.getFeedbacksByFromAgent(fromAgentId);
    } else if (taskId) {
      feedbacks = await FeedbackManager.getFeedbacksByTask(taskId);
    }

    // 如果指定了状态过滤
    if (status && status !== 'pending') {
      feedbacks = feedbacks.filter(f => f.status === status);
    }

    // 获取统计信息
    let stats = null;
    if (toAgentId) {
      stats = await FeedbackManager.getFeedbackStats(toAgentId);
    }

    console.log(`✅ 查询成功，找到 ${feedbacks.length} 条反馈`);

    return NextResponse.json({
      success: true,
      data: {
        feedbacks,
        stats,
      },
    });
  } catch (error) {
    console.error('❌ 查询反馈失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '查询反馈失败',
      },
      { status: 500 }
    );
  }
}

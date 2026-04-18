import { NextRequest, NextResponse } from 'next/server';
import { FeedbackManager } from '@/lib/services/feedback-manager';
import { TaskManager } from '@/lib/services/task-manager';
import { wsServer } from '@/lib/websocket-server';

/**
 * PUT /api/feedback/:feedbackId
 * 更新反馈状态
 * 可以解决反馈（纠正指令）或驳回反馈
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { feedbackId: string } }
) {
  console.log('📥 === /api/feedback/:feedbackId 收到更新请求 ===');

  try {
    const { feedbackId } = params;
    const body = await request.json();
    const { status, resolution, resolvedCommand } = body;

    console.log('📦 请求参数:', {
      feedbackId,
      status,
      hasResolution: !!resolution,
      hasResolvedCommand: !!resolvedCommand,
    });

    // 验证必需参数
    if (!status || !['pending', 'processing', 'resolved', 'rejected'].includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: '无效的status参数',
        },
        { status: 400 }
      );
    }

    // 获取原始反馈
    const feedback = await FeedbackManager.getFeedback(feedbackId);
    if (!feedback) {
      return NextResponse.json(
        {
          success: false,
          error: `反馈 ${feedbackId} 不存在`,
        },
        { status: 404 }
      );
    }

    // 更新反馈状态
    const updatedFeedback = await FeedbackManager.updateFeedbackStatus(
      feedbackId,
      status,
      resolution,
      resolvedCommand
    );

    // 如果状态是resolved且有纠正后的指令，需要重新下发指令
    if (status === 'resolved' && resolvedCommand) {
      console.log(`📤 重新下发纠正后的指令到 ${feedback.fromAgentId}`);

      // 更新原始任务的状态和指令
      await TaskManager.updateTaskStatus(feedback.taskId, 'pending');

      // 通过WebSocket发送通知
      wsServer.broadcastToAgent(feedback.fromAgentId, {
        type: 'command_updated',
        taskId: feedback.taskId,
        feedbackId: feedbackId,
        originalCommand: feedback.originalCommand,
        resolvedCommand: resolvedCommand,
        message: '您的反馈已被处理，指令已更新',
      });

      // 如果有resolution，也发送给Agent A
      if (feedback.toAgentId === 'A') {
        wsServer.broadcastToAgent('A', {
          type: 'feedback_resolved',
          feedbackId: feedbackId,
          taskId: feedback.taskId,
          fromAgentId: feedback.fromAgentId,
          message: '反馈已处理，新指令已下发',
        });
      }
    }

    console.log(`✅ 反馈状态更新成功: feedbackId=${feedbackId}, status=${status}`);

    return NextResponse.json({
      success: true,
      data: updatedFeedback,
    });
  } catch (error) {
    console.error('❌ 更新反馈失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '更新反馈失败',
      },
      { status: 500 }
    );
  }
}

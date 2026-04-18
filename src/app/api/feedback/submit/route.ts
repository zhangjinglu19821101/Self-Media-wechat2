import { NextRequest, NextResponse } from 'next/server';
import { FeedbackManager } from '@/lib/services/feedback-manager';
import { TaskManager } from '@/lib/services/task-manager';

/**
 * POST /api/feedback/submit
 * 提交反馈接口
 * Agent 可以对收到的指令提出异议、疑问或建议
 */
export async function POST(request: NextRequest) {
  console.log('📥 === /api/feedback/submit 收到反馈提交请求 ===');

  try {
    const body = await request.json();
    const {
      taskId,          // 关联的任务ID
      fromAgentId,     // 反馈的Agent ID
      toAgentId,       // 目标Agent ID（通常是A）
      feedbackContent, // 反馈内容
      feedbackType = 'question', // 反馈类型：question/objection/suggestion
      metadata = {},
    } = body;

    console.log('📦 请求参数:', {
      taskId,
      fromAgentId,
      toAgentId,
      feedbackType,
      feedbackContentLength: feedbackContent?.length || 0,
    });

    // 验证必需参数
    if (!taskId || !fromAgentId || !toAgentId || !feedbackContent) {
      console.log('❌ 参数验证失败: 缺少必需参数');
      return NextResponse.json(
        {
          success: false,
          error: '缺少必需参数：taskId, fromAgentId, toAgentId, feedbackContent',
        },
        { status: 400 }
      );
    }

    // 获取关联的任务信息
    const task = await TaskManager.getTask(taskId);
    if (!task) {
      return NextResponse.json(
        {
          success: false,
          error: `任务 ${taskId} 不存在`,
        },
        { status: 404 }
      );
    }

    // 创建反馈
    const feedback = await FeedbackManager.createFeedback({
      taskId,
      fromAgentId,
      toAgentId,
      originalCommand: task.command,
      feedbackContent,
      feedbackType,
      metadata,
    });

    console.log(`✅ 反馈提交成功: feedbackId=${feedback.feedbackId}`);

    return NextResponse.json({
      success: true,
      data: feedback,
    });
  } catch (error) {
    console.error('❌ 提交反馈失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '提交反馈失败',
      },
      { status: 500 }
    );
  }
}

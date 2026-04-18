/**
 * Agent 回执 API
 * POST /api/agents/receipt - 发送任务接收回执
 * POST /api/agents/status-feedback - 发送任务状态反馈
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generateTaskReceipt,
  generateTaskStatusFeedback,
  TaskReceiptParams,
  TaskStatusFeedbackParams,
} from '@/lib/services/agent-receipt';

/**
 * POST /api/agents/receipt
 * 生成任务接收回执
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, params } = body;

    if (type === 'receipt') {
      // 生成任务接收回执
      const receiptParams: TaskReceiptParams = {
        taskId: params.taskId,
        status: params.status,
        preparation: params.preparation,
        failureReason: params.failureReason,
      };

      const receipt = generateTaskReceipt(receiptParams);

      return NextResponse.json({
        success: true,
        data: {
          type: 'receipt',
          content: receipt,
          timestamp: new Date().toISOString(),
        },
      });
    } else if (type === 'status-feedback') {
      // 生成任务状态反馈
      const statusParams: TaskStatusFeedbackParams = {
        taskId: params.taskId,
        taskName: params.taskName,
        receivedTime: params.receivedTime,
        executionStatus: params.executionStatus,
        executionStatusReason: params.executionStatusReason,
        progress: params.progress,
        completedNodes: params.completedNodes || [],
        pendingItems: params.pendingItems || [],
        issues: params.issues,
      };

      const feedback = generateTaskStatusFeedback(statusParams);

      return NextResponse.json({
        success: true,
        data: {
          type: 'status-feedback',
          content: feedback,
          timestamp: new Date().toISOString(),
        },
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: '不支持的操作类型，仅支持：receipt、status-feedback',
        },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('生成回执/状态反馈失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '生成失败',
      },
      { status: 500 }
    );
  }
}

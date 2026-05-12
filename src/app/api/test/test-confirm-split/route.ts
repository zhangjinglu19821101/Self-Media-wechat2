/**
 * 直接测试 confirm-split 接口
 * POST /api/test/test-confirm-split
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, notificationId } = body;

    console.log('🔍 [测试] 直接测试 confirm-split 接口...');

    // 调用真实的 confirm-split 接口
    const response = await fetch('http://localhost:5000/api/agent-sub-tasks/confirm-split', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notificationId: notificationId,
        splitResult: {}, // 这个会被忽略，因为我们从通知中解析
        taskId: taskId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ confirm-split 接口返回错误:', errorText);
      return NextResponse.json({
        success: false,
        error: 'confirm-split 接口调用失败',
        responseError: errorText,
        status: response.status,
      });
    }

    const result = await response.json();
    console.log('✅ confirm-split 接口调用成功:', result);

    return NextResponse.json({
      success: true,
      message: 'confirm-split 接口测试成功！',
      confirmSplitResult: result,
    });
  } catch (error) {
    console.error('❌ [测试] 失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

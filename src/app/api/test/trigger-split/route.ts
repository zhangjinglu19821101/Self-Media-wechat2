import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/test/trigger-split
 * 手动触发 Agent B 拆解任务
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId } = body;

    if (!taskId) {
      return NextResponse.json({
        success: false,
        error: '缺少 taskId 参数',
      }, { status: 400 });
    }

    console.log(`🔧 [trigger-split] 手动触发任务拆解: ${taskId}`);

    // 调用拆解接口
    const splitUrl = `http://localhost:5000/api/agents/tasks/${encodeURIComponent(taskId)}/split`;
    const response = await fetch(splitUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    console.log(`✅ [trigger-split] 拆解接口响应:`, result);

    return NextResponse.json({
      success: true,
      data: result,
      message: '已触发任务拆解',
    });
  } catch (error) {
    console.error('❌ [trigger-split] 触发失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

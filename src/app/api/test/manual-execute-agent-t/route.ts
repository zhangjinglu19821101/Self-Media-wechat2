import { NextRequest, NextResponse } from 'next/server';
import { subtaskEngine } from '@/lib/services/subtask-execution-engine';

// 手动执行特定任务的 API 接口
export async function POST(request: NextRequest) {
  try {
    const { commandResultId, orderIndex } = await request.json();

    if (!commandResultId) {
      return NextResponse.json({ error: '缺少 commandResultId 参数' }, { status: 400 });
    }

    console.log('[ManualExecute] 开始执行特定任务', { commandResultId, orderIndex });

    // 调用公共方法执行特定任务
    const result = await subtaskEngine.executeSpecificTask(commandResultId, orderIndex);

    console.log('[ManualExecute] 任务执行完成', result);

    return NextResponse.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('[ManualExecute] 执行失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '执行失败' },
      { status: 500 }
    );
  }
}

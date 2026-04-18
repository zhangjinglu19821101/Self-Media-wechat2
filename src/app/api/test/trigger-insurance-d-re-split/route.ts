/**
 * 测试 API：触发 insurance-d 重新拆解
 * 
 * POST /api/test/trigger-insurance-d-re-split
 * 
 * 用于测试保险拆解被拒绝后的重新拆解功能
 */

import { NextRequest, NextResponse } from 'next/server';
import { insuranceDBatchSplitTask } from '@/lib/services/task-assignment-service';

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [trigger-insurance-d-re-split] ===== 开始触发 insurance-d 重新拆解 =====');

    // 需要重新拆解的任务ID列表（UUID）
    const taskIdsToResplit = [
      '4a886929-93a0-444b-91d4-7e57e817bc35',
      'e301e076-1402-4370-a2b9-465021ed98eb',
      '8b3f5236-635e-45e4-86cb-3148d81fcff3',
    ];

    console.log('📋 [trigger-insurance-d-re-split] 准备重新拆解的任务:');
    taskIdsToResplit.forEach((id, index) => {
      console.log(`   ${index + 1}. ${id}`);
    });

    // 调用 insurance-d 批量拆解
    console.log('🤖 [trigger-insurance-d-re-split] 调用 insuranceDBatchSplitTask...');
    const result = await insuranceDBatchSplitTask(taskIdsToResplit);

    console.log('✅ [trigger-insurance-d-re-split] 重新拆解触发完成');
    console.log('📊 [trigger-insurance-d-re-split] 结果:', JSON.stringify(result, null, 2));

    return NextResponse.json({
      success: true,
      message: '已触发 insurance-d 重新拆解',
      data: {
        taskIds: taskIdsToResplit,
        result: result,
      },
    });
  } catch (error: any) {
    console.error('❌ [trigger-insurance-d-re-split] 触发重新拆解失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '触发重新拆解失败',
        details: error.message || String(error),
      },
      { status: 500 }
    );
  }
}

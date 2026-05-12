/**
 * 直接执行单个任务的测试 API
 * POST /api/test/execute-single-task
 */

import { NextRequest, NextResponse } from 'next/server';
import { SubtaskExecutionEngine } from '@/lib/services/subtask-execution-engine';

export async function POST(request: NextRequest) {
  console.log('🔔 直接执行子任务引擎...');
  
  try {
    const engine = new SubtaskExecutionEngine();
    await engine.execute();
    
    return NextResponse.json({
      success: true,
      message: '执行完成',
    });
  } catch (error) {
    console.error('❌ 执行失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '执行失败' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { manuallyExecuteInProgressSubtasks } from '@/lib/cron';

export async function POST(request: NextRequest) {
  try {
    console.log('[API] 手动触发任务执行...');
    
    await manuallyExecuteInProgressSubtasks();
    
    return NextResponse.json({
      success: true,
      message: '任务执行已触发'
    });
    
  } catch (error) {
    console.error('[API] 错误:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '未知错误' 
    }, { status: 500 });
  }
}
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasksStepHistory } from '@/lib/db/schema';

export async function GET(request: Request) {
  try {
    console.log('🎯 [简单检查] 开始查询...');

    // 直接查询所有记录
    const allRecords = await db.select().from(agentSubTasksStepHistory);

    console.log('🎯 [简单检查] 查询完成，记录数:', allRecords.length);
    
    // 只返回前 5 条记录避免数据太大
    return NextResponse.json({
      success: true,
      totalCount: allRecords.length,
      first5Records: allRecords.slice(0, 5)
    });
  } catch (error: any) {
    console.error('❌ [简单检查] 失败:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

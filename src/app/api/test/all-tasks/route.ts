import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';

export async function GET(request: NextRequest) {
  try {
    const allTasks = await db.select().from(agentSubTasks);

    return NextResponse.json({
      success: true,
      tasks: allTasks,
    });
  } catch (error) {
    console.error('获取所有子任务失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

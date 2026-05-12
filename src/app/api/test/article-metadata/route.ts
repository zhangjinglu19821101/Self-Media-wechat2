/**
 * 测试 article_metadata 机制
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  // 查询步骤1的子任务
  const subTaskId = '0f81b2a7-3a2d-4d1a-b09b-6d4f6a95c8fa';
  
  try {
    // 查询子任务
    const subTasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, subTaskId))
      .limit(1);
    
    if (subTasks.length === 0) {
      return NextResponse.json({
        success: false,
        error: '找不到子任务',
      });
    }
    
    const subTask = subTasks[0];
    
    return NextResponse.json({
      success: true,
      subTask: {
        id: subTask.id,
        taskTitle: subTask.taskTitle,
        orderIndex: subTask.orderIndex,
        status: subTask.status,
      },
      articleMetadata: {
        exists: !!subTask.articleMetadata,
        isEmpty: !subTask.articleMetadata || Object.keys(subTask.articleMetadata).length === 0,
        data: subTask.articleMetadata,
      },
    });
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

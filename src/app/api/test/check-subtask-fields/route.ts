/**
 * 检查子任务字段
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
  try {
    const subTasks = await db
      .select()
      .from(agentSubTasks)
      .orderBy(desc(agentSubTasks.createdAt))
      .limit(2);
    
    return NextResponse.json({
      success: true,
      subTasks: subTasks.map(st => ({
        id: st.id,
        taskTitle: st.taskTitle,
        allFields: Object.keys(st),
        // 查看所有字段值
        ...st,
      })),
    });
    
  } catch (error) {
    console.error('❌ 查询失败:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

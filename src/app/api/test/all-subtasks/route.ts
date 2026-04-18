/**
 * GET /api/test/all-subtasks
 * 查询所有子任务数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 查询所有子任务...');

    // 查询所有子任务，按 executor 分组
    const allSubTasks = await db.query.agentSubTasks.findMany({
      limit: 50,
    });

    console.log(`📋 总共找到 ${allSubTasks.length} 条子任务`);

    // 按 executor 分组统计
    const executorStats: Record<string, any[]> = {};
    allSubTasks.forEach(task => {
      const executor = task.fromParentsExecutor || 'unknown';
      if (!executorStats[executor]) {
        executorStats[executor] = [];
      }
      executorStats[executor].push({
        id: task.id,
        orderIndex: task.orderIndex,
        status: task.status,
        taskTitle: task.taskTitle,
      });
    });

    console.log('📊 按 executor 分组统计:', Object.keys(executorStats));
    
    // 特别查找 insurance-d 的任务
    const insuranceDTasks = allSubTasks.filter(
      t => t.fromParentsExecutor === 'insurance-d'
    );
    
    console.log(`🔍 insurance-d 任务数量: ${insuranceDTasks.length}`);
    if (insuranceDTasks.length > 0) {
      console.log('📋 insurance-d 任务详情:', insuranceDTasks.map(t => ({
        id: t.id,
        orderIndex: t.orderIndex,
        status: t.status,
        title: t.taskTitle,
      })));
    }

    return NextResponse.json({
      success: true,
      data: {
        total: allSubTasks.length,
        executorStats,
        insuranceDTasks,
        allSubTasks: allSubTasks.map(t => ({
          id: t.id,
          fromParentsExecutor: t.fromParentsExecutor,
          orderIndex: t.orderIndex,
          status: t.status,
          taskTitle: t.taskTitle,
        })),
      },
    });
  } catch (error) {
    console.error('❌ 查询失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '查询失败',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

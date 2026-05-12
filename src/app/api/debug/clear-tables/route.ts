/**
 * POST /api/debug/clear-tables
 * 清空测试数据：agent_tasks, daily_task, agent_sub_tasks, agent_notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentTasks, dailyTask, agentSubTasks, agentNotifications } from '@/lib/db/schema';

export async function POST(request: NextRequest) {
  console.log('🧹 [clear-tables] 开始清空数据表...');

  try {
    const results = [];

    // 1. 清空 agent_sub_tasks（先删子表）
    console.log('🧹 清空 agent_sub_tasks...');
    const deleteSubTasks = await db.delete(agentSubTasks).returning();
    results.push({
      table: 'agent_sub_tasks',
      deletedCount: deleteSubTasks.length,
    });
    console.log(`✅ agent_sub_tasks: 删除 ${deleteSubTasks.length} 条`);

    // 2. 清空 agent_notifications
    console.log('🧹 清空 agent_notifications...');
    const deleteNotifications = await db.delete(agentNotifications).returning();
    results.push({
      table: 'agent_notifications',
      deletedCount: deleteNotifications.length,
    });
    console.log(`✅ agent_notifications: 删除 ${deleteNotifications.length} 条`);

    // 3. 清空 daily_task
    console.log('🧹 清空 daily_task...');
    const deleteDailyTasks = await db.delete(dailyTask).returning();
    results.push({
      table: 'daily_task',
      deletedCount: deleteDailyTasks.length,
    });
    console.log(`✅ daily_task: 删除 ${deleteDailyTasks.length} 条`);

    // 4. 清空 agent_tasks（最后删父表）
    console.log('🧹 清空 agent_tasks...');
    const deleteAgentTasks = await db.delete(agentTasks).returning();
    results.push({
      table: 'agent_tasks',
      deletedCount: deleteAgentTasks.length,
    });
    console.log(`✅ agent_tasks: 删除 ${deleteAgentTasks.length} 条`);

    console.log('\n✅ 所有表清空完成！');

    return NextResponse.json({
      success: true,
      message: '所有表已清空',
      results,
    });
  } catch (error) {
    console.error('❌ 清空表失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '清空表失败',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

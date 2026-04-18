/**
 * 5 分钟定时任务 - 第二步：巡检卡住的任务
 * 扫描正在执行的任务，检查是否卡在某个子任务超过 1 小时
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dailyTask, agentInteractions } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { isTaskStuck } from '@/lib/task-status-detector';
import { generateSessionId } from '@/lib/session-id';

/**
 * GET /api/cron/check-stuck-tasks
 * 5 分钟定时任务，扫描正在执行的任务，检查是否卡住
 */
export async function GET(request: NextRequest) {
  console.log('🕐 5分钟定时任务 - 第二步：开始巡检卡住的任务...');
  
  try {
    // 1. 扫描所有 status = 'in_progress' 的任务
    const tasks = await db
      .select()
      .from(dailyTask)
      .where(eq(dailyTask.executionStatus, 'in_progress'));
    
    console.log(`📋 找到 ${tasks.length} 个正在执行的任务`);
    
    let stuckCount = 0;
    let checkedCount = 0;
    
    // 2. 遍历每个任务
    for (const task of tasks) {
      console.log(`🔍 检查任务 ${task.id}: ${task.taskName || task.commandContent?.substring(0, 50)}`);
      
      // 检查是否卡住
      const isStuck = await isTaskStuck(task);
      
      if (isStuck) {
        console.log(`⚠️ 任务 ${task.id} 卡住了`);
        stuckCount++;
        
        // 检查是否已经创建过巡检记录（避免重复巡检）
        const existingInspection = await db
          .select()
          .from(agentInteractions)
          .where(
            and(
              eq(agentInteractions.commandResultId, task.id),
              eq(agentInteractions.messageType, 'question'),
              eq(agentInteractions.sender, 'system'),
              eq(agentInteractions.receiver, task.executor),
              sql`${agentInteractions.metadata}->>'trigger' = 'check_stuck'`
            )
          )
          .orderBy(sql`${agentInteractions.createdAt} DESC`)
          .limit(1);
        
        // 如果最近 30 分钟内已经巡检过，跳过
        if (existingInspection.length > 0) {
          const lastInspectionTime = new Date(existingInspection[0].createdAt);
          const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
          
          if (lastInspectionTime > thirtyMinutesAgo) {
            console.log(`⏭️ 任务 ${task.id} 最近 30 分钟内已巡检过，跳过`);
            continue;
          }
        }
        
        // 创建 session_id
        const sessionId = generateSessionId('inspection', 'system', task.executor);
        
        // 插入 system 巡检提问记录
        await db.insert(agentInteractions).values({
          commandResultId: task.id,
          taskDescription: task.taskName || task.commandContent?.substring(0, 100),
          sessionId,
          sender: 'system',
          receiver: task.executor,
          messageType: 'question',
          content: '你好，系统检测到你的任务卡住了（超过 1 小时未更新）。请问你遇到了什么问题？需要帮助吗？',
          roundNumber: 1,
          metadata: {
            trigger: 'check_stuck',
            stuckReason: '超过1小时未更新',
            inspectionTime: new Date().toISOString(),
          },
        });
        
        console.log(`📨 已发送巡检消息给 Agent ${task.executor}`);
      } else {
        console.log(`✅ 任务 ${task.id} 正常，未卡住`);
      }
      
      checkedCount++;
    }
    
    console.log(`✅ 定时任务第二步完成：检查了 ${checkedCount} 个任务，发现 ${stuckCount} 个卡住的任务`);
    
    return NextResponse.json({
      success: true,
      checkedCount,
      stuckCount,
      message: `检查了 ${checkedCount} 个正在执行的任务，发现 ${stuckCount} 个卡住的任务`,
    });
  } catch (error) {
    console.error('❌ 定时任务失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
      message: '定时任务执行失败',
    }, { status: 500 });
  }
}

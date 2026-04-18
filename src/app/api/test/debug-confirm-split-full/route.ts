/**
 * 完整调试 confirm-split 接口的逻辑
 * POST /api/test/debug-confirm-split-full
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dailyTask, agentNotifications } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, notificationId } = body;

    console.log('🔍 [完整调试] 开始测试 confirm-split 完整逻辑...');

    // 1. 查询任务
    const tasks = await db
      .select()
      .from(dailyTask)
      .where(eq(dailyTask.taskId, taskId))
      .limit(1);

    if (tasks.length === 0) {
      return NextResponse.json({
        success: false,
        error: '任务不存在',
      });
    }

    const dailyTask = tasks[0];
    console.log(`✅ 找到任务: id=${dailyTask.id}, task_id=${dailyTask.taskId}`);

    // 2. 查询通知
    const notifications = await db
      .select()
      .from(agentNotifications)
      .where(eq(agentNotifications.id, notificationId))
      .limit(1);

    if (notifications.length === 0) {
      return NextResponse.json({
        success: false,
        error: '通知不存在',
      });
    }

    const notification = notifications[0];
    console.log(`✅ 找到通知: id=${notification.id}, notificationId=${notification.notificationId}`);

    // 3. 解析数据 - 完全模拟 confirm-split 的逻辑
    console.log('🔍 开始数据解析...');

    let pendingSubTasksByTask: Record<string, any[]> = {};
    
    if (notification.metadata?.pendingSubTasksByTask) {
      pendingSubTasksByTask = notification.metadata.pendingSubTasksByTask;
      console.log('✅ 从 notification.metadata.pendingSubTasksByTask 获取');
    } else {
      console.log('⚠️ notification.metadata 中没有 pendingSubTasksByTask');
      
      // 解析 content
      let contentObj: any = null;
      try {
        if (typeof notification.content === 'string') {
          contentObj = JSON.parse(notification.content);
        } else {
          contentObj = notification.content;
        }
        console.log('✅ content 解析成功');
      } catch (e) {
        console.error('❌ content 解析失败:', e);
      }

      if (contentObj) {
        console.log('  - content 字段:', Object.keys(contentObj));
        
        const splitResult = contentObj.splitResult;
        if (splitResult) {
          console.log('  - 找到 splitResult');
          console.log('  - splitResult 字段:', Object.keys(splitResult));
          
          let subTasks = splitResult.subtasks || splitResult.subTasks || [];
          console.log(`  - 直接 subTasks 数量: ${subTasks.length}`);
          
          if ((!subTasks || !Array.isArray(subTasks) || subTasks.length === 0) && 
              splitResult.tasks && Array.isArray(splitResult.tasks) && splitResult.tasks.length > 0) {
            console.log('  - 🔍 检测到批量拆解格式，从 tasks[0].subTasks 获取');
            const firstTask = splitResult.tasks[0];
            console.log('  - firstTask 字段:', Object.keys(firstTask));
            subTasks = firstTask.subtasks || firstTask.subTasks || [];
            console.log(`  - 批量拆解 subTasks 数量: ${subTasks.length}`);
          }
          
          pendingSubTasksByTask[dailyTask.id] = subTasks;
          console.log(`✅ 设置 pendingSubTasksByTask[${dailyTask.id}] = ${subTasks.length} 个子任务`);
        } else {
          console.log('❌ 没有找到 splitResult');
        }
      }
    }

    console.log('📋 pendingSubTasksByTask 结果:', Object.keys(pendingSubTasksByTask));
    
    for (const [key, subTasks] of Object.entries(pendingSubTasksByTask)) {
      console.log(`  - ${key}: ${subTasks.length} 个子任务`);
      if (subTasks.length > 0) {
        console.log(`    第一个子任务:`, subTasks[0]?.title);
      }
    }

    return NextResponse.json({
      success: true,
      message: '完整调试完成！',
      dailyTask: {
        id: dailyTask.id,
        taskId: dailyTask.taskId,
      },
      notification: {
        id: notification.id,
        notificationId: notification.notificationId,
        hasMetadataPendingSubTasks: !!notification.metadata?.pendingSubTasksByTask,
      },
      pendingSubTasksByTaskKeys: Object.keys(pendingSubTasksByTask),
      pendingSubTasksByTask: pendingSubTasksByTask,
    });
  } catch (error) {
    console.error('❌ [完整调试] 失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

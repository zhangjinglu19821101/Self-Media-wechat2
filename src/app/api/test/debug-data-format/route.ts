/**
 * 调试数据格式 API
 * GET /api/test/debug-data-format
 * 
 * 用于分析数据格式兼容性问题
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentNotifications } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const notificationId = searchParams.get('notificationId');

    if (!notificationId) {
      return NextResponse.json(
        { success: false, error: '缺少 notificationId 参数' },
        { status: 400 }
      );
    }

    console.log(`🔍 开始调试数据格式: notificationId=${notificationId}`);

    // 1. 查询通知
    const notifications = await db
      .select()
      .from(agentNotifications)
      .where(eq(agentNotifications.notificationId, notificationId))
      .limit(1);

    if (notifications.length === 0) {
      return NextResponse.json(
        { success: false, error: '通知不存在' },
        { status: 404 }
      );
    }

    const notification = notifications[0];
    
    // 2. 分析数据结构
    let contentJson = null;
    try {
      contentJson = JSON.parse(notification.content);
    } catch (e) {
      console.log('⚠️ content 不是 JSON 格式');
    }

    // 3. 构建分析报告
    const analysis = {
      notificationId: notification.notificationId,
      notificationType: notification.notificationType,
      
      // metadata 分析
      metadata: {
        hasPendingSubTasksByTask: !!notification.metadata?.pendingSubTasksByTask,
        hasPendingSubTasks: !!notification.metadata?.pendingSubTasks,
        hasDailyTaskIds: !!notification.metadata?.dailyTaskIds,
        keys: notification.metadata ? Object.keys(notification.metadata) : [],
      },
      
      // content 分析
      content: {
        isJson: !!contentJson,
        hasSplitResult: !!contentJson?.splitResult,
        splitResultKeys: contentJson?.splitResult ? Object.keys(contentJson.splitResult) : [],
        hasTasks: !!contentJson?.splitResult?.tasks,
        tasksCount: contentJson?.splitResult?.tasks?.length || 0,
      },
      
      // 数据路径对比
      dataPaths: {
        // 路径 1: metadata.pendingSubTasksByTask
        path1: notification.metadata?.pendingSubTasksByTask ? '✅ 存在' : '❌ 不存在',
        
        // 路径 2: content.splitResult.tasks[0].subTasks
        path2: contentJson?.splitResult?.tasks?.[0]?.subTasks ? '✅ 存在' : '❌ 不存在',
        
        // 路径 3: content.splitResult.tasks[0].subtasks
        path3: contentJson?.splitResult?.tasks?.[0]?.subtasks ? '✅ 存在' : '❌ 不存在',
      },
      
      // 原始数据（截断）
      rawData: {
        metadata: notification.metadata ? Object.keys(notification.metadata).slice(0, 10) : [],
        contentPreview: notification.content ? notification.content.substring(0, 500) : null,
      },
    };

    // 4. 检查数据格式兼容性问题
    const issues = [];
    
    if (!notification.metadata?.pendingSubTasksByTask) {
      issues.push('⚠️ metadata.pendingSubTasksByTask 不存在');
    }
    
    if (contentJson?.splitResult?.tasks) {
      issues.push('✅ 检测到批量拆解格式 (content.splitResult.tasks)');
      
      if (contentJson.splitResult.tasks.length > 0) {
        const firstTask = contentJson.splitResult.tasks[0];
        if (firstTask.subTasks || firstTask.subtasks) {
          issues.push('✅ 子任务数据存在于 tasks[0] 中');
        } else {
          issues.push('❌ tasks[0] 中没有找到 subTasks/subtasks');
        }
      }
    }

    return NextResponse.json({
      success: true,
      analysis,
      issues,
    });
  } catch (error) {
    console.error('❌ 调试失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agent-sub-tasks/confirm-split
 * Agent A 确认拆解结果，插入 agent_sub_tasks 表
 *
 * 请求体：
 * {
 *   notificationId: "uuid",
 *   splitResult: {...},
 *   taskId: "daily-task-id"
 * }
 *
 * 响应：
 * {
 *   success: true,
 *   message: "拆解结果已确认",
 *   data: { subTaskCount }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dailyTask, agentSubTasks, agentNotifications } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { markNotificationAsRead } from '@/lib/services/notification-service';
import { getCurrentBeijingTime } from '@/lib/utils/date-time';
import { requireAuth } from '@/lib/auth/context';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { notificationId, splitResult, taskId } = body;

    if (!notificationId || !splitResult || !taskId) {
      return NextResponse.json(
        { success: false, error: '缺少必填参数：notificationId, splitResult, taskId' },
        { status: 400 }
      );
    }

    console.log(`🔴🔴🔴 [调试] Agent A 确认拆解结果: taskId=${taskId}, notificationId=${notificationId}`);
    console.log(`🔴 [调试] taskId 类型: ${typeof taskId}`);
    console.log(`🔴 [调试] taskId 长度: ${taskId?.length}`);

    // 1. 查询 daily_task（兼容 UUID id 和字符串 task_id）
    // 先尝试用 id（UUID）查询，如果失败再用 task_id 查询
    let tasks;
    try {
      console.log(`🔴 [调试] 尝试用 id 查询 daily_task: ${taskId}`);
      tasks = await db
        .select()
        .from(dailyTask)
        .where(eq(dailyTask.id, taskId))
        .limit(1);
      console.log(`🔴 [调试] 用 id 查询结果: ${tasks.length} 条`);
    } catch (error) {
      console.log(`⚠️ 使用 id 查询失败，尝试用 task_id 查询:`, error);
      tasks = await db
        .select()
        .from(dailyTask)
        .where(eq(dailyTask.taskId, taskId))
        .limit(1);
      console.log(`🔴 [调试] 用 task_id 查询结果: ${tasks.length} 条`);
    }

    // 如果 id 查询没找到，尝试用 task_id 查询
    if (tasks.length === 0) {
      console.log(`🔴 [调试] id 查询没找到，再试一次用 task_id 查询`);
      tasks = await db
        .select()
        .from(dailyTask)
        .where(eq(dailyTask.taskId, taskId))
        .limit(1);
      console.log(`🔴 [调试] 第二次用 task_id 查询结果: ${tasks.length} 条`);
    }

    if (tasks.length === 0) {
      return NextResponse.json(
        { success: false, error: '任务不存在' },
        { status: 404 }
      );
    }

    const dailyTaskRecord = tasks[0];
    console.log(`✅ 找到 daily_task: id=${dailyTaskRecord.id}, task_id=${dailyTaskRecord.taskId}`);
    console.log(`📋 当前任务状态: ${dailyTaskRecord.executionStatus}`);
    console.log(`👤 父任务 executor: ${dailyTaskRecord.executor}`);

    // 🔥 防重检查 1: 检查 daily_task 状态
    if (dailyTaskRecord.executionStatus === 'split_completed') {
      console.log(`⚠️ 防重触发: daily_task 已经是 split_completed 状态`);
      return NextResponse.json(
        { 
          success: false, 
          error: '该任务已经拆解完成，请勿重复提交',
          code: 'ALREADY_SPLIT_COMPLETED'
        },
        { status: 409 }
      );
    }

    // 🔥 防重检查 2: 检查 agent_sub_tasks 表是否已有数据
    const existingSubTasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.commandResultId, dailyTaskRecord.id))
      .limit(1);

    if (existingSubTasks.length > 0) {
      console.log(`⚠️ 防重触发: agent_sub_tasks 表已经有数据了`);
      return NextResponse.json(
        { 
          success: false, 
          error: '该任务已经有子任务了，请勿重复提交',
          code: 'ALREADY_HAS_SUBTASKS'
        },
        { status: 409 }
      );
    }

    console.log(`✅ 防重检查通过: 可以插入子任务`);

    // 2. 查询通知，获取待确认的子任务数据
    console.log(`📋 查询通知获取待确认的子任务...`);
    let notifications: any[] = [];
    
    // 先尝试用 notificationId 查询
    try {
      const result = await db
        .select()
        .from(agentNotifications)
        .where(eq(agentNotifications.notificationId, notificationId))
        .limit(1);
      notifications = result || [];
      console.log(`✅ 用 notificationId 查询到 ${notifications.length} 条通知`);
    } catch (error) {
      console.log(`⚠️ 用 notificationId 查询失败，尝试用 id 查询`);
    }
    
    // 如果没找到，尝试用 id 查询
    if (notifications.length === 0) {
      try {
        const result = await db
          .select()
          .from(agentNotifications)
          .where(eq(agentNotifications.id, notificationId))
          .limit(1);
        notifications = result || [];
        console.log(`✅ 用 id 查询到 ${notifications.length} 条通知`);
      } catch (error) {
        console.log(`⚠️ 用 id 查询也失败`);
      }
    }

    if (notifications.length === 0) {
      return NextResponse.json(
        { success: false, error: '通知不存在' },
        { status: 404 }
      );
    }

    const notification = notifications[0];
    console.log(`✅ 找到通知: ${notification.notificationId}`);

    // 3. 🔥 新增：从通知 metadata 中获取待确认的子任务数据
    let pendingSubTasksByTask: Record<string, any[]> = {};
    
    // 方式 1：优先从通知 metadata 中获取
    if (notification.metadata?.pendingSubTasksByTask) {
      pendingSubTasksByTask = notification.metadata.pendingSubTasksByTask;
      console.log(`✅ 从通知 metadata 中获取到 pendingSubTasksByTask`);
    } 
    // 方式 2：如果 metadata 中没有，尝试从 content.splitResult 中获取（批量拆解格式）
    else {
      console.log(`⚠️ 通知 metadata 中没有 pendingSubTasksByTask，尝试从 content.splitResult 中获取`);
      
      let contentJson = null;
      try {
        contentJson = typeof notification.content === 'string' 
          ? JSON.parse(notification.content) 
          : notification.content;
      } catch (e) {
        console.log(`⚠️ 解析 content 失败:`, e);
      }
      
      if (contentJson?.splitResult?.tasks && Array.isArray(contentJson.splitResult.tasks) && contentJson.splitResult.tasks.length > 0) {
        console.log(`🔍 [批量拆解] 检测到批量拆解格式`);
        
        // 构建 pendingSubTasksByTask
        for (const taskData of contentJson.splitResult.tasks) {
          // 查找对应的 daily_task UUID
          let taskUuid = null;
          
          // 方式 A：如果有 dailyTaskIds 数组
          if (notification.metadata?.dailyTaskIds && Array.isArray(notification.metadata.dailyTaskIds)) {
            // 简单匹配（这里需要更精确的匹配逻辑
            console.log(`🔍 有 dailyTaskIds:`, notification.metadata.dailyTaskIds);
          }
          
          // 方式 B：通过 task_id 查询 daily_task 表获取 UUID
          if (!taskUuid && taskData.taskId) {
            const tasks = await db
              .select()
              .from(dailyTask)
              .where(eq(dailyTask.taskId, taskData.taskId))
              .limit(1);
            
            if (tasks.length > 0) {
              taskUuid = tasks[0].id;
              console.log(`✅ 找到 taskUuid: ${taskUuid} (taskId: ${taskData.taskId}`);
            }
          }
          
          // 方式 C：如果没有找到，使用当前的 dailyTaskRecord.id（兜底）
          if (!taskUuid) {
            taskUuid = dailyTaskRecord.id;  // ✅ 修复：使用当前 dailyTaskRecord.id 作为兜底
            const subTasks = taskData.subtasks || taskData.subTasks || [];
            pendingSubTasksByTask[taskUuid] = subTasks;
            console.log(`✅ 任务 ${taskData.taskId} 分配 ${subTasks.length} 个子任务`);
          }
        }
      }
      
      // 如果上面没有获取到数据，使用当前 dailyTask 作为兜底
      if (Object.keys(pendingSubTasksByTask).length === 0) {
        console.log(`⚠️ 没有从批量格式中获取到数据，使用当前 dailyTask 作为兜底`);
        let subTasks = splitResult?.subtasks || splitResult?.subTasks || [];
        
        if ((!subTasks || !Array.isArray(subTasks) || subTasks.length === 0) && 
            contentJson?.splitResult?.tasks && Array.isArray(contentJson.splitResult.tasks) && contentJson.splitResult.tasks.length > 0) {
          console.log(`🔍 [兜底] 从 tasks[0].subTasks 获取`);
          const firstTask = contentJson.splitResult.tasks[0];
          subTasks = firstTask.subtasks || firstTask.subTasks || [];
        }
        
        pendingSubTasksByTask[dailyTaskRecord.id] = subTasks;
      }
    }

    // 4. 🔥 新增：真正插入子任务到 agent_sub_tasks 表
    console.log(`💾 开始插入子任务到 agent_sub_tasks 表...`);
    let totalInserted = 0;

    for (const [taskIdKey, subTasks] of Object.entries(pendingSubTasksByTask)) {
      console.log(`   📝 处理任务 ${taskIdKey}: ${subTasks.length} 个子任务`);
      
      if (subTasks.length > 0) {
        for (const subTask of subTasks) {
          // 🔥 新增：处理 deadline 字段（与 save-split-result-v2.ts 保持一致）
          let deadlineDate: Date | null = null;
          let dateSource = '';
          
          console.log(`🔍 [insurance-d deadline处理] 子任务 ${subTask.orderIndex}:`);
          console.log(`🔍 [insurance-d deadline处理] Agent返回的deadline: "${subTask.deadline}" (类型: ${typeof subTask.deadline})`);
          
          // 方案1：优先直接使用 Agent 返回的 deadline
          if (subTask.deadline) {
            // 尝试解析 YYYY-MM-DD 格式（这是规范要求的格式）
            const dateMatch = subTask.deadline.match(/(\d{4})-(\d{2})-(\d{2})/);
            if (dateMatch) {
              const [, year, month, day] = dateMatch;
              deadlineDate = new Date(`${year}-${month}-${day}`);
              if (!isNaN(deadlineDate.getTime())) {
                dateSource = 'Agent返回的YYYY-MM-DD格式';
                console.log(`✅ [insurance-d deadline处理] 直接使用Agent返回的deadline: ${deadlineDate.toISOString().split('T')[0]}`);
              }
            }
            
            // 如果上面失败，尝试直接 new Date() 解析
            if (!dateSource) {
              deadlineDate = new Date(subTask.deadline);
              if (!isNaN(deadlineDate.getTime())) {
                dateSource = 'Agent返回的其他日期格式';
                console.log(`✅ [insurance-d deadline处理] 直接使用Agent返回的deadline: ${deadlineDate.toISOString().split('T')[0]}`);
              }
            }
          }
          
          // 方案2：如果 Agent 没有返回有效 deadline，使用当前日期作为兜底
          if (!dateSource) {
            console.log(`⚠️ [insurance-d deadline处理] Agent未返回有效deadline，使用兜底方案（当前日期）`);
            deadlineDate = new Date();
            dateSource = '兜底方案(当前日期)';
            console.log(`✅ [insurance-d deadline处理] 使用兜底日期: ${deadlineDate.toISOString().split('T')[0]}`);
          }
          
          // 最终验证日期是否有效
          if (isNaN(deadlineDate.getTime())) {
            console.error(`❌ [insurance-d deadline处理] 日期解析最终失败，使用当前日期`);
            deadlineDate = new Date();
            dateSource = '最终兜底(当前日期)';
          }
          
          console.log(`✅ [insurance-d deadline处理] 最终结果:`);
          console.log(`  - deadline: ${deadlineDate.toISOString().split('T')[0]}`);
          console.log(`  - 日期来源: ${dateSource}`);
          console.log(`  - Agent原始deadline: "${subTask.deadline}"`);
          
          await db.insert(agentSubTasks).values({
            commandResultId: taskIdKey,
            fromParentsExecutor: dailyTaskRecord.executor, // 🔥 修复：使用父 daily_task 的 executor
            taskTitle: subTask.title,
            taskDescription: subTask.description,
            status: 'pending',
            orderIndex: subTask.orderIndex,
            // 🔥 新增：从主任务继承用户观点和素材
            userOpinion: dailyTaskRecord.userOpinion || null,
            materialIds: dailyTaskRecord.materialIds || [],
            // 🔥 Phase 6 多用户：从认证上下文继承 workspaceId
            workspaceId: authResult.workspaceId,
            metadata: {
              acceptanceCriteria: subTask.acceptanceCriteria,
              isCritical: subTask.isCritical,
              criticalReason: subTask.criticalReason,
              executor: subTask.executor, // 保留子任务原始 executor 到 metadata
              parentTaskExecutor: dailyTaskRecord.executor, // 新增：记录父任务 executor
              deadline: subTask.deadline, // 🔥 新增：保存原始 deadline
              deadlineDate: deadlineDate.toISOString().split('T')[0], // 🔥 新增：保存解析后的日期
              deadlineSource: dateSource, // 🔥 新增：保存日期来源
              priority: subTask.priority, // 🔥 新增：保存优先级
              estimatedHours: subTask.estimatedHours, // 🔥 新增：保存预计工时
            },
          });
          totalInserted++;
        }
        console.log(`      ✅ 任务 ${taskIdKey} 插入 ${subTasks.length} 个子任务`);
        console.log(`      📌 使用父任务 executor: ${dailyTaskRecord.executor}`);
      }
    }

    console.log(`✅ 总共插入 ${totalInserted} 个子任务`);

    // 5. 更新 daily_task 状态：从 splitting → split_completed
    await db
      .update(dailyTask)
      .set({
        executionStatus: 'split_completed', // ✅ 确认后设置为 split_completed
        retryStatus: null, // 清空重试状态
        updatedAt: new Date(),
        metadata: {
          ...(dailyTaskRecord.metadata || {}),
          insuranceDSplitConfirmed: true,
          insuranceDSplitConfirmedAt: new Date().toISOString(),
          splitNotificationId: notificationId,
        },
      })
      .where(eq(dailyTask.id, dailyTaskRecord.id)); // ✅ 使用查询到的 UUID

    console.log(`✅ daily_task 已更新: splitting → split_completed`);

    // 6. 立即启动第一个子任务（order_index = 1）
    console.log(`🚀 立即启动第一个子任务...`);
    
    const firstSubTask = await db
      .select()
      .from(agentSubTasks)
      .where(
        and(
          eq(agentSubTasks.commandResultId, dailyTaskRecord.id),
          eq(agentSubTasks.orderIndex, 1)
        )
      )
      .limit(1);
    
    if (firstSubTask.length > 0) {
      await db
        .update(agentSubTasks)
        .set({
          status: 'in_progress',
          startedAt: getCurrentBeijingTime(),
          updatedAt: getCurrentBeijingTime(),
        })
        .where(eq(agentSubTasks.id, firstSubTask[0].id));
      
      console.log(`✅ 第一个子任务已启动: ${firstSubTask[0].taskTitle}`);
    }

    // 7. 标记通知为已读，并更新通知 metadata
    await markNotificationAsRead(notification.notificationId);
    
    // 🔥 更新通知 metadata，标记为已确认
    await db
      .update(agentNotifications)
      .set({
        metadata: {
          ...(notification.metadata || {}),
          insuranceDSplitConfirmed: true,
          insuranceDSplitConfirmedAt: getCurrentBeijingTime().toISOString(),
          splitPopupStatus: 'confirmed', // 🔥 设置为终态 confirmed
        },
      })
      .where(eq(agentNotifications.id, notification.id));
    
    console.log(`✅ 通知已标记为已读并更新 metadata: ${notificationId}`);
    
    // 8. 查询所有已保存的子任务
    const savedSubTasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.commandResultId, dailyTaskRecord.id))
      .orderBy(agentSubTasks.orderIndex);

    return NextResponse.json({
      success: true,
      message: '拆解结果已确认',
      data: {
        taskId,
        subTaskCount: savedSubTasks.length,
        totalInserted,
        subTasks: savedSubTasks.map((st: any) => ({
          orderIndex: st.orderIndex,
          title: st.taskTitle,
          executor: st.executor,
        })),
      },
    });
  } catch (error) {
    console.error('❌ 确认拆解结果失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

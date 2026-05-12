import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentTasks, dailyTask, agentSubTasks, agentNotifications } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { TaskStateMachine } from '@/lib/services/task-state-machine';

/**
 * 测试失败通知机制
 * 场景：创建测试数据 → 触发关键子任务失败 → 验证通知是否生成
 */
export async function POST(request: NextRequest) {
  try {
    console.log(`🧪 开始测试失败通知机制`);

    const timestamp = Date.now();

    // 1. 创建任务
    const taskId = `task-notification-test-${timestamp}`;
    const [task] = await db
      .insert(agentTasks)
      .values({
        taskId,
        taskName: `通知测试任务 ${timestamp}`,
        coreCommand: '测试失败通知机制',
        executor: 'insurance-d',
        fromAgentId: 'A',
        toAgentId: 'B',
        creator: 'A',
        updater: 'TS',
        taskStatus: 'in_progress',
        taskPriority: 'normal',
        acceptanceCriteria: '完成所有子任务',
        taskType: 'master',
        splitStatus: 'completed',
        taskDurationStart: new Date(),
        taskDurationEnd: new Date(),
        totalDeliverables: '3个子任务',
      })
      .returning();

    console.log(`✅ 任务创建成功: ${taskId}`);

    // 2. 创建指令
    const commandId = `cmd-notification-${timestamp}`;
    const [command] = await db
      .insert(dailyTask)
      .values({
        commandId,
        relatedTaskId: taskId,
        commandContent: '测试指令',
        executor: 'insurance-d',
        commandPriority: 'normal',
        executionDeadlineStart: new Date(),
        executionDeadlineEnd: new Date(),
        deliverables: '3个子任务',
        executionStatus: 'in_progress',
        splitter: 'agent B',
        entryUser: 'TS',
        fromAgentId: 'A',
        toAgentId: 'B',
        originalCommand: '测试指令',
        completedSubTasks: 0,
        subTaskCount: 3,
      })
      .returning();

    console.log(`✅ 指令创建成功: ${commandId}`);

    // 3. 创建3个子任务
    const subTasksData = [
      {
        taskTitle: '收集素材',
        taskDescription: '收集相关素材',
        status: 'failed',
        isCritical: true,
        criticalReason: '前置依赖，没有素材无法进行后续步骤',
        failureReason: '素材收集失败，无法获取必要的数据'
      },
      {
        taskTitle: '撰写文章',
        taskDescription: '撰写文章初稿',
        status: 'pending',
        isCritical: true,
        criticalReason: '核心功能，这是文章的主体内容',
      },
      {
        taskTitle: '校验内容',
        taskDescription: '进行内容校验',
        status: 'pending',
        isCritical: true,
        criticalReason: '合规要求，必须通过校验',
      }
    ];

    const subTasks = [];
    for (let i = 0; i < subTasksData.length; i++) {
      const stData = subTasksData[i];
      const [subTask] = await db
        .insert(agentSubTasks)
        .values({
          commandResultId: command.id,
          agentId: 'insurance-d',
          taskTitle: stData.taskTitle,
          taskDescription: stData.taskDescription,
          status: stData.status,
          orderIndex: i,
          startedAt: stData.status !== 'pending' ? new Date() : null,
          completedAt: stData.status === 'completed' ? new Date() : null,
          metadata: {
            isCritical: stData.isCritical,
            criticalReason: stData.criticalReason,
            failureReason: stData.failureReason,
          }
        })
        .returning();
      
      subTasks.push(subTask);
      
      console.log(`✅ 子任务创建成功: ${stData.taskTitle} (${stData.status}, 关键: ${stData.isCritical})`);
    }

    // 4. 触发关键子任务失败（直接调用状态机的 handleCriticalSubTaskFailure 方法）
    console.log(`\n步骤 1: 触发关键子任务失败`);
    const criticalSubTask = subTasks[0]; // 第一个子任务是关键子任务，状态为 failed
    
    await TaskStateMachine.handleCriticalSubTaskFailure(
      command.id,
      criticalSubTask.taskTitle,
      criticalSubTask.metadata?.failureReason || '测试失败原因',
      'test'
    );

    console.log(`✅ 关键子任务失败级联更新完成`);

    // 5. 查询生成的通知
    console.log(`\n步骤 2: 查询生成的失败通知`);
    const notifications = await db
      .select()
      .from(agentNotifications)
      .where(eq(agentNotifications.relatedTaskId, taskId));

    console.log(`✅ 查询到 ${notifications.length} 条通知`);

    return NextResponse.json({
      success: true,
      message: '失败通知测试完成',
      data: {
        task,
        command,
        subTasks,
        notifications,
        statistics: {
          subTasks: {
            total: subTasks.length,
            completed: subTasks.filter(st => st.status === 'completed').length,
            failed: subTasks.filter(st => st.status === 'failed').length,
            pending: subTasks.filter(st => st.status === 'pending').length,
          },
          notifications: {
            total: notifications.length,
            unread: notifications.filter(n => !n.isRead).length,
            read: notifications.filter(n => n.isRead).length,
          }
        }
      }
    }, { status: 200 });
  } catch (error: any) {
    console.error(`❌ 测试失败通知机制失败:`, error);

    return NextResponse.json({
      success: false,
      error: error.message,
      message: error.message,
    }, { status: 500 });
  }
}

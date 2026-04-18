import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentTasks, dailyTask, agentSubTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

/**
 * 创建测试数据：模拟非关键子任务失败场景
 * 场景：5个子任务，其中2个非关键子任务失败，3个关键子任务成功
 */
export async function POST(request: NextRequest) {
  try {
    console.log(`🧪 创建测试数据：非关键子任务失败场景`);

    const timestamp = Date.now();

    // 1. 创建任务
    const taskId = `task-recovery-test-${timestamp}`;
    const [task] = await db
      .insert(agentTasks)
      .values({
        taskId,
        taskName: `恢复测试任务 ${timestamp}`,
        coreCommand: '测试失败恢复机制',
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
        totalDeliverables: '5个子任务',
      })
      .returning();

    console.log(`✅ 任务创建成功: ${taskId}`);

    // 2. 创建指令
    const commandId = `cmd-recovery-${timestamp}`;
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
        deliverables: '5个子任务',
        executionStatus: 'in_progress',
        splitter: 'agent B',
        entryUser: 'TS',
        fromAgentId: 'A',
        toAgentId: 'B',
        originalCommand: '测试指令',
        completedSubTasks: 0,
        subTaskCount: 5,
      })
      .returning();

    console.log(`✅ 指令创建成功: ${commandId}`);

    // 3. 创建5个子任务
    const subTasksData = [
      {
        taskTitle: '收集保险素材',
        taskDescription: '收集保险产品相关素材',
        status: 'completed',
        isCritical: true,
        criticalReason: '前置依赖，没有素材无法进行后续步骤'
      },
      {
        taskTitle: '撰写保险文章初稿',
        taskDescription: '撰写保险文章初稿',
        status: 'completed',
        isCritical: true,
        criticalReason: '核心功能，这是文章的主体内容'
      },
      {
        taskTitle: '合规校验与修正',
        taskDescription: '进行合规校验与修正',
        status: 'completed',
        isCritical: true,
        criticalReason: '合规要求，必须通过合规校验'
      },
      {
        taskTitle: '添加配图',
        taskDescription: '为文章添加相关配图',
        status: 'failed',
        isCritical: false,
        criticalReason: null,
        failureReason: '素材不足，无法找到合适的配图'
      },
      {
        taskTitle: '排版优化',
        taskDescription: '优化文章排版',
        status: 'failed',
        isCritical: false,
        criticalReason: null,
        failureReason: '排版工具不可用'
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

    // 更新指令的子任务进展
    await db
      .update(dailyTask)
      .set({
        completedSubTasks: 3,
        completedSubTasksDescription: '已完成 3/5 个子任务',
      })
      .where(eq(dailyTask.id, command.id));

    return NextResponse.json({
      success: true,
      message: '测试数据创建成功',
      data: {
        task,
        command,
        subTasks,
        statistics: {
          total: subTasks.length,
          completed: subTasks.filter(st => st.status === 'completed').length,
          failed: subTasks.filter(st => st.status === 'failed').length,
          critical: subTasks.filter(st => st.metadata?.isCritical).length,
          nonCritical: subTasks.filter(st => st.metadata?.isCritical === false).length,
        }
      }
    }, { status: 201 });
  } catch (error: any) {
    console.error(`❌ 创建测试数据失败:`, error);

    return NextResponse.json({
      success: false,
      error: error.message,
      message: error.message,
    }, { status: 500 });
  }
}

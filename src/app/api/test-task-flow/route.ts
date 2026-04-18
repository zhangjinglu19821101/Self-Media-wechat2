/**
 * 任务流程测试 API
 * 测试完整的任务创建 → 拆解 → 确认流程
 */

import { NextResponse } from 'next/server';
import { TaskManager } from '@/lib/services/task-manager';
import { db } from '@/lib/db';
import { agentTasks, dailyTask } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    console.log('🚀 开始测试任务流程...');

    // 步骤 1: 创建一个任务（模拟 Agent A 下发任务）
    console.log('\n=== 步骤 1: 创建任务 ===');
    const taskId = `task-flow-test-${Date.now()}`;
    const task = await TaskManager.createTask({
      taskId,
      taskName: '测试任务：编写保险产品介绍文章',
      coreCommand: '编写一篇关于重大疾病保险产品介绍的科普文章，目标读者为30-45岁职场人群，字数要求1500字左右',
      executor: 'B',
      taskDurationStart: new Date(),
      taskDurationEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7天后
      totalDeliverables: '1篇保险产品介绍文章',
      taskPriority: 'high',
      taskStatus: 'unsplit',
      creator: 'A',
      updater: 'A',
      remarks: '此任务用于测试任务拆解流程',
      // 旧字段（保持兼容）
      fromAgentId: 'A',
      toAgentId: 'B',
      command: '编写一篇关于重大疾病保险产品介绍的科普文章',
      commandType: 'task',
      priority: 'high',
      status: 'pending',
      metadata: {},
    });

    console.log('✅ 任务创建成功:', task.taskId);
    console.log('  - 任务名称:', task.taskName);
    console.log('  - 执行者:', task.executor);
    console.log('  - 状态:', task.taskStatus);

    // 步骤 2: Agent B 拆解任务
    console.log('\n=== 步骤 2: Agent B 拆解任务 ===');
    const splitCommands = [
      {
        commandId: `cmd-${taskId}-1`,
        commandContent: '研究重大疾病保险的基本概念、保障范围、常见疾病类型',
        executor: 'B',
        commandPriority: 'high',
        deliverables: '重大疾病保险概念和保障范围清单',
      },
      {
        commandId: `cmd-${taskId}-2`,
        commandContent: '收集30-45岁职场人群的保险需求和关注点',
        executor: 'B',
        commandPriority: 'normal',
        deliverables: '目标用户需求分析报告',
      },
      {
        commandId: `cmd-${taskId}-3`,
        commandContent: '撰写文章初稿，包含引言、正文、结语',
        executor: 'B',
        commandPriority: 'high',
        deliverables: '文章初稿（1500字）',
      },
    ];

    // 插入指令到 dailyTask 表
    const insertedCommands = [];
    for (const cmd of splitCommands) {
      const [inserted] = await db.insert(dailyTask).values({
        ...cmd,
        relatedTaskId: taskId,
        executionStatus: 'new',
        executionDeadlineStart: new Date(),
        executionDeadlineEnd: new Date(Date.now() + 24 * 60 * 60 * 1000),
        // 补充必填字段
        fromAgentId: 'B',
        toAgentId: 'A',
        originalCommand: cmd.commandContent,
        splitter: 'B',
        entryUser: 'TS',
      }).returning();
      insertedCommands.push(inserted);
      console.log(`  ✅ 指令创建成功: ${cmd.commandId}`);
    }

    // 更新任务状态为"拆分完成"
    const updatedTask = await db.update(agentTasks)
      .set({
        taskStatus: 'split_completed',
        status: 'pending',
        updatedAt: new Date(),
        metadata: {
          ...task.metadata,
          splitResult: {
            commandCount: splitCommands.length,
            splitAt: new Date().toISOString(),
          },
        },
      })
      .where(eq(agentTasks.taskId, taskId))
      .returning();

    console.log('✅ 任务拆解完成');
    console.log('  - 生成了', splitCommands.length, '条指令');
    console.log('  - 任务状态更新为: split_completed');

    // 步骤 3: Agent A 确认拆解方案
    console.log('\n=== 步骤 3: Agent A 确认拆解方案 ===');
    const finalTask = await db.update(agentTasks)
      .set({
        taskStatus: 'in_progress',
        status: 'in_progress',
        taskDurationStart: new Date(),
        updatedAt: new Date(),
        metadata: {
          ...updatedTask[0].metadata,
          confirmedAt: new Date().toISOString(),
        },
      })
      .where(eq(agentTasks.taskId, taskId))
      .returning();

    console.log('✅ 拆解方案已确认');
    console.log('  - 任务状态更新为: in_progress');
    console.log('  - 任务开始时间:', finalTask[0].taskDurationStart);

    // 步骤 4: 查询最终结果
    console.log('\n=== 步骤 4: 查询最终结果 ===');
    const finalCommands = await db.select()
      .from(dailyTask)
      .where(eq(dailyTask.relatedTaskId, taskId));

    console.log('✅ 查询结果:');
    console.log('  - 任务ID:', finalTask[0].taskId);
    console.log('  - 任务名称:', finalTask[0].taskName);
    console.log('  - 当前状态:', finalTask[0].taskStatus);
    console.log('  - 关联指令数量:', finalCommands.length);

    return NextResponse.json({
      success: true,
      message: '任务流程测试成功',
      data: {
        task: finalTask[0],
        commands: finalCommands,
      },
    });

  } catch (error) {
    console.error('❌ 任务流程测试失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '任务流程测试失败',
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * 测试失败状态级联功能
 * POST /api/test/failure-cascade
 *
 * 测试场景：
 * 1. 模拟任务失败 → 级联更新所有指令和子任务
 * 2. 模拟指令失败 → 级联更新所有子任务
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentTasks, dailyTask, agentSubTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { TaskStateMachine, TaskStatus, CommandStatus } from '@/lib/services/task-state-machine';

/**
 * 测试任务失败级联
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { scenario, taskId, commandId } = body;

    console.log(`🧪 开始测试失败状态级联: scenario=${scenario}`);

    if (scenario === 'task_failure') {
      // 场景 1：任务失败 → 级联更新所有指令和子任务
      if (!taskId) {
        return NextResponse.json({ error: '缺少 taskId 参数' }, { status: 400 });
      }

      // 1. 获取任务信息
      const [task] = await db
        .select()
        .from(agentTasks)
        .where(eq(agentTasks.taskId, taskId));

      if (!task) {
        return NextResponse.json({ error: `任务 ${taskId} 不存在` }, { status: 404 });
      }

      console.log(`📋 当前任务状态: ${task.taskStatus}`);

      // 2. 获取所有关联指令和子任务（级联前）
      const commandsBefore = await db
        .select()
        .from(dailyTask)
        .where(eq(dailyTask.relatedTaskId, taskId));

      const subTasksBefore: any[] = [];
      for (const cmd of commandsBefore) {
        const subTasks = await db
          .select()
          .from(agentSubTasks)
          .where(eq(agentSubTasks.commandResultId, cmd.id));
        subTasksBefore.push(...subTasks);
      }

      console.log(`📊 级联前统计: ${commandsBefore.length} 个指令, ${subTasksBefore.length} 个子任务`);

      // 3. 标记任务为失败
      await TaskStateMachine.updateTaskStatus(taskId, TaskStatus.FAILED, 'test', '测试级联失败');
      console.log(`✅ 任务状态已更新为 failed`);

      // 4. 获取所有关联指令和子任务（级联后）
      const commandsAfter = await db
        .select()
        .from(dailyTask)
        .where(eq(dailyTask.relatedTaskId, taskId));

      const subTasksAfter: any[] = [];
      for (const cmd of commandsAfter) {
        const subTasks = await db
          .select()
          .from(agentSubTasks)
          .where(eq(agentSubTasks.commandResultId, cmd.id));
        subTasksAfter.push(...subTasks);
      }

      console.log(`📊 级联后统计: ${commandsAfter.length} 个指令, ${subTasksAfter.length} 个子任务`);

      // 5. 统计失败数量
      const failedCommandsCount = commandsAfter.filter(c => c.executionStatus === CommandStatus.FAILED).length;
      const failedSubTasksCount = subTasksAfter.filter(s => s.status === 'failed').length;

      return NextResponse.json({
        success: true,
        scenario: 'task_failure',
        message: '任务失败级联测试完成',
        data: {
          taskId,
          taskStatus: TaskStatus.FAILED,
          cascadeBefore: {
            commandsCount: commandsBefore.length,
            subTasksCount: subTasksBefore.length,
            commandsStatus: commandsBefore.map(c => ({ id: c.commandId, status: c.executionStatus })),
            subTasksStatus: subTasksBefore.map(s => ({ id: s.id, status: s.status }))
          },
          cascadeAfter: {
            commandsCount: commandsAfter.length,
            subTasksCount: subTasksAfter.length,
            commandsStatus: commandsAfter.map(c => ({ id: c.commandId, status: c.executionStatus })),
            subTasksStatus: subTasksAfter.map(s => ({ id: s.id, status: s.status }))
          },
          summary: {
            failedCommandsCount,
            failedSubTasksCount,
            totalCommandsCount: commandsAfter.length,
            totalSubTasksCount: subTasksAfter.length
          }
        }
      });

    } else if (scenario === 'command_failure') {
      // 场景 2：指令失败 → 级联更新所有子任务
      if (!commandId) {
        return NextResponse.json({ error: '缺少 commandId 参数' }, { status: 400 });
      }

      // 1. 获取指令信息
      const [command] = await db
        .select()
        .from(dailyTask)
        .where(eq(dailyTask.commandId, commandId));

      if (!command) {
        return NextResponse.json({ error: `指令 ${commandId} 不存在` }, { status: 404 });
      }

      console.log(`📋 当前指令状态: ${command.executionStatus}`);

      // 2. 获取所有关联子任务（级联前）
      const subTasksBefore = await db
        .select()
        .from(agentSubTasks)
        .where(eq(agentSubTasks.commandResultId, command.id));

      console.log(`📊 级联前统计: ${subTasksBefore.length} 个子任务`);

      // 3. 标记指令为失败
      await TaskStateMachine.updateCommandStatus(commandId, CommandStatus.FAILED, 'test', '测试级联失败');
      console.log(`✅ 指令状态已更新为 failed`);

      // 4. 获取所有关联子任务（级联后）
      const subTasksAfter = await db
        .select()
        .from(agentSubTasks)
        .where(eq(agentSubTasks.commandResultId, command.id));

      console.log(`📊 级联后统计: ${subTasksAfter.length} 个子任务`);

      // 5. 统计失败数量
      const failedSubTasksCount = subTasksAfter.filter(s => s.status === 'failed').length;

      return NextResponse.json({
        success: true,
        scenario: 'command_failure',
        message: '指令失败级联测试完成',
        data: {
          commandId,
          commandStatus: CommandStatus.FAILED,
          relatedTaskId: command.relatedTaskId,
          cascadeBefore: {
            subTasksCount: subTasksBefore.length,
            subTasksStatus: subTasksBefore.map(s => ({ id: s.id, status: s.status }))
          },
          cascadeAfter: {
            subTasksCount: subTasksAfter.length,
            subTasksStatus: subTasksAfter.map(s => ({ id: s.id, status: s.status }))
          },
          summary: {
            failedSubTasksCount,
            totalSubTasksCount: subTasksAfter.length
          }
        }
      });

    } else {
      return NextResponse.json(
        { error: '无效的测试场景，请使用: task_failure 或 command_failure' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('❌ 测试失败:', error);
    return NextResponse.json(
      { error: '测试失败', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * 获取测试数据说明
 */
export async function GET() {
  return NextResponse.json({
    message: '失败状态级联测试 API',
    endpoints: {
      'POST /api/test/failure-cascade': {
        description: '测试失败状态级联功能',
        scenarios: [
          {
            name: 'task_failure',
            description: '任务失败 → 级联更新所有指令和子任务',
            params: {
              scenario: 'task_failure',
              taskId: '任务ID（例如：task-user-to-B-xxx）'
            }
          },
          {
            name: 'command_failure',
            description: '指令失败 → 级联更新所有子任务',
            params: {
              scenario: 'command_failure',
              commandId: '指令ID（例如：cmd-task-20260222-001-01）'
            }
          }
        ],
        example: {
          scenario: 'task_failure',
          taskId: 'task-user-to-B-1770699956142'
        }
      }
    }
  });
}

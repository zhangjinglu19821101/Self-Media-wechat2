/**
 * 指令 API 接口
 * POST /api/commands - 批量创建指令（Agent A 确认拆解方案后入库）
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dailyTask, agentTasks } from '@/lib/db/schema';
import { TaskStatusConst, CommandStatus } from '@/lib/services/task-state-machine';
import { commandResultService } from '@/lib/services/command-result-service';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/context';

/**
 * 批量创建指令（Agent A 确认拆解方案后入库）
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();

    // 解构请求参数
    const {
      relatedTaskId,
      commands
    } = body;

    // 参数校验
    if (!relatedTaskId || !commands || !Array.isArray(commands) || commands.length === 0) {
      return NextResponse.json(
        { error: '缺少必要参数：relatedTaskId, commands' },
        { status: 400 }
      );
    }

    // 1. 验证任务存在
    const [task] = await db
      .select()
      .from(agentTasks)
      .where(eq(agentTasks.taskId, relatedTaskId));

    if (!task) {
      return NextResponse.json(
        { error: `任务 ${relatedTaskId} 不存在` },
        { status: 404 }
      );
    }

    // 2. 验证任务状态是否允许拆解
    if (task.taskStatus !== TaskStatusConst.SPLITTING) {
      return NextResponse.json(
        { error: `任务状态不允许创建指令，当前状态：${task.taskStatus}` },
        { status: 400 }
      );
    }

    // 3. 批量插入指令（使用防重方法）
    const insertedCommands = [];
    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];
      const commandId = `cmd-${relatedTaskId}-${String(i + 1).padStart(2, '0')}`;

      // 使用带防重功能的方法创建任务
      const result = await commandResultService.createDailyTaskWithDuplicateCheck({
        commandId,
        taskId: relatedTaskId,
        relatedTaskId,
        taskTitle: `子任务 ${i + 1}`,
        originalCommand: cmd.commandContent,
        taskDescription: cmd.commandContent,
        executor: cmd.executor || task.executor,
        commandPriority: cmd.commandPriority || task.taskPriority,
        executionDeadlineStart: new Date(cmd.executionDeadlineStart),
        executionDeadlineEnd: new Date(cmd.executionDeadlineEnd),
        deliverables: cmd.deliverables,
        executionStatus: CommandStatus.NEW,
        splitter: 'agent B',
        entryUser: 'TS',
        fromAgentId: task.fromAgentId,
        toAgentId: task.executor,
        commandContent: cmd.commandContent,
        // 🔥 新增：从主任务继承用户观点和素材
        userOpinion: (task as any).userOpinion || null,
        originalInstruction: (task as any).originalInstruction || null, // 🔥 独立存储原始指令
        materialIds: (task as any).materialIds || [],
        // 🔥 Phase 6 多用户：工作空间归属（优先从父任务继承）
        workspaceId: task.workspaceId || authResult.workspaceId,
      });

      if (result.isDuplicate) {
        console.log(`⚠️ [api/commands] 检测到重复子任务: ${commandId}`);
        insertedCommands.push(result.data);
      } else {
        console.log(`✅ [api/commands] 子任务已创建: ${commandId}`);
        insertedCommands.push(result.data);
      }
    }

    // 4. 更新任务状态为"拆分完成"
    await db
      .update(agentTasks)
      .set({ taskStatus: TaskStatusConst.SPLIT_COMPLETED, updatedAt: new Date() })
      .where(eq(agentTasks.taskId, relatedTaskId));

    const [updatedTask] = await db
      .select()
      .from(agentTasks)
      .where(eq(agentTasks.taskId, relatedTaskId));

    console.log(`任务 ${relatedTaskId} 的 ${commands.length} 条指令已创建`);

    return NextResponse.json({
      success: true,
      data: {
        task: updatedTask,
        commands: insertedCommands
      },
      message: '指令已创建，等待执行主体执行'
    });

  } catch (error) {
    console.error('创建指令失败:', error);
    return NextResponse.json(
      { error: '创建指令失败', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * 获取指令列表
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { workspaceId } = authResult;
    const { searchParams } = new URL(request.url);
    const relatedTaskId = searchParams.get('relatedTaskId');
    const executor = searchParams.get('executor');
    const status = searchParams.get('status');

    // 构建查询条件 - workspace 隔离
    const conditions = [eq(dailyTask.workspaceId, workspaceId)];
    if (relatedTaskId) {
      conditions.push(eq(dailyTask.relatedTaskId, relatedTaskId));
    }
    if (executor) {
      conditions.push(eq(dailyTask.executor, executor));
    }
    if (status) {
      conditions.push(eq(dailyTask.executionStatus, status));
    }

    // 查询指令列表
    const commands = await db
      .select()
      .from(dailyTask)
      .where(and(...conditions))
      .orderBy(dailyTask.createdAt);

    return NextResponse.json({
      success: true,
      data: commands,
      total: commands.length
    });

  } catch (error) {
    console.error('获取指令列表失败:', error);
    return NextResponse.json(
      { error: '获取指令列表失败' },
      { status: 500 }
    );
  }
}

/**
 * 咨询 API 接口
 * POST /api/commands/:id/consult - 执行 agent 主动咨询或回复咨询
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dailyTask } from '@/lib/db/schema';
import { TaskStateMachine, CommandStatus } from '@/lib/services/task-state-machine';
import { eq } from 'drizzle-orm';

interface ConsultRequest {
  type: 'active_consult' | 'ts_response' | 'inspection_response';
  problemDescription?: {
    currentStatus: string;
    specificProblem: string;
    blocker: string;
    neededHelp: string;
    estimatedTimeToResolve: string;
  };
  response?: string;
}

/**
 * 执行 agent 主动咨询或回复咨询
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: commandId } = await params;
    const body: ConsultRequest = await request.json();
    const { type, problemDescription, response } = body;

    // 1. 验证指令存在
    const [command] = await db
      .select()
      .from(dailyTask)
      .where(eq(dailyTask.commandId, commandId));

    if (!command) {
      return NextResponse.json(
        { error: `指令 ${commandId} 不存在` },
        { status: 404 }
      );
    }

    // 2. 根据咨询类型处理
    switch (type) {
      case 'active_consult':
        // 主动咨询（执行 agent 遇到技术问题）
        return await handleActiveConsult(command, problemDescription);

      case 'ts_response':
        // TS 提醒回复
        return await handleTSResponse(command, response);

      case 'inspection_response':
        // 巡检回复
        return await handleInspectionResponse(command, response);

      default:
        return NextResponse.json(
          { error: `未知的咨询类型：${type}` },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('咨询处理失败:', error);
    return NextResponse.json(
      { error: '咨询处理失败', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * 处理主动咨询
 */
async function handleActiveConsult(
  command: any,
  problemDescription?: any
) {
  if (!problemDescription) {
    return NextResponse.json(
      { error: '缺少问题描述' },
      { status: 400 }
    );
  }

  // 1. 记录咨询
  const helpRecord = `${new Date().toISOString()} - 主动咨询：${problemDescription.specificProblem}`;

  await db
    .update(dailyTask)
    .set({
      helpRecord: `${command.helpRecord || ''}\n${helpRecord}`.trim(),
      lastConsultTime: new Date(),
      updatedAt: new Date()
    })
    .where(eq(dailyTask.commandId, command.commandId));

  // 2. 通知 Agent B
  await TaskStateMachine.notifyAgent(
    command.executor,
    'agent B',
    'system',
    `收到咨询：${problemDescription.specificProblem}`,
    `指令「${command.commandContent}」执行主体遇到问题：${JSON.stringify(problemDescription)}`,
    command.commandId
  );

  console.log(`主动咨询已提交给 Agent B`);

  return NextResponse.json({
    success: true,
    message: '咨询已提交给 Agent B',
    data: {
      commandId: command.commandId,
      helpRecord
    }
  });
}

/**
 * 处理 TS 提醒回复
 */
async function handleTSResponse(
  command: any,
  response?: string
) {
  if (!response) {
    return NextResponse.json(
      { error: '缺少回复内容' },
      { status: 400 }
    );
  }

  // 1. 记录回复
  const helpRecord = `${new Date().toISOString()} - TS 提醒回复：${response}`;

  await db
    .update(dailyTask)
    .set({
      helpRecord: `${command.helpRecord || ''}\n${helpRecord}`.trim(),
      updatedAt: new Date()
    })
    .where(eq(dailyTask.commandId, command.commandId));

  // 2. 判断是否遇到困难
  if (response.includes('困难') || response.includes('问题') || response.includes('阻塞')) {
    // 通知 Agent B 处理
    await TaskStateMachine.notifyAgent(
      'TS',
      'agent B',
      'system',
      `执行遇到困难`,
      `指令 ${command.commandId} TS 提醒回复遇到困难：${response}`,
      command.commandId
    );

    return NextResponse.json({
      success: true,
      message: '回复已记录，已通知 Agent B 处理困难'
    });
  }

  return NextResponse.json({
    success: true,
    message: '回复已记录'
  });
}

/**
 * 处理巡检回复
 */
async function handleInspectionResponse(
  command: any,
  response?: string
) {
  if (!response) {
    return NextResponse.json(
      { error: '缺少回复内容' },
      { status: 400 }
    );
  }

  // 1. 记录回复
  const helpRecord = `${new Date().toISOString()} - 巡检回复：${response}`;

  await db
    .update(dailyTask)
    .set({
      helpRecord: `${command.helpRecord || ''}\n${helpRecord}`.trim(),
      updatedAt: new Date()
    })
    .where(eq(dailyTask.commandId, command.commandId));

  // 2. 判断是否遇到困难
  if (response.includes('困难') || response.includes('问题') || response.includes('阻塞')) {
    // 通知 Agent B 处理
    await TaskStateMachine.notifyAgent(
      'agent B',
      'agent B',
      'system',
      `执行遇到困难`,
      `指令 ${command.commandId} 巡检回复遇到困难：${response}`,
      command.commandId
    );

    return NextResponse.json({
      success: true,
      message: '回复已记录，已通知 Agent B 处理困难'
    });
  }

  return NextResponse.json({
    success: true,
    message: '回复已记录'
  });
}

/**
 * 获取指令详情（包含咨询记录）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: commandId } = await params;

    // 查询指令详情
    const [command] = await db
      .select()
      .from(dailyTask)
      .where(eq(dailyTask.commandId, commandId));

    if (!command) {
      return NextResponse.json(
        { error: `指令 ${commandId} 不存在` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: command
    });

  } catch (error) {
    console.error('获取指令详情失败:', error);
    return NextResponse.json(
      { error: '获取指令详情失败' },
      { status: 500 }
    );
  }
}

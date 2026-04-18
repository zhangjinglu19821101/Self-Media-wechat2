import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { db } from '@/lib/db';
import { agentTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { wsServer } from '@/lib/websocket-server';

/**
 * POST /api/agents/cancel-command - 取消指令
 *
 * 请求体：
 * {
 *   taskId: "task-A-to-B-1770699956142",
 *   cancelReason: "指令发送错误，需要重新发送"
 * }
 *
 * 响应：
 * {
 *   success: true,
 *   message: "指令已取消",
 *   data: { taskId, cancelReason }
 * }
 */
export async function POST(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const body = await request.json();
    const { taskId, cancelReason } = body;

    if (!taskId) {
      return NextResponse.json(
        { success: false, error: '缺少必填参数：taskId' },
        { status: 400 }
      );
    }

    if (!cancelReason) {
      return NextResponse.json(
        { success: false, error: '缺少必填参数：cancelReason' },
        { status: 400 }
      );
    }

    console.log(`📥 收到取消指令请求: taskId=${taskId}, reason=${cancelReason}`);

    // 1. 查询任务是否存在
    const tasks = await db
      .select()
      .from(agentTasks)
      .where(eq(agentTasks.taskId, taskId));

    if (tasks.length === 0) {
      console.log(`❌ 任务不存在: ${taskId}`);
      return NextResponse.json(
        { success: false, error: '任务不存在' },
        { status: 404 }
      );
    }

    const task = tasks[0];

    // 2. 检查任务状态，只有待处理和执行中的任务可以取消
    if (task.taskStatus === 'completed' || task.taskStatus === 'cancelled' || task.taskStatus === 'failed') {
      console.log(`❌ 任务状态不允许取消: ${task.taskStatus}`);
      return NextResponse.json(
        { success: false, error: `任务状态为 ${task.taskStatus}，不允许取消` },
        { status: 400 }
      );
    }

    // 3. 更新任务状态为已取消
    await db
      .update(agentTasks)
      .set({
        taskStatus: 'cancelled',
        remarks: `${task.remarks || ''}\n\n【取消记录】\n取消时间：${new Date().toLocaleString('zh-CN')}\n取消原因：${cancelReason}`,
      })
      .where(eq(agentTasks.taskId, taskId));

    console.log(`✅ 任务状态已更新为 cancelled: ${taskId}`);

    // 4. 通过 WebSocket 通知目标 Agent 停止执行
    const executor = task.executor;
    const fromAgentId = task.fromAgentId;

    const wsMessage = {
      type: 'command_cancelled' as const,
      taskId,
      fromAgentId,
      toAgentId: executor,
      cancelReason,
      timestamp: new Date().toISOString(),
    };

    wsServer.sendToAgent(executor, wsMessage);
    console.log(`📡 已通知 ${executor} 停止执行: ${taskId}`);

    // 5. 返回成功响应
    return NextResponse.json({
      success: true,
      message: '指令已取消',
      data: {
        taskId,
        cancelReason,
        cancelledAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('❌ 取消指令时出错:', error);
    return NextResponse.json(
      {
        success: false,
        error: '取消指令失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

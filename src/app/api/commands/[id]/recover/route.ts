import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dailyTask } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { TaskStateMachine } from '@/lib/services/task-state-machine';

/**
 * 恢复失败的指令
 *
 * POST /api/commands/:id/recover
 *
 * 请求体：
 * {
 *   "reason": "恢复原因（可选）",
 *   "recoveredBy": "恢复操作者（可选）"
 * }
 *
 * 功能：
 * 1. 验证指令存在性
 * 2. 检查指令状态是否可以恢复（必须是 failed）
 * 3. 检查所有子任务是否都已完成或跳过
 * 4. 更新指令状态为 'in_progress'
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: commandId } = await params;
    const body = await request.json();
    const { reason = '用户恢复', recoveredBy = 'user' } = body;

    console.log(`🔄 恢复指令`);
    console.log(`  📍 指令 ID: ${commandId}`);
    console.log(`  📋 恢复原因: ${reason}`);

    // 查询指令获取其 UUID
    const commands = await db
      .select()
      .from(dailyTask)
      .where(eq(dailyTask.commandId, commandId));

    if (commands.length === 0) {
      return NextResponse.json({
        success: false,
        error: '指令不存在',
        message: `指令 ID ${commandId} 不存在`,
      }, { status: 404 });
    }

    const command = commands[0];

    // 调用状态机的恢复方法
    const result = await TaskStateMachine.recoverCommand(
      command.id,
      reason,
      recoveredBy
    );

    return NextResponse.json({
      success: true,
      message: '指令已恢复',
      data: result.command,
    }, { status: 200 });
  } catch (error: any) {
    console.error(`❌ 恢复指令失败:`, error);

    return NextResponse.json({
      success: false,
      error: error.message,
      message: error.message,
    }, { status: 400 });
  }
}

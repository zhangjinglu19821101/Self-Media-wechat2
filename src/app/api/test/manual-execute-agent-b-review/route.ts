import { NextRequest, NextResponse } from 'next/server';
import { SubtaskExecutionEngine } from '@/lib/services/subtask-execution-engine';
import { db } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { agentSubTasks } from '@/lib/db/schema';

// 手动执行 Agent B 评审的 API 接口
export async function POST(request: NextRequest) {
  console.log('🔴🔴🔴 ========== 手动执行 Agent B 评审接口被调用 ========== 🔴🔴🔴');
  
  try {
    const { subtaskId } = await request.json();
    console.log('🔴 收到的 subtaskId:', subtaskId);

    if (!subtaskId) {
      return NextResponse.json({ error: '缺少 subtaskId 参数' }, { status: 400 });
    }

    // 查询任务
    console.log('🔴 开始查询任务...');
    const subtasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, subtaskId));

    console.log('🔴 查询到的任务数量:', subtasks.length);

    if (subtasks.length === 0) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }

    const subtask = subtasks[0];
    console.log('🔴 任务详情:', {
      id: subtask.id,
      status: subtask.status,
      orderIndex: subtask.orderIndex,
      taskTitle: subtask.taskTitle
    });

    // 创建引擎实例
    console.log('🔴 创建 SubtaskExecutionEngine 实例...');
    const engine = new SubtaskExecutionEngine();

    // 通过类型断言调用私有方法（只传一个参数）
    console.log('🔴 开始调用 executeAgentBReviewWorkflow...');
    const result = await (engine as any).executeAgentBReviewWorkflow(subtask);
    console.log('🔴 executeAgentBReviewWorkflow 调用完成，结果:', result);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('🔴🔴🔴 手动执行 Agent B 评审失败:', error);
    console.error('🔴🔴🔴 错误堆栈:', error instanceof Error ? error.stack : new Error().stack);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '执行失败' },
      { status: 500 }
    );
  }
}

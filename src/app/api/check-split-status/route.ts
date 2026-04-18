import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentTasks, dailyTask } from '@/lib/db/schema';
import { isWritingAgent } from '@/lib/agents/agent-registry';
import { eq } from 'drizzle-orm';

/**
 * POST /api/check-split-status
 * 检查任务是否已经完成拆解（避免重复弹框）
 *
 * 请求体：
 * {
 *   taskId: "agent-task-id",
 *   fromAgentId: "B" | "insurance-d"
 * }
 *
 * 返回：
 * {
 *   success: boolean,
 *   isAlreadyProcessed: boolean,
 *   message: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, fromAgentId } = body;

    console.log(`🔍 [check-split-status] 检查任务状态:`, { taskId, fromAgentId });

    if (!taskId) {
      return NextResponse.json(
        { success: false, error: '缺少必填参数：taskId' },
        { status: 400 }
      );
    }

    let isAlreadyProcessed = false;
    let checkType = '';

    if (fromAgentId === 'B') {
      // 检查 agent_tasks 表
      checkType = 'agent_tasks';
      console.log(`🔍 [check-split-status] 检查 agent_tasks 表...`);
      
      // 🔥 Agent B 的任务可能用 taskId 或 id（UUID）查询
      // 先尝试用 taskId 查询
      let task;
      [task] = await db
        .select()
        .from(agentTasks)
        .where(eq(agentTasks.taskId, taskId))
        .limit(1);
      
      // 如果没找到，再尝试用 id（UUID）查询
      if (!task) {
        console.log(`🔍 [check-split-status] 未用 taskId 找到，尝试用 id（UUID）查询...`);
        [task] = await db
          .select()
          .from(agentTasks)
          .where(eq(agentTasks.id, taskId))
          .limit(1);
      }

      if (task) {
        console.log(`🔍 [check-split-status] Agent B 任务状态:`, {
          splitStatus: task.splitStatus,
          taskStatus: task.taskStatus,
        });
        
        // 如果任务已经完成拆解或确认，就不再弹框
        if (
          task.splitStatus === 'completed' || 
          task.splitStatus === 'split_confirmed' ||
          task.taskStatus === 'split' ||
          task.taskStatus === 'confirmed' ||
          task.taskStatus === 'in_progress'
        ) {
          isAlreadyProcessed = true;
          console.log(`✅ [check-split-status] Agent B 任务已处理完成`);
        }
      }
    } else if (isWritingAgent(fromAgentId)) {
      // 检查 daily_task 表
      checkType = 'daily_task';
      console.log(`🔍 [check-split-status] 检查 daily_task 表 (fromAgentId=${fromAgentId})...`);
      
      // 🔥 写作类 Agent 的任务可能用 taskId 或 id（UUID）查询
      // 先尝试用 taskId 查询
      let task;
      [task] = await db
        .select()
        .from(dailyTask)
        .where(eq(dailyTask.taskId, taskId))
        .limit(1);
      
      // 如果没找到，再尝试用 id（UUID）查询
      if (!task) {
        console.log(`🔍 [check-split-status] 未用 taskId 找到，尝试用 id（UUID）查询...`);
        [task] = await db
          .select()
          .from(dailyTask)
          .where(eq(dailyTask.id, taskId))
          .limit(1);
      }

      if (task) {
        console.log(`🔍 [check-split-status] insurance-d 任务状态:`, {
          executionStatus: task.executionStatus,
          subTaskCount: task.subTaskCount,
        });
        
        // 如果任务已经不是 pending_review 状态或已有子任务，就不再弹框
        if (
          task.executionStatus !== 'pending_review' || 
          (task.subTaskCount && task.subTaskCount > 0)
        ) {
          isAlreadyProcessed = true;
          console.log(`✅ [check-split-status] insurance-d 任务已处理完成`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      isAlreadyProcessed,
      message: isAlreadyProcessed 
        ? '任务已处理完成，无需再弹框' 
        : '任务需要处理',
      checkType,
    });
  } catch (error) {
    console.error('❌ [check-split-status] 检查任务状态失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '检查任务状态失败',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

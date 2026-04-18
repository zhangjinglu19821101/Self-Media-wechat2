/**
 * GET /api/agents/tasks/by-command
 * 按主任务（指令）维度获取任务列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { db } from '@/lib/db';
import { agentSubTasks, agentSubTasksStepHistory } from '@/lib/db/schema';
import { eq, desc, exists, and } from 'drizzle-orm';

/**
 * 从 task_description 中提取用户原始指令
 * 格式示例："【大纲生成】...\n\n原始创作指令：基于给定的xxx..."
 */
function extractOriginalCommand(taskDescription: string | null): string {
  if (!taskDescription) return '';
  
  // 尝试匹配 "原始创作指令：" 或 "原始创作指令：" 后面的内容
  const patterns = [
    /原始创作指令[：:]\s*([\s\S]+)/,
    /原始指令[：:]\s*([\s\S]+)/,
    /核心指令[：:]\s*([\s\S]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = taskDescription.match(pattern);
    if (match && match[1]) {
      return match[1].trim().slice(0, 200); // 截取前200字符
    }
  }
  
  // 如果没找到，返回 task_description 本身（截取）
  return taskDescription.slice(0, 150);
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    console.log(`[by-command] 获取按主任务分组的任务列表`);

    let allTasks: any[];

    try {
      allTasks = await db
        .select({
          id: agentSubTasks.id,
          commandResultId: agentSubTasks.commandResultId,
          taskTitle: agentSubTasks.taskTitle,
          taskDescription: agentSubTasks.taskDescription,
          executor: agentSubTasks.fromParentsExecutor,
          status: agentSubTasks.status,
          orderIndex: agentSubTasks.orderIndex,
          executionResult: agentSubTasks.resultText,
          createdAt: agentSubTasks.createdAt,
          startedAt: agentSubTasks.startedAt,
          completedAt: agentSubTasks.completedAt,
          metadata: agentSubTasks.metadata,
        })
        .from(agentSubTasks)
        .where(
          exists(
            db.select({ id: agentSubTasksStepHistory.id })
              .from(agentSubTasksStepHistory)
              .where(
                and(
                  eq(agentSubTasksStepHistory.commandResultId, agentSubTasks.commandResultId),
                  eq(agentSubTasksStepHistory.stepNo, agentSubTasks.orderIndex)
                )
              )
          )
        )
        .orderBy(desc(agentSubTasks.createdAt));
    } catch (queryError) {
      console.error('[by-command] 查询失败，降级:', queryError);
      allTasks = await db
        .select({
          id: agentSubTasks.id,
          commandResultId: agentSubTasks.commandResultId,
          taskTitle: agentSubTasks.taskTitle,
          taskDescription: agentSubTasks.taskDescription,
          executor: agentSubTasks.fromParentsExecutor,
          status: agentSubTasks.status,
          orderIndex: agentSubTasks.orderIndex,
          executionResult: agentSubTasks.resultText,
          createdAt: agentSubTasks.createdAt,
          startedAt: agentSubTasks.startedAt,
          completedAt: agentSubTasks.completedAt,
          metadata: agentSubTasks.metadata,
        })
        .from(agentSubTasks)
        .orderBy(desc(agentSubTasks.createdAt))
        .limit(50);
    }

    if (!Array.isArray(allTasks)) allTasks = [];
    console.log(`[by-command] 找到 ${allTasks.length} 个有交互历史的子任务`);

    // 按 command_result_id 分组
    const groupedByCommand = new Map<string, any[]>();
    for (const task of allTasks) {
      const key = task.commandResultId;
      if (!key) continue;
      if (!groupedByCommand.has(key)) groupedByCommand.set(key, []);
      groupedByCommand.get(key)!.push(task);
    }

    // 构建返回数据
    const commands: any[] = [];
    for (const [commandId, subTasks] of groupedByCommand.entries()) {
      const sorted = [...subTasks].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

      // 🔥 从第一个子任务的 task_description 中提取用户原始指令
      const originalCommand = extractOriginalCommand(sorted[0]?.taskDescription);

      // 🔥 两阶段流程：分别计算第一阶段和第二阶段的状态
      const phase1Tasks = sorted.filter(t => (t.orderIndex || 0) <= 1);
      const phase2Tasks = sorted.filter(t => (t.orderIndex || 0) >= 2);
      
      const phase1Complete = phase1Tasks.length > 0 && phase1Tasks.every(t => t.status === 'completed');
      const phase2Exists = phase2Tasks.length > 0;
      const phase2Complete = phase2Exists && phase2Tasks.every(t => t.status === 'completed');
      
      // 判断当前所处阶段
      let currentPhase = 'creation'; // 默认第一阶段
      if (phase1Complete && phase2Exists) {
        currentPhase = phase2Complete ? 'completed' : 'publishing';
      }

      const allCompleted = sorted.every(t => t.status === 'completed');
      const anyFailed = sorted.some(t => t.status === 'failed');
      const anyWaitingUser = sorted.some(t => t.status === 'waiting_user');
      const anyInProgress = sorted.some(t => t.status === 'in_progress');

      let overallStatus = 'pending';
      if (anyWaitingUser) overallStatus = 'waiting_user';
      else if (anyInProgress) overallStatus = 'in_progress';
      else if (anyFailed) overallStatus = 'failed';
      else if (allCompleted) overallStatus = 'completed';
      // 🔥 特殊状态：第一阶段完成，等待用户触发第二阶段
      else if (phase1Complete && !phase2Exists) overallStatus = 'ready_to_publish';

      commands.push({
        commandId,
        // 🔥 使用提取的原始指令作为标题
        title: originalCommand || sorted[0]?.taskTitle || `任务组 ${String(commandId).slice(0, 8)}`,
        description: sorted[0]?.taskDescription?.slice(0, 100) || '',
        originalCommand, // 原始指令完整版
        overallStatus,
        // 🔥 两阶段信息
        currentPhase,
        phase1Complete,
        phase2Exists,
        phase2Complete,
        subTaskCount: sorted.length,
        completedCount: sorted.filter(t => t.status === 'completed').length,
        subTasks: sorted,
        createdAt: sorted[0]?.createdAt,
      });
    }

    commands.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    let filteredCommands = commands;
    if (status && status !== 'all') {
      filteredCommands = commands.filter(c => c.overallStatus === status);
    }

    console.log(`[by-command] 返回 ${filteredCommands.length} 个主任务`);

    return NextResponse.json({
      success: true,
      data: {
        commands: filteredCommands,
        total: filteredCommands.length,
        totalSubTasks: filteredCommands.reduce((sum, c) => sum + c.subTaskCount, 0),
      },
    });
  } catch (error) {
    console.error('[by-command] 获取失败:', error);
    return NextResponse.json(
      { success: false, error: '获取任务列表失败' },
      { status: 500 }
    );
  }
}

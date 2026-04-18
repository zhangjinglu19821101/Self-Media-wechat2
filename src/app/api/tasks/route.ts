/**
 * 任务 API 接口
 * POST /api/tasks - 创建任务（人确认后入库）
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentTasks } from '@/lib/db/schema';
import { TaskStateMachine, TaskStatusConst } from '@/lib/services/task-state-machine';
import { TaskVectorSync } from '@/lib/services/task-vector-sync';
import { createAgentTaskWithDuplicateCheck } from '@/lib/services/command-result-service';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/context';

/**
 * 创建任务（人确认后入库）
 * 
 * 🔥 新增参数：
 * - userOpinion: 用户核心观点（可选）
 * - materialIds: 关联素材ID列表（可选）
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { workspaceId } = authResult;

    const body = await request.json();

    // 解构请求参数
    const {
      taskName,
      coreCommand,
      executor,
      taskDurationStart,
      taskDurationEnd,
      totalDeliverables,
      taskPriority = 'normal',
      fromAgentId = 'user',
      // 🔥 新增：用户观点和素材
      userOpinion,
      materialIds
    } = body;

    // 参数校验
    if (!taskName || !coreCommand || !executor || !taskDurationStart || !taskDurationEnd || !totalDeliverables) {
      return NextResponse.json(
        { error: '缺少必要参数：taskName, coreCommand, executor, taskDurationStart, taskDurationEnd, totalDeliverables' },
        { status: 400 }
      );
    }

    // 生成任务ID
    const taskId = `task-${fromAgentId}-to-${executor}-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;

    // 🔥 日志：记录用户观点和素材
    if (userOpinion) {
      console.log(`🔥 [api/tasks] 用户观点: ${userOpinion.substring(0, 100)}...`);
    }
    if (materialIds && materialIds.length > 0) {
      console.log(`🔥 [api/tasks] 关联素材: ${materialIds.length} 个`);
    }

    // 1. 使用带防重功能的方法创建任务
    console.log(`🔍 [api/tasks] 准备创建任务: ${taskId}`);
    const result = await createAgentTaskWithDuplicateCheck({
      taskId,
      taskName,
      coreCommand,
      executor,
      fromAgentId,
      toAgentId: body.toAgentId || 'agent B',
      acceptanceCriteria: body.acceptanceCriteria || '待定义',
      taskType: body.taskType || 'daily',
      splitStatus: 'splitting',
      splitStartTime: new Date(),
      taskDurationStart: new Date(taskDurationStart),
      taskDurationEnd: new Date(taskDurationEnd),
      totalDeliverables: totalDeliverables?.toString() || '0',
      taskPriority: taskPriority,
      taskStatus: body.taskStatus || TaskStatusConst.UNSPLIT,
      creator: fromAgentId,
      updater: 'TS',
      commandType: 'instruction',
      metadata: body.metadata || {},
      timeWindowDays: 7,
      // 🔥 新增：用户观点和素材
      userOpinion: userOpinion || null,
      materialIds: materialIds || [],
      workspaceId,
    });

    if (result.isDuplicate) {
      console.log(`⚠️ [api/tasks] 检测到重复任务: ${taskId}`);
      
      // 从重复检测结果中获取第一个已存在的任务
      const duplicateTask = result.duplicateTasks?.[0];
      console.log(`📋 [api/tasks] 使用已存在的任务: ${duplicateTask?.taskId}`);
      
      // 查询完整的任务信息
      let existingTask = null;
      if (duplicateTask?.taskId) {
        const tasks = await db
          .select()
          .from(agentTasks)
          .where(eq(agentTasks.taskId, duplicateTask.taskId))
          .limit(1);
        existingTask = tasks?.[0] || null;
      }
      
      return NextResponse.json({
        success: true,
        message: '检测到重复任务，已跳过创建',
        data: existingTask || duplicateTask || result.data,
        isDuplicate: true,
      });
    }

    const newTask = result.data!;
    console.log(`✅ [api/tasks] 任务已创建: taskId=${taskId}`);

    // 3. 同步到向量库（暂时禁用）
    /*
    try {
      await TaskVectorSync.syncTaskToVector(taskId);
    } catch (error) {
      console.error('向量同步失败:', error);
      // 不阻塞任务创建，仅记录错误
    }
    */

    // 🔥 修复：不在 API 中自动通知 Agent B，由前端通过 sendCommandToAgent 通知
    console.log(`任务 ${taskId} 已创建，等待前端发送拆解指令`);

    return NextResponse.json({
      success: true,
      data: newTask,
      message: '任务已创建'
    });

  } catch (error) {
    console.error('创建任务失败:', error);
    return NextResponse.json(
      { error: '创建任务失败', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * 获取任务列表
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { workspaceId } = authResult;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const executor = searchParams.get('executor');

    // 构建查询条件 - workspace 隔离
    const conditions = [eq(agentTasks.workspaceId, workspaceId)];
    if (status) {
      conditions.push(eq(agentTasks.taskStatus, status));
    }
    if (executor) {
      conditions.push(eq(agentTasks.executor, executor));
    }

    // 查询任务列表
    const tasks = await db
      .select()
      .from(agentTasks)
      .where(and(...conditions))
      .orderBy(agentTasks.createdAt);

    return NextResponse.json({
      success: true,
      data: tasks,
      total: tasks.length
    });

  } catch (error) {
    console.error('获取任务列表失败:', error);
    return NextResponse.json(
      { error: '获取任务列表失败' },
      { status: 500 }
    );
  }
}

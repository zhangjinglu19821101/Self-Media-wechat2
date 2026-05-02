/**
 * Agent 子任务管理 API
 * 处理 Agent 拆分子任务、更新子任务进度等操作
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { db } from '@/lib/db';
import { dailyTask, agentSubTasks, agentInteractions } from '@/lib/db/schema';
import { commandResultService } from '@/lib/services/command-result-service';
import { eq, and, sql } from 'drizzle-orm';
import { splitTaskForAgent } from '@/lib/agent-llm';
import { generateSessionId } from '@/lib/session-id';
import { getCurrentBeijingTime } from '@/lib/utils/date-time';

/**
 * POST /api/agents/[id]/split-task
 * Agent 拆分子任务
 * 请求体：
 * - commandResultId: 任务 ID
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const { id: agentId } = await params;
    const body = await request.json();
    const { commandResultId, subTaskData, userOpinion, materialIds } = body;
    
    // 🔥 模式1：直接插入子任务数据（不调用 LLM）
    if (subTaskData) {
      console.log(`📦 Agent ${agentId} 直接插入子任务数据`);
      
      // 1. 创建或获取 commandResult
      let commandResultIdToUse = commandResultId;
      
      if (!commandResultIdToUse) {
        // 如果没有提供 commandResultId，使用带防重功能的方法创建
        const result = await commandResultService.createDailyTaskWithDuplicateCheck({
          commandId: `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          taskId: '',
          relatedTaskId: '',
          taskTitle: subTaskData.taskTitle,
          originalCommand: subTaskData.commandContent,
          taskDescription: subTaskData.commandContent,
          executor: subTaskData.executor,
          commandPriority: subTaskData.priority === '高' ? 'high' : 'normal',
          executionDeadlineStart: new Date(),
          executionDeadlineEnd: subTaskData.deadline ? new Date(subTaskData.deadline) : new Date(Date.now() + 24 * 60 * 60 * 1000),
          deliverables: '1',
          executionStatus: 'in_progress',
          splitter: 'B',
          entryUser: 'B',
          fromAgentId: 'B',
          toAgentId: subTaskData.executor,
          commandContent: subTaskData.commandContent,
          // 🔥 新增：传递用户观点和素材
          userOpinion: userOpinion || null,
          originalInstruction: body.originalInstruction || null, // 🔥 独立存储原始指令
          materialIds: materialIds || [],
        });
        
        if (result.isDuplicate) {
          console.log(`⚠️ [subtasks] 检测到重复任务，使用已有任务`);
        } else {
          console.log(`✅ [subtasks] 创建新的任务`);
        }
        
        commandResultIdToUse = result.data?.id;
        console.log(`✅ commandResult: ${commandResultIdToUse}`);
      }
      
      // 2. 插入子任务
      const subTaskId = crypto.randomUUID();
      await db.insert(agentSubTasks).values({
        id: subTaskId,
        commandResultId: commandResultIdToUse,
        fromParentsExecutor: subTaskData.executor,
        taskTitle: subTaskData.taskTitle,
        taskDescription: subTaskData.commandContent,
        status: 'pending',
        orderIndex: 1,
        // 🔥 新增：继承用户观点和素材
        userOpinion: userOpinion || null,
        originalInstruction: body.originalInstruction || null, // 🔥 独立存储原始指令
        materialIds: materialIds || [],
        // 🔥 Phase 6 多用户：工作空间归属
        workspaceId: authResult.workspaceId,
        metadata: {
          taskType: subTaskData.taskType,
          priority: subTaskData.priority,
          deadline: subTaskData.deadline,
          estimatedHours: subTaskData.estimatedHours,
          acceptanceCriteria: subTaskData.acceptanceCriteria,
        },
      });
      
      console.log(`✅ 子任务已插入 agent_sub_tasks 表: ${subTaskId}`);
      
      return NextResponse.json({
        success: true,
        subTaskId,
        commandResultId: commandResultIdToUse,
        message: `成功插入子任务`,
      });
    }
    
    // 🔥 模式2：LLM 拆分任务（原有逻辑）
    if (!commandResultId) {
      return NextResponse.json({
        success: false,
        error: '缺少必填字段',
        message: '缺少必填字段：commandResultId 或 subTaskData',
      }, { status: 400 });
    }
    
    console.log(`📦 Agent ${agentId} 开始拆分子任务，任务 ID: ${commandResultId}`);
    
    // 1. 查询任务信息
    const task = await db
      .select()
      .from(dailyTask)
      .where(eq(dailyTask.id, commandResultId))
      .then(rows => rows[0]);
    
    if (!task) {
      return NextResponse.json({
        success: false,
        error: '任务不存在',
        message: `任务 ID ${commandResultId} 不存在`,
      }, { status: 404 });
    }
    
    // 2. 检查是否已经拆分过
    if (task.subTaskCount && task.subTaskCount > 0) {
      return NextResponse.json({
        success: false,
        error: '任务已拆分',
        message: `任务已拆分，子任务数量：${task.subTaskCount}`,
      }, { status: 400 });
    }
    
    // 3. 调用 LLM 让 agent 拆分任务
    console.log(`🔍 调用 LLM 让 Agent ${agentId} 拆分任务...`);
    
    const splitResult = await splitTaskForAgent(agentId, task);
    const subTasks = splitResult.subTasks;
    const productTags = splitResult.productTags;
    
    console.log(`✅ Agent ${agentId} 拆分完成，子任务数量：${subTasks.length}，产品标签：${productTags.join(', ')}`);
    
    // 4. 插入子任务到 agent_sub_tasks 表
    for (let i = 0; i < subTasks.length; i++) {
      console.log(`📝 插入子任务 ${i + 1}/${subTasks.length}:`, {
        commandResultId,
        agentId,
        taskTitle: subTasks[i].title,
        isCritical: subTasks[i].isCritical,
      });

      await db.insert(agentSubTasks).values({
        commandResultId,
        fromParentsExecutor: subTasks[i].executor || agentId, // 使用 LLM 返回的 executor，如果没有则默认为当前 agent
        taskTitle: subTasks[i].title,
        taskDescription: subTasks[i].description,
        status: 'pending',
        orderIndex: subTasks[i].orderIndex, // 使用 LLM 返回的 orderIndex
        // 🔥 新增：从父任务继承用户观点和素材
        userOpinion: (task as any).userOpinion || null,
        originalInstruction: (task as any).originalInstruction || null, // 🔥 独立存储原始指令
        materialIds: (task as any).materialIds || [],
        // 🔥 Phase 6 多用户：从父任务继承 workspaceId
        workspaceId: task.workspaceId || authResult.workspaceId,
        metadata: {
          acceptanceCriteria: subTasks[i].acceptanceCriteria,
          isCritical: subTasks[i].isCritical || false, // 🔥 关键子任务标记
          criticalReason: subTasks[i].criticalReason || '', // 🔥 关键原因
          executor: subTasks[i].executor || agentId, // 🔥 记录执行者
        },
      });
    }
    
    // 5. 更新 commandresult 表
    await db.update(dailyTask)
      .set({
        subTaskCount: subTasks.length,
        completedSubTasks: 0,
        completedSubTasksDescription: '',
        executionStatus: 'in_progress',
      })
      .where(eq(dailyTask.id, commandResultId));
    
    // 6. 创建拆分记录
    const sessionId = generateSessionId('task_assignment', agentId);
    
    await db.insert(agentInteractions).values({
      commandResultId,
      taskDescription: task.taskName || task.commandContent?.substring(0, 100),
      sessionId,
      sender: agentId,
      messageType: 'notification',
      content: `已拆分任务为 ${subTasks.length} 个子任务`,
      roundNumber: 1,
      metadata: {
        action: 'split_task',
        subTaskCount: subTasks.length,
      },
    });
    
    console.log(`✅ 子任务创建完成`);
    
    return NextResponse.json({
      success: true,
      subTaskCount: subTasks.length,
      productTags,
      subTasks,
      message: `成功拆分 ${subTasks.length} 个子任务`,
    });
  } catch (error) {
    console.error('❌ 拆分子任务失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
      message: '拆分子任务失败',
    }, { status: 500 });
  }
}

/**
 * PUT /api/agents/[id]/subtasks/:subtaskId
 * Agent 更新子任务进度
 * 请求体：
 * - status: 子任务状态
 * - completedAt: 完成时间（可选）
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const { id: agentId } = await params;
    const { status, completedAt, subtaskId } = await request.json();
    
    if (!status) {
      return NextResponse.json({
        success: false,
        error: '缺少必填字段',
        message: '缺少必填字段：status',
      }, { status: 400 });
    }
    
    console.log(`📝 Agent ${agentId} 更新子任务 ${subtaskId} 状态为 ${status}`);
    
    // 1. 查询子任务
    const subTask = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, subtaskId))
      .then(rows => rows[0]);
    
    if (!subTask) {
      return NextResponse.json({
        success: false,
        error: '子任务不存在',
        message: `子任务 ID ${subtaskId} 不存在`,
      }, { status: 404 });
    }
    
    // 2. 更新子任务状态
    const updateData: any = {
      status,
      updatedAt: getCurrentBeijingTime(),
    };
    
    if (status === 'in_progress' && !subTask.startedAt) {
      updateData.startedAt = getCurrentBeijingTime();
    }
    
    if (status === 'completed') {
      updateData.completedAt = completedAt || getCurrentBeijingTime();
    }
    
    await db.update(agentSubTasks)
      .set(updateData)
      .where(eq(agentSubTasks.id, subtaskId));
    
    // 3. 更新主任务的进度
    const allSubTasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.commandResultId, subTask.commandResultId));
    
    const completedCount = allSubTasks.filter(st => st.status === 'completed').length;
    
    await db.update(dailyTask)
      .set({
        completedSubTasks: completedCount,
        completedSubTasksDescription: subTask.taskTitle,
      })
      .where(eq(dailyTask.id, subTask.commandResultId));
    
    // 4. 如果所有子任务都完成了，更新主任务状态
    if (completedCount === allSubTasks.length) {
      await db.update(dailyTask)
        .set({
          executionStatus: 'completed',
          completedAt: new Date(),
        })
        .where(eq(dailyTask.id, subTask.commandResultId));
      
      console.log(`✅ 所有子任务已完成，主任务 ${subTask.commandResultId} 状态更新为 completed`);
    }
    
    console.log(`✅ 子任务更新完成，完成进度：${completedCount}/${allSubTasks.length}`);
    
    return NextResponse.json({
      success: true,
      completedCount,
      totalCount: allSubTasks.length,
      progress: Math.round((completedCount / allSubTasks.length) * 100),
      message: `子任务更新完成，完成进度：${completedCount}/${allSubTasks.length}`,
    });
  } catch (error) {
    console.error('❌ 更新子任务失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
      message: '更新子任务失败',
    }, { status: 500 });
  }
}

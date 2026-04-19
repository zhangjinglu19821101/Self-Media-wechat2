import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentTasks, agentSubTasks } from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { createNotification } from '@/lib/services/notification-service-v3';
import { splitTaskForAgent } from '@/lib/agent-llm';

/**
 * POST /api/agents/tasks/[taskId]/split
 * Agent B 拆分任务（支持单个任务和批量任务）
 * 
 * - 单个任务：使用 URL 中的 taskId
 * - 批量任务：使用 body 中的 taskIds 数组
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    let body: any = {};
    
    try {
      body = await request.json();
    } catch (e) {
      // body 可能为空，忽略
    }
    
    const taskIds = body.taskIds;
    
    // 检查是批量拆解还是单个任务拆解
    if (taskIds && Array.isArray(taskIds) && taskIds.length > 0) {
      console.log(`🔍 [split-task] 批量拆解 ${taskIds.length} 个任务:`, taskIds);
      return await handleBatchSplit(taskIds);
    } else {
      console.log('🔍 [split-task] 单个任务拆解:', taskId);
      return await handleSingleSplit(taskId);
    }
  } catch (error) {
    console.error('❌ [split-task] 拆分任务失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '拆分任务失败',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * 处理单个任务拆解
 */
async function handleSingleSplit(taskId: string) {
  // 查询任务
  const [task] = await db
    .select()
    .from(agentTasks)
    .where(eq(agentTasks.taskId, taskId));

  if (!task) {
    return NextResponse.json(
      { success: false, error: '任务不存在' },
      { status: 404 }
    );
  }

  // 验证任务状态
  const allowedStatuses = ['splitting', 'pending_split', 'split_rejected', 'split_pending_review'];
  if (!allowedStatuses.includes(task.splitStatus)) {
    return NextResponse.json(
      {
        success: false,
        error: '任务状态不允许拆解',
        currentStatus: task.splitStatus,
      },
      { status: 400 }
    );
  }

  // 调用 Agent B 的拆分逻辑
  console.log('🤖 [split-task] 调用 splitTaskForAgent 拆解任务...');
  const subTasks = await splitTaskForAgent('agent-b', task);
  console.log(`✅ [split-task] 拆解完成，子任务数量: ${subTasks.length}`);

  // 构建拆分结果格式
  const splitResult = {
    subTasks: subTasks.map((st, index) => ({
      taskTitle: st.title,
      title: st.title,
      description: st.description,
      commandContent: st.description,
      executor: st.executor,
      priority: st.priority || '中',
      deadline: st.deadline || new Date().toISOString().split('T')[0],
      estimatedHours: st.estimatedHours || 2,
      acceptanceCriteria: st.acceptanceCriteria,
      isCritical: st.isCritical,
      criticalReason: st.criticalReason,
    })),
    summary: `拆解任务为 ${subTasks.length} 个子任务`,
    totalDeliverables: subTasks.length.toString(),
    timeFrame: `${subTasks.length}步`,
  };

  // 更新任务
  const [updatedTask] = await db
    .update(agentTasks)
    .set({
      splitStatus: 'splitting',
      taskStatus: 'pending_review',
      metadata: {
        ...task.metadata,
        splitResult,
        splitAt: new Date().toISOString(),
        splitRejected: false,
      },
      updatedAt: new Date(),
    })
    .where(eq(agentTasks.taskId, taskId))
    .returning();

  // 创建通知给 Agent A
  const splitResultString = JSON.stringify(splitResult);
  
  await createNotification({
    agentId: 'A',
    type: 'agent_b_split_result',
    title: `Agent B 拆解完成: ${task.taskName}`,
    content: {
      fromAgentId: 'B',
      toAgentId: 'A',
      message: '拆解完成，请确认拆解方案',
      splitResult: splitResult,
    },
    result: splitResultString,
    relatedTaskId: taskId,
    fromAgentId: 'B',
    priority: 'high',
    metadata: {
      taskId: taskId,
      splitType: 'agent_b_split',
      subTaskCount: splitResult.subTasks?.length || 0,
      splitPopupStatus: null,
      originalTaskContent: task.metadata?.splitRequest?.originalContent || task.coreCommand || task.taskName || '',
      originalTaskTitle: task.taskName || '',
    },
  });

  return NextResponse.json({
    success: true,
    message: '任务拆分完成，等待确认',
    data: { task: updatedTask, splitResult },
  });
}

/**
 * 处理批量任务拆解
 * 按日期和执行者分组，同一天同一个执行者的所有任务合并在一起，一次性调用 LLM 拆解
 */
async function handleBatchSplit(taskIds: string[]) {
  console.log(`🔍 [batch-split] 开始批量拆解 ${taskIds.length} 个任务`);

  // 查询所有任务
  const tasks = await db
    .select()
    .from(agentTasks)
    .where(inArray(agentTasks.taskId, taskIds));

  if (tasks.length === 0) {
    return NextResponse.json(
      { success: false, error: '未找到任何任务' },
      { status: 404 }
    );
  }

  console.log(`📦 [batch-split] 找到 ${tasks.length} 个任务`);

  // 验证任务状态
  const allowedStatuses = ['splitting', 'pending_split', 'split_rejected', 'split_pending_review'];
  const validTasks = tasks.filter(task => allowedStatuses.includes(task.splitStatus));
  
  if (validTasks.length === 0) {
    return NextResponse.json(
      { success: false, error: '没有符合条件的任务可以拆解' },
      { status: 400 }
    );
  }

  console.log(`✅ [batch-split] 筛选出 ${validTasks.length} 个符合条件的任务`);

  // 使用北京时间计算今天日期
  const todayStr = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  // 按日期 + 执行者分组任务
  const tasksByDateAndAgent = validTasks.reduce((acc, task) => {
    // 从任务 metadata 或其他字段中获取日期和执行者
    const date = task.metadata?.dates?.[0] || todayStr;
    const executor = task.metadata?.splitRequest?.originalCommands?.[0]?.targetAgentId || 'unknown';
    const key = `${date}_${executor}`;
    
    if (!acc[key]) acc[key] = [];
    acc[key].push(task);
    return acc;
  }, {} as Record<string, typeof validTasks>);

  const groupKeys = Object.keys(tasksByDateAndAgent);
  console.log(`📊 [batch-split] 任务按日期+执行者分组:`, groupKeys.map(key => ({
    key,
    count: tasksByDateAndAgent[key].length,
  })));

  const allGroupResults: Array<{
    date: string;
    executor: string;
    tasks: typeof validTasks;
    totalSubTasks: number;
  }> = [];

  // 处理每个分组
  for (const groupKey of groupKeys) {
    const [date, executor] = groupKey.split('_');
    const groupTasks = tasksByDateAndAgent[groupKey];
    
    console.log(`\n🤖 [batch-split] 处理分组: ${date} + ${executor}, ${groupTasks.length} 个任务`);

    try {
      // 步骤1：更新该分组所有任务的状态为 splitting
      console.log(`   🔒 更新分组中 ${groupTasks.length} 个任务的状态为 splitting...`);
      for (const task of groupTasks) {
        const currentMetadata = task.metadata || {};
        const isRejected = currentMetadata.splitRejected === true;
        
        // 如果被拒绝了，先清除之前的拒绝标记
        if (isRejected) {
          console.log(`   🔄 任务 ${task.taskId} 已被拒绝，清除拒绝标记`);
        }
        
        await db
          .update(agentTasks)
          .set({
            splitStatus: 'splitting',
            taskStatus: 'pending_review',
            metadata: {
              ...currentMetadata,
              splitStartTime: new Date().toISOString(),
              splitRejected: false,
              rejectionReason: undefined,
            },
            updatedAt: new Date(),
          })
          .where(eq(agentTasks.taskId, task.taskId));
      }
      console.log(`   ✅ 分组中所有任务状态已更新为 splitting`);

      // 步骤2：合并该组所有任务的描述
      console.log(`   📝 合并分组任务描述...`);
      const combinedTaskDescription = groupTasks.map((task, index) => {
        return `## 任务 ${index + 1}：${task.taskName}

**任务 ID**: ${task.taskId}
**执行者**: ${executor}
**优先级**: ${task.taskPriority || 'normal'}

**任务描述**:
${task.coreCommand || ''}

**交付物**: ${task.taskName || ''}`;
      }).join('\n\n---\n\n');

      // 添加任务执行顺序说明
      const finalPrompt = `${combinedTaskDescription}

---

## 任务执行顺序说明

请根据任务之间的逻辑关系，制定所有子任务的执行优先级。
你可以根据任务的依赖关系和逻辑顺序，合理安排所有子任务的执行顺序（orderIndex）。
例如：任务1的子任务可以优先于任务2的子任务执行，或者交叉执行。`;

      console.log(`   ✅ 任务描述合并完成，长度: ${finalPrompt.length} 字符`);

      // 步骤3：创建一个虚拟任务用于调用 LLM
      const virtualTask = {
        id: `batch-${date}-${executor}-${Date.now()}`,
        taskId: `batch-${date}-${executor}`,
        taskTitle: `批量拆解 ${groupTasks.length} 个任务 (${date}, ${executor})`,
        taskName: `批量拆解 ${groupTasks.length} 个任务`,
        coreCommand: finalPrompt,
        executor: executor,
        taskPriority: groupTasks[0].taskPriority || 'normal',
        splitStatus: 'splitting',
        metadata: {},
      };

      // 步骤4：调用 LLM 一次性拆解该分组的所有任务
      console.log(`   🤖 调用 LLM 批量拆解 ${groupTasks.length} 个任务...`);
      const flatSubTasks = await splitTaskForAgent('agent-b', virtualTask as any);
      console.log(`   ✅ LLM 返回 ${flatSubTasks.length} 个扁平子任务`);

      // 步骤5：将扁平化的子任务平均分配给该分组的各个任务
      console.log(`   📦 分配子任务给 ${groupTasks.length} 个任务...`);
      const taskSubTaskMap: Record<string, typeof flatSubTasks> = {};
      
      // 初始化每个任务的子任务数组
      for (const task of groupTasks) {
        taskSubTaskMap[task.taskId] = [];
      }
      
      // 平均分配子任务
      for (let i = 0; i < flatSubTasks.length; i++) {
        const taskIndex = i % groupTasks.length;
        const targetTask = groupTasks[taskIndex];
        const subTask = flatSubTasks[i];
        
        // 重新计算该任务内部的 orderIndex
        const internalOrderIndex = taskSubTaskMap[targetTask.taskId].length + 1;
        
        taskSubTaskMap[targetTask.taskId].push({
          ...subTask,
          orderIndex: internalOrderIndex,
        });
      }
      
      console.log(`   ✅ 子任务分配完成:`, Object.entries(taskSubTaskMap).map(([taskId, subTasks]) => ({
        taskId,
        subTaskCount: subTasks.length,
      })));

      // 步骤6：为每个任务创建拆分结果和通知
      for (const task of groupTasks) {
        const subTasks = taskSubTaskMap[task.taskId] || [];
        
        // 构建该任务的拆分结果
        const splitResult = {
          subTasks: subTasks.map((st, index) => ({
            taskTitle: st.title,
            title: st.title,
            description: st.description,
            commandContent: st.description,
            executor: st.executor,
            priority: st.priority || '中',
            deadline: st.deadline || date,
            estimatedHours: st.estimatedHours || 2,
            acceptanceCriteria: st.acceptanceCriteria,
            isCritical: st.isCritical,
            criticalReason: st.criticalReason,
            orderIndex: st.orderIndex || index + 1,
          })),
          summary: `批量拆解任务为 ${subTasks.length} 个子任务`,
          totalDeliverables: subTasks.length.toString(),
          timeFrame: `${subTasks.length}步`,
          date: date,
          executor: executor,
          taskCount: groupTasks.length,
          totalSubTasks: flatSubTasks.length,
        };

        // 更新任务
        const currentMetadata = task.metadata || {};
        await db
          .update(agentTasks)
          .set({
            splitStatus: 'splitting',
            taskStatus: 'pending_review',
            metadata: {
              ...currentMetadata,
              splitResult,
              splitAt: new Date().toISOString(),
              splitRejected: false,
              groupDate: date,
              groupExecutor: executor,
            },
            updatedAt: new Date(),
          })
          .where(eq(agentTasks.taskId, task.taskId));

        // 创建通知给 Agent A
        const splitResultString = JSON.stringify(splitResult);
        
        await createNotification({
          agentId: 'A',
          type: 'agent_b_split_result',
          title: `Agent B 批量拆解完成: ${task.taskName} (${date}, ${executor})`,
          content: {
            fromAgentId: 'B',
            toAgentId: 'A',
            message: '批量拆解完成，请确认拆解方案',
            splitResult: splitResult,
          },
          result: splitResultString,
          relatedTaskId: task.taskId,
          fromAgentId: 'B',
          priority: 'high',
          metadata: {
            taskId: task.taskId,
            splitType: 'agent_b_batch_split',
            subTaskCount: splitResult.subTasks?.length || 0,
            taskCount: groupTasks.length,
            date: date,
            executor: executor,
            splitPopupStatus: null,
            originalTaskContent: groupTasks.map(t => `${t.taskName || ''}`).join('\n\n'),
            originalTaskTitle: `批量拆解 ${groupTasks.length} 个任务 (${date}, ${executor})`,
          },
        });

        console.log(`   ✅ 任务 ${task.taskId} 处理完成，${subTasks.length} 个子任务`);
      }

      allGroupResults.push({
        date,
        executor,
        tasks: groupTasks,
        totalSubTasks: flatSubTasks.length,
      });

    } catch (error) {
      console.error(`❌ [batch-split] 处理分组 ${groupKey} 失败:`, error);
    }
  }

  console.log(`✅ [batch-split] 批量拆解完成，共处理 ${allGroupResults.length} 个分组`);

  const totalTaskCount = allGroupResults.reduce((sum, group) => sum + group.tasks.length, 0);
  const totalSubTaskCount = allGroupResults.reduce((sum, group) => sum + group.totalSubTasks, 0);

  return NextResponse.json({
    success: true,
    message: `批量拆解完成，处理 ${totalTaskCount} 个任务，生成 ${totalSubTaskCount} 个子任务`,
    data: {
      groupCount: allGroupResults.length,
      totalTaskCount,
      totalSubTaskCount,
      groupResults: allGroupResults,
    },
  });
}

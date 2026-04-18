/**
 * 任务分配服务
 * Agent B 从 Agent A 的一周工作任务中，识别并下发属于 insurance-d 的任务
 */

import { db } from '@/lib/db';
import { dailyTask, agentSubTasks } from '@/lib/db/schema';
import { splitTaskForAgent } from '@/lib/agent-llm';
import { isWritingAgent } from '@/lib/agents/agent-registry';
import { getLLMClient } from '@/lib/agent-llm';
import { createUserLLMClient } from '@/lib/llm/factory';
import { eq, and, or, sql, inArray, count } from 'drizzle-orm';
import { createNotification } from '@/lib/services/notification-service-v3';
import { randomUUID } from 'crypto';

// ============================================
// 类型定义
// ============================================

/**
 * Agent A 的一周任务项
 */
export interface WeeklyTask {
  id: string;
  taskName: string;
  commandContent: string;
  executionDate: string; // YYYY-MM-DD
  executor: string; // 执行者，如 'insurance-d'
  priority: 'urgent' | 'normal';
  deadline: string;
  deliverables: string;
}

/**
 * Agent A 的一周工作任务列表
 */
export interface WeeklyTaskList {
  weekStart: string; // 周开始日期，YYYY-MM-DD
  weekEnd: string; // 周结束日期，YYYY-MM-DD
  tasks: WeeklyTask[];
}

/**
 * 任务识别结果
 */
export interface TaskIdentificationResult {
  taskId: string;
  taskName: string;
  belongsToInsuranceD: boolean;
  reason: string; // 为什么属于 insurance-d
  confidence: number; // 置信度 0-1
}

// ============================================
// 任务识别服务
// ============================================

/**
 * Agent B 识别属于 insurance-d 的任务
 * @param weeklyTasks Agent A 的一周工作任务列表
 * @returns 识别结果
 */
export async function identifyInsuranceDTasks(
  weeklyTasks: WeeklyTaskList
): Promise<TaskIdentificationResult[]> {
  console.log(`🔍 Agent B 开始识别属于 insurance-d 的任务...`);
  console.log(`📋 一周任务数量: ${weeklyTasks.tasks.length}`);

  // 构建识别 Prompt
  const taskListJson = JSON.stringify(weeklyTasks.tasks, null, 2);

  const prompt = `
# 你是 Agent B

你是一个任务分发专家，负责从 Agent A 的一周工作任务中，识别出需要下发给 insurance-d 执行的任务。

---

## insurance-d 的职责范围

insurance-d 是任务拆分与管理 agent，主要负责：
1. 任务拆解：将复杂任务拆分为多个可执行的子任务
2. 任务管理：管理和跟踪子任务的执行进度
3. 资源协调：协调不同 agent 之间的任务分配
4. 进度监控：监控任务进度，及时发现和解决问题

---

## Agent A 的一周工作任务

\`\`\`json
${taskListJson}
\`\`\`

---

## 你的任务

请分析上述任务列表，识别出哪些任务应该下发给 insurance-d 执行。

**识别标准：**

1. **任务包含"拆分"关键词**：任务名称或内容中包含"拆分"、"分解"、"分解为"、"拆解"等词汇
2. **任务包含"管理"关键词**：任务名称或内容中包含"管理"、"跟踪"、"监控"、"协调"等词汇
3. **任务复杂度高**：任务描述中提到复杂流程、多步骤、多协作等特征
4. **任务需要多 Agent 协作**：任务涉及多个 agent 的协同工作

**不属于 insurance-d 的任务：**
- 内容创作类（如"撰写文章"、"生成内容"）
- 简单执行类（如"收集数据"、"发送通知"）
- 单一 agent 可完成的任务

---

## 返回格式

请以 JSON 数组格式返回识别结果，每个元素包含以下字段：

\`\`\`json
[
  {
    "taskId": "任务 ID",
    "taskName": "任务名称",
    "belongsToInsuranceD": true/false,
    "reason": "识别理由（简短说明为什么属于或不属于 insurance-d）",
    "confidence": 0.8
  }
]
\`\`\`

**字段说明：**
- taskId: 对应任务列表中的 id 字段
- taskName: 对应任务列表中的 taskName 字段
- belongsToInsuranceD: 是否属于 insurance-d（true/false）
- reason: 识别理由（10-30 字）
- confidence: 置信度（0-1 之间的数字，表示判断的确定性）

**注意：**
- 返回**所有任务**的识别结果，不要过滤
- belongsToInsuranceD=true 的任务：需要下发给 insurance-d
- belongsToInsuranceD=false 的任务：需要 Agent B 自己拆解
- 置信度应该基于任务描述的明确程度，越明确的任务置信度越高
- 如果任务模糊不清，置信度应该较低
`;

  try {
    // BYOK: task-assignment 暂无 workspaceId 上下文，使用平台 Key
    const llm = getLLMClient();
    
    // 🔥 完整打印发送给 LLM 的提示词
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('📤 【任务识别】发送给 LLM 的完整提示词');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('🔧 调用参数:');
    console.log(`   温度: 0.2`);
    console.log('');
    
    const messages = [
      { role: 'system', content: prompt },
    ];
    
    messages.forEach((msg, index) => {
      console.log(`📋 消息 ${index + 1} [${msg.role.toUpperCase()}]:`);
      console.log('───────────────────────────────────────────────────────────────────────────────');
      console.log(msg.content);
      console.log('───────────────────────────────────────────────────────────────────────────────');
      console.log('');
    });

    console.log('📊 提示词统计:');
    console.log(`   - 消息数量: ${messages.length}`);
    console.log(`   - 总字符数: ${prompt.length}`);
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('');
    
    console.log(`🤖 正在调用 LLM 识别任务...`);

    const startTime = Date.now();
    const response = await llm.invoke(messages, {
      temperature: 0.2, // 较低的温度以获得更稳定的识别结果
    });
    const latency = Date.now() - startTime;

    // 🔥 完整打印 LLM 的返回结果
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('📥 【任务识别】LLM 返回的完整结果');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('⏱️  性能数据:');
    console.log(`   响应时间: ${latency}ms`);
    console.log('');

    // 记录 token 使用情况
    if (response.usage) {
      console.log('🔢 Token 使用情况:');
      console.log(`   输入: ${response.usage.input_tokens}`);
      console.log(`   输出: ${response.usage.output_tokens}`);
      console.log(`   总计: ${response.usage.total_tokens}`);
      console.log('');
    }

    console.log('📝 返回内容:');
    console.log('───────────────────────────────────────────────────────────────────────────────');
    console.log(response.content);
    console.log('───────────────────────────────────────────────────────────────────────────────');
    console.log('');

    console.log('📊 响应统计:');
    console.log(`   内容长度: ${response.content?.length || 0} 字符`);
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('');

    console.log(`✅ LLM 响应成功 (${latency}ms)`);

    // 解析 LLM 响应
    const content = response.content;
    console.log(`📄 LLM 返回内容长度: ${content.length} 字符`);

    let results: TaskIdentificationResult[];

    try {
      // 尝试提取 JSON 数组
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        results = JSON.parse(jsonMatch[0]);
        console.log(`✅ 成功解析 ${results.length} 个识别结果`);
      } else {
        throw new Error('No JSON array found in LLM response');
      }

      // 返回所有任务的识别结果
      console.log(`🎯 识别完成，共 ${results.length} 个任务`);
      console.log(`   - 属于 insurance-d: ${results.filter(r => r.belongsToInsuranceD).length} 个`);
      console.log(`   - 不属于 insurance-d: ${results.filter(r => !r.belongsToInsuranceD).length} 个`);

      return results;
    } catch (parseError) {
      console.error(`❌ 解析 LLM 响应失败:`, parseError);
      console.error(`📄 原始响应:`, content);
      throw new Error(`解析任务识别结果失败: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }
  } catch (error) {
    console.error(`❌ LLM 调用失败:`, error);
    throw new Error(`任务识别失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ============================================
// 任务下发服务
// ============================================

/**
 * Agent B 下发任务给 insurance-d
 * @param tasks 需要下发的任务列表
 * @returns 下发结果
 */
export async function assignTasksToInsuranceD(
  tasks: TaskIdentificationResult[]
): Promise<{ success: boolean; assignedCount: number; errors: string[] }> {
  console.log(`📤 Agent B 开始下发任务给 insurance-d...`);
  console.log(`📋 待下发任务数量: ${tasks.length}`);

  const errors: string[] = [];
  let assignedCount = 0;

  for (const task of tasks) {
    try {
      console.log(`📝 下发任务: ${task.taskName} (ID: ${task.taskId})`);

      // 查询任务详情
      const taskDetail = await db
        .select()
        .from(dailyTask)
        .where(eq(dailyTask.id, task.taskId))
        .limit(1);

      if (taskDetail.length === 0) {
        errors.push(`任务 ${task.taskId} 不存在`);
        continue;
      }

      const commandResult = taskDetail[0];

      // 检查是否已经下发给写作类 Agent
      const _isWritingAgent = isWritingAgent(commandResult.toAgentId);
      if (_isWritingAgent && commandResult.executionStatus !== 'new') {
        console.log(`⚠️ 任务 ${task.taskId} 已经下发给 ${commandResult.toAgentId}，跳过`);
        continue;
      }

      // 更新任务的下发信息
      await db
        .update(dailyTask)
        .set({
          toAgentId: 'insurance-d',
          executor: 'insurance-d',
          splitter: 'agent B',
          executionStatus: 'new', // 重置为 new 状态，让 insurance-d 重新处理
          updatedAt: new Date(),
        })
        .where(eq(dailyTask.id, task.taskId));

      console.log(`✅ 任务 ${task.taskId} 已下发给 insurance-d`);
      assignedCount++;
    } catch (error) {
      const errorMsg = `下发任务 ${task.taskId} 失败: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      errors.push(errorMsg);

      // 更新任务失败状态
      try {
        const currentMetadata = taskDetail.length > 0 ? taskDetail[0].metadata || {} : {};
        const failureCount = (currentMetadata.failureCount || 0) + 1;

        await db
          .update(dailyTask)
          .set({
            retryStatus: 'failed',
            remarks: errorMsg,
            metadata: {
              ...currentMetadata,
              failureReason: errorMsg,
              failureCount: failureCount,
              lastFailureAt: new Date().toISOString(),
              failures: [
                ...(currentMetadata.failures || []),
                {
                  time: new Date().toISOString(),
                  error: errorMsg,
                },
              ],
            },
            updatedAt: new Date(),
          })
          .where(eq(dailyTask.id, task.taskId));
      } catch (updateError) {
        console.error(`❌ 更新任务 ${task.taskId} 失败状态失败:`, updateError);
      }
    }
  }

  console.log(`✅ 任务下发完成: 成功 ${assignedCount} 个，失败 ${errors.length} 个`);

  return {
    success: errors.length === 0,
    assignedCount,
    errors,
  };
}

// ============================================
// insurance-d 拆解指令
// ============================================

/**
 * insurance-d 拆解属于自己的指令
 * @param commandResultId 指令 ID
 * @returns 拆解结果
 */
export async function insuranceDSplitTask(commandResultId: string) {
  console.log(`🔧 insurance-d 开始拆解指令: ${commandResultId}`);

  // 查询指令详情（在 try 块外部声明，以便 catch 块可以访问）
  let commandResult: any;

  try {
    // 查询指令详情
    const task = await db
      .select()
      .from(dailyTask)
      .where(eq(dailyTask.id, commandResultId))
      .limit(1);

    if (task.length === 0) {
      throw new Error(`指令 ${commandResultId} 不存在`);
    }

    commandResult = task[0];
    const metadata = commandResult.metadata || {};

    // 🔥 检查任务是否已被拒绝，如果是则清除之前的拆分数据，允许重新拆解
    const splitRejected = commandResult.metadata?.splitRejected;
    if (splitRejected) {
      console.log(`🔄 [insurance-d-split] 任务已被用户拒绝，准备重新拆解`);
      
      // 清除之前的拆分数据
      await db
        .update(dailyTask)
        .set({
          subTaskCount: 0,
          completedSubTasks: 0,
          updatedAt: new Date(),
        })
        .where(eq(dailyTask.id, commandResultId));
      
      // 删除之前的子任务
      await db
        .delete(agentSubTasks)
        .where(eq(agentSubTasks.commandResultId, commandResultId));
      
      console.log(`✅ [insurance-d-split] 已清除之前的拆分数据，允许重新拆解`);
    } else {
      // 🔥 只有在未被拒绝的情况下，才进行防重复检查
      
      // 🔥 防重复检查 1：检查 subTaskCount（原来的控制，保留）
      if (commandResult.subTaskCount && commandResult.subTaskCount > 0) {
        console.log(`⚠️ 指令 ${commandResultId} 已经拆分过，subTaskCount: ${commandResult.subTaskCount}`);
        return {
          success: true,
          message: '指令已拆分',
          subTaskCount: commandResult.subTaskCount,
        };
      }

      // 🔥 防重复检查 2：检查 execution_status（原来的控制，保留）
      if (commandResult.executionStatus === 'split_completed') {
        console.log(`⚠️ 指令 ${commandResultId} 状态为 split_completed，跳过`);
        return {
          success: false,
          message: '指令已完成拆分',
          subTaskCount: commandResult.subTaskCount || 0,
        };
      }

      // 🔥 防重复检查 3：额外查询 agent_sub_tasks 表（双重保障）
      const existingSubTasks = await db
        .select()
        .from(agentSubTasks)
        .where(eq(agentSubTasks.commandResultId, commandResultId))
        .limit(1);

      if (existingSubTasks.length > 0) {
        console.log(`⚠️ 指令 ${commandResultId} 的 agent_sub_tasks 表中已有数据，跳过`);
        // 统计实际子任务数量
        const countResult = await db
          .select({ count: count() })
          .from(agentSubTasks)
          .where(eq(agentSubTasks.commandResultId, commandResultId));
        const actualCount = Number(countResult[0]?.count || 0);
        return {
          success: true,
          message: '指令已拆分',
          subTaskCount: actualCount,
        };
      }
    }



    // 🔥 开始拆解：设置 executionStatus = 'splitting' + splitStartTime
    await db
      .update(dailyTask)
      .set({
        executionStatus: 'splitting', // 🔥 修改：开始拆解就设置为 splitting
        splitStartTime: sql`now()`, // 🔥 使用数据库当前时间，与 created_at 保持一致
        metadata: {
          ...metadata,
          splitStartTime: new Date().toISOString(),
        },
      })
      .where(eq(dailyTask.id, commandResultId));
    console.log(`🔒 已设置指令 ${commandResultId} 为拆解中 (splitting)`);

    // 调用任务拆解函数
    console.log(`🤖 调用 splitTaskForAgent 拆解任务...`);
    const subTasks = await splitTaskForAgent('insurance-d', commandResult);
    console.log(`✅ insurance-d 拆解完成，子任务数量: ${subTasks.length}`);

    // 🔥 注意：不立即插入子任务到数据库，等待用户弹框确认后才插入
    // 子任务数据通过通知传递给用户，用户确认后调用 /api/agent-sub-tasks/confirm-split 接口插入

    // 更新指令的子任务数量（executionStatus保持 in_progress，不修改）
    await db
      .update(dailyTask)
      .set({
        // executionStatus 保持 in_progress，不修改
        retryStatus: 'pending_review', // 🔥 更新重试状态为等待确认
        subTaskCount: subTasks.length,
        completedSubTasks: 0,
        updatedAt: new Date(),
      })
      .where(eq(dailyTask.id, commandResultId));

    console.log(`✅ 指令 ${commandResultId} 的子任务数量已更新为 ${subTasks.length}`);

    // 🔥 拆解完成：保持 executionStatus = splitting，等待用户确认
    await db
      .update(dailyTask)
      .set({
        retryStatus: 'pending_review', // 🔥 保持 retry_status = pending_review
        metadata: {
          ...(commandResult.metadata || {}),
          splitCompletedAt: new Date().toISOString(), // 🔥 记录拆解完成时间
          lastSplitAt: new Date().toISOString(), // 🔥 记录最后一次拆解时间
          // 🔥 清除临时标记
          splitRejected: undefined,
        },
      })
      .where(eq(dailyTask.id, commandResultId));
    console.log(`🔓 已完成拆分，保持 splitting 状态等待用户确认: ${commandResultId}`);

    // 🔥 创建通知给 Agent A，告知 insurance-d 拆解完成
    console.log(`📢 创建通知给 Agent A: insurance-d 拆解完成`);
    
    // 🔥 构建统一的拆解结果格式，确保与 Agent B 一致
    const splitResultData = {
      subTasks: subTasks.map(st => ({
        taskTitle: st.title,  // 统一字段名
        title: st.title,  // 支持两种写法
        description: st.description,
        commandContent: st.description,  // 支持两种写法
        executor: st.executor,
        priority: st.priority || '中',  // 默认优先级
        deadline: st.deadline || new Date().toISOString().split('T')[0],  // 默认今天
        estimatedHours: st.estimatedHours || 2,  // 默认2小时
        acceptanceCriteria: st.acceptanceCriteria,
        isCritical: st.isCritical,
        criticalReason: st.criticalReason,
      })),
      summary: `拆解任务为 ${subTasks.length} 个子任务`,
      totalDeliverables: subTasks.length.toString(),
      timeFrame: `${subTasks.length}步`,
    };
    
    // 🔥 关键：保存第一次拆解结果到 metadata.splitResult（这样二次拆解才能依据它！）
    await db
      .update(dailyTask)
      .set({
        metadata: {
          ...metadata,
          splitResult: splitResultData, // 🔥 保存拆解结果！
          splitAt: new Date().toISOString(),
        },
      })
      .where(eq(dailyTask.id, commandResultId));
    console.log(`✅ 已保存拆解结果到 metadata.splitResult`);
    
    await createNotification({
      agentId: 'A', // Agent A 接收通知
      type: 'insurance_d_split_result', // 通知类型
      title: `insurance-d 拆解完成: ${commandResult.taskTitle}`,
      content: {
        fromAgentId: 'insurance-d',
        toAgentId: 'A',
        // 🔥 关键：同时设置 result 和 splitResult，确保兼容性
        result: JSON.stringify(splitResultData),
        splitResult: splitResultData,
      },
      relatedTaskId: commandResultId, // 使用 UUID
      fromAgentId: 'insurance-d',
      priority: 'high',
      metadata: {
        dailyTaskId: commandResultId, // 保存 UUID
        taskId: commandResult.taskId, // 保存 task_id
        subTaskCount: subTasks.length,
        splitType: 'insurance_d_split',
        splitPopupStatus: null, // 🔥 初始状态为 null（待显示弹框）
        // 🔥 优先从 metadata 中获取完整的原任务内容，与 Agent B 保持一致
        originalTaskContent: metadata?.splitRequest?.originalContent || commandResult.taskContent || commandResult.taskDescription || '',
        originalTaskTitle: commandResult.taskTitle || '', // 🔥 新增：保存原任务标题
      },
    });
    console.log(`✅ 通知已创建: insurance-d -> A`);

    return {
      success: true,
      subTaskCount: subTasks.length,
      firstSubTaskStarted: true,
      subTasks: subTasks.map(task => ({
        orderIndex: task.orderIndex,
        title: task.title,
        executor: task.executor,
        isCritical: task.isCritical,
      })),
    };
  } catch (error) {
    console.error(`❌ insurance-d 拆解指令失败:`, error);
    
    // 🔥 异常处理：保持 splitting 状态，依赖定时任务超时重试
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    console.log(`⚠️ 拆解异常，保持 splitting 状态，等待超时重试`);
    await db
      .update(dailyTask)
      .set({
        metadata: {
          ...(commandResult.metadata || {}),
          splitFailedAt: new Date().toISOString(),
          splitFailureReason: errorMessage,
        },
        updatedAt: new Date(),
      })
      .where(eq(dailyTask.id, commandResultId));
    
    throw new Error(`拆解失败: ${errorMessage}`);
  }
}

// ============================================
// 🔥 新增：批量拆解任务
// ============================================

/**
 * insurance-d 批量拆解任务
 * @param taskIds 任务 ID 数组（daily_task 的 id）
 */
// 判断是否使用 mock 版本
const USE_MOCK = process.env.USE_MOCK_INSURANCE_D === 'true'; // 🔥 仅在显式设置时才使用 mock

/**
 * Mock 版本的拆解结果生成器
 */
function generateMockSplitResult(groupTasks: any[], date: string, executor: string) {
  console.log(`🎭 [Mock] 生成 ${groupTasks.length} 个任务的 mock 拆解结果`);
  
  const mockSubTasks = [];
  
  // 为每个任务生成 3-5 个 mock 子任务
  for (let taskIndex = 0; taskIndex < groupTasks.length; taskIndex++) {
    const task = groupTasks[taskIndex];
    const subTaskCount = 3 + Math.floor(Math.random() * 3); // 3-5 个子任务
    
    for (let i = 0; i < subTaskCount; i++) {
      mockSubTasks.push({
        orderIndex: mockSubTasks.length + 1,
        title: `[Mock] ${task.taskTitle} - 子任务 ${i + 1}`,
        description: `这是 mock 生成的子任务描述，用于测试拆解流程。原任务：${task.taskTitle}`,
        executor: i % 2 === 0 ? 'insurance-d' : 'insurance-c',
        deadline: date,
        priority: i === 0 ? 'urgent' : 'normal',
        estimatedHours: 1 + Math.floor(Math.random() * 3),
        acceptanceCriteria: `完成 ${task.taskTitle} 的第 ${i + 1} 步`,
        isCritical: i === 0,
        criticalReason: i === 0 ? '这是第一个关键步骤' : undefined,
      });
    }
  }
  
  console.log(`🎭 [Mock] 生成了 ${mockSubTasks.length} 个子任务`);
  return mockSubTasks;
}

/**
 * Mock 版本的 insurance-d 批量拆解任务
 * 用于开发环境，节约 Coze 使用成本
 */
async function mockInsuranceDBatchSplitTask(taskIds: string[]) {
  console.log(`🎭 [Mock] 开始 mock 批量拆解 ${taskIds.length} 个任务`);
  
  try {
    // 查询所有任务详情
    const tasks = await db
      .select()
      .from(dailyTask)
      .where(inArray(dailyTask.id, taskIds));

    if (tasks.length === 0) {
      throw new Error(`未找到任何任务`);
    }

    console.log(`🎭 [Mock] 找到 ${tasks.length} 个任务`);

    // 使用北京时间计算今天日期
    const todayStr = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    
    // 筛选需要处理的任务（简化版）
    const validTasks = tasks.filter(task => {
      // 🔥 关键修复：检查 splitRejected 标记，如果被拒绝了则允许重新拆解
      const isRejected = task.metadata?.splitRejected === true;
      
      // 基础条件
      const _isWritingAgent = isWritingAgent(task.executor);
      
      // 状态条件：pending_review 或 splitting，或者被拒绝了
      const isStatusValid = 
        task.executionStatus === 'pending_review' || 
        task.executionStatus === 'splitting' ||
        isRejected;
      
      // 子任务条件：没有子任务，或者被拒绝了（被拒绝时会清除子任务）
      const hasNoSubTasks = !task.subTaskCount || task.subTaskCount === 0;
      
      return _isWritingAgent && isStatusValid && (hasNoSubTasks || isRejected);
    });
    
    if (validTasks.length === 0) {
      return {
        success: false,
        message: '没有符合条件的任务可以处理',
        processedCount: 0,
      };
    }
    
    console.log(`🎭 [Mock] 筛选出 ${validTasks.length} 个符合条件的任务`);

    // 按日期 + agent 分组任务（简化版）
    const tasksByDateAndAgent = validTasks.reduce((acc, task) => {
      const date = todayStr;
      const executor = task.executor || 'unknown';
      const key = `${date}_${executor}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(task);
      return acc;
    }, {} as Record<string, typeof tasks>);

    const groupKeys = Object.keys(tasksByDateAndAgent);
    console.log(`🎭 [Mock] 任务按日期+agent分组:`, groupKeys);

    const allGroupResults: Array<{
      date: string;
      executor: string;
      tasks: typeof tasks;
      totalSubTasks: number;
    }> = [];

    for (const groupKey of groupKeys) {
      const [date, executor] = groupKey.split('_');
      const groupTasks = tasksByDateAndAgent[groupKey];
      
      console.log(`🎭 [Mock] 处理分组: ${date} + ${executor}, ${groupTasks.length} 个任务`);

      try {
        // 更新任务状态为 splitting
        for (const task of groupTasks) {
          const currentMetadata = task.metadata || {};
          const isRejected = currentMetadata.splitRejected === true;
          
          // 如果被拒绝了，先清除之前的子任务数据
          if (isRejected) {
            console.log(`🎭 [Mock] 任务 ${task.id} 已被拒绝，清除之前的子任务数据`);
            await db
              .update(dailyTask)
              .set({
                subTaskCount: 0,
                completedSubTasks: 0,
                updatedAt: new Date(),
              })
              .where(eq(dailyTask.id, task.id));
            
            // 删除之前的子任务
            await db
              .delete(agentSubTasks)
              .where(eq(agentSubTasks.commandResultId, task.id));
          }
          
          await db
            .update(dailyTask)
            .set({
              executionStatus: 'splitting',
              splitStartTime: sql`now()`,
              metadata: {
                ...currentMetadata,
                splitStartTime: new Date().toISOString(),
                splitRejected: false, // 🔥 清除拒绝标记
                rejectionReason: undefined, // 🔥 清除拒绝原因
              },
              updatedAt: sql`now()`,
            })
            .where(eq(dailyTask.id, task.id));
        }
        console.log(`🎭 [Mock] 分组中所有任务状态已更新为 splitting`);

        // 生成 mock 子任务
        const flatSubTasks = generateMockSplitResult(groupTasks, date, executor);

        // 将子任务平均分配给各个任务
        const taskSubTaskMap: Record<string, typeof flatSubTasks> = {};
        for (const task of groupTasks) {
          taskSubTaskMap[task.id] = [];
        }
        
        for (let i = 0; i < flatSubTasks.length; i++) {
          const taskIndex = i % groupTasks.length;
          const targetTask = groupTasks[taskIndex];
          const subTask = flatSubTasks[i];
          const internalOrderIndex = taskSubTaskMap[targetTask.id].length + 1;
          
          taskSubTaskMap[targetTask.id].push({
            ...subTask,
            orderIndex: internalOrderIndex,
          });
        }

        // 更新任务状态（保持 splitting，设置 pending_review）
        // 🔥 关键修复：Mock 版本也不立即设置 subTaskCount，保持为 0
        // 只通过通知传递数据，等待用户确认后才设置
        for (const task of groupTasks) {
          const currentMetadata = task.metadata || {};
          
          await db
            .update(dailyTask)
            .set({
              retryStatus: 'pending_review',
              subTaskCount: 0, // 🔥 关键：设置为 0，防止防重检查被触发
              completedSubTasks: 0,
              metadata: {
                ...currentMetadata,
                groupDate: date,
                groupExecutor: executor,
              },
              updatedAt: new Date(),
            })
            .where(eq(dailyTask.id, task.id));
        }

        // 构建按任务分组的子任务数据
        const pendingSubTasksByTask: Record<string, any[]> = {};
        for (const task of groupTasks) {
          pendingSubTasksByTask[task.id] = taskSubTaskMap[task.id] || [];
        }

        // 统一数据结构，创建通知
        const allSubTasks = flatSubTasks.map((st, index) => ({
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
        }));
        
        const splitResult = {
          subTasks: allSubTasks,
          summary: `[Mock] 批量拆解 ${groupTasks.length} 个任务为 ${allSubTasks.length} 个子任务`,
          totalDeliverables: allSubTasks.length.toString(),
          timeFrame: `${allSubTasks.length}步`,
          date: date,
          executor: executor,
          taskCount: groupTasks.length,
          totalSubTasks: allSubTasks.length,
          tasks: groupTasks.map(task => ({
            taskId: task.taskId,
            taskTitle: task.taskTitle,
            executor: task.executor,
          })),
        };
        
        const splitResultString = JSON.stringify(splitResult);
        
        await createNotification({
          agentId: 'A',
          type: 'insurance_d_split_result',
          title: `[Mock] insurance-d 批量拆解完成: ${groupTasks.length} 个任务 (${date}, ${executor})`,
          content: {
            fromAgentId: 'insurance-d',
            toAgentId: 'A',
            message: '[Mock] 拆解完成，请确认拆解方案',
            splitResult: splitResult,
          },
          result: splitResultString,
          relatedTaskId: groupTasks[0].taskId,
          fromAgentId: 'insurance-d',
          priority: 'high',
          metadata: {
            dailyTaskIds: groupTasks.map(t => t.id),
            taskId: groupTasks[0].taskId,
            subTaskCount: flatSubTasks.length,
            taskCount: groupTasks.length,
            splitType: 'insurance_d_batch_split',
            date: date,
            executor: executor,
            splitPopupStatus: null,
            originalTaskContent: groupTasks.map(t => `${t.taskTitle || t.taskName || ''}`).join('\n\n'),
            originalTaskTitle: `[Mock] ${groupTasks.length} 个任务 (${date}, ${executor})`,
            pendingSubTasksByTask: pendingSubTasksByTask,
            pendingSubTasks: flatSubTasks,
          },
        });
        
        console.log(`🎭 [Mock] 分组通知已创建`);

        allGroupResults.push({
          date,
          executor,
          tasks: groupTasks,
          totalSubTasks: flatSubTasks.length,
        });

      } catch (error) {
        console.error(`🎭 [Mock] 处理分组 ${groupKey} 失败:`, error);
      }
    }

    console.log(`🎭 [Mock] 批量拆解完成，共处理 ${allGroupResults.length} 个分组`);

    const totalTaskCount = allGroupResults.reduce((sum, group) => sum + group.tasks.length, 0);
    const totalSubTaskCount = allGroupResults.reduce((sum, group) => sum + group.totalSubTasks, 0);

    return {
      success: true,
      groupCount: allGroupResults.length,
      totalTaskCount: totalTaskCount,
      totalSubTaskCount: totalSubTaskCount,
      taskIds: taskIds,
      groupResults: allGroupResults,
    };
  } catch (error) {
    console.error(`🎭 [Mock] mock 批量拆解任务失败:`, error);
    throw new Error(`Mock 批量拆解失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function insuranceDBatchSplitTask(taskIds: string[]) {
  // 如果是开发环境或设置了 USE_MOCK_INSURANCE_D，使用 mock 版本
  if (USE_MOCK) {
    console.log(`🎭 [Mock] 检测到开发环境，使用 mock 版本的批量拆解`);
    return mockInsuranceDBatchSplitTask(taskIds);
  }
  
  // 否则使用真实版本
  console.log(`🔧 insurance-d 开始批量拆解 ${taskIds.length} 个任务`);
  console.log(`📋 任务 IDs:`, taskIds);

  try {
    // 查询所有任务详情
    // 🔥 修复：使用 inArray 避免类型不匹配问题
    const tasks = await db
      .select()
      .from(dailyTask)
      .where(inArray(dailyTask.id, taskIds));

    if (tasks.length === 0) {
      throw new Error(`未找到任何任务`);
    }

    if (tasks.length !== taskIds.length) {
      console.warn(`⚠️ 只找到 ${tasks.length} 个任务，请求了 ${taskIds.length} 个`);
    }

    console.log(`📦 找到 ${tasks.length} 个任务`);

    // 🔥 筛选需要处理的任务
    // ✅ 使用北京时间（Asia/Shanghai）计算今天日期
    const todayStr = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const today = new Date(`${todayStr}T00:00:00`);
    
    console.log(`🔍 [insurance-d] 开始筛选 ${tasks.length} 个任务...`);
    console.log(`🔍 [insurance-d] todayStr = ${todayStr}`);
    console.log(`🔍 [insurance-d] today = ${today.toISOString()}`);
    
    const validTasks = tasks.filter(task => {
      console.log(`🔍 [insurance-d] 检查任务 ${task.taskId}:`);
      console.log(`  - executor: ${task.executor}`);
      console.log(`  - executionStatus: ${task.executionStatus}`);
      console.log(`  - subTaskCount: ${task.subTaskCount}`);
      console.log(`  - executionDate: ${task.executionDate}`);
      
      // 条件 1: executor 必须是 insurance-d
      if (task.executor !== 'insurance-d') {
        console.log(`❌ [insurance-d] 跳过任务 ${task.taskId}: executor 不是 insurance-d (${task.executor})`);
        return false;
      }
      
      // 条件 2: 状态必须是 pending_review 或 splitting（避免重复处理）
      if (task.executionStatus !== 'pending_review' && task.executionStatus !== 'splitting') {
        console.log(`❌ [insurance-d] 跳过任务 ${task.taskId}: 状态不是 pending_review 或 splitting (${task.executionStatus})`);
        return false;
      }
      
      // 条件 3: 没有子任务或子任务数为 0
      if (task.subTaskCount && task.subTaskCount > 0) {
        console.log(`❌ [insurance-d] 跳过任务 ${task.taskId}: 已经有 ${task.subTaskCount} 个子任务`);
        return false;
      }
      
      // 条件 4: 检查是否被拒绝，如果是则需要处理重新拆解
      if (task.metadata?.splitRejected) {
        console.log(`🔄 [insurance-d] 任务 ${task.taskId} 已被用户拒绝，将重新拆解`);
        // 不跳过，继续处理
      }
      
      // 条件 5: 执行时间必须是今天或者今天以前
      if (task.executionDate) {
        const executionDate = new Date(task.executionDate.toString());
        executionDate.setHours(0, 0, 0, 0);
        
        console.log(`  - executionDate (date: ${executionDate.toISOString()}`);
        console.log(`  - today: ${today.toISOString()}`);
        console.log(`  - executionDate > today? ${executionDate > today}`);
        
        if (executionDate > today) {
          console.log(`❌ [insurance-d] 跳过任务 ${task.taskId}: 执行日期 ${executionDate.toISOString().split('T')[0]} 在今天之后`);
          return false;
        }
      }
      
      return true;
    });
    
    if (validTasks.length === 0) {
      console.log(`❌ 没有符合条件的任务可以处理`);
      return {
        success: false,
        message: '没有符合条件的任务可以处理',
        processedCount: 0,
      };
    }
    
    console.log(`✅ 筛选出 ${validTasks.length} 个符合条件的任务`);

    // 🔥 按日期 + agent 分组任务
    const tasksByDateAndAgent = validTasks.reduce((acc, task) => {
      let date = 'unknown';
      const taskId = task.taskId || '';
      const executor = task.executor || 'unknown';

      // 🔥 修复：支持 2025 和 2026 年的数据
      if (taskId.includes('-2025-')) {
        const parts = taskId.split('-2025-')[1].split('-');
        date = `2025-${parts[0]}-${parts[1]}`;
      } else if (taskId.includes('-2026-')) {
        const parts = taskId.split('-2026-')[1].split('-');
        date = `2026-${parts[0]}-${parts[1]}`;
      } else if (task.executionDate) {
        // 如果 taskId 中没有日期，使用 executionDate 字段
        date = task.executionDate.toString();
      }

      const key = `${date}_${executor}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(task);
      return acc;
    }, {} as Record<string, typeof tasks>);

    const groupKeys = Object.keys(tasksByDateAndAgent).sort();
    console.log(`📅 任务按日期+agent分组:`, groupKeys.map(key => {
      const [date, executor] = key.split('_');
      return { date, executor, count: tasksByDateAndAgent[key].length };
    }));

    // 🔥 完整方案：按分组批量拆解，LLM返回扁平子任务列表，平均分配给各任务
    const allGroupResults: Array<{
      date: string;
      executor: string;
      tasks: typeof tasks;
      totalSubTasks: number;
    }> = [];

    for (const groupKey of groupKeys) {
      const [date, executor] = groupKey.split('_');
      const groupTasks = tasksByDateAndAgent[groupKey];
      
      console.log(`\n🤖 处理分组: ${date} + ${executor}, ${groupTasks.length} 个任务`);

      try {
        // 🔥 步骤5：更新该分组所有任务的状态为 splitting
        console.log(`   🔒 更新分组中 ${groupTasks.length} 个任务的状态为 splitting...`);
        for (const task of groupTasks) {
          const currentMetadata = task.metadata || {};
          const isRejected = currentMetadata.splitRejected === true;
          
          // 如果被拒绝了，先清除之前的子任务数据
          if (isRejected) {
            console.log(`🔄 [insurance-d] 任务 ${task.id} 已被拒绝，清除之前的子任务数据`);
            await db
              .update(dailyTask)
              .set({
                subTaskCount: 0,
                completedSubTasks: 0,
                updatedAt: new Date(),
              })
              .where(eq(dailyTask.id, task.id));
            
            // 删除之前的子任务
            await db
              .delete(agentSubTasks)
              .where(eq(agentSubTasks.commandResultId, task.id));
          }
          
          await db
            .update(dailyTask)
            .set({
              executionStatus: 'splitting',
              splitStartTime: sql`now()`, // 🔥 使用数据库当前时间，与 created_at 保持一致
              metadata: {
                ...currentMetadata,
                splitStartTime: new Date().toISOString(),
                splitRejected: false, // 🔥 清除拒绝标记
                rejectionReason: undefined, // 🔥 清除拒绝原因
              },
              updatedAt: sql`now()`, // 🔥 使用数据库当前时间
            })
            .where(eq(dailyTask.id, task.id));
        }
        console.log(`   ✅ 分组中所有任务状态已更新为 splitting`);

        // 🔥 步骤6：合并该组所有任务的描述，包含任务执行顺序说明和拒绝原因
        console.log(`   📝 合并分组任务描述...`);
        
        // 🔥 收集所有任务的拒绝原因
        const rejectionReasons: Array<{
          taskId: string;
          taskTitle: string;
          rejectionReason: string;
          rejectionCount: number;
        }> = [];
        
        for (const task of groupTasks) {
          if (task.metadata?.rejectionReason) {
            rejectionReasons.push({
              taskId: task.taskId,
              taskTitle: task.taskTitle,
              rejectionReason: task.metadata.rejectionReason,
              rejectionCount: task.metadata.rejectionCount || 1,
            });
          }
        }
        
        const combinedTaskDescription = groupTasks.map((task, index) => {
          const rejectionInfo = task.metadata?.rejectionReason ? `

**⚠️ 重要：此任务拆解已被拒绝 ${task.metadata?.rejectionCount || 1} 次！**
**拒绝原因**：
\`\`\`
${task.metadata.rejectionReason}
\`\`\`
**请根据拒绝原因重新调整拆解方案！**` : '';
          
          const lastSplitResultInfo = task.metadata?.splitResult ? `

**📋 上次拆解结果（仅供参考，请根据拒绝原因调整）**：
\`\`\`
${typeof task.metadata.splitResult === 'string' 
  ? task.metadata.splitResult 
  : JSON.stringify(task.metadata.splitResult, null, 2)}
\`\`\`` : '';
          
          return `## 任务 ${index + 1}：${task.taskTitle}

**任务 ID**: ${task.taskId}
**执行者**: ${task.executor}
**优先级**: ${task.taskPriority}
${rejectionInfo}${lastSplitResultInfo}

**任务描述**:
${task.commandContent}

**交付物**: ${task.deliverables}`;
        }).join('\n\n---\n\n');

        // 添加任务执行顺序说明和 JSON 返回样例
        const finalPrompt = `${rejectionReasons.length > 0 ? `
---

## 🚨🚨🚨 最高优先级警告 🚨🚨🚨

**此分组中有 ${rejectionReasons.length} 个任务已被用户拒绝！你必须按照用户的拒绝原因重新拆解！**

**被拒绝的任务和原因**：
${rejectionReasons.map((r, i) => `
### ${i + 1}. ${r.taskTitle} (任务 ID: ${r.taskId})
- 拒绝次数：${r.rejectionCount} 次
- 拒绝原因：
\`\`\`
${r.rejectionReason}
\`\`\`
`).join('\n')}

**立即调整你的拆解策略，不要重复之前的错误！**

---

` : ''}${combinedTaskDescription}

---

## 任务执行顺序说明

请根据任务之间的逻辑关系，制定所有子任务的执行优先级。
你可以根据任务的依赖关系和逻辑顺序，合理安排所有子任务的执行顺序（orderIndex）。
例如：任务1的子任务可以优先于任务2的子任务执行，或者交叉执行。

---

## 返回格式要求

**重要：请直接返回 JSON 数组，不要包含任何其他文字说明文字！

JSON 格式如下：

\`\`\`json
[
  {
    "orderIndex": 1,
    "title": "任务1的第1个子任务",
    "description": "详细描述",
    "executor": "insurance-d",
    "deadline": "2026-02-20",
    "priority": "urgent",
    "estimatedHours": 2,
    "acceptanceCriteria": "验收标准",
    "isCritical": true,
    "criticalReason": "为什么这个任务很关键"
  },
  {
    "orderIndex": 2,
    "title": "任务1的第2个子任务",
    "description": "详细描述",
    "executor": "insurance-d",
    "deadline": "2026-02-20",
    "priority": "urgent",
    "estimatedHours": 3,
    "acceptanceCriteria": "验收标准",
    "isCritical": true,
    "criticalReason": "为什么这个任务很关键"
  },
  {
    "orderIndex": 3,
    "title": "任务2的第1个子任务",
    "description": "详细描述",
    "executor": "insurance-c",
    "deadline": "2026-02-20",
    "priority": "urgent",
    "estimatedHours": 2,
    "acceptanceCriteria": "验收标准",
    "isCritical": true,
    "criticalReason": "为什么这个任务很关键"
  }
]
\`\`\`

**注意事项：**
1. 只返回 JSON 数组，不要 Markdown 标记或其他说明文字
2. 每个子任务必须包含所有字段
3. orderIndex 必须从 1 开始连续编号
4. executor 必须是有效的 Agent ID（insurance-d、insurance-c 等
5. priority 必须是：urgent、normal、low
6. 如果 isCritical=true 时必须提供 criticalReason
7. 根据保险内容必须包含 8 个标准步骤！`;

        console.log(`   ✅ 任务描述合并完成，长度: ${finalPrompt.length} 字符`);

        // 🔥 步骤7：调用 LLM 一次性拆解该分组的所有任务
        console.log(`   🤖 调用 LLM 批量拆解 ${groupTasks.length} 个任务...`);
        const flatSubTasks = await splitTaskForAgent('insurance-d', {
          id: `batch-${date}-${executor}-${Date.now()}`,
          taskId: `batch-${date}-${executor}`,
          taskTitle: `批量拆解 ${groupTasks.length} 个任务 (${date}, ${executor})`,
          commandContent: finalPrompt,
          executor: 'insurance-d',
          taskPriority: groupTasks[0].taskPriority,
          deliverables: groupTasks.map(t => t.deliverables).join('; '),
        });
        
        console.log(`   ✅ LLM 返回 ${flatSubTasks.length} 个扁平子任务`);

        // 🔥 步骤10：将扁平化的子任务平均分配给该分组的各个任务
        console.log(`   📦 分配子任务给 ${groupTasks.length} 个任务...`);
        const taskSubTaskMap: Record<string, typeof flatSubTasks> = {};
        
        // 初始化每个任务的子任务数组
        for (const task of groupTasks) {
          taskSubTaskMap[task.id] = [];
        }
        
        // 平均分配子任务
        for (let i = 0; i < flatSubTasks.length; i++) {
          const taskIndex = i % groupTasks.length;
          const targetTask = groupTasks[taskIndex];
          const subTask = flatSubTasks[i];
          
          // 重新计算该任务内部的 orderIndex
          const internalOrderIndex = taskSubTaskMap[targetTask.id].length + 1;
          
          taskSubTaskMap[targetTask.id].push({
            ...subTask,
            orderIndex: internalOrderIndex,
          });
        }
        
        console.log(`   ✅ 子任务分配完成:`, Object.entries(taskSubTaskMap).map(([taskId, subTasks]) => ({
          taskId,
          subTaskCount: subTasks.length,
        })));

        // 🔥 步骤11：保存待确认的子任务到 metadata（不立即插入数据库）
        console.log(`   💾 保存待确认的子任务到 metadata...`);
        
        // 构建按任务分组的子任务数据
        const pendingSubTasksByTask: Record<string, any[]> = {};
        for (const task of groupTasks) {
          pendingSubTasksByTask[task.id] = taskSubTaskMap[task.id] || [];
        }

        // 🔥 步骤12：状态保持为 splitting，只更新 retryStatus = 'pending_review'
        console.log(`   🔄 更新任务状态（保持 splitting，设置 pending_review）...`);
        for (const task of groupTasks) {
          const subTasks = taskSubTaskMap[task.id] || [];
          const currentMetadata = task.metadata || {};
          
          await db
            .update(dailyTask)
            .set({
              // executionStatus 保持为 'splitting'，不修改！
              retryStatus: 'pending_review',
              subTaskCount: subTasks.length,
              completedSubTasks: 0,
              metadata: {
                ...currentMetadata,
                groupDate: date,
                groupExecutor: executor,
              },
              updatedAt: new Date(),
            })
            .where(eq(dailyTask.id, task.id));
        }
        console.log(`   ✅ 分组中所有任务状态已更新（保持 splitting）`);

        // 🔥 步骤13：为该分组创建一个通知（统一数据结构，与 Agent B 保持一致）
        console.log(`   📢 为分组创建通知...`);
        
        // 🔥 统一数据结构：将 insurance-d 也使用与 Agent B 相同的格式
        // 确保弹框展示格式一致
        const allSubTasks = flatSubTasks.map((st, index) => ({
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
        }));
        
        const splitResult = {
          subTasks: allSubTasks,
          summary: `批量拆解 ${groupTasks.length} 个任务为 ${allSubTasks.length} 个子任务`,
          totalDeliverables: allSubTasks.length.toString(),
          timeFrame: `${allSubTasks.length}步`,
          date: date,
          executor: executor,
          taskCount: groupTasks.length,
          totalSubTasks: allSubTasks.length,
          tasks: groupTasks.map(task => ({
            taskId: task.taskId,
            taskTitle: task.taskTitle,
            executor: task.executor,
          })),
        };
        
        const splitResultString = JSON.stringify(splitResult);
        
        await createNotification({
          agentId: 'A',
          type: 'insurance_d_split_result',
          title: `insurance-d 批量拆解完成: ${groupTasks.length} 个任务 (${date}, ${executor})`,
          content: {
            fromAgentId: 'insurance-d',
            toAgentId: 'A',
            message: '拆解完成，请确认拆解方案',
            splitResult: splitResult, // 🔥 关键修复：在 content 中添加 splitResult 字段
          },
          result: splitResultString,
          relatedTaskId: groupTasks[0].taskId,
          fromAgentId: 'insurance-d',
          priority: 'high',
          metadata: {
            dailyTaskIds: groupTasks.map(t => t.id),
            taskId: groupTasks[0].taskId,
            subTaskCount: flatSubTasks.length,
            taskCount: groupTasks.length,
            splitType: 'insurance_d_batch_split',
            date: date,
            executor: executor,
            splitPopupStatus: null,
            originalTaskContent: groupTasks.map(t => `${t.taskTitle || t.taskName || ''}`).join('\n\n'),
            originalTaskTitle: `${groupTasks.length} 个任务 (${date}, ${executor})`,
            // 🔥 新增：保存待确认的子任务（Agent A 确认后才插入数据库
            pendingSubTasksByTask: pendingSubTasksByTask, // 按任务分组的子任务数据
            // 🔥 新增：保存扁平化的子任务数据（用于前端显示）
            pendingSubTasks: flatSubTasks,
          },
        });
        
        console.log(`   ✅ 分组通知已创建`);

        // 记录分组结果
        allGroupResults.push({
          date,
          executor,
          tasks: groupTasks,
          totalSubTasks: flatSubTasks.length,
        });

      } catch (error) {
        console.error(`   ❌ 处理分组 ${groupKey} 失败:`, error);
        // 继续处理下一个分组，不中断整个流程
      }
    }

    console.log(`\n🔓 批量拆解完成，共处理 ${allGroupResults.length} 个分组`);

    // 计算总任务数和总子任务数
    const totalTaskCount = allGroupResults.reduce((sum, group) => sum + group.tasks.length, 0);
    const totalSubTaskCount = allGroupResults.reduce((sum, group) => sum + group.totalSubTasks, 0);

    return {
      success: true,
      groupCount: allGroupResults.length,
      totalTaskCount: totalTaskCount,
      totalSubTaskCount: totalSubTaskCount,
      taskIds: taskIds,
      groupResults: allGroupResults,
    };
  } catch (error) {
    console.error(`❌ insurance-d 批量拆解任务失败:`, error);
    
    // 🔥 只有在超时或请求异常时才更新 executionStatus='in_progress'
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isTimeoutOrRequestError = 
      errorMessage.includes('timeout') || 
      errorMessage.includes('Timeout') ||
      errorMessage.includes('request') ||
      errorMessage.includes('Request') ||
      errorMessage.includes('fetch') ||
      errorMessage.includes('Fetch') ||
      errorMessage.includes('network') ||
      errorMessage.includes('Network');
    
    // 🔥 处理所有任务的状态更新
    console.log(`🧹 处理 ${taskIds.length} 个任务的状态...`);
    for (const taskId of taskIds) {
      try {
        // 先查询当前任务的 metadata
        const task = await db
          .select()
          .from(dailyTask)
          .where(eq(dailyTask.id, taskId))
          .limit(1);
        
        if (task.length === 0) {
          console.warn(`⚠️ 任务 ${taskId} 不存在，跳过清理`);
          continue;
        }
        
        const currentMetadata = task[0].metadata || {};
        const newMetadata = {
          ...currentMetadata,
          splitStartTime: new Date().toISOString(),
          splitFailedAt: new Date().toISOString(),
          splitFailureReason: errorMessage,
          splitFailureType: isTimeoutOrRequestError ? 'timeout_or_request_error' : 'other_error',
        };
        
        if (isTimeoutOrRequestError) {
          // 🔥 超时或请求异常：更新为 splitting
          console.log(`⏱️ 任务 ${taskId}: 超时或请求异常，更新为 executionStatus='splitting'`);
          await db
            .update(dailyTask)
            .set({
              executionStatus: 'splitting', // 🔥 修改：超时或异常时更新为 splitting
              splitStartTime: new Date(), // 🔥 更新拆解开始时间
              metadata: newMetadata,
              updatedAt: new Date(),
            })
            .where(eq(dailyTask.id, taskId));
        } else {
          // 🔥 其他错误：保持原有状态，只记录错误
          console.log(`⚠️ 任务 ${taskId}: 非超时/请求异常，保持原有状态`);
          await db
            .update(dailyTask)
            .set({
              metadata: newMetadata,
              updatedAt: new Date(),
            })
            .where(eq(dailyTask.id, taskId));
        }
        
        console.log(`✅ 已处理任务 ${taskId} 的状态`);
      } catch (cleanupError) {
        console.error(`❌ 处理任务 ${taskId} 失败:`, cleanupError);
      }
    }
    
    throw new Error(`批量拆解失败: ${errorMessage}`);
  }
}

// ============================================
// 导出服务
// ============================================

export const taskAssignmentService = {
  identifyInsuranceDTasks,
  assignTasksToInsuranceD,
  insuranceDSplitTask,
  insuranceDBatchSplitTask, // 🔥 新增批量拆解（支持 mock）
};

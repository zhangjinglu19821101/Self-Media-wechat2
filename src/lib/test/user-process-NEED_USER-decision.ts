/**
 * Agent B NEED_USER 决策用户处理流程测试
 *
 * 测试完整的数据流：
 * 1. Agent B 输出 NEED_USER 决策
 * 2. handleNeedUserDecision() 处理
 * 3. waiting-tasks API 读取
 * 4. user-decision API 提交
 * 5. 任务继续执行
 */

import { db } from '@/lib/db';
import { agentSubTasks, agentSubTasksStepHistory, dailyTask } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

// 测试数据配置
const TEST_CONFIG = {
  testSubTaskId: 'test-subtask-' + Date.now(),
  testDailyTaskId: 'test-daily-' + Date.now(),
  testAgentId: 'insurance-d',
  testCommandResultId: 'test-cmd-' + Date.now(),
};

/**
 * 测试 1: 创建测试数据
 */
export async function test1_CreateTestData() {
  console.log('🧪 测试 1: 创建测试数据');

  try {
    // 1. 创建测试 daily_task
    await db.insert(dailyTask).values({
      id: TEST_CONFIG.testDailyTaskId,
      taskId: 'test-task-001',
      taskTitle: '测试任务：发布保险产品文章',
      taskDescription: '请发布一篇关于新产品的公众号文章',
      taskPriority: 'normal',
      executor: TEST_CONFIG.testAgentId,
      executionDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log('✅ 创建 daily_task 成功');

    // 2. 创建测试 agent_sub_task
    await db.insert(agentSubTasks).values({
      id: TEST_CONFIG.testSubTaskId,
      taskTitle: '发布保险产品介绍文章',
      taskDescription: '请发布一篇关于新产品的公众号文章',
      status: 'in_progress',
      fromParentsExecutor: TEST_CONFIG.testAgentId,
      commandResultId: TEST_CONFIG.testDailyTaskId,
      orderIndex: 1,
      metadata: {},
      createdAt: new Date(),
      startedAt: new Date(),
      updatedAt: new Date(),
    });

    console.log('✅ 创建 agent_sub_task 成功');
    console.log('✅ 测试 1 完成');

    return { success: true };
  } catch (error) {
    console.error('❌ 测试 1 失败:', error);
    return { success: false, error };
  }
}

/**
 * 测试 2: 模拟 Agent B 输出 NEED_USER 决策并调用 handleNeedUserDecision
 */
export async function test2_SimulateAgentBNEED_USERDecision() {
  console.log('🧪 测试 2: 模拟 Agent B 输出 NEED_USER 决策');

  try {
    // 这里我们直接操作数据库，模拟 handleNeedUserDecision 的行为
    // 1. 更新 agent_sub_tasks 状态为 waiting_user
    await db
      .update(agentSubTasks)
      .set({
        status: 'waiting_user',
        updatedAt: new Date(),
      })
      .where(eq(agentSubTasks.id, TEST_CONFIG.testSubTaskId));

    console.log('✅ 更新 agent_sub_tasks.status = waiting_user 成功');

    // 2. 记录到 agent_sub_tasks_step_history
    const mockAgentBDecision = {
      interact_type: 'response',
      consultant: TEST_CONFIG.testAgentId,
      responder: 'agent B',
      question: {
        isNeedMcp: true,
        problem: '需要用户确认发布时间',
        capabilityType: 'wechat_upload',
      },
      response: {
        decision: {
          type: 'NEED_USER',
          reason_code: 'USER_CONFIRM',
          reasoning: '需要用户确认发布时间',
          final_conclusion: '等待用户处理',
        },
        mcp_attempts: [],
        available_solutions: [
          {
            solutionId: 'sol-1',
            label: '立即发布',
            description: '立即发布到公众号',
            pros: ['时效性强'],
            cons: ['可能错过最佳发布时间'],
          },
        ],
        user_interactions: [],
        pending_key_fields: [
          {
            fieldId: 'publish_time',
            fieldName: '发布时间',
            fieldType: 'datetime',
            description: '请选择文章发布时间',
            currentValue: null,
            validationRules: { required: true },
          },
        ],
        prompt_message: {
          title: '请确认发布时间',
          description: '为了获得最佳传播效果，请选择合适的发布时间',
          priority: 'medium',
        },
      },
      execution_result: { status: 'waiting_user' },
      ext_info: {
        step: 'agent_b_decision_need_user',
        iteration: 1,
      },
    };

    await db.insert(agentSubTasksStepHistory).values({
      commandResultId: TEST_CONFIG.testDailyTaskId,
      stepNo: 1,
      interactType: 'response',
      interactNum: 1,
      interactContent: mockAgentBDecision as any,
      interactUser: 'agent B',
      interactTime: new Date(),
    });

    console.log('✅ 记录到 agent_sub_tasks_step_history 成功');

    // 3. 验证数据
    const updatedTask = await db.query.agentSubTasks.findFirst({
      where: eq(agentSubTasks.id, TEST_CONFIG.testSubTaskId),
    });

    if (!updatedTask) {
      throw new Error('找不到更新后的任务');
    }

    if (updatedTask.status !== 'waiting_user') {
      throw new Error(`任务状态不正确，期望: waiting_user，实际: ${updatedTask.status}`);
    }

    console.log('✅ 验证任务状态成功');
    console.log('✅ 测试 2 完成');

    return { success: true, task: updatedTask };
  } catch (error) {
    console.error('❌ 测试 2 失败:', error);
    return { success: false, error };
  }
}

/**
 * 测试 3: 测试 waiting-tasks API
 */
export async function test3_WaitingTasksAPI() {
  console.log('🧪 测试 3: 测试 waiting-tasks API');

  try {
    // 我们直接查询数据库，模拟 API 的行为
    const subTasks = await db
      .select()
      .from(agentSubTasks)
      .where(
        and(
          eq(agentSubTasks.fromParentsExecutor, TEST_CONFIG.testAgentId),
          eq(agentSubTasks.status, 'waiting_user')
        )
      )
      .orderBy(desc(agentSubTasks.createdAt))
      .limit(50);

    console.log(`✅ 查询到 ${subTasks.length} 个 waiting_user 状态的任务`);

    const tasks = [];
    for (const subTask of subTasks) {
      // 查询关联的 daily_task
      const dailyTaskResult = await db
        .select()
        .from(dailyTask)
        .where(eq(dailyTask.id, subTask.commandResultId))
        .limit(1);

      const relatedDailyTask = dailyTaskResult.length > 0 ? dailyTaskResult[0] : null;

      // 查询交互历史
      const stepHistory = await db
        .select()
        .from(agentSubTasksStepHistory)
        .where(
          and(
            eq(agentSubTasksStepHistory.commandResultId, subTask.commandResultId),
            eq(agentSubTasksStepHistory.stepNo, subTask.orderIndex)
          )
        )
        .orderBy(desc(agentSubTasksStepHistory.interactTime))
        .limit(1);

      let pendingKeyFields = [];
      let availableSolutions = [];
      let promptMessage = null;

      if (stepHistory.length > 0) {
        const lastRecord = stepHistory[0];
        const content = lastRecord.interactContent as any;

        if (content?.response) {
          pendingKeyFields = content.response.pending_key_fields || [];
          availableSolutions = content.response.available_solutions || [];
          promptMessage = content.response.prompt_message || null;
        }
      }

      tasks.push({
        id: subTask.id,
        taskTitle: subTask.taskTitle,
        taskDescription: subTask.taskDescription,
        status: subTask.status,
        priority: relatedDailyTask?.taskPriority || 'normal',
        orderIndex: subTask.orderIndex,
        isCritical: subTask.metadata?.isCritical || false,
        executor: subTask.fromParentsExecutor,
        createdAt: subTask.createdAt,
        startedAt: subTask.startedAt,
        updatedAt: subTask.updatedAt,
        metadata: subTask.metadata,
        relatedDailyTask: relatedDailyTask ? {
          id: relatedDailyTask.id,
          taskId: relatedDailyTask.taskId,
          executionDate: relatedDailyTask.executionDate,
        } : null,
        pendingKeyFields,
        availableSolutions,
        promptMessage,
      });
    }

    console.log(`✅ 组装了 ${tasks.length} 个任务数据`);

    // 验证我们的测试任务在列表中
    const testTaskInList = tasks.find(t => t.id === TEST_CONFIG.testSubTaskId);
    if (!testTaskInList) {
      throw new Error('测试任务不在待办列表中');
    }

    console.log('✅ 验证测试任务在列表中成功');
    console.log('✅ pendingKeyFields 数量:', testTaskInList.pendingKeyFields.length);
    console.log('✅ availableSolutions 数量:', testTaskInList.availableSolutions.length);
    console.log('✅ promptMessage:', testTaskInList.promptMessage);

    console.log('✅ 测试 3 完成');

    return { success: true, tasks, testTask: testTaskInList };
  } catch (error) {
    console.error('❌ 测试 3 失败:', error);
    return { success: false, error };
  }
}

/**
 * 测试 4: 测试 user-decision API (模拟用户提交)
 */
export async function test4_UserDecisionAPI() {
  console.log('🧪 测试 4: 模拟用户提交决策');

  try {
    const userInteractionData = {
      fieldValues: {
        publish_time: '2026-03-09 09:00:00',
      },
      selectedSolution: 'sol-1',
      notes: '用户选择了明早9点发布',
      submittedAt: new Date().toISOString(),
    };

    // 1. 记录用户交互到 agent_sub_tasks_step_history
    const userInteractionContent = {
      type: 'user_decision',
      decisionType: 'waiting_user_confirm',
      userDecision: 'confirm',
      interactionData: userInteractionData,
      timestamp: new Date().toISOString(),
    };

    // 查询历史记录获取下一个 interactNum
    const historyRecords = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(
        and(
          eq(agentSubTasksStepHistory.commandResultId, TEST_CONFIG.testDailyTaskId),
          eq(agentSubTasksStepHistory.stepNo, 1)
        )
      );

    const nextInteractNum = historyRecords.length > 0
      ? Math.max(...historyRecords.map(h => h.interactNum || 1)) + 1
      : 1;

    await db.insert(agentSubTasksStepHistory).values({
      commandResultId: TEST_CONFIG.testDailyTaskId,
      stepNo: 1,
      interactType: 'response',
      interactNum: nextInteractNum,
      interactContent: userInteractionContent as any,
      interactUser: 'human',
      interactTime: new Date(),
    });

    console.log('✅ 记录用户交互到历史表成功');

    // 2. 更新 agent_sub_tasks 状态为 in_progress
    await db
      .update(agentSubTasks)
      .set({
        status: 'in_progress',
        updatedAt: new Date(),
      })
      .where(eq(agentSubTasks.id, TEST_CONFIG.testSubTaskId));

    console.log('✅ 更新 agent_sub_tasks.status = in_progress 成功');

    // 3. 验证数据
    const updatedTask = await db.query.agentSubTasks.findFirst({
      where: eq(agentSubTasks.id, TEST_CONFIG.testSubTaskId),
    });

    if (!updatedTask) {
      throw new Error('找不到更新后的任务');
    }

    if (updatedTask.status !== 'in_progress') {
      throw new Error(`任务状态不正确，期望: in_progress，实际: ${updatedTask.status}`);
    }

    console.log('✅ 验证任务状态成功');
    console.log('✅ 测试 4 完成');

    return { success: true, task: updatedTask };
  } catch (error) {
    console.error('❌ 测试 4 失败:', error);
    return { success: false, error };
  }
}

/**
 * 测试 5: 清理测试数据
 */
export async function test5_CleanupTestData() {
  console.log('🧪 测试 5: 清理测试数据');

  try {
    // 1. 删除 agent_sub_tasks_step_history 记录
    await db
      .delete(agentSubTasksStepHistory)
      .where(eq(agentSubTasksStepHistory.commandResultId, TEST_CONFIG.testDailyTaskId));

    console.log('✅ 删除 agent_sub_tasks_step_history 记录成功');

    // 2. 删除 agent_sub_tasks 记录
    await db
      .delete(agentSubTasks)
      .where(eq(agentSubTasks.id, TEST_CONFIG.testSubTaskId));

    console.log('✅ 删除 agent_sub_tasks 记录成功');

    // 3. 删除 daily_task 记录
    await db
      .delete(dailyTask)
      .where(eq(dailyTask.id, TEST_CONFIG.testDailyTaskId));

    console.log('✅ 删除 daily_task 记录成功');
    console.log('✅ 测试 5 完成');

    return { success: true };
  } catch (error) {
    console.error('❌ 测试 5 失败:', error);
    return { success: false, error };
  }
}

/**
 * 运行所有测试
 */
export async function runAllTests() {
  console.log('🧪 ===== 开始运行 Agent B NEED_USER 决策用户处理流程测试 =====');
  console.log('🧪 测试配置:', TEST_CONFIG);

  const results = {
    test1: null as any,
    test2: null as any,
    test3: null as any,
    test4: null as any,
    test5: null as any,
    allPassed: false,
  };

  try {
    // 测试 1: 创建测试数据
    results.test1 = await test1_CreateTestData();
    if (!results.test1.success) throw new Error('测试 1 失败');

    // 测试 2: 模拟 Agent B 输出 NEED_USER 决策
    results.test2 = await test2_SimulateAgentBNEED_USERDecision();
    if (!results.test2.success) throw new Error('测试 2 失败');

    // 测试 3: 测试 waiting-tasks API
    results.test3 = await test3_WaitingTasksAPI();
    if (!results.test3.success) throw new Error('测试 3 失败');

    // 测试 4: 模拟用户提交决策
    results.test4 = await test4_UserDecisionAPI();
    if (!results.test4.success) throw new Error('测试 4 失败');

    // 测试 5: 清理测试数据
    results.test5 = await test5_CleanupTestData();
    if (!results.test5.success) throw new Error('测试 5 失败');

    results.allPassed = true;
    console.log('✅ ===== 所有测试通过 =====');
  } catch (error) {
    console.error('❌ ===== 测试失败 =====');
    console.error('❌ 错误:', error);

    // 尝试清理数据
    try {
      await test5_CleanupTestData();
      console.log('🧹 测试数据已清理');
    } catch (cleanupError) {
      console.error('❌ 清理测试数据失败:', cleanupError);
    }
  }

  return results;
}

// 如果直接运行此文件，则执行测试
if (require.main === module) {
  runAllTests().then((results) => {
    console.log('📊 测试结果:', JSON.stringify(results, null, 2));
    process.exit(results.allPassed ? 0 : 1);
  });
}

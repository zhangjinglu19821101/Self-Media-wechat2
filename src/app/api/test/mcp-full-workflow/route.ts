/**
 * Mock 测试：MCP 完整工作流程
 * 
 * 测试完整的 Agent 智能交互流程，包括：
 * 1. 执行 Agent 能力边界判定
 * 2. Agent B 查询能力清单
 * 3. Agent B 解决方案选型
 * 4. MCP 现场执行（状态同步）
 * 5. Agent B 上报决策（如需要）
 * 
 * 使用方法:
 * curl -X POST http://localhost:5000/api/test/mcp-full-workflow
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  agentSubTasks,
  agentSubTasksStepHistory,
  agentNotifications,
  agentReports,
  dailyTask,
} from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import {
  createExecutorAgentOutput,
  createAgentBOutput,
  createAgentBOutputWithMcp,
  CapabilityType,
  McpExecutionStatus,
} from '@/lib/types/capability-types';
import {
  createAgentConsultContent,
  createAgentResponseContent,
  createMcpExecutionContent,
  createAgentSummaryContent,
} from '@/lib/types/interact-content';

export const maxDuration = 60;

export async function POST() {
  console.log('[MCP Full Workflow Test] 开始完整 MCP 工作流程测试');

  try {
    // 1. 查找一个现有的 daily_task
    const existingDailyTask = await db.select().from(dailyTask).limit(1);
    if (existingDailyTask.length === 0) {
      return NextResponse.json({
        success: false,
        message: '没有找到 daily_task，请先创建测试数据',
      });
    }

    const dailyTask = existingDailyTask[0];
    console.log('[MCP Full Workflow Test] 使用 daily_task:', dailyTask.taskId);

    const executionSteps = [];

    // 2. 创建测试子任务
    console.log('[MCP Full Workflow Test] 创建测试子任务...');
    const today = new Date().toISOString().split('T')[0];

    const subTask = await db
      .insert(agentSubTasks)
      .values({
        commandResultId: dailyTask.id,
        fromParentsExecutor: dailyTask.executor,
        taskTitle: '测试 MCP 完整工作流程',
        taskDescription: '[Mock] 测试：执行 Agent 无平台发布能力，Agent B 选型并现场执行 MCP',
        status: 'pending',
        orderIndex: 999,
        isDispatched: false,
        timeoutHandlingCount: 0,
        escalated: false,
        executionDate: today,
        dialogueRounds: 0,
        dialogueStatus: 'none',
        metadata: { mock: true, mock_test: true, scenario: 'mcp_full_workflow' },
      })
      .returning();

    executionSteps.push({
      step: 1,
      description: '创建测试子任务',
      status: 'completed',
      subTaskId: subTask[0].id,
    });

    // 3. 步骤 1：执行 Agent 能力边界判定
    console.log('[MCP Full Workflow Test] 步骤 1：执行 Agent 能力边界判定...');

    // 更新任务状态
    await db
      .update(agentSubTasks)
      .set({
        status: 'in_progress',
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(agentSubTasks.id, subTask[0].id));

    // 执行 Agent 输出：需要 MCP 能力
    const executorOutput = createExecutorAgentOutput({
      is_need_mcp: true,
      problem: '平台发布能力缺失，无微信公众号上传权限，无法完成内容发布操作',
      capability_type: 'platform_publish' as CapabilityType,
    });

    // 记录交互 1：执行 Agent → Agent B
    const interact1 = createAgentConsultContent({
      consultant: 'insurance-d',
      responder: 'Agent B',
      question: executorOutput as any,
      response: '',
      executionResult: { status: 'waiting' },
      extInfo: {
        capability_type: 'platform_publish',
        is_need_mcp: true,
        problem: '平台发布能力缺失，无微信公众号上传权限',
      },
    });

    await db.insert(agentSubTasksStepHistory).values({
      commandResultId: subTask[0].commandResultId,
      stepNo: 999,
      interactContent: interact1,
      interactUser: 'insurance-d',
      interactTime: new Date(),
      interactNum: 1,
    });

    executionSteps.push({
      step: 2,
      description: '执行 Agent 能力边界判定，输出 is_need_mcp=true',
      status: 'completed',
      executorOutput,
    });

    // 4. 步骤 2：Agent B 查询能力清单
    console.log('[MCP Full Workflow Test] 步骤 2：Agent B 查询能力清单...');

    const agentBQueryOutput = createAgentBOutput({
      list_capabilities: true,
      capability_type: 'platform_publish' as CapabilityType,
      is_notify_agentA: false,
    });

    // 记录交互 2：Agent B → 控制器
    const interact2 = createAgentConsultContent({
      consultant: 'Agent B',
      responder: '控制器',
      question: agentBQueryOutput as any,
      response: '',
      executionResult: { status: 'waiting' },
      extInfo: {
        list_capabilities: true,
        capability_type: 'platform_publish',
      },
    });

    // 先检查是否已存在记录
    const existingHistory2 = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(
        and(
          eq(agentSubTasksStepHistory.commandResultId, subTask[0].commandResultId),
          eq(agentSubTasksStepHistory.stepNo, 999)
        )
      );

    if (existingHistory2.length > 0) {
      await db
        .update(agentSubTasksStepHistory)
        .set({
          interactContent: interact2,
          interactUser: 'Agent B',
          interactTime: new Date(),
          interactNum: 2,
        })
        .where(eq(agentSubTasksStepHistory.id, existingHistory2[0].id));
    } else {
      await db.insert(agentSubTasksStepHistory).values({
        commandResultId: subTask[0].commandResultId,
        stepNo: 999,
        interactContent: interact2,
        interactUser: 'Agent B',
        interactTime: new Date(),
        interactNum: 2,
      });
    }

    executionSteps.push({
      step: 3,
      description: 'Agent B 查询能力清单，输出 list_capabilities=true',
      status: 'completed',
      agentBQueryOutput,
    });

    // 5. 步骤 3：控制器返回能力清单
    console.log('[MCP Full Workflow Test] 步骤 3：控制器返回能力清单...');

    const capabilityListResponse = {
      capability_list: [
        {
          id: 10,
          function_desc: '微信公众号文章上传（Coze MCP连接器，需现场执行）',
          status: 'available',
          requires_on_site_execution: true,
        },
      ],
    };

    // 记录交互 3：控制器 → Agent B
    const interact3 = createAgentResponseContent({
      consultant: '控制器',
      responder: 'Agent B',
      question: '',
      response: capabilityListResponse as any,
      executionResult: { status: 'success' },
    });

    const existingHistory3 = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(
        and(
          eq(agentSubTasksStepHistory.commandResultId, subTask[0].commandResultId),
          eq(agentSubTasksStepHistory.stepNo, 999)
        )
      );

    await db
      .update(agentSubTasksStepHistory)
      .set({
        interactContent: interact3,
        interactUser: '控制器',
        interactTime: new Date(),
        interactNum: 3,
      })
      .where(eq(agentSubTasksStepHistory.id, existingHistory3[0].id));

    executionSteps.push({
      step: 4,
      description: '控制器返回能力清单',
      status: 'completed',
      capabilityListResponse,
    });

    // 6. 步骤 4：Agent B 解决方案选型 + MCP 待执行状态
    console.log('[MCP Full Workflow Test] 步骤 4：Agent B 解决方案选型 + MCP 待执行状态...');

    const agentBSolutionOutput = createAgentBOutputWithMcp({
      list_capabilities: false,
      solution_num: 10,
      solution_desc: '采用10号方案，通过Coze MCP连接器完成微信公众号上传（需现场执行）',
      is_notify_agentA: false,
      mcp_execution_status: 'waiting_execution' as McpExecutionStatus,
      mcp_return_info: null,
      dialog_history: null,
    });

    // 记录交互 4：Agent B → 执行 Agent（MCP 待执行）
    const interact4 = createMcpExecutionContent({
      consultant: 'Agent B',
      responder: 'insurance-d',
      question: '',
      response: agentBSolutionOutput as any,
      executionResult: { status: 'waiting' },
      extInfo: {
        solution_num: 10,
        mcp_execution_status: 'waiting_execution',
      },
    });

    const existingHistory4 = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(
        and(
          eq(agentSubTasksStepHistory.commandResultId, subTask[0].commandResultId),
          eq(agentSubTasksStepHistory.stepNo, 999)
        )
      );

    await db
      .update(agentSubTasksStepHistory)
      .set({
        interactContent: interact4,
        interactUser: 'Agent B',
        interactTime: new Date(),
        interactNum: 4,
      })
      .where(eq(agentSubTasksStepHistory.id, existingHistory4[0].id));

    executionSteps.push({
      step: 5,
      description: 'Agent B 解决方案选型，MCP 待执行状态',
      status: 'completed',
      agentBSolutionOutput,
    });

    // 7. 步骤 5：MCP 执行中状态同步
    console.log('[MCP Full Workflow Test] 步骤 5：MCP 执行中状态同步...');

    await new Promise(resolve => setTimeout(resolve, 500));

    const agentBExecutingOutput = {
      solution_num: 10,
      mcp_execution_status: 'executing' as McpExecutionStatus,
      mcp_return_info: null,
      dialog_history: null,
      is_notify_agentA: false,
    };

    // 记录交互 5：Agent B → 执行 Agent（MCP 执行中）
    const interact5 = createMcpExecutionContent({
      consultant: 'Agent B',
      responder: 'insurance-d',
      question: '',
      response: agentBExecutingOutput as any,
      executionResult: { status: 'executing' },
      extInfo: {
        mcp_execution_status: 'executing',
      },
    });

    const existingHistory5 = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(
        and(
          eq(agentSubTasksStepHistory.commandResultId, subTask[0].commandResultId),
          eq(agentSubTasksStepHistory.stepNo, 999)
        )
      );

    await db
      .update(agentSubTasksStepHistory)
      .set({
        interactContent: interact5,
        interactUser: 'Agent B',
        interactTime: new Date(),
        interactNum: 5,
      })
      .where(eq(agentSubTasksStepHistory.id, existingHistory5[0].id));

    executionSteps.push({
      step: 6,
      description: 'MCP 执行中状态同步',
      status: 'completed',
      agentBExecutingOutput,
    });

    // 8. 步骤 6：MCP 执行完成，返回结果
    console.log('[MCP Full Workflow Test] 步骤 6：MCP 执行完成，返回结果...');

    await new Promise(resolve => setTimeout(resolve, 1000));

    const agentBCompleteOutput = createAgentBOutputWithMcp({
      list_capabilities: false,
      solution_num: 10,
      solution_desc: '采用10号方案，通过Coze MCP连接器完成微信公众号上传（现场执行完成）',
      is_notify_agentA: false,
      mcp_execution_status: 'success' as McpExecutionStatus,
      mcp_return_info: {
        execution_log: '2026-02-26 00:50:00 触发MCP执行，2026-02-26 00:52:00 执行完成',
        result: '微信公众号文章上传成功，文章ID：wx123456',
        error_msg: '',
      },
      dialog_history: [
        {
          interact_num: 1,
          consultant: 'insurance-d',
          content: '平台发布能力缺失，无微信公众号上传权限，无法完成内容发布操作',
        },
        {
          interact_num: 2,
          consultant: 'Agent B',
          content: '选定10号解决方案，将通过MCP连接器现场执行微信公众号上传',
        },
        {
          interact_num: 5,
          consultant: 'Agent B',
          content: 'MCP执行中，请勿重复操作',
        },
      ],
    });

    // 记录交互 6：Agent B → 执行 Agent（MCP 执行完成）
    const interact6 = createAgentResponseContent({
      consultant: 'Agent B',
      responder: 'insurance-d',
      question: '',
      response: agentBCompleteOutput as any,
      executionResult: { status: 'success' },
      extInfo: {
        mcp_execution_status: 'success',
      },
    });

    const existingHistory6 = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(
        and(
          eq(agentSubTasksStepHistory.commandResultId, subTask[0].commandResultId),
          eq(agentSubTasksStepHistory.stepNo, 999)
        )
      );

    await db
      .update(agentSubTasksStepHistory)
      .set({
        interactContent: interact6,
        interactUser: 'Agent B',
        interactTime: new Date(),
        interactNum: 6,
      })
      .where(eq(agentSubTasksStepHistory.id, existingHistory6[0].id));

    // 更新子任务状态
    await db
      .update(agentSubTasks)
      .set({
        status: 'completed',
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(agentSubTasks.id, subTask[0].id));

    executionSteps.push({
      step: 7,
      description: 'MCP 执行完成，返回结果',
      status: 'completed',
      agentBCompleteOutput,
    });

    // 9. 查询最终结果
    const finalSubTask = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, subTask[0].id));

    const stepHistory = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(eq(agentSubTasksStepHistory.commandResultId, subTask[0].commandResultId))
      .orderBy(agentSubTasksStepHistory.interactNum);

    console.log('[MCP Full Workflow Test] 测试完成');

    return NextResponse.json({
      success: true,
      message: 'MCP 完整工作流程测试完成',
      data: {
        subTask: finalSubTask[0],
        stepHistory: stepHistory,
        executionSteps: executionSteps,
      },
    });
  } catch (error) {
    console.error('[MCP Full Workflow Test] 测试失败:', error);
    return NextResponse.json(
      { success: false, error: `Error: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

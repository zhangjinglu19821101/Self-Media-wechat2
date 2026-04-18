
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dailyTask, agentSubTasks } from '@/lib/db/schema';
import { randomUUID } from 'crypto';

export async function GET(request: NextRequest) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    // ============================================
    // 1. 先插入 daily_task 记录
    // ============================================
    const dailyTaskId = randomUUID();
    const dailyTaskTaskId = `daily-task-mcp-api-${Math.floor(Date.now() / 1000)}`;

    await db.insert(dailyTask).values({
      id: dailyTaskId,
      taskId: dailyTaskTaskId,
      relatedTaskId: 'test-mcp-master-api',
      taskTitle: 'MCP API 测试任务',
      taskDescription: '用于测试 MCP 功能的综合任务',
      executor: 'insurance-d',
      taskPriority: 'normal',
      executionDate: today,
      executionDeadlineStart: now,
      executionDeadlineEnd: new Date(now.getTime() + 4 * 60 * 60 * 1000),
      deliverables: 'MCP 功能测试报告',
      executionStatus: 'in_progress',
      splitter: 'test',
      entryUser: 'test',
      fromAgentId: 'test',
      toAgentId: 'insurance-d',
      taskType: 'daily',
      completedSubTasks: 0,
      subTaskCount: 3,
      questionStatus: 'none',
      dialogueRounds: 0,
      dialogueStatus: 'none',
      reportCount: 0,
      requiresIntervention: false,
      dependencies: {},
      sortOrder: 0,
      outputData: {},
      metrics: {},
      attachments: [],
      metadata: {},
      createdAt: now,
      updatedAt: now,
    });

    console.log('✅ 已创建 daily_task 记录:', dailyTaskId);

    // ============================================
    // 2. 再插入 3 条 agent_sub_tasks 记录
    // ============================================
    const subTasksData = [
      {
        taskTitle: '网页搜索带摘要',
        taskDescription: '使用 MCP 网页搜索功能搜索"2025年保险市场趋势"，并生成搜索摘要。要求：1. 搜索最近3个月的相关资讯；2. 提取关键信息和数据；3. 生成结构化摘要。',
        metadata: {
          mcpCapability: 'web_search',
          searchQuery: '2025年保险市场趋势',
          searchTimeRange: '3个月',
          taskType: 'mcp_web_search',
          estimatedHours: 0.5,
          acceptanceCriteria: '1. 成功调用 MCP 网页搜索接口；2. 返回相关搜索结果；3. 生成结构化摘要',
        },
        status: 'in_progress',
        orderIndex: 1,
      },
      {
        taskTitle: '合规校验功能',
        taskDescription: '使用 MCP 合规校验功能检查以下文章内容的合规性。文章内容："这是最好的保险产品，收益率最高，绝对安全，保本保息！" 要求：1. 检查是否有绝对化用语；2. 检查是否有违规承诺；3. 生成合规修改建议。',
        metadata: {
          mcpCapability: 'compliance_check',
          contentToCheck: '这是最好的保险产品，收益率最高，绝对安全，保本保息！',
          taskType: 'mcp_compliance_check',
          estimatedHours: 0.5,
          acceptanceCriteria: '1. 成功调用 MCP 合规校验接口；2. 识别出违规内容；3. 提供修改建议',
        },
        status: 'pending',
        orderIndex: 2,
      },
      {
        taskTitle: '上传一个摘要到微信公众',
        taskDescription: '使用 MCP 微信公众号功能上传文章摘要到草稿箱。文章摘要："本文详细介绍了2025年保险市场的最新趋势，包括利率走势、产品创新和监管政策变化，帮助读者了解保险市场动态。" 要求：1. 生成标题和封面建议；2. 上传到微信公众号草稿箱；3. 返回草稿链接。',
        metadata: {
          mcpCapability: 'wechat_public',
          articleSummary: '本文详细介绍了2025年保险市场的最新趋势，包括利率走势、产品创新和监管政策变化，帮助读者了解保险市场动态。',
          taskType: 'mcp_wechat_upload',
          estimatedHours: 0.5,
          acceptanceCriteria: '1. 成功调用 MCP 微信公众号接口；2. 生成标题和封面建议；3. 上传到草稿箱并返回链接',
        },
        status: 'pending',
        orderIndex: 3,
      },
    ];

    const insertedSubTasks: any[] = [];

    for (const subTaskData of subTasksData) {
      const subTaskId = randomUUID();
      await db.insert(agentSubTasks).values({
        id: subTaskId,
        commandResultId: dailyTaskId,
        fromParentsExecutor: 'insurance-d',
        taskTitle: subTaskData.taskTitle,
        taskDescription: subTaskData.taskDescription,
        status: subTaskData.status,
        orderIndex: subTaskData.orderIndex,
        executionDate: today,
        metadata: subTaskData.metadata,
        createdAt: now,
        updatedAt: now,
      });
      insertedSubTasks.push({
        id: subTaskId,
        taskTitle: subTaskData.taskTitle,
        status: subTaskData.status,
        orderIndex: subTaskData.orderIndex,
      });
      console.log('✅ 已创建 agent_sub_tasks 记录:', subTaskId);
    }

    // ============================================
    // 3. 返回结果
    // ============================================
    return NextResponse.json({
      success: true,
      message: '✅ 测试数据创建成功！',
      data: {
        dailyTask: {
          id: dailyTaskId,
          taskId: dailyTaskTaskId,
          taskTitle: 'MCP API 测试任务',
          executionStatus: 'in_progress',
        },
        agentSubTasks: insertedSubTasks,
      },
      workflow: {
        step1: '已创建 1 条 daily_task 记录',
        step2: '已创建 3 条 agent_sub_tasks 记录',
        step3: '定时任务通过 agent_sub_tasks 查到任务',
        step4: '系统自动执行流程',
      },
      summary: {
        testCases: [
          '1. 网页搜索带摘要',
          '2. 合规校验功能',
          '3. 上传一个摘要到微信公众',
        ],
        nextStep: '等待定时任务执行，系统会自动处理',
      },
    });
  } catch (error) {
    console.error('❌ 创建测试数据失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}


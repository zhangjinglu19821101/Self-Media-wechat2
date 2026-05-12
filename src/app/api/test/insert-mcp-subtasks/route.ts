
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { randomUUID } from 'crypto';

export async function GET(request: NextRequest) {
  try {
    const results: any[] = [];
    const today = new Date().toISOString().split('T')[0];

    // ============================================
    // 先查询一个现有的 daily_task 记录
    // ============================================
    const { searchParams } = new URL(request.url);
    let commandResultId = searchParams.get('commandResultId');

    if (!commandResultId) {
      return NextResponse.json({
        success: false,
        error: '请先提供 commandResultId 参数',
        usage: {
          step1: '先创建一个 daily_task 记录（使用其他测试 API）',
          step2: '获取该 daily_task 的 id',
          step3: '调用此 API 并传入 commandResultId 参数',
          example: 'GET /api/test/insert-mcp-subtasks?commandResultId=xxx-xxx-xxx'
        }
      }, { status: 400 });
    }

    console.log('使用 commandResultId:', commandResultId);

    // ============================================
    // 插入 3 条 agent_sub_tasks 记录
    // ============================================

    // 1. 网页搜索带摘要
    const subTaskId1 = randomUUID();
    await db.insert(agentSubTasks).values({
      id: subTaskId1,
      commandResultId: commandResultId,
      fromParentsExecutor: 'insurance-d',
      taskTitle: '网页搜索带摘要',
      taskDescription: '使用 MCP 网页搜索功能搜索"2025年保险市场趋势"，并生成搜索摘要。要求：1. 搜索最近3个月的相关资讯；2. 提取关键信息和数据；3. 生成结构化摘要。',
      status: 'pending',
      orderIndex: 1,
      executionDate: today,
      metadata: {
        mcpCapability: 'web_search',
        searchQuery: '2025年保险市场趋势',
        searchTimeRange: '3个月',
        taskType: 'mcp_web_search',
        estimatedHours: 0.5,
        acceptanceCriteria: '1. 成功调用 MCP 网页搜索接口；2. 返回相关搜索结果；3. 生成结构化摘要',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    results.push({
      testCase: '1. 网页搜索带摘要',
      subTaskId: subTaskId1,
      orderIndex: 1,
      status: 'created',
    });

    // 2. 合规校验功能
    const subTaskId2 = randomUUID();
    await db.insert(agentSubTasks).values({
      id: subTaskId2,
      commandResultId: commandResultId,
      fromParentsExecutor: 'insurance-d',
      taskTitle: '合规校验功能',
      taskDescription: '使用 MCP 合规校验功能检查以下文章内容的合规性。文章内容："这是最好的保险产品，收益率最高，绝对安全，保本保息！" 要求：1. 检查是否有绝对化用语；2. 检查是否有违规承诺；3. 生成合规修改建议。',
      status: 'pending',
      orderIndex: 2,
      executionDate: today,
      metadata: {
        mcpCapability: 'compliance_check',
        contentToCheck: '这是最好的保险产品，收益率最高，绝对安全，保本保息！',
        taskType: 'mcp_compliance_check',
        estimatedHours: 0.5,
        acceptanceCriteria: '1. 成功调用 MCP 合规校验接口；2. 识别出违规内容；3. 提供修改建议',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    results.push({
      testCase: '2. 合规校验功能',
      subTaskId: subTaskId2,
      orderIndex: 2,
      status: 'created',
    });

    // 3. 上传一个摘要到微信公众
    const subTaskId3 = randomUUID();
    await db.insert(agentSubTasks).values({
      id: subTaskId3,
      commandResultId: commandResultId,
      fromParentsExecutor: 'insurance-d',
      taskTitle: '上传一个摘要到微信公众',
      taskDescription: '使用 MCP 微信公众号功能上传文章摘要到草稿箱。文章摘要："本文详细介绍了2025年保险市场的最新趋势，包括利率走势、产品创新和监管政策变化，帮助读者了解保险市场动态。" 要求：1. 生成标题和封面建议；2. 上传到微信公众号草稿箱；3. 返回草稿链接。',
      status: 'pending',
      orderIndex: 3,
      executionDate: today,
      metadata: {
        mcpCapability: 'wechat_public',
        articleSummary: '本文详细介绍了2025年保险市场的最新趋势，包括利率走势、产品创新和监管政策变化，帮助读者了解保险市场动态。',
        taskType: 'mcp_wechat_upload',
        estimatedHours: 0.5,
        acceptanceCriteria: '1. 成功调用 MCP 微信公众号接口；2. 生成标题和封面建议；3. 上传到草稿箱并返回链接',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    results.push({
      testCase: '3. 上传一个摘要到微信公众',
      subTaskId: subTaskId3,
      orderIndex: 3,
      status: 'created',
    });

    // ============================================
    // 返回结果
    // ============================================
    return NextResponse.json({
      success: true,
      message: '✅ 3 条 MCP 功能测试子任务创建成功！',
      workflow: {
        step1: '已创建 3 条 agent_sub_tasks 记录',
        step2: '定时任务通过 agent_sub_tasks 查到任务',
        step3: '系统自动执行流程'
      },
      commandResultId: commandResultId,
      subTasks: results,
      summary: {
        totalTestCases: 3,
        testCases: [
          '1. 网页搜索带摘要',
          '2. 合规校验功能',
          '3. 上传一个摘要到微信公众'
        ],
        nextStep: '等待定时任务执行，系统会自动处理'
      }
    });
  } catch (error) {
    console.error('❌ 创建 MCP 测试子任务失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}


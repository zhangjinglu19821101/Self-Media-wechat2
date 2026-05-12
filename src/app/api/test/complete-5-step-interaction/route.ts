import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasksStepHistory, agentSubTasksMcpExecutions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCurrentBeijingTime } from '@/lib/utils/date-time';

export const maxDuration = 60;

// 生成唯一ID的工具函数
function generateUniqueId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export async function GET(request: NextRequest) {
  console.log('[5-Step-Test] 🔴 开始执行完整的5步骤交互闭环测试');

  const startTime = Date.now();
  const testResults: any[] = [];
  const databaseRecords: any = {
    stepHistory: [],
    mcpExecutions: []
  };

  try {
    // ========== 测试数据准备 ==========
    const commandResultId = generateUniqueId();
    const subTaskId = Math.floor(Math.random() * 10000) + 1000;
    
    console.log('[5-Step-Test] 📋 测试数据准备:', { commandResultId, subTaskId });

    // ========== 步骤1: Insurance-D 交互 ==========
    console.log('[5-Step-Test] 📝 ========== 步骤1: Insurance-D 交互 ==========');
    
    const step1Result = await recordAgentInteraction(
      commandResultId,
      1,
      'insurance-d',
      {
        type: 'user_request',
        content: '请上传微信公众号草稿箱',
        timestamp: getCurrentBeijingTime().toISOString()
      },
      'pre_need_support',
      {
        type: 'agent_response',
        content: '无法上传微信公众号草稿箱，需要技术支持',
        note: 'Insurance-D 无法处理上传任务，请求技术支持',
        timestamp: getCurrentBeijingTime().toISOString()
      },
      subTaskId
    );
    
    testResults.push({
      step: 1,
      name: 'Insurance-D 交互',
      status: 'success',
      interactNum: step1Result.interactNum,
      details: 'Insurance-D 收到请求，回复需要技术支持'
    });

    // ========== 步骤2: Agent B 第一次交互 (决策执行 MCP) ==========
    console.log('[5-Step-Test] 🤖 ========== 步骤2: Agent B 第一次交互 ==========');
    
    const step2Result = await recordAgentInteraction(
      commandResultId,
      2,
      'agent-b',
      {
        type: 'task_request',
        content: 'insurance-d无法上传微信公众号草稿箱，需要技术支持',
        fromAgent: 'insurance-d',
        timestamp: getCurrentBeijingTime().toISOString()
      },
      'EXECUTE_MCP',
      {
        type: 'mcp_decision',
        decision: {
          toolName: 'wechat_tools',
          actionName: 'create_wechat_draft',
          params: {
            title: '保险资讯推送',
            content: '今天为您带来最新保险资讯...',
            author: 'Insurance-D'
          }
        },
        note: 'Agent B 决策执行微信公众号草稿箱上传 MCP',
        reasoning: '需要使用 wechat_tools 工具的 create_wechat_draft 动作来完成上传',
        timestamp: getCurrentBeijingTime().toISOString()
      },
      subTaskId
    );
    
    testResults.push({
      step: 2,
      name: 'Agent B 决策执行 MCP',
      status: 'success',
      interactNum: step2Result.interactNum,
      details: 'Agent B 收到请求，决策执行 MCP'
    });

    // ========== 步骤3: Agent T 交互 (执行 MCP) ==========
    console.log('[5-Step-Test] 🔧 ========== 步骤3: Agent T 交互 ==========');
    
    const attemptId = generateUniqueId();
    const mcpExecutionData = {
      attemptId,
      attemptNumber: 1,
      toolName: 'wechat_tools',
      actionName: 'create_wechat_draft',
      params: {
        title: '保险资讯推送',
        content: '今天为您带来最新保险资讯...',
        author: 'Insurance-D'
      },
      resultStatus: 'success',
      resultData: {
        draftId: 'draft_123456',
        url: 'https://mp.weixin.qq.com/draft/123456',
        status: 'created'
      },
      resultText: '成功创建微信公众号草稿，草稿ID: draft_123456，预览链接: https://mp.weixin.qq.com/draft/123456',
      executionTimeMs: 1250
    };

    const step3Result = await recordAgentInteractionWithMcp(
      commandResultId,
      3,
      'agent-t',
      {
        type: 'mcp_execution_request',
        content: '标准的MCP执行指令',
        mcpDecision: {
          toolName: 'wechat_tools',
          actionName: 'create_wechat_draft'
        },
        note: 'Agent T 收到 MCP 执行指令',
        timestamp: getCurrentBeijingTime().toISOString()
      },
      'COMPLETE',
      {
        type: 'mcp_execution_result',
        content: '标准的调用MCP的数据格式',
        mcpResult: mcpExecutionData,
        note: 'Agent T 成功执行 MCP，返回结果数据',
        timestamp: getCurrentBeijingTime().toISOString()
      },
      subTaskId,
      [mcpExecutionData]
    );
    
    testResults.push({
      step: 3,
      name: 'Agent T 执行 MCP',
      status: 'success',
      interactNum: step3Result.interactNum,
      mcpRecorded: step3Result.mcpRecorded,
      details: 'Agent T 执行 MCP 并记录结果'
    });

    // ========== 步骤4: MCP 执行记录 (这一步在步骤3中已经通过 recordAgentInteractionWithMcp 完成) ==========
    console.log('[5-Step-Test] 📊 ========== 步骤4: MCP 执行记录 (已包含在步骤3中) ==========');
    
    testResults.push({
      step: 4,
      name: 'MCP 执行记录',
      status: 'success',
      details: 'MCP 执行记录已在步骤3中通过事务保证完成'
    });

    // ========== 步骤5: Agent B 第二次交互 (任务完成) ==========
    console.log('[5-Step-Test] ✅ ========== 步骤5: Agent B 任务完成确认 ==========');
    
    const step5Result = await recordAgentInteraction(
      commandResultId,
      4,
      'agent-b',
      {
        type: 'mcp_result_notification',
        content: '标准的调用MCP的数据格式',
        mcpResult: mcpExecutionData,
        fromAgent: 'agent-t',
        timestamp: getCurrentBeijingTime().toISOString()
      },
      'COMPLETE',
      {
        type: 'task_completion',
        content: '该指令完成',
        summary: '微信公众号草稿箱上传任务已完成',
        result: {
          draftId: 'draft_123456',
          url: 'https://mp.weixin.qq.com/draft/123456'
        },
        note: 'Agent B 确认任务完成，准备报告给 Agent A',
        timestamp: getCurrentBeijingTime().toISOString()
      },
      subTaskId
    );
    
    testResults.push({
      step: 5,
      name: 'Agent B 任务完成',
      status: 'success',
      interactNum: step5Result.interactNum,
      details: 'Agent B 收到 MCP 结果，确认任务完成'
    });

    // ========== 数据库数据核实 ==========
    console.log('[5-Step-Test] 🔍 ========== 数据库数据核实 ==========');
    
    // 查询 step_history 记录
    const stepHistoryRecords = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(eq(agentSubTasksStepHistory.commandResultId, commandResultId as any))
      .orderBy(agentSubTasksStepHistory.stepNo, agentSubTasksStepHistory.interactNum);
    
    databaseRecords.stepHistory = stepHistoryRecords;
    
    // 查询 mcp_executions 记录
    const mcpRecords = await db
      .select()
      .from(agentSubTasksMcpExecutions)
      .where(eq(agentSubTasksMcpExecutions.commandResultId, commandResultId as any));
    
    databaseRecords.mcpExecutions = mcpRecords;

    // ========== 验证结果 ==========
    const verification = {
      stepHistoryCount: stepHistoryRecords.length,
      mcpExecutionsCount: mcpRecords.length,
      expectedStepHistoryCount: 4, // 步骤1,2,3,5 共4条记录
      expectedMcpExecutionsCount: 1, // 步骤3中的1条MCP记录
      stepHistoryOk: stepHistoryRecords.length >= 4,
      mcpExecutionsOk: mcpRecords.length >= 1,
      allStepsVerified: stepHistoryRecords.length >= 4 && mcpRecords.length >= 1
    };

    const endTime = Date.now();
    const durationMs = endTime - startTime;

    console.log('[5-Step-Test] ✅ 完整的5步骤交互闭环测试完成!');

    return NextResponse.json({
      success: true,
      message: '完整的5步骤交互闭环测试完成',
      timing: {
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        durationMs
      },
      testData: {
        commandResultId,
        subTaskId
      },
      testResults,
      verification,
      databaseRecords: {
        stepHistory: stepHistoryRecords.map(r => ({
          id: r.id,
          stepNo: r.stepNo,
          interactNum: r.interactNum,
          interactUser: r.interactUser,
          interactType: r.interactType,
          hasContent: !!r.interactContent,
          contentPreview: typeof r.interactContent === 'object' ? {
            agentId: (r.interactContent as any)?.agentId,
            responseStatus: (r.interactContent as any)?.responseStatus
          } : null
        })),
        mcpExecutions: mcpRecords.map(r => ({
          id: r.id,
          attemptId: r.attemptId,
          toolName: r.toolName,
          actionName: r.actionName,
          resultStatus: r.resultStatus,
          hasResultText: !!r.resultText
        }))
      }
    });

  } catch (error) {
    console.error('[5-Step-Test] ❌ 测试失败:', error);
    
    return NextResponse.json({
      success: false,
      message: '5步骤交互闭环测试失败',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      testResults
    }, { status: 500 });
  }
}

// ========== 简化版的记录函数 (直接操作数据库，不依赖完整的 SubtaskExecutionEngine) ==========

async function recordAgentInteraction(
  commandResultId: string,
  stepNo: number,
  agentId: string,
  requestContent: any,
  responseStatus: string,
  responseContent: any,
  subTaskId?: number
): Promise<{ interactNum: number }> {
  
  const fingerprint = generateFingerprint(agentId, requestContent, responseStatus);
  
  // 检查是否已存在
  const existingRecords = await db
    .select({
      id: agentSubTasksStepHistory.id,
      interactNum: agentSubTasksStepHistory.interactNum,
      interactContent: agentSubTasksStepHistory.interactContent
    })
    .from(agentSubTasksStepHistory)
    .where(
      and(
        eq(agentSubTasksStepHistory.commandResultId, commandResultId as any),
        eq(agentSubTasksStepHistory.stepNo, stepNo),
        eq(agentSubTasksStepHistory.interactUser, agentId)
      )
    );

  // 检查重复
  for (const record of existingRecords) {
    if (isDuplicate(record.interactContent, fingerprint)) {
      console.log(`[recordAgentInteraction] ⚠️  记录已存在，复用 interactNum: ${record.interactNum}`);
      return { interactNum: record.interactNum };
    }
  }

  const nextInteractNum = existingRecords.length > 0
    ? Math.max(...existingRecords.map(r => r.interactNum || 1)) + 1
    : 1;

  try {
    await db.insert(agentSubTasksStepHistory)
      .values({
        commandResultId,
        stepNo,
        interactType: 'agent_interaction',
        interactNum: nextInteractNum,
        interactUser: agentId,
        interactContent: {
          type: 'agent_interaction',
          agentId,
          requestContent,
          responseStatus,
          responseContent,
          timestamp: getCurrentBeijingTime().toISOString(),
          fingerprint
        },
        interactTime: getCurrentBeijingTime(),
      });

    console.log(`[recordAgentInteraction] ✅ 记录插入成功: agentId=${agentId}, stepNo=${stepNo}, interactNum=${nextInteractNum}`);
    return { interactNum: nextInteractNum };
  } catch (error) {
    console.warn('[recordAgentInteraction] ⚠️  插入异常，检查是否已存在:', error);
    
    const existingRecord = await db
      .select({
        id: agentSubTasksStepHistory.id,
        interactNum: agentSubTasksStepHistory.interactNum
      })
      .from(agentSubTasksStepHistory)
      .where(
        and(
          eq(agentSubTasksStepHistory.commandResultId, commandResultId as any),
          eq(agentSubTasksStepHistory.stepNo, stepNo),
          eq(agentSubTasksStepHistory.interactUser, agentId)
        )
      )
      .limit(1);

    if (existingRecord.length > 0) {
      return { interactNum: existingRecord[0].interactNum };
    }
    
    throw error;
  }
}

async function recordAgentInteractionWithMcp(
  commandResultId: string,
  stepNo: number,
  agentId: string,
  requestContent: any,
  responseStatus: string,
  responseContent: any,
  subTaskId: number,
  mcpDataList: any[]
): Promise<{ interactNum: number; mcpRecorded: number }> {
  
  let mcpRecorded = 0;

  const result = await db.transaction(async (tx) => {
    // 1. 记录 Agent 交互
    const fingerprint = generateFingerprint(agentId, requestContent, responseStatus);
    
    const existingRecords = await tx
      .select({
        id: agentSubTasksStepHistory.id,
        interactNum: agentSubTasksStepHistory.interactNum,
        interactContent: agentSubTasksStepHistory.interactContent
      })
      .from(agentSubTasksStepHistory)
      .where(
        and(
          eq(agentSubTasksStepHistory.commandResultId, commandResultId as any),
          eq(agentSubTasksStepHistory.stepNo, stepNo),
          eq(agentSubTasksStepHistory.interactUser, agentId)
        )
      );

    let interactNum: number;
    let isNew = true;

    for (const record of existingRecords) {
      if (isDuplicate(record.interactContent, fingerprint)) {
        interactNum = record.interactNum;
        isNew = false;
        break;
      }
    }

    if (isNew!) {
      interactNum = existingRecords.length > 0
        ? Math.max(...existingRecords.map(r => r.interactNum || 1)) + 1
        : 1;

      await tx.insert(agentSubTasksStepHistory)
        .values({
          commandResultId,
          stepNo,
          interactType: 'agent_interaction',
          interactNum,
          interactUser: agentId,
          interactContent: {
            type: 'agent_interaction',
            agentId,
            requestContent,
            responseStatus,
            responseContent,
            timestamp: getCurrentBeijingTime().toISOString(),
            fingerprint,
            hasMcpExecutions: mcpDataList.length > 0,
            mcpCount: mcpDataList.length
          },
          interactTime: getCurrentBeijingTime(),
        });
    }

    // 2. 记录 MCP 执行
    for (const mcpData of mcpDataList) {
      const existingMcp = await tx
        .select({ id: agentSubTasksMcpExecutions.id })
        .from(agentSubTasksMcpExecutions)
        .where(
          and(
            eq(agentSubTasksMcpExecutions.attemptId, mcpData.attemptId),
            eq(agentSubTasksMcpExecutions.subTaskId, subTaskId)
          )
        );

      if (existingMcp.length > 0) {
        continue;
      }

      await tx.insert(agentSubTasksMcpExecutions)
        .values({
          subTaskId,
          stepNo,
          interactNo: interactNum!,
          commandResultId,
          orderIndex: stepNo,
          attemptId: mcpData.attemptId,
          attemptNumber: mcpData.attemptNumber,
          attemptTimestamp: getCurrentBeijingTime(),
          toolName: mcpData.toolName,
          actionName: mcpData.actionName,
          params: mcpData.params,
          resultStatus: mcpData.resultStatus,
          resultData: mcpData.resultData,
          resultText: mcpData.resultText,
          executionTimeMs: mcpData.executionTimeMs || 0,
        });

      mcpRecorded++;
    }

    return { interactNum: interactNum!, mcpRecorded };
  });

  console.log(`[recordAgentInteractionWithMcp] ✅ 事务完成: interactNum=${result.interactNum}, mcpRecorded=${mcpRecorded}`);
  return result;
}

function generateFingerprint(agentId: string, requestContent: any, responseStatus: string): string {
  const contentStr = typeof requestContent === 'string' 
    ? requestContent 
    : JSON.stringify(requestContent);
  return `${agentId}:${responseStatus}:${simpleHash(contentStr)}`;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

function isDuplicate(interactContent: any, fingerprint: string): boolean {
  if (!interactContent || typeof interactContent !== 'object') {
    return false;
  }
  const content = interactContent as any;
  return content.fingerprint === fingerprint;
}

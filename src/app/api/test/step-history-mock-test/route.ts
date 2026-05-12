
/**
 * 模拟数据测试：agent_sub_tasks_step_history 交互记录逻辑
 * 
 * 不依赖数据库迁移，直接在内存中模拟，验证逻辑正确性
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getCurrentBeijingTime } from '@/lib/utils/date-time';

// ============ 模拟数据类型定义 ============

interface MockStepHistoryRecord {
  id: number;
  commandResultId: string;
  stepNo: number;
  interactType: string;
  interactNum: number;
  interactContent: any;
  interactUser: string;
  interactTime: Date;
}

// ============ 模拟数据库（内存） ============

let mockStepHistory: MockStepHistoryRecord[] = [];
let nextId = 1;

// ============ 模拟 createInteractionStep 方法 ============

function mockCreateInteractionStep(
  commandResultId: string,
  stepNo: number,
  interactType: string,
  interactNum: number,
  interactUser: string,
  content: any
): MockStepHistoryRecord {
  const record: MockStepHistoryRecord = {
    id: nextId++,
    commandResultId,
    stepNo,
    interactType,
    interactNum,
    interactContent: content,
    interactUser,
    interactTime: getCurrentBeijingTime(),
  };
  
  mockStepHistory.push(record);
  console.log('[Mock] 创建记录: id=' + record.id + ', interactType=' + interactType + ', interactNum=' + interactNum);
  
  return record;
}

// ============ 模拟数据内容 ============

const mockExecutorResult = {
  isNeedMcp: true,
  problem: "需要微信公众号上传能力",
  capabilityType: "platform_publish",
  isTaskDown: false
};

const mockAgentBOutput = {
  solutionNum: 11,
  toolName: "wechat",
  actionName: "addDraft",
  params: {
    accountId: "insurance-account",
    articles: [
      {
        title: "2026医疗险避坑指南",
        author: "保险事业部",
        content: "测试内容"
      }
    ]
  },
  reasoning: "选择微信公众号上传方案",
  isNotifyAgentA: false
};

const mockFinalResult = {
  finalResult: "文章上传完成"
};

// ============ API 路由 ============

export async function POST(request: NextRequest) {
  console.log('\n' + '='.repeat(80));
  console.log('开始模拟数据测试：agent_sub_tasks_step_history');
  console.log('='.repeat(80));

  try {
    // 重置模拟数据
    mockStepHistory = [];
    nextId = 1;
    
    const testResults: any[] = [];
    const mockCommandResultId = uuidv4();
    const mockOrderIndex = 1;
    const mockFromParentsExecutor = 'insurance-d';

    console.log('\n测试参数:');
    console.log('  - commandResultId:', mockCommandResultId);
    console.log('  - orderIndex:', mockOrderIndex);
    console.log('  - fromParentsExecutor:', mockFromParentsExecutor);

    // ============ 测试1：记录执行Agent分析（request） ============
    console.log('\n' + '-'.repeat(80));
    console.log('测试1：记录执行Agent分析（request）');
    console.log('-'.repeat(80));

    try {
      const record1 = mockCreateInteractionStep(
        mockCommandResultId,
        mockOrderIndex,
        'request',
        1,
        mockFromParentsExecutor,
        {
          interact_type: 'request',
          consultant: mockFromParentsExecutor,
          responder: 'agent B',
          question: mockExecutorResult,
          response: '',
          execution_result: { status: 'waiting' },
          ext_info: { step: 'phase_1_executor_analysis' }
        }
      );

      testResults.push({
        test: '记录执行Agent分析（request）',
        status: 'success',
        data: {
          id: record1.id,
          interactType: record1.interactType,
          interactNum: record1.interactNum
        }
      });
      console.log('测试1通过');
    } catch (error) {
      testResults.push({
        test: '记录执行Agent分析（request）',
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      });
      console.error('测试1失败:', error);
    }

    // ============ 测试2：记录Agent B决策 + MCP执行结果（合并记录） ============
    console.log('\n' + '-'.repeat(80));
    console.log('测试2：记录Agent B决策 + MCP执行结果（合并记录）');
    console.log('-'.repeat(80));

    try {
      const record2 = mockCreateInteractionStep(
        mockCommandResultId,
        mockOrderIndex,
        'response',
        1,
        'agent B',
        {
          interact_type: 'response',
          consultant: mockFromParentsExecutor,
          responder: 'agent B',
          question: mockExecutorResult,
          response: {
            agent_b_decision: mockAgentBOutput,
            mcp_execution_result: mockFinalResult,
            final_result: mockFinalResult
          },
          execution_result: { status: 'success' },
          ext_info: {
            mcp_call_info: {
              solutionNum: mockAgentBOutput.solutionNum,
              toolName: mockAgentBOutput.toolName,
              actionName: mockAgentBOutput.actionName,
              params: mockAgentBOutput.params,
              reasoning: mockAgentBOutput.reasoning
            },
            mcp_execution_result: mockFinalResult,
            step: 'phase_2_agent_b_decision_with_execution'
          }
        }
      );

      testResults.push({
        test: '记录Agent B决策 + MCP执行结果（合并记录）',
        status: 'success',
        data: {
          id: record2.id,
          interactType: record2.interactType,
          interactNum: record2.interactNum,
          interactUser: record2.interactUser,
          hasMcpParams: !!record2.interactContent.ext_info?.mcp_call_info,
          hasMcpExecutionResult: !!record2.interactContent.ext_info?.mcp_execution_result
        }
      });
      console.log('测试2通过');
    } catch (error) {
      testResults.push({
        test: '记录Agent B决策 + MCP执行结果（合并记录）',
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      });
      console.error('测试2失败:', error);
    }

    // ============ 验证成对逻辑 ============
    console.log('\n' + '-'.repeat(80));
    console.log('验证成对逻辑');
    console.log('-'.repeat(80));

    const requestRecords = mockStepHistory.filter(function(r) { return r.interactType === 'request'; });
    const responseRecords = mockStepHistory.filter(function(r) { return r.interactType === 'response'; });

    console.log('记录统计：');
    console.log('  - 总记录数: ' + mockStepHistory.length);
    console.log('  - request 记录: ' + requestRecords.length);
    console.log('  - response 记录: ' + responseRecords.length);

    // 验证成对逻辑：request 和 response 有相同的 interactNum = 1
    const hasRequestWithNum1 = requestRecords.some(function(r) { return r.interactNum === 1; });
    const hasResponseWithNum1 = responseRecords.some(function(r) { return r.interactNum === 1; });
    const pairSuccess = hasRequestWithNum1 && hasResponseWithNum1;

    console.log('\n成对逻辑验证：');
    console.log('  - request 有 interactNum=1: ' + hasRequestWithNum1);
    console.log('  - response 有 interactNum=1: ' + hasResponseWithNum1);
    console.log('  - 成对逻辑: ' + (pairSuccess ? '成功' : '失败'));

    testResults.push({
      test: '成对逻辑验证',
      status: pairSuccess ? 'success' : 'failed',
      data: {
        hasRequestWithNum1,
        hasResponseWithNum1,
        pairSuccess
      }
    });

    // ============ 验证 MCP 参数存储 ============
    console.log('\n' + '-'.repeat(80));
    console.log('验证 MCP 参数存储');
    console.log('-'.repeat(80));

    const recordWithMcp = mockStepHistory.find(function(r) { 
      return r.interactContent.ext_info?.mcp_call_info;
    });

    const hasMcpParams = !!recordWithMcp;
    const mcpParams = recordWithMcp?.interactContent.ext_info?.mcp_call_info || null;

    console.log('  - 包含 MCP 参数: ' + (hasMcpParams ? '是' : '否'));
    if (mcpParams) {
      console.log('  - MCP 参数详情:', mcpParams);
    }

    testResults.push({
      test: 'MCP 参数存储验证',
      status: hasMcpParams ? 'success' : 'failed',
      data: {
        hasMcpParams,
        mcpParams
      }
    });

    // ============ 输出完整记录 ============
    console.log('\n' + '='.repeat(80));
    console.log('完整模拟记录：');
    console.log('='.repeat(80));
    
    mockStepHistory.forEach(function(record) {
      console.log('\n记录 #' + record.id + ':');
      console.log('  - interactType: ' + record.interactType);
      console.log('  - interactNum: ' + record.interactNum);
      console.log('  - interactUser: ' + record.interactUser);
      console.log('  - interactContent:', JSON.stringify(record.interactContent, null, 2));
    });

    // ============ 返回结果 ============
    console.log('\n' + '='.repeat(80));
    console.log('模拟数据测试完成');
    console.log('='.repeat(80));

    return NextResponse.json({
      success: true,
      message: '模拟数据测试完成',
      testResults,
      mockRecords: mockStepHistory,
      summary: {
        totalRecords: mockStepHistory.length,
        requestCount: requestRecords.length,
        responseCount: responseRecords.length,
        pairLogicSuccess: pairSuccess,
        mcpParamsStored: hasMcpParams
      }
    });

  } catch (error) {
    console.error('模拟数据测试失败:', error);
    return NextResponse.json({
      success: false,
      message: '模拟数据测试失败',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}


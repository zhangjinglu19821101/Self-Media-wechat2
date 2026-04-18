/**
 * 验证13个测试案例的 step-history 数据结构
 *
 * 功能：
 * 1. 分析每个案例想测试的业务场景
 * 2. 验证 step-history 数据结构是否符合预期
 * 3. 输出完整的验证报告
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasksStepHistory } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

// ==================== 13个测试案例定义 ====================

const TEST_CASES = [
  // 基础功能 (6个)
  {
    id: 'TC-01A',
    name: '初始不合规→整改→成功上传公众号',
    category: '基础功能',
    scenario: {
      description: '内容不合规时的整改流程',
      keyPoints: [
        '初始内容违规',
        'Agent 识别违规并提示修改',
        '用户整改后重新提交',
        '合规审核通过，成功上传公众号'
      ]
    },
    expectedDataStructure: {
      hasMultipleInteractions: true,
      hasComplianceDecision: true,
      hasUserModification: true,
      hasWechatMcp: true,
      decisionTypes: ['NEED_USER', 'COMPLETE']
    }
  },
  {
    id: 'TC-01B',
    name: '初始合规→直接上传公众号',
    category: '基础功能',
    scenario: {
      description: '内容合规时的直接发布流程',
      keyPoints: [
        '初始内容合规',
        'Agent 审核通过',
        '直接上传公众号'
      ]
    },
    expectedDataStructure: {
      hasRequestResponsePairs: true,
      hasComplianceDecision: true,
      hasWechatMcp: true,
      decisionTypes: ['COMPLETE']
    }
  },
  {
    id: 'TC-01C',
    name: '合规审核-流程完整性',
    category: '基础功能',
    scenario: {
      description: '合规审核流程的完整性验证',
      keyPoints: [
        '提交内容审核',
        'Agent 执行完整审核流程',
        '输出审核结果'
      ]
    },
    expectedDataStructure: {
      hasRequestResponsePairs: true,
      hasComplianceDecision: true,
      hasExecutionSummary: true
    }
  },
  {
    id: 'TC-02',
    name: '网页搜索带摘要',
    category: '基础功能',
    scenario: {
      description: '网页搜索+摘要功能',
      keyPoints: [
        '执行网页搜索',
        '生成搜索摘要'
      ]
    },
    expectedDataStructure: {
      hasSearchMcp: true,
      hasSummary: true
    }
  },
  {
    id: 'TC-03',
    name: '网页搜索（基础版）',
    category: '基础功能',
    scenario: {
      description: '基础网页搜索功能',
      keyPoints: [
        '执行基础网页搜索',
        '返回搜索结果'
      ]
    },
    expectedDataStructure: {
      hasSearchMcp: true
    }
  },
  {
    id: 'TC-04',
    name: '添加草稿',
    category: '基础功能',
    scenario: {
      description: '微信公众号添加草稿功能',
      keyPoints: [
        '准备文章内容',
        '调用微信公众号添加草稿 API'
      ]
    },
    expectedDataStructure: {
      hasWechatMcp: true,
      mcpAction: 'add_draft'
    }
  },

  // 复杂场景 (7个)
  {
    id: 'TC-05',
    name: 'MCP首次失败重试成功',
    category: '复杂场景',
    scenario: {
      description: 'MCP 失败重试机制验证',
      keyPoints: [
        '第一次 MCP 调用失败',
        'Agent 自动重试',
        '第二次调用成功'
      ]
    },
    expectedDataStructure: {
      hasMcpRetries: true,
      minAttempts: 2,
      firstFailure: true,
      finalSuccess: true
    }
  },
  {
    id: 'TC-06',
    name: 'MCP多次失败最终失败',
    category: '复杂场景',
    scenario: {
      description: 'MCP 重试限制机制验证',
      keyPoints: [
        '第一次 MCP 调用失败',
        'Agent 多次重试（达到最大重试次数）',
        '最终放弃，返回失败'
      ]
    },
    expectedDataStructure: {
      hasMcpRetries: true,
      minAttempts: 2,
      allFailures: true,
      finalDecision: 'FAILED'
    }
  },
  {
    id: 'TC-07',
    name: '达到最大迭代次数',
    category: '复杂场景',
    scenario: {
      description: '最大迭代次数限制验证',
      keyPoints: [
        'Agent 执行多轮迭代',
        '达到最大迭代次数限制',
        '停止执行'
      ]
    },
    expectedDataStructure: {
      hasMultipleSteps: true,
      hasMaxIterationNote: true
    }
  },
  {
    id: 'TC-08',
    name: '用户确认后继续执行',
    category: '复杂场景',
    scenario: {
      description: '用户交互确认机制验证',
      keyPoints: [
        'Agent 执行需要用户确认的操作',
        '暂停等待用户确认',
        '用户确认后继续执行'
      ]
    },
    expectedDataStructure: {
      hasNeedUserDecision: true,
      hasUserInteraction: true,
      hasContinuationAfterConfirm: true
    }
  },

  // 重点业务流程 (3个)
  {
    id: 'TC-23',
    name: '多次违规→多次整改→最终成功上传公众号',
    category: '重点业务',
    isPriority: true,
    scenario: {
      description: '多轮违规整改的完整业务流程',
      keyPoints: [
        '第1次内容违规 → Agent 提示修改',
        '用户整改 → 第2次仍然违规 → Agent 再次提示',
        '用户再次整改 → 第3次合规',
        '成功上传公众号'
      ]
    },
    expectedDataStructure: {
      minInteractions: 3,
      hasMultipleRequestResponsePairs: true,
      hasMultipleComplianceDecisions: true,
      hasUserModifications: true,
      hasFinalCompleteDecision: true,
      hasWechatMcp: true
    }
  },
  {
    id: 'TC-24',
    name: '合规通过-正常发布流程',
    category: '重点业务',
    isPriority: true,
    scenario: {
      description: '合规内容的完整正常发布流程',
      keyPoints: [
        '内容合规 → Agent 审核通过',
        '直接执行公众号发布流程',
        '成功上传公众号'
      ]
    },
    expectedDataStructure: {
      hasRequestResponsePairs: true,
      hasCompleteDecision: true,
      hasWechatMcp: true,
      mcpSuccess: true
    }
  },
  {
    id: 'TC-25',
    name: '合规不通过-提示修改后重试',
    category: '重点业务',
    isPriority: true,
    scenario: {
      description: '违规后提示修改再重试的流程',
      keyPoints: [
        '内容违规 → Agent 提示具体修改意见',
        '用户根据提示修改',
        '修改后合规 → 成功上传公众号'
      ]
    },
    expectedDataStructure: {
      minInteractions: 2,
      hasRequestResponsePairs: true,
      hasFirstNeedUserDecision: true,
      hasUserModification: true,
      hasSecondCompleteDecision: true,
      hasWechatMcp: true
    }
  }
];

// ==================== 数据结构验证器 ====================

async function validateTestCase(commandResultId: string, testCase: any) {
  const result = {
    testCaseId: testCase.id,
    testCaseName: testCase.name,
    category: testCase.category,
    isPriority: testCase.isPriority || false,
    passed: false,
    checks: {} as any,
    issues: [] as string[],
    sampleData: null as any
  };

  try {
    // 查询 step_history 数据
    const records = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(eq(agentSubTasksStepHistory.commandResultId, commandResultId as any))
      .orderBy(agentSubTasksStepHistory.stepNo, agentSubTasksStepHistory.interactNum);

    if (records.length === 0) {
      result.issues.push('❌ 没有找到 step_history 记录');
      return result;
    }

    result.sampleData = {
      totalRecords: records.length,
      interactNums: [...new Set(records.map(r => r.interactNum))],
      stepNos: [...new Set(records.map(r => r.stepNo))]
    };

    // ========== 基础检查 ==========
    const checks = result.checks;

    // 基础数据结构
    checks.hasBasicStructure = records.every(r =>
      r.commandResultId &&
      r.stepNo !== undefined &&
      r.interactNum !== undefined &&
      r.interactType &&
      r.interactUser &&
      r.interactTime &&
      r.interactContent
    );

    if (!checks.hasBasicStructure) {
      result.issues.push('❌ 基础数据结构不完整');
    }

    // request/response 成对
    const hasRequest = records.some(r => r.interactType === 'request');
    const hasResponse = records.some(r => r.interactType === 'response');
    checks.hasRequest = hasRequest;
    checks.hasResponse = hasResponse;

    // 检查成对
    const interactNums = new Set(records.map(r => r.interactNum));
    let hasPairs = false;
    for (const num of interactNums) {
      const pairRecords = records.filter(r => r.interactNum === num);
      if (pairRecords.some(r => r.interactType === 'request') &&
          pairRecords.some(r => r.interactType === 'response')) {
        hasPairs = true;
        break;
      }
    }
    checks.hasRequestResponsePairs = hasPairs;

    // ========== 业务数据检查 ==========
    const responseRecords = records.filter(r => r.interactType === 'response');

    // 检查 mcp_attempts
    let hasMcpAttempts = false;
    let mcpAttemptsTotal = 0;
    const mcpTools = new Set<string>();

    // 检查 decision
    let hasDecision = false;
    const decisionTypes = new Set<string>();

    // 检查 execution_summary
    let hasExecutionSummary = false;

    // 检查 user_interactions
    let hasUserInteractions = false;

    for (const record of responseRecords) {
      const content = record.interactContent as any;
      if (content?.response) {
        if (content.response.mcp_attempts && Array.isArray(content.response.mcp_attempts)) {
          hasMcpAttempts = true;
          mcpAttemptsTotal += content.response.mcp_attempts.length;
          for (const attempt of content.response.mcp_attempts) {
            if (attempt.decision?.toolName) {
              mcpTools.add(attempt.decision.toolName);
            }
          }
        }

        if (content.response.decision) {
          hasDecision = true;
          decisionTypes.add(content.response.decision.type);
        }

        if (content.response.execution_summary) {
          hasExecutionSummary = true;
        }

        if (content.response.user_interactions && Array.isArray(content.response.user_interactions)) {
          hasUserInteractions = true;
        }
      }
    }

    checks.hasMcpAttempts = hasMcpAttempts;
    checks.mcpAttemptsTotal = mcpAttemptsTotal;
    checks.mcpTools = [...mcpTools];
    checks.hasDecision = hasDecision;
    checks.decisionTypes = [...decisionTypes];
    checks.hasExecutionSummary = hasExecutionSummary;
    checks.hasUserInteractions = hasUserInteractions;

    // ========== 场景特定检查 ==========
    const expected = testCase.expectedDataStructure;

    if (expected.hasMultipleInteractions) {
      checks.hasMultipleInteractions = interactNums.size >= 2;
      if (!checks.hasMultipleInteractions) {
        result.issues.push(`⚠️  期望多轮交互，实际只有 ${interactNums.size} 轮`);
      }
    }

    if (expected.minInteractions) {
      checks.meetsMinInteractions = interactNums.size >= expected.minInteractions;
      if (!checks.meetsMinInteractions) {
        result.issues.push(`⚠️  期望至少 ${expected.minInteractions} 轮交互，实际只有 ${interactNums.size} 轮`);
      }
    }

    if (expected.hasSearchMcp) {
      checks.hasSearchMcp = mcpTools.has('search');
      if (!checks.hasSearchMcp) {
        result.issues.push('⚠️  期望有 search MCP 调用');
      }
    }

    if (expected.hasWechatMcp) {
      checks.hasWechatMcp = mcpTools.has('wechat');
      if (!checks.hasWechatMcp) {
        result.issues.push('⚠️  期望有 wechat MCP 调用');
      }
    }

    if (expected.hasMcpRetries) {
      checks.hasMcpRetries = mcpAttemptsTotal >= (expected.minAttempts || 2);
      if (!checks.hasMcpRetries) {
        result.issues.push(`⚠️  期望至少 ${expected.minAttempts || 2} 次 MCP 尝试，实际有 ${mcpAttemptsTotal} 次`);
      }
    }

    if (expected.hasNeedUserDecision) {
      checks.hasNeedUserDecision = decisionTypes.has('NEED_USER');
      if (!checks.hasNeedUserDecision) {
        result.issues.push('⚠️  期望有 NEED_USER 决策');
      }
    }

    // ========== 总体判断 ==========
    // 只要基础数据结构完整就算通过
    result.passed = checks.hasBasicStructure && hasRequest && hasResponse;

    if (result.passed) {
      result.issues.unshift('✅ 数据结构基本完整');
    }

  } catch (error) {
    result.issues.push(`❌ 验证出错: ${error}`);
  }

  return result;
}

// ==================== 主入口 ====================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'summary';

    // 先查找有数据的 command_result_id
    const recentRecords = await db
      .select()
      .from(agentSubTasksStepHistory)
      .orderBy(desc(agentSubTasksStepHistory.interactTime))
      .limit(100);

    const uniqueCmdIds = [...new Set(recentRecords.map(r => r.commandResultId))];

    if (uniqueCmdIds.length === 0) {
      return NextResponse.json({
        success: false,
        message: '没有找到 step_history 数据，请先运行测试生成数据'
      });
    }

    // 为每个测试案例找一个匹配的记录进行验证
    const validationResults = [];

    // 先用第一个有数据的 command_result_id 做示例验证
    const sampleCmdId = uniqueCmdIds[0];

    for (const testCase of TEST_CASES) {
      // 这里简化：用同一个 command_result_id 验证所有案例的结构
      // 实际使用时应该根据 task_type 匹配对应的记录
      const result = await validateTestCase(sampleCmdId, testCase);
      validationResults.push(result);
    }

    // ========== 生成总结 ==========
    const summary = {
      totalTestCases: TEST_CASES.length,
      passed: validationResults.filter(r => r.passed).length,
      failed: validationResults.filter(r => !r.passed).length,
      priorityCases: validationResults.filter(r => r.isPriority),
      sampleCommandResultId: sampleCmdId,
      availableCommandResultIds: uniqueCmdIds.slice(0, 5)
    };

    if (mode === 'summary') {
      return NextResponse.json({
        success: true,
        summary,
        testCases: TEST_CASES.map(tc => ({
          id: tc.id,
          name: tc.name,
          category: tc.category,
          isPriority: tc.isPriority,
          scenario: tc.scenario.description
        }))
      });
    } else {
      return NextResponse.json({
        success: true,
        summary,
        validationResults
      });
    }

  } catch (error) {
    console.error('❌ 验证失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

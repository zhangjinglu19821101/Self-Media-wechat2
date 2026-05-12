/**
 * 完整的 Agent 交互记录端到端测试
 * 
 * 真实调用数据库，验证 recordAgentInteraction 和 recordMcpExecution 方法
 */

import { NextResponse } from 'next/server';
import { SubtaskExecutionEngine } from '@/lib/services/subtask-execution-engine';
import { getCurrentBeijingTime } from '@/lib/utils/date-time';

export async function GET() {
  const startTime = getCurrentBeijingTime();
  console.log('🧪 ========== 开始完整的 Agent 交互记录端到端测试 ==========');
  console.log('🧪 开始时间:', startTime.toISOString());

  try {
    const engine = new SubtaskExecutionEngine();
    
    // 测试数据
    const testCommandResultId = 'test-e2e-' + Date.now();
    const testStepNo = 1;
    const testSubTaskId = 99999;

    const testResults: any[] = [];

    // ========== 测试1: recordAgentInteraction ==========
    console.log('\n🧪 【测试1】recordAgentInteraction 方法');
    try {
      const interactNum = await engine.recordAgentInteraction(
        testCommandResultId,
        testStepNo,
        'test-agent',
        {
          type: 'test_request',
          task: '测试任务',
          timestamp: getCurrentBeijingTime().toISOString()
        },
        'COMPLETE',
        {
          type: 'test_response',
          result: '测试成功',
          timestamp: getCurrentBeijingTime().toISOString()
        },
        testSubTaskId
      );

      testResults.push({
        testName: 'recordAgentInteraction',
        passed: true,
        interactNum,
        message: `成功记录 Agent 交互，interactNum: ${interactNum}`
      });
      console.log('✅ recordAgentInteraction 测试通过，interactNum:', interactNum);
    } catch (error) {
      testResults.push({
        testName: 'recordAgentInteraction',
        passed: false,
        error: error instanceof Error ? error.message : String(error)
      });
      console.error('❌ recordAgentInteraction 测试失败:', error);
    }

    // ========== 测试2: 重复插入防护 ==========
    console.log('\n🧪 【测试2】重复插入防护');
    try {
      const interactNum1 = await engine.recordAgentInteraction(
        testCommandResultId,
        testStepNo,
        'test-agent',
        {
          type: 'test_request',
          task: '测试任务',
          timestamp: getCurrentBeijingTime().toISOString()
        },
        'COMPLETE',
        {
          type: 'test_response',
          result: '测试成功',
          timestamp: getCurrentBeijingTime().toISOString()
        },
        testSubTaskId
      );

      const interactNum2 = await engine.recordAgentInteraction(
        testCommandResultId,
        testStepNo,
        'test-agent',
        {
          type: 'test_request',
          task: '测试任务',
          timestamp: getCurrentBeijingTime().toISOString()
        },
        'COMPLETE',
        {
          type: 'test_response',
          result: '测试成功',
          timestamp: getCurrentBeijingTime().toISOString()
        },
        testSubTaskId
      );

      testResults.push({
        testName: '重复插入防护',
        passed: interactNum1 === interactNum2,
        interactNum1,
        interactNum2,
        message: interactNum1 === interactNum2 
          ? `重复插入防护生效，两次都返回相同的 interactNum: ${interactNum1}`
          : `重复插入防护可能有问题，interactNum1: ${interactNum1}, interactNum2: ${interactNum2}`
      });
      console.log('✅ 重复插入防护测试:', interactNum1 === interactNum2 ? '通过' : '需要检查');
    } catch (error) {
      testResults.push({
        testName: '重复插入防护',
        passed: false,
        error: error instanceof Error ? error.message : String(error)
      });
      console.error('❌ 重复插入防护测试失败:', error);
    }

    // ========== 测试3: 不同内容生成不同 interactNum ==========
    console.log('\n🧪 【测试3】不同内容生成不同 interactNum');
    try {
      const interactNumA = await engine.recordAgentInteraction(
        testCommandResultId,
        testStepNo,
        'test-agent',
        {
          type: 'test_request',
          task: '测试任务 A',
          timestamp: getCurrentBeijingTime().toISOString()
        },
        'COMPLETE',
        {
          type: 'test_response',
          result: '测试成功 A',
          timestamp: getCurrentBeijingTime().toISOString()
        },
        testSubTaskId
      );

      const interactNumB = await engine.recordAgentInteraction(
        testCommandResultId,
        testStepNo,
        'test-agent',
        {
          type: 'test_request',
          task: '测试任务 B',
          timestamp: getCurrentBeijingTime().toISOString()
        },
        'COMPLETE',
        {
          type: 'test_response',
          result: '测试成功 B',
          timestamp: getCurrentBeijingTime().toISOString()
        },
        testSubTaskId
      );

      testResults.push({
        testName: '不同内容生成不同 interactNum',
        passed: interactNumA !== interactNumB,
        interactNumA,
        interactNumB,
        message: interactNumA !== interactNumB
          ? `不同内容生成不同的 interactNum: A=${interactNumA}, B=${interactNumB}`
          : `不同内容应该生成不同的 interactNum，但都是: ${interactNumA}`
      });
      console.log('✅ 不同内容测试:', interactNumA !== interactNumB ? '通过' : '需要检查');
    } catch (error) {
      testResults.push({
        testName: '不同内容生成不同 interactNum',
        passed: false,
        error: error instanceof Error ? error.message : String(error)
      });
      console.error('❌ 不同内容测试失败:', error);
    }

    // ========== 测试4: recordAgentInteractionWithMcp ==========
    console.log('\n🧪 【测试4】recordAgentInteractionWithMcp 方法');
    try {
      const result = await engine.recordAgentInteractionWithMcp(
        testCommandResultId,
        testStepNo,
        'test-agent-with-mcp',
        {
          type: 'test_request_with_mcp',
          task: '测试任务带 MCP',
          timestamp: getCurrentBeijingTime().toISOString()
        },
        'EXECUTE_MCP',
        {
          type: 'test_response_with_mcp',
          result: 'MCP 执行成功',
          timestamp: getCurrentBeijingTime().toISOString()
        },
        testSubTaskId,
        [
          {
            attemptId: 'mcp-test-' + Date.now(),
            attemptNumber: 1,
            toolName: 'test_tool',
            actionName: 'test_action',
            params: { query: 'test' },
            resultStatus: 'success',
            resultData: { result: 'success' },
            resultText: '【测试结果】成功',
            executionTimeMs: 100,
          }
        ]
      );

      testResults.push({
        testName: 'recordAgentInteractionWithMcp',
        passed: true,
        result,
        message: `成功记录 Agent 交互 + MCP 执行，interactNum: ${result.interactNum}`
      });
      console.log('✅ recordAgentInteractionWithMcp 测试通过');
    } catch (error) {
      testResults.push({
        testName: 'recordAgentInteractionWithMcp',
        passed: false,
        error: error instanceof Error ? error.message : String(error)
      });
      console.error('❌ recordAgentInteractionWithMcp 测试失败:', error);
    }

    // ========== 汇总测试结果 ==========
    const endTime = getCurrentBeijingTime();
    const durationMs = endTime.getTime() - startTime.getTime();
    const passedCount = testResults.filter(r => r.passed).length;
    const failedCount = testResults.filter(r => !r.passed).length;

    console.log('\n🧪 ========== 完整端到端测试完成 ==========');
    console.log('🧪 结束时间:', endTime.toISOString());
    console.log('🧪 耗时:', durationMs, 'ms');
    console.log('🧪 总测试数:', testResults.length);
    console.log('🧪 通过:', passedCount);
    console.log('🧪 失败:', failedCount);
    console.log('🧪 通过率:', ((passedCount / testResults.length) * 100).toFixed(1) + '%');

    return NextResponse.json({
      success: true,
      message: '完整的 Agent 交互记录端到端测试完成',
      timing: {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        durationMs,
      },
      summary: {
        total: testResults.length,
        passed: passedCount,
        failed: failedCount,
        passRate: `${((passedCount / testResults.length) * 100).toFixed(1)}%`,
      },
      details: testResults,
    });

  } catch (error) {
    console.error('❌ 完整端到端测试失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

/**
 * 完整查看和验证 agent_sub_tasks_step_history 表数据
 *
 * 功能：
 * 1. 查看 step_history 表数据
 * 2. 验证数据是否符合业务场景要求
 * 3. 检查 mcp_attempts, decision, execution_summary 等数据结构
 *
 * 使用方法：
 *   GET /api/test/check-step-history
 *   GET /api/test/check-step-history?commandResultId=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasksStepHistory } from '@/lib/db/schema';
import { desc, eq, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '10');
  const commandResultId = searchParams.get('commandResultId');

  try {
    if (commandResultId) {
      // 查看单个 command_result_id 的详细数据并验证
      console.log(`🔍 验证 command_result_id: ${commandResultId}`);

      const records = await db
        .select()
        .from(agentSubTasksStepHistory)
        .where(eq(agentSubTasksStepHistory.commandResultId, commandResultId as any))
        .orderBy(agentSubTasksStepHistory.stepNo, agentSubTasksStepHistory.interactNum);

      // ========== 业务场景数据完整性验证 ==========
      const checks = {
        // 基础检查
        hasRecords: records.length > 0,
        hasRequest: records.some(r => r.interactType === 'request'),
        hasResponse: records.some(r => r.interactType === 'response'),

        // 数据结构检查
        hasMcpAttempts: false,
        hasDecision: false,
        hasExecutionSummary: false,
        hasUserInteractions: false,

        // 成对检查
        hasRequestResponsePairs: false,

        // MCP 重试场景检查
        hasMcpFailures: false,
        hasMcpRetries: false,
        hasFinalSuccess: false,
      };

      const details = {
        totalRecords: records.length,
        requestCount: records.filter(r => r.interactType === 'request').length,
        responseCount: records.filter(r => r.interactType === 'response').length,
        interactNums: [...new Set(records.map(r => r.interactNum))],
        mcpAttemptsTotal: 0,
        decisions: [] as string[],

        // MCP 详细分析
        mcpAnalysis: [] as any[],
        mcpFailuresCount: 0,
        mcpSuccessesCount: 0,
        mcpRetryPatterns: [] as any[],
      };

      // 检查每条记录的数据结构
      for (const record of records) {
        const content = record.interactContent as any;

        if (record.interactType === 'response' && content?.response) {
          // 检查 mcp_attempts
          if (content.response.mcp_attempts && Array.isArray(content.response.mcp_attempts)) {
            checks.hasMcpAttempts = true;
            details.mcpAttemptsTotal += content.response.mcp_attempts.length;

            // ========== MCP 重试场景详细分析 ==========
            const mcpAttempts = content.response.mcp_attempts;
            const stepAnalysis = {
              stepNo: record.stepNo,
              interactNum: record.interactNum,
              totalAttempts: mcpAttempts.length,
              attempts: [] as any[],
              hasFailure: false,
              hasRetry: false,
              finalSuccess: false,
            };

            for (let i = 0; i < mcpAttempts.length; i++) {
              const attempt = mcpAttempts[i];
              
              // ========== 根据实际数据结构分析 ==========
              // 从调试数据看:
              // - attempt.status: "success" (调用执行成功)
              // - attempt.result.data.success: true/false (实际业务结果)
              // - attempt.result.data.error: 错误信息 (如存在)
              const callSuccess = attempt.status === 'success';
              const businessSuccess = attempt.result?.data?.success === true;
              const hasBusinessError = attempt.result?.data?.error !== undefined;
              
              // 判断是否成功：调用成功 且 业务成功
              const isSuccess = callSuccess && businessSuccess;
              
              const attemptInfo = {
                attemptNo: i + 1,
                toolName: attempt.decision?.toolName || null,
                actionName: attempt.decision?.actionName || null,
                callStatus: attempt.status,
                callSuccess: callSuccess,
                businessSuccess: businessSuccess,
                hasBusinessError: hasBusinessError,
                errorMessage: attempt.result?.data?.error || null,
                isSuccess: isSuccess,
                // 调试原始值
                _rawStatus: attempt.status,
                _rawResultSuccess: attempt.result?.data?.success,
              };

              stepAnalysis.attempts.push(attemptInfo);

              if (!isSuccess) {
                stepAnalysis.hasFailure = true;
                details.mcpFailuresCount++;
                checks.hasMcpFailures = true;
              } else {
                details.mcpSuccessesCount++;
              }
            }

            // 检查是否有重试（多次尝试）
            if (mcpAttempts.length > 1) {
              stepAnalysis.hasRetry = true;
              checks.hasMcpRetries = true;

              // 分析重试模式
              details.mcpRetryPatterns.push({
                stepNo: record.stepNo,
                interactNum: record.interactNum,
                attemptCount: mcpAttempts.length,
                successOnAttempt: mcpAttempts.findIndex(a => a.is_success) + 1 || null,
              });
            }

            // 检查最后一次是否成功
            if (mcpAttempts.length > 0 && mcpAttempts[mcpAttempts.length - 1].is_success) {
              stepAnalysis.finalSuccess = true;
              checks.hasFinalSuccess = true;
            }

            details.mcpAnalysis.push(stepAnalysis);
          }

          // 检查 decision
          if (content.response.decision) {
            checks.hasDecision = true;
            details.decisions.push(content.response.decision.type);
          }

          // 检查 execution_summary
          if (content.response.execution_summary) {
            checks.hasExecutionSummary = true;
          }

          // 检查 user_interactions
          if (content.response.user_interactions && Array.isArray(content.response.user_interactions)) {
            checks.hasUserInteractions = true;
          }
        }
      }

      // 检查是否有成对的 request/response
      for (const num of details.interactNums) {
        const pairRecords = records.filter(r => r.interactNum === num);
        const hasRequest = pairRecords.some(r => r.interactType === 'request');
        const hasResponse = pairRecords.some(r => r.interactType === 'response');
        if (hasRequest && hasResponse) {
          checks.hasRequestResponsePairs = true;
          break;
        }
      }

      // ========== 生成验证报告 ==========
      const issues: string[] = [];

      if (!checks.hasRecords) issues.push('❌ 没有任何记录');
      if (!checks.hasRequest) issues.push('❌ 缺少 request 类型记录');
      if (!checks.hasResponse) issues.push('❌ 缺少 response 类型记录');
      if (!checks.hasRequestResponsePairs) issues.push('❌ 没有成对的 request/response（同一 interact_num）');
      if (!checks.hasMcpAttempts) issues.push('⚠️  没有找到 mcp_attempts 数据');
      if (!checks.hasDecision) issues.push('⚠️  没有找到 decision 数据');
      if (!checks.hasExecutionSummary) issues.push('⚠️  没有找到 execution_summary 数据');

      // ========== MCP 重试场景验证说明 ==========
      const mcpValidationNotes: string[] = [];

      if (checks.hasMcpAttempts) {
        mcpValidationNotes.push(`📊 MCP 调用统计: 总 ${details.mcpAttemptsTotal} 次, 成功 ${details.mcpSuccessesCount} 次, 失败 ${details.mcpFailuresCount} 次`);

        if (checks.hasMcpFailures && checks.hasMcpRetries) {
          mcpValidationNotes.push('✅ 【关键验证】检测到 MCP 失败后重试场景！');

          for (const pattern of details.mcpRetryPatterns) {
            if (pattern.successOnAttempt) {
              mcpValidationNotes.push(`   - Step ${pattern.stepNo}/Interact ${pattern.interactNum}: 重试 ${pattern.attemptCount} 次后在第 ${pattern.successOnAttempt} 次成功`);
            } else {
              mcpValidationNotes.push(`   - Step ${pattern.stepNo}/Interact ${pattern.interactNum}: 重试 ${pattern.attemptCount} 次后仍然失败`);
            }
          }
        } else if (checks.hasMcpFailures) {
          mcpValidationNotes.push('⚠️  检测到 MCP 失败，但没有重试');
        } else if (checks.hasMcpRetries) {
          mcpValidationNotes.push('⚠️  检测到多次 MCP 调用，但没有失败（无需重试）');
        } else {
          mcpValidationNotes.push('✅ MCP 调用正常（无失败无需重试）');
        }
      }

      if (issues.length === 0) {
        issues.push('✅ 所有业务场景检查通过！数据结构完整！');
      }

      return NextResponse.json({
        success: true,
        mode: 'business_scenario_validation',
        commandResultId,
        validation: {
          passed: issues.length === 1 && issues[0].includes('✅'),
          checks,
          details,
          issues,
          mcpValidationNotes
        },
        sampleRecords: records.slice(0, 5).map(r => ({
          stepNo: r.stepNo,
          interactType: r.interactType,
          interactNum: r.interactNum,
          interactUser: r.interactUser,
          interactTime: r.interactTime,
          contentKeys: Object.keys((r.interactContent as any) || {})
        }))
      });

    } else {
      // 查看最近的记录概览
      console.log(`🔍 查看最近 ${limit} 条记录...`);

      const records = await db
        .select()
        .from(agentSubTasksStepHistory)
        .orderBy(desc(agentSubTasksStepHistory.interactTime))
        .limit(limit);

      // 统计
      const cmdIds = new Set(records.map(r => r.commandResultId));

      return NextResponse.json({
        success: true,
        mode: 'overview',
        summary: {
          totalRecordsShown: records.length,
          uniqueCommandResultIds: cmdIds.size,
          sampleCommandResultIds: [...cmdIds].slice(0, 5)
        },
        recentRecords: records.map(r => ({
          commandResultId: r.commandResultId,
          stepNo: r.stepNo,
          interactType: r.interactType,
          interactNum: r.interactNum,
          interactUser: r.interactUser,
          interactTime: r.interactTime
        }))
      });
    }

  } catch (error) {
    console.error('❌ 查询失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

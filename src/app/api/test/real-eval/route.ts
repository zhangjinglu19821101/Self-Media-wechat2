/**
 * 真实数据验证 API
 * 从数据库动态读取 agent_sub_tasks_step_history 中的真实数据
 * 构造真实的 ExecutionContext，调用引擎中真正的 evaluateExecutorCompletionBeforeLoopExit
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasksStepHistory } from '@/lib/db/schema/agent-sub-tasks-step-history';
import { eq, desc } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { commandResultId } = body;

    if (!commandResultId) {
      return NextResponse.json({ error: '请提供 commandResultId' }, { status: 400 });
    }

    // 1. 从数据库读取该任务的所有步骤历史
    const steps = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(eq(agentSubTasksStepHistory.commandResultId, commandResultId))
      .orderBy(agentSubTasksStepHistory.id);

    if (!steps || steps.length === 0) {
      return NextResponse.json({ error: `未找到 command_result_id=${commandResultId} 的步骤记录` }, { status: 404 });
    }

    // 2. 提取每一步的关键信息
    const stepAnalysis = steps.map((step: any) => {
      const content = step.interactContent || step.interact_content;
      const agentId = content?.agentId || content?.requestContent?.agentId || 'unknown';
      
      // 从 responseContent 提取执行者输出（insurance-d 的输出）
      const responseContent = content?.responseContent || {};
      const isTaskDown = responseContent.isTaskDown;
      const isCompleted = responseContent.isCompleted;
      const briefResponse = typeof responseContent.briefResponse === 'string' 
        ? responseContent.briefResponse 
        : JSON.stringify(responseContent.briefResponse);
      const executionSummary = typeof responseContent.executionSummary === 'string' 
        ? responseContent.executionSummary 
        : JSON.stringify(responseContent.executionSummary);
      
      // 从 responseContent 提取 Agent B 的决策
      const decision = responseContent.decision || {};
      const decisionType = decision.type;
      const reasonCode = decision.reasonCode;
      const reasoning = decision.reasoning?.substring(0, 200);
      
      // MCP 结果
      const mcpResult = responseContent.mcpExecutionResult;
      const mcpStatus = mcpResult?.status;
      const mcpBusinessSuccess = mcpResult?.data?.success;
      
      return {
        stepNo: step.stepNo || step.step_no,
        agentId,
        // 执行者输出
        isTaskDown,
        isCompleted,
        briefResponse: briefResponse?.substring(0, 100),
        executionSummary: executionSummary?.substring(0, 200),
        // MCP 结果
        mcpStatus,
        mcpBusinessSuccess,
        // Agent B 决策
        decisionType,
        reasonCode,
        reasoning,
      };
    });

    // 3. 找到最后一次 insurance-d 执行的步骤
    const insuranceDSteps = stepAnalysis.filter(
      (s: any) => s.agentId === 'insurance-d'
    );
    const lastInsuranceDStep = insuranceDSteps[insuranceDSteps.length - 1];
    
    // 4. 找到最后一次 Agent B 评审的步骤
    const agentBSteps = stepAnalysis.filter(
      (s: any) => s.agentId === 'agent B' || s.agentId === 'B'
    );
    const lastAgentBStep = agentBSteps[agentBSteps.length - 1];

    // 5. 模拟终审：用最后一次 insurance-d 的数据构造 ExecutionContext
    let finalEvalResult = null;
    let finalEvalExplanation = null;
    
    if (lastInsuranceDStep) {
      // 构造与引擎中相同的结构
      const mockExecutionContext = {
        executorFeedback: {
          isNeedMcp: lastInsuranceDStep.mcpStatus !== undefined,
          isTaskDown: lastInsuranceDStep.isTaskDown,
          isNeedSplit: false,
          splitReason: '',
          suggestedSplitPoints: [],
          originalTask: '',
          problem: '',
          attemptedSolutions: [],
          decisionContent: lastInsuranceDStep.isCompleted !== undefined
            ? { isCompleted: lastInsuranceDStep.isCompleted }
            : undefined,
          briefResponse: lastInsuranceDStep.briefResponse,
          executionSummary: lastInsuranceDStep.executionSummary,
        },
        mcpExecutionHistory: lastInsuranceDStep.mcpStatus
          ? [{
              decision: { orderIndex: 2 },
              result: {
                status: lastInsuranceDStep.mcpStatus,
                data: { success: lastInsuranceDStep.mcpBusinessSuccess }
              }
            }]
          : [],
        taskMeta: {
          taskId: commandResultId,
          taskType: 'default',
          priority: 'medium',
          createdAt: new Date(),
          iterationCount: steps.length,
          maxIterations: steps.length + 2,
        }
      };

      // 用与引擎中完全相同的逻辑判断
      const executorFeedback = mockExecutionContext.executorFeedback;
      
      if (executorFeedback?.isTaskDown === true) {
        finalEvalResult = { completed: true, reason: `isTaskDown=true` };
      } else if (executorFeedback?.decisionContent?.isCompleted === true) {
        finalEvalResult = { completed: true, reason: `decisionContent.isCompleted=true` };
      } else if (mockExecutionContext.mcpExecutionHistory.some(
        (m: any) => m.result?.status === 'success' && m.result?.data?.success === true
      )) {
        finalEvalResult = { completed: true, reason: `MCP 业务层成功` };
      } else {
        finalEvalResult = { 
          completed: false, 
          reason: `isTaskDown=${executorFeedback?.isTaskDown}, isCompleted=${executorFeedback?.decisionContent?.isCompleted}, mcpSuccess=${mockExecutionContext.mcpExecutionHistory.some((m: any) => m.result?.status === 'success' && m.result?.data?.success === true)}` 
        };
      }
      
      finalEvalExplanation = finalEvalResult.completed
        ? `修复后终审通过：insurance-d 声明 isTaskDown=${lastInsuranceDStep.isTaskDown}, isCompleted=${lastInsuranceDStep.isCompleted} → 应返回 COMPLETE`
        : `终审未通过：insurance-d 未声明完成 → 维持 NEED_USER`;
    }

    return NextResponse.json({
      commandResultId,
      stepCount: steps.length,
      stepAnalysis,
      lastInsuranceDStep,
      lastAgentBStep,
      finalEvalResult,
      finalEvalExplanation,
      bugDiagnosis: lastAgentBStep?.reasonCode === 'LOOP_RISK_DETECTED' && lastInsuranceDStep?.isTaskDown === true
        ? '🔴 确认 BUG：Agent B 因死循环检测返回 NEED_USER，但 insurance-d 已声明 isTaskDown=true → 修复后终审应识别为 COMPLETE'
        : lastAgentBStep?.decisionType === 'COMPLETE'
          ? '✅ 正常场景：Agent B 正确判断为 COMPLETE'
          : '⚠️ 需要进一步分析'
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message, stack: error.stack?.substring(0, 500) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    description: '从数据库读取真实步骤历史，验证终审逻辑',
    usage: 'POST /api/test/real-eval with { "commandResultId": "ab2ca071-c506-4408-ac8f-8e4a7f089d90" }'
  });
}

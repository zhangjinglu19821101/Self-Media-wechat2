/**
 * 测试终审逻辑 API
 * 模拟 agent B 在死循环退出时评审 insurance-d 执行结果的场景
 */

import { NextRequest, NextResponse } from 'next/server';

// 模拟 ExecutionContext
interface ExecutionContext {
  executorFeedback: {
    isNeedMcp: boolean;
    isTaskDown: boolean | undefined;
    isNeedSplit: boolean;
    splitReason: string;
    suggestedSplitPoints: string[];
    originalTask: string;
    problem: string;
    attemptedSolutions: string[];
    decisionContent?: {
      isCompleted: boolean;
    };
    failureReason?: string;
    briefResponse?: string;
    selfEvaluation?: string;
    executionSummary?: string;
  };
  mcpExecutionHistory: any[];
  taskMeta: {
    taskId: string;
    taskType: string;
    priority: string;
    createdAt: Date;
    iterationCount: number;
    maxIterations: number;
  };
}

// 终审逻辑（从 subtask-execution-engine.ts 复制）
function evaluateExecutorCompletionBeforeLoopExit(
  task: {
    id: string;
    orderIndex: number;
    taskTitle?: string;
    fromParentsExecutor?: string;
  },
  executionContext: ExecutionContext,
  reexecuteHistory: any[],
  executorAttempts: Record<string, number>
): { completed: boolean; reason: string } {
  console.log('[TestFinalEval] ========== Loop Exit Evaluation Started ==========');
  
  // ========== 维度0（最高优先级）：执行者明确声明 ==========
  const executorFeedback = executionContext.executorFeedback;
  
  if (executorFeedback?.isTaskDown === true) {
    const reason = `执行者 ${task.fromParentsExecutor} 明确声明 isTaskDown=true，任务已完成`;
    console.log('[TestFinalEval] ✅ Dimension-0 passed (isTaskDown):', reason);
    return { completed: true, reason };
  }
  
  if (executorFeedback?.decisionContent?.isCompleted === true) {
    const reason = `执行者 ${task.fromParentsExecutor} 明确声明 decisionContent.isCompleted=true，任务已完成`;
    console.log('[TestFinalEval] ✅ Dimension-0 passed (isCompleted):', reason);
    return { completed: true, reason };
  }
  
  // ========== 维度1：MCP 执行结果检查 ==========
  const mcpHistory = executionContext.mcpExecutionHistory || [];
  const currentOrderMcp = mcpHistory.filter(
    (m: any) => m.decision.orderIndex === task.orderIndex
  );
  
  const mcpBusinessSuccess = currentOrderMcp.filter(
    (m: any) => m.result?.status === 'success' && m.result?.data?.success === true
  );
  
  if (mcpBusinessSuccess.length > 0) {
    const reason = `MCP 执行完全成功（HTTP层+业务层），order_index=${task.orderIndex} 共${mcpBusinessSuccess.length}次`;
    console.log('[TestFinalEval] ✅ Dimension-1 passed (MCP business success):', reason);
    return { completed: true, reason };
  }
  
  // ========== 维度1.5：合规校验任务特殊判断 ==========
  const complianceKeywords = ['合规', '合规校验', '合规审核', '合规检查'];
  const isComplianceTask = complianceKeywords.some(
    kw => task.taskTitle?.includes(kw)
  );
  const mcpTechSuccess = currentOrderMcp.filter(
    (m: any) => m.result?.status === 'success'
  );
  
  if (isComplianceTask && mcpTechSuccess.length > 0) {
    const reason = `合规校验任务 MCP 技术层执行成功（${mcpTechSuccess.length}次），校验流程正常完成`;
    console.log('[TestFinalEval] ✅ Dimension-1.5 passed (compliance MCP tech success):', reason);
    return { completed: true, reason };
  }
  
  // ========== 维度2：reexecuteHistory 执行结果检查 ==========
  const successfulExecutions = reexecuteHistory.filter(
    (h: any) => h?.executionResult?.success === true
  );
  
  if (successfulExecutions.length > 0) {
    const successfulExecutors = successfulExecutions
      .map((h: any) => h?.executor || h?.previousExecutor)
      .filter(Boolean);
    const reason = `reexecuteHistory 中存在成功记录，执行者 ${successfulExecutors.join(', ')} 已完成任务`;
    console.log('[TestFinalEval] ✅ Dimension-2 passed (history success):', reason);
    return { completed: true, reason };
  }
  
  // ========== 所有维度均未通过 ==========
  const reason = `终审未通过: MCP成功=${mcpBusinessSuccess.length}/${currentOrderMcp.length}, ` +
    `isTaskDown=${executorFeedback?.isTaskDown}, ` +
    `isCompleted=${executorFeedback?.decisionContent?.isCompleted}, ` +
    `history成功=${successfulExecutions.length}/${reexecuteHistory.length}`;
  console.log('[TestFinalEval] ❌ All dimensions failed:', reason);
  
  return { completed: false, reason };
}

export async function POST(request: NextRequest) {
  // 测试 API，跳过认证
  console.log('[TestFinalEval] API called, skipping auth for testing');
  
  try {
    const body = await request.json();
    const { scenario } = body;
    
    // 测试场景数据
    const scenarios = {
      // 场景1: insurance-d 明确声明 isTaskDown=true（应该通过）
      scenario1: {
        task: {
          id: 'test-1',
          orderIndex: 2,
          taskTitle: '[微信公众号] 撰写公众号文章',
          fromParentsExecutor: 'insurance-d'
        },
        executionContext: {
          executorFeedback: {
            isNeedMcp: false,
            isTaskDown: true,  // ✅ 明确声明完成
            isNeedSplit: false,
            splitReason: '',
            suggestedSplitPoints: [],
            originalTask: '撰写公众号文章',
            problem: '',
            attemptedSolutions: [],
            decisionContent: { isCompleted: true }
          },
          mcpExecutionHistory: [],
          taskMeta: {
            taskId: 'test-1',
            taskType: 'default',
            priority: 'medium',
            createdAt: new Date(),
            iterationCount: 3,
            maxIterations: 5
          }
        },
        reexecuteHistory: [],
        executorAttempts: { 'insurance-d': 3 }
      },
      
      // 场景2: insurance-d 执行但 isTaskDown 未设置（应该失败）
      scenario2: {
        task: {
          id: 'test-2',
          orderIndex: 2,
          taskTitle: '[微信公众号] 撰写公众号文章',
          fromParentsExecutor: 'insurance-d'
        },
        executionContext: {
          executorFeedback: {
            isNeedMcp: false,
            isTaskDown: undefined,  // ❌ 未声明完成
            isNeedSplit: false,
            splitReason: '',
            suggestedSplitPoints: [],
            originalTask: '撰写公众号文章',
            problem: '执行失败',
            attemptedSolutions: [],
            decisionContent: { isCompleted: false }
          },
          mcpExecutionHistory: [],
          taskMeta: {
            taskId: 'test-2',
            taskType: 'default',
            priority: 'medium',
            createdAt: new Date(),
            iterationCount: 3,
            maxIterations: 5
          }
        },
        reexecuteHistory: [],
        executorAttempts: { 'insurance-d': 3 }
      },
      
      // 场景3: MCP 业务层成功（应该通过）
      scenario3: {
        task: {
          id: 'test-3',
          orderIndex: 2,
          taskTitle: '[微信公众号] 撰写公众号文章',
          fromParentsExecutor: 'insurance-d'
        },
        executionContext: {
          executorFeedback: {
            isNeedMcp: true,
            isTaskDown: false,
            isNeedSplit: false,
            splitReason: '',
            suggestedSplitPoints: [],
            originalTask: '撰写公众号文章',
            problem: '',
            attemptedSolutions: []
          },
          mcpExecutionHistory: [
            {
              decision: { orderIndex: 2 },
              result: {
                status: 'success',
                data: { success: true, message: '文章生成成功' }
              }
            }
          ],
          taskMeta: {
            taskId: 'test-3',
            taskType: 'default',
            priority: 'medium',
            createdAt: new Date(),
            iterationCount: 3,
            maxIterations: 5
          }
        },
        reexecuteHistory: [],
        executorAttempts: { 'insurance-d': 3 }
      },
      
      // 场景4: reexecuteHistory 中有成功记录（应该通过）
      scenario4: {
        task: {
          id: 'test-4',
          orderIndex: 2,
          taskTitle: '[微信公众号] 撰写公众号文章',
          fromParentsExecutor: 'insurance-d'
        },
        executionContext: {
          executorFeedback: {
            isNeedMcp: false,
            isTaskDown: undefined,
            isNeedSplit: false,
            splitReason: '',
            suggestedSplitPoints: [],
            originalTask: '撰写公众号文章',
            problem: '',
            attemptedSolutions: []
          },
          mcpExecutionHistory: [],
          taskMeta: {
            taskId: 'test-4',
            taskType: 'default',
            priority: 'medium',
            createdAt: new Date(),
            iterationCount: 3,
            maxIterations: 5
          }
        },
        reexecuteHistory: [
          {
            executor: 'insurance-d',
            executionResult: { success: true, message: '文章已生成' }
          }
        ],
        executorAttempts: { 'insurance-d': 3 }
      },
      
      // 场景5: 合规校验任务 MCP 技术层成功（应该通过）
      scenario5: {
        task: {
          id: 'test-5',
          orderIndex: 5,
          taskTitle: '合规校验',
          fromParentsExecutor: 'T'
        },
        executionContext: {
          executorFeedback: {
            isNeedMcp: true,
            isTaskDown: false,
            isNeedSplit: false,
            splitReason: '',
            suggestedSplitPoints: [],
            originalTask: '合规校验',
            problem: '',
            attemptedSolutions: []
          },
          mcpExecutionHistory: [
            {
              decision: { orderIndex: 5 },
              result: {
                status: 'success',
                data: { success: false, issues: ['绝对化用语'] }  // 业务层未成功
              }
            }
          ],
          taskMeta: {
            taskId: 'test-5',
            taskType: 'default',
            priority: 'medium',
            createdAt: new Date(),
            iterationCount: 2,
            maxIterations: 5
          }
        },
        reexecuteHistory: [],
        executorAttempts: { 'T': 2 }
      },

      // 场景6: 【真实数据还原】order_index=2, command_result_id=ab2ca071
      // insurance-d 第3次执行: isTaskDown=true, isCompleted=true
      // 但 agent B 因死循环检测返回了 NEED_USER (LOOP_RISK_DETECTED)
      // 修复后：终审应识别 isTaskDown=true → 返回 COMPLETE
      scenario6: {
        task: {
          id: 'ab2ca071-c506-4408-ac8f-8e4a7f089d90',
          orderIndex: 2,
          taskTitle: '[微信公众号] 撰写公众号文章',
          fromParentsExecutor: 'insurance-d'
        },
        executionContext: {
          executorFeedback: {
            isNeedMcp: false,
            isTaskDown: true,   // ← 真实值：insurance-d 声明完成
            isNeedSplit: false,
            splitReason: '',
            suggestedSplitPoints: [],
            originalTask: '[微信公众号] 撰写公众号文章',
            problem: '',
            attemptedSolutions: [],
            decisionContent: { isCompleted: true },  // ← 真实值
            briefResponse: '我以家庭医疗保障痛点为切入点，结合指定案例完成7段结构文章创作，符合公众号风格...',
            executionSummary: '{"toolsUsed":[],"actionsTaken":["梳理核心观点和指定案例","按照7段结构分配内容占比","创作符合风格要求的正文内容","采用指定HTML格式排版","添加合规声明"],"needsMcpSupport":false}'
          },
          mcpExecutionHistory: [],
          taskMeta: {
            taskId: 'ab2ca071-c506-4408-ac8f-8e4a7f089d90',
            taskType: 'default',
            priority: 'medium',
            createdAt: new Date(),
            iterationCount: 3,
            maxIterations: 5
          }
        },
        reexecuteHistory: [
          // insurance-d 前两次执行（被 agent B 判 REEXECUTE_EXECUTOR）
          { executor: 'insurance-d', previousExecutor: 'insurance-d', executionResult: { success: false } },
          { executor: 'insurance-d', previousExecutor: 'insurance-d', executionResult: { success: false } }
        ],
        executorAttempts: { 'insurance-d': 3 }
      }
    };
    
    // 选择场景
    const scenarioData = scenarios[scenario as keyof typeof scenarios] || scenarios.scenario1;
    
    // 执行终审
    const result = evaluateExecutorCompletionBeforeLoopExit(
      scenarioData.task,
      scenarioData.executionContext as ExecutionContext,
      scenarioData.reexecuteHistory,
      scenarioData.executorAttempts
    );
    
    return NextResponse.json({
      scenario,
      input: scenarioData,
      result,
      explanation: getResultExplanation(scenario, result.completed)
    });
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function getResultExplanation(scenario: string, passed: boolean): string {
  const explanations: Record<string, { passed: string; failed: string }> = {
    scenario1: {
      passed: '✅ 正确：isTaskDown=true 被维度0 识别',
      failed: '❌ 错误：isTaskDown=true 应该通过终审'
    },
    scenario2: {
      passed: '❌ 错误：isTaskDown=undefined 应该失败',
      failed: '✅ 正确：isTaskDown=undefined 未通过任何维度'
    },
    scenario3: {
      passed: '✅ 正确：MCP 业务层成功被维度1 识别',
      failed: '❌ 错误：MCP 业务层成功应该通过终审'
    },
    scenario4: {
      passed: '✅ 正确：reexecuteHistory 成功记录被维度2 识别',
      failed: '❌ 错误：reexecuteHistory 成功记录应该通过终审'
    },
    scenario5: {
      passed: '✅ 正确：合规任务 MCP 技术层成功被维度1.5 识别',
      failed: '❌ 错误：合规任务 MCP 技术层成功应该通过终审'
    },
    scenario6: {
      passed: '✅ 正确：[真实数据还原] insurance-d isTaskDown=true，终审识别完成 → 修复后应返回 COMPLETE 而非 NEED_USER',
      failed: '❌ 错误：[真实数据还原] insurance-d isTaskDown=true 应该通过终审！这就是原始 bug！'
    }
  };
  
  return explanations[scenario]?.[passed ? 'passed' : 'failed'] || '未知场景';
}

export async function GET() {
  return NextResponse.json({
    description: '测试终审逻辑 API',
    usage: 'POST /api/test/final-eval with { "scenario": "scenario1" | "scenario2" | "scenario3" | "scenario4" | "scenario5" }',
    scenarios: {
      scenario1: 'insurance-d isTaskDown=true（应该通过）',
      scenario2: 'insurance-d isTaskDown=undefined（应该失败）',
      scenario3: 'MCP 业务层成功（应该通过）',
      scenario4: 'reexecuteHistory 成功记录（应该通过）',
      scenario5: '合规任务 MCP 技术层成功（应该通过）',
      scenario6: '【真实数据还原】order_index=2 insurance-d isTaskDown=true（修复后应通过，之前是 NEED_USER）'
    }
  });
}

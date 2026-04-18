/**
 * 用户反馈流程 - 使用示例
 *
 * 展示如何使用用户反馈流程的各个模块
 */

import {
  UserFeedbackService,
  UserFeedbackStateMachine,
  ReExecuteHandler,
  AgentBDecisionServiceV2,
  TaskStatusV2,
  AgentBDecisionType,
} from './index';

/**
 * 示例 1: 完整的用户反馈流程
 */
export async function exampleCompleteUserFeedbackFlow() {
  console.log('========================================');
  console.log('示例 1: 完整的用户反馈流程');
  console.log('========================================\n');

  // 1. 用户提交反馈
  const userFeedbackRequest = {
    dailyTaskId: 'task-1234567890',
    userFeedback: '这个结果不太对，请重新执行一次',
    agentId: 'insurance-c',
    metadata: {
      conversationId: 'conv-abc123',
    },
  };

  console.log('1. 用户提交反馈:', userFeedbackRequest);

  // 2. 处理用户反馈
  const result = await UserFeedbackService.handleUserFeedback(userFeedbackRequest);

  console.log('\n2. 处理结果:', result);

  if (result.success && result.data?.decision) {
    console.log('\n3. Agent B 决策类型:', result.data.decision.type);
    console.log('4. 决策理由:', result.data.decision.reasoning);
    console.log('5. 新状态:', result.data.status);
  }

  console.log('\n');
}

/**
 * 示例 2: 状态机使用
 */
export function exampleStateMachineUsage() {
  console.log('========================================');
  console.log('示例 2: 状态机使用');
  console.log('========================================\n');

  // 1. 检查状态转换是否合法
  const from = TaskStatusV2.WAITING_USER;
  const to = TaskStatusV2.USER_FEEDBACK_RECEIVED;

  console.log(`1. 检查 ${from} -> ${to} 是否合法:`);
  const canTransition = UserFeedbackStateMachine.canTransition(from, to);
  console.log(`   结果: ${canTransition ? '合法 ✓' : '不合法 ✗'}`);

  // 2. 获取转换描述
  const description = UserFeedbackStateMachine.getTransitionDescription(from, to);
  console.log(`\n2. 转换描述: ${description}`);

  // 3. 获取所有合法的转换
  const validTransitions = UserFeedbackStateMachine.getValidTransitions(from);
  console.log(`\n3. 从 ${from} 可以转换到:`, validTransitions);

  // 4. 根据决策获取下一个状态
  const nextState = UserFeedbackStateMachine.getNextStateFromDecision(
    AgentBDecisionType.RE_EXECUTE
  );
  console.log(`\n4. RE_EXECUTE 决策的下一个状态: ${nextState}`);

  console.log('\n');
}

/**
 * 示例 3: 单独使用 Agent B 决策
 */
export async function exampleAgentBDecisionOnly() {
  console.log('========================================');
  console.log('示例 3: 单独使用 Agent B 决策');
  console.log('========================================\n');

  // 1. 恢复历史记录
  const dailyTaskId = 'task-1234567890';
  console.log(`1. 恢复任务 ${dailyTaskId} 的历史记录...`);
  const historyResult = await AgentBDecisionServiceV2.recoverHistory(dailyTaskId);
  console.log('   历史记录恢复结果:', historyResult.success ? '成功 ✓' : '失败 ✗');

  // 2. Agent B 决策
  console.log('\n2. Agent B 进行决策...');
  const decision = await AgentBDecisionServiceV2.executeAgentBDecisionWithHistory({
    dailyTaskId,
    userFeedback: '请重新执行这个任务',
    mcpExecutionHistory: historyResult.mcpExecutionHistory,
    userInteractions: historyResult.userInteractions,
    executorResult: historyResult.executorResult,
  });

  console.log('   决策类型:', decision.type);
  console.log('   决策理由:', decision.reasoning);

  // 3. 获取下一个状态
  const nextState = AgentBDecisionServiceV2.getNextStateFromDecision(decision);
  console.log('\n3. 下一个状态:', nextState);

  console.log('\n');
}

/**
 * 示例 4: 单独使用 RE_EXECUTE 处理器
 */
export async function exampleReExecuteHandler() {
  console.log('========================================');
  console.log('示例 4: 单独使用 RE_EXECUTE 处理器');
  console.log('========================================\n');

  // 1. 准备 RE_EXECUTE 决策
  const reExecuteRequest = {
    dailyTaskId: 'task-1234567890',
    decision: {
      type: AgentBDecisionType.RE_EXECUTE,
      reasoning: '用户要求重新执行，让执行 Agent 再执行一次',
      data: {
        reason: 'user_requested',
      },
    },
  };

  console.log('1. RE_EXECUTE 请求:', reExecuteRequest);

  // 2. 验证决策
  const validation = ReExecuteHandler.validateReExecuteDecision(reExecuteRequest);
  console.log('\n2. 验证结果:', validation.valid ? '通过 ✓' : '失败 ✗');
  if (!validation.valid) {
    console.log('   原因:', validation.reason);
    return;
  }

  // 3. 处理 RE_EXECUTE 决策
  console.log('\n3. 处理 RE_EXECUTE 决策...');
  const result = await ReExecuteHandler.handleReExecuteDecision(reExecuteRequest);
  console.log('   处理结果:', result.success ? '成功 ✓' : '失败 ✗');

  if (result.success && result.data) {
    console.log('   新状态:', result.data.status);
    console.log('   消息:', result.data.message);
  }

  console.log('\n');
}

/**
 * 运行所有示例
 */
export async function runAllExamples() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           用户反馈流程 - 使用示例                              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('\n');

  try {
    await exampleCompleteUserFeedbackFlow();
    exampleStateMachineUsage();
    await exampleAgentBDecisionOnly();
    await exampleReExecuteHandler();

    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                     所有示例运行完成！                          ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
  } catch (error) {
    console.error('运行示例时出错:', error);
  }
}

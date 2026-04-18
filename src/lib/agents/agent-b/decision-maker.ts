
/**
 * Agent B 决策逻辑
 *
 * 功能：
 * 1. 判断是否继续交互
 * 2. 判断是否应该上报 Agent A
 * 3. 务必在交互次数达到上限时上报
 */

import { db } from '@/lib/db';
import { agentSubTasksStepHistory } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

// === 配置 ===

const MAX_INTERACTIONS = 5; // 最大交互次数，达到后务必上报

// === 类型定义 ===

export interface DecisionContext {
  taskId: string; // 子任务 ID
  commandResultId: string; // 指令结果 ID
  currentInteractionCount: number; // 当前交互次数
  executorFeedback: string; // 执行 Agent 的反馈内容
  lastAgentBResponse?: string; // 上一次 Agent B 的回应
}

export interface DecisionResult {
  shouldContinue: boolean; // 是否继续交互
  shouldReport: boolean; // 是否上报 Agent A
  reason: string; // 决策原因
}

// === 决策函数 ===

/**
 * Agent B 决策：是否继续交互、是否上报
 * @param context 决策上下文
 * @returns 决策结果
 */
export async function makeDecision(context: DecisionContext): Promise<DecisionResult> {
  console.log('[Agent B Decision] 开始决策...');
  console.log('[Agent B Decision] 上下文:', context);

  // 1. 检查交互次数是否达到上限（务必上报）
  if (context.currentInteractionCount >= MAX_INTERACTIONS) {
    console.log(`[Agent B Decision] 交互次数达到上限 (${MAX_INTERACTIONS})，务必上报`);
    return {
      shouldContinue: false,
      shouldReport: true,
      reason: `交互次数达到上限 (${MAX_INTERACTIONS})，需要用户介入`,
    };
  }

  // 2. 分析执行 Agent 的反馈内容
  const feedbackAnalysis = analyzeExecutorFeedback(context.executorFeedback);

  // 3. 根据分析结果决策
  if (feedbackAnalysis.isProblemSolved) {
    console.log('[Agent B Decision] 问题已解决，无需继续交互');
    return {
      shouldContinue: false,
      shouldReport: false,
      reason: '问题已解决，任务可以继续执行',
    };
  }

  if (feedbackAnalysis.needsMoreClarification) {
    console.log('[Agent B Decision] 需要更多澄清，继续交互');
    return {
      shouldContinue: true,
      shouldReport: false,
      reason: '需要更多澄清，继续与执行 Agent 交互',
    };
  }

  if (feedbackAnalysis.needsUserDecision) {
    console.log('[Agent B Decision] 需要用户决策，上报 Agent A');
    return {
      shouldContinue: false,
      shouldReport: true,
      reason: '需要用户决策，上报 Agent A',
    };
  }

  // 4. 默认决策：继续交互（未达到上限）
  console.log('[Agent B Decision] 默认决策：继续交互');
  return {
    shouldContinue: true,
    shouldReport: false,
    reason: '继续与执行 Agent 交互',
  };
}

/**
 * 分析执行 Agent 的反馈内容
 * @param feedback 执行 Agent 的反馈
 * @returns 分析结果
 */
function analyzeExecutorFeedback(feedback: string): {
  isProblemSolved: boolean;
  needsMoreClarification: boolean;
  needsUserDecision: boolean;
} {
  const lowerFeedback = feedback.toLowerCase();

  // 检查是否问题已解决
  const solvedKeywords = [
    '理解了', '明白了', '没问题', '可以执行', '开始执行',
    '完成了', '成功', 'ok', '好的', '了解'
  ];
  const isProblemSolved = solvedKeywords.some(keyword => lowerFeedback.includes(keyword));

  // 检查是否需要更多澄清
  const clarificationKeywords = [
    '不理解', '不清楚', '什么意思', '能否详细', '请解释',
    '有疑问', '需要确认', '能否说明'
  ];
  const needsMoreClarification = clarificationKeywords.some(keyword => lowerFeedback.includes(keyword));

  // 检查是否需要用户决策
  const userDecisionKeywords = [
    '需要用户', '需要人工', '请用户', '请人工', '无法决定',
    '超出能力', '需要审批', '需要确认'
  ];
  const needsUserDecision = userDecisionKeywords.some(keyword => lowerFeedback.includes(keyword));

  return {
    isProblemSolved,
    needsMoreClarification,
    needsUserDecision,
  };
}

/**
 * 获取当前交互次数
 * @param commandResultId 指令结果 ID
 * @param orderIndex 子任务序号
 * @returns 交互次数
 */
export async function getCurrentInteractionCount(
  commandResultId: string,
  orderIndex: number
): Promise<number> {
  const interactions = await db
    .select()
    .from(agentSubTasksStepHistory)
    .where(
      and(
        eq(agentSubTasksStepHistory.commandResultId, commandResultId),
        eq(agentSubTasksStepHistory.stepNo, orderIndex)
      )
    );

  // 每两条记录算一次交互（问+答）
  return Math.ceil(interactions.length / 2);
}

export { MAX_INTERACTIONS };


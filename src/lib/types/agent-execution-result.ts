/**
 * 执行Agent执行结果类型定义
 * 
 * 【 Executor 输出标准格式 】
 * 所有执行 Agent（包括 insurance-d、Agent T 等）统一使用此格式
 * 
 * 字段语义：
 * - isCompleted: 任务是否完成（执行结果判断）
 * - reason: 当 isCompleted=false 时，说明原因
 * - result: 执行结论（当 isCompleted=true 时有意义）
 * - mcpParams: MCP 调用参数（仅 Agent T 使用）
 */

/**
 * Executor 输出标准格式（共用类型）
 * 所有执行 Agent 统一使用此格式
 */
export interface ExecutorOutput {
  // ========== 执行结果判断（必填） ==========
  // 任务是否完成
  isCompleted: boolean;
  
  // 当 isCompleted=false 时必填，说明原因
  reason?: string;
  
  // 执行结论（必须以【执行结论】开头）
  result?: string;
  
  // 建议
  suggestion?: string;
  
  // ========== MCP 参数（仅 Agent T 使用） ==========
  mcpParams?: {
    solutionNum: number;
    toolName: string;
    actionName: string;
    params: Record<string, any>;
  };
  
  // ========== 结构化结果（可选） ==========
  structuredResult?: ExecutionResult;
}

// 完成情况判断
export interface CompletionJudgment {
  isCompleted: boolean;
  confidence: 'high' | 'medium' | 'low';
  evidence: string[];
  suggestions?: string;
}

// 原指令内容
export interface OriginalInstruction {
  title: string;
  description: string;
  fullContent?: string;
}

// 执行摘要
export interface ExecutionSummary {
  actionsTaken: string[];
  toolsUsed?: string[];
}

// 指令执行结果
export interface ExecutionResult {
  originalInstruction: OriginalInstruction;
  executionSummary: ExecutionSummary;
  resultContent: any;
  completionJudgment?: CompletionJudgment;
  
  // 🔴 P0-1 修复：新增标准返回字段（deai-optimizer 等新 Agent 使用）
  taskInstruction?: string;
  briefRequest?: string;
  briefResponse?: string;
  selfEvaluation?: string;
}

// 执行Agent直接执行结果（增强版）
export interface ExecutorDirectResult {
  // 向后兼容：原有字段
  isCompleted: boolean;
  result?: any;
  suggestion?: string;
  
  // 🔴 新增：统一使用 output 字段存放执行结果内容
  output?: string;
  
  // 🔴🔴🔴 新增：是否需要 MCP 支持（场景2核心）
  needsMcpSupport?: boolean;
  
  // 新增：结构化结果
  structuredResult?: ExecutionResult;
  
  // 🔴 新增：Agent T 作为执行 Agent 时的 MCP 参数（与 AgentBDecision.data.mcpParams 格式一致）
  mcpParams?: {
    solutionNum: number;
    toolName: string;
    actionName: string;
    params: Record<string, any>;
  };
  
  // 🔴 新增：执行时使用的 capabilities（供 Agent B 参考）
  executedWithCapabilities?: any[];
  
  // 🔴 P0-1 修复：标准执行格式字段（deai-optimizer 等新 Agent 使用）
  briefResponse?: string;
  selfEvaluation?: string;
}

/**
 * 类型守卫：检查是否有结构化结果
 */
export function hasStructuredResult(
  result: ExecutorDirectResult
): result is ExecutorDirectResult & { structuredResult: ExecutionResult } {
  return result.structuredResult !== undefined;
}

/**
 * 🔴🔴🔴 多层级提取函数：逐层尝试提取有效字符串
 * 不是"非彼即此"，而是"逐一尝试，全部失败才返回默认值"
 * 
 * @param sources 数据源数组，按优先级排序
 * @param defaultValue 最终兜底值
 * @param fieldName 字段名（用于日志）
 * @returns 提取到的有效字符串，或默认值
 */
export function multiLevelExtract(
  sources: Array<{ value: any; name: string }>,
  defaultValue: string,
  fieldName: string
): string {
  for (const source of sources) {
    if (typeof source.value === 'string' && source.value.trim().length > 0) {
      console.log(`[multiLevelExtract] ✅ ${fieldName} 从 ${source.name} 提取成功: "${source.value.substring(0, 50)}..."`);
      return source.value;
    }
  }
  console.log(`[multiLevelExtract] ⚠️ ${fieldName} 所有层级均为空，使用默认值: "${defaultValue.substring(0, 50)}..."`);
  return defaultValue;
}

/**
 * 🔴🔴🔴 提取 briefResponse 的多层级配置
 * 优先级：顶层 > structuredResult > 备选字段 > 默认值
 */
export function extractBriefResponse(
  directBriefResponse: string | undefined,
  structuredResult: any,
  directResult: any
): string {
  return multiLevelExtract(
    [
      { value: directBriefResponse, name: '顶层 briefResponse' },
      { value: structuredResult?.briefResponse, name: 'structuredResult.briefResponse' },
      { value: structuredResult?.resultContent, name: 'structuredResult.resultContent' },
      { value: typeof directResult === 'string' ? directResult : undefined, name: '顶层 result' },
    ],
    '',  // 默认值：空字符串，由调用方决定是否使用特殊兜底
    'briefResponse'
  );
}

/**
 * 🔴🔴🔴 提取 selfEvaluation 的多层级配置
 * 优先级：顶层 > structuredResult > 备选字段 > 默认值
 * 
 * @param isTaskDown 任务是否完成（用于决定兜底值）
 * @param suggestions 建议字段（用于未完成时的兜底）
 */
export function extractSelfEvaluation(
  directSelfEvaluation: string | undefined,
  structuredResult: any,
  suggestions?: string,
  reasoning?: string,
  isTaskDown?: boolean
): string {
  const extracted = multiLevelExtract(
    [
      { value: directSelfEvaluation, name: '顶层 selfEvaluation' },
      { value: structuredResult?.selfEvaluation, name: 'structuredResult.selfEvaluation' },
      { value: structuredResult?.completionJudgment?.suggestions, name: 'completionJudgment.suggestions' },
      { value: structuredResult?.executionSummary?.actionsTaken?.join('; '), name: 'executionSummary.actionsTaken' },
      { value: suggestions, name: 'suggestions' },
      { value: reasoning, name: 'reasoning' },
    ],
    '',  // 默认值：空字符串，由调用方决定是否使用特殊兜底
    'selfEvaluation'
  );
  
  // 🔴🔴🔴 【关键】区分两种场景的兜底值
  // 场景1：任务完成但无 selfEvaluation → 使用中性兜底值，不误导 Agent B
  // 场景2：任务未完成 → 如实说明原因
  if (extracted.trim().length === 0) {
    if (isTaskDown === false) {
      // 任务未完成：提供有意义的未完成原因
      return suggestions 
        ? `任务未完成：${suggestions}` 
        : '任务未能完成，具体原因请查看执行结论';
    } else {
      // 任务完成或未知：使用中性兜底值，避免误导 Agent B
      return '';
    }
  }
  
  return extracted;
}

/**
 * 从结构化结果自动填充原有字段（向后兼容）
 * 🔴🔴🔴 重构：多层级兜底机制，而非"非彼即此"
 * 
 * 统一入口：所有需要提取 legacy 字段的场景都应调用此函数
 */
export function fillLegacyFields(result: ExecutorDirectResult): ExecutorDirectResult {
  if (!hasStructuredResult(result)) {
    return result;
  }
  
  const { structuredResult } = result;
  
  // 🔴🔴🔴 使用统一的多层级提取函数
  const briefResponse = extractBriefResponse(
    result.briefResponse,
    structuredResult,
    result.result
  );
  
  const selfEvaluation = extractSelfEvaluation(
    result.selfEvaluation,
    structuredResult,
    structuredResult.completionJudgment?.suggestions,
    undefined,
    result.isCompleted  // 🔴 传递 isCompleted 用于决定兜底值
  );
  
  // 🔴 修复：让 fillLegacyFields 更健壮，处理缺失的字段
  // 🔴🔴🔴 注意：needsMcpSupport 和 mcpParams 是 ExecutorDirectResult 的顶层字段
  // 不应该从 structuredResult.executionSummary 提取（ExecutionSummary 接口不包含这些字段）
  return {
    ...result,
    // 自动从结构化结果填充原有字段（安全访问）
    isCompleted: structuredResult.completionJudgment?.isCompleted ?? result.isCompleted ?? false,
    result: structuredResult.resultContent ?? result.result,
    suggestion: structuredResult.completionJudgment?.suggestions ?? result.suggestion ?? '',
    // 🔴🔴🔴 needsMcpSupport 和 mcpParams 直接使用顶层字段
    needsMcpSupport: result.needsMcpSupport,
    mcpParams: result.mcpParams,
    // 🔴🔴🔴 使用多层级提取结果
    briefResponse,
    selfEvaluation,
  };
}

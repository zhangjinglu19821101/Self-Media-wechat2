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
  completionJudgment: CompletionJudgment;
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
 * 从结构化结果自动填充原有字段（向后兼容）
 */
export function fillLegacyFields(result: ExecutorDirectResult): ExecutorDirectResult {
  if (!hasStructuredResult(result)) {
    return result;
  }
  
  const { structuredResult } = result;
  
  // 🔴 修复：让 fillLegacyFields 更健壮，处理缺失的字段
  // 🔴🔴🔴 注意：needsMcpSupport 和 mcpParams 需要从 structuredResult.executionSummary 提取
  return {
    ...result,
    // 自动从结构化结果填充原有字段（安全访问）
    isCompleted: structuredResult.completionJudgment?.isCompleted ?? result.isCompleted ?? false,
    result: structuredResult.resultContent ?? result.result,
    suggestion: structuredResult.completionJudgment?.suggestions ?? result.suggestion ?? '',
    // 🔴🔴🔴 从 structuredResult.executionSummary 提取 needsMcpSupport（场景2核心）
    needsMcpSupport: result.needsMcpSupport ?? structuredResult.executionSummary?.needsMcpSupport,
    // 🔴🔴🔴 从 structuredResult.executionSummary 提取 mcpParams（场景2核心）
    mcpParams: result.mcpParams ?? structuredResult.executionSummary?.mcpParams,
  };
}

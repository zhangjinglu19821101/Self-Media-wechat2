/**
 * 通用执行Agent能力边界判定器
 * 
 * 功能：
 * - 基于配置化的规则判定（支持任意Agent，无需硬编码）
 * - 基于LLM的深度判定
 * - 返回标准化的判定结果
 * 
 * @features
 * - 从 agent_capabilities 表读取配置
 * - 支持关键词、正则、语义匹配
 * - 可配置置信度阈值
 * 
 * @docs /docs/最新流程交互图.md 阶段1
 */

import { callLLM } from '@/lib/agent-llm';
import { AgentCapabilityService, type AgentCapabilityConfig } from './agent-capability-service';
import type { AutoJudgeRule } from '@/lib/db/schema';

// === 类型定义 ===

export interface ExecutorCapabilityCheckResult {
  isNeedMcp: boolean;
  problem?: string;
  capabilityType?: 'search' | 'platform_publish' | 'data_acquire';
  executionResult?: any;
  isTaskDown: boolean;
  confidence: number; // 判定置信度 0-1
  reasoning: string; // 判定理由
  matchedRule?: string; // 匹配的规则ID
}

export interface ExecutorCapabilityCheckParams {
  taskTitle: string;
  taskDescription: string;
  executorAgentId: string;
  taskMetadata?: Record<string, any>;
  previousResult?: any;  // 新增：前序任务结果（链式传递）
}

// === 通用能力边界判定器主类 ===

export class UniversalCapabilityChecker {
  
  /**
   * 主判定方法（通用版本）
   * 支持任意Agent，从配置中心读取规则
   */
  static async check(params: ExecutorCapabilityCheckParams): Promise<ExecutorCapabilityCheckResult> {
    console.log('[UniversalCapabilityChecker] 开始能力边界判定:', {
      executor: params.executorAgentId,
      taskTitle: params.taskTitle,
    });

    try {
      // 1. 获取Agent配置（包含自动判定规则）
      const agentConfig = await AgentCapabilityService.getConfig(params.executorAgentId);
      console.log(`[UniversalCapabilityChecker] Agent配置: ${params.executorAgentId}, 规则数: ${agentConfig.autoJudgeRules.length}`);

      // 2. 快速规则匹配（基于配置的规则）
      const ruleResult = await this.tryRuleBasedCheck(params, agentConfig);
      if (ruleResult && ruleResult.confidence >= 0.8) {
        console.log('[UniversalCapabilityChecker] 规则匹配成功:', ruleResult);
        return ruleResult;
      }

      // 3. 检查固有能力
      const nativeResult = this.checkNativeCapabilities(params, agentConfig);
      if (nativeResult) {
        console.log('[UniversalCapabilityChecker] 固有能力匹配:', nativeResult);
        return nativeResult;
      }

      // 4. LLM 深度判定（规则无法判定时）
      console.log('[UniversalCapabilityChecker] 规则匹配失败，使用 LLM 深度判定');
      const llmResult = await this.llmBasedCheck(params, agentConfig);
      
      console.log('[UniversalCapabilityChecker] LLM 判定完成:', llmResult);
      return llmResult;

    } catch (error) {
      console.error('[UniversalCapabilityChecker] 判定失败:', error);
      
      // 兜底策略：默认需要MCP介入
      return {
        isNeedMcp: true,
        problem: '能力判定异常，需要MCP介入',
        capabilityType: 'search',
        isTaskDown: false,
        confidence: 0.5,
        reasoning: '系统异常，兜底处理',
      };
    }
  }

  /**
   * 基于配置规则的快速判定
   */
  private static async tryRuleBasedCheck(
    params: ExecutorCapabilityCheckParams,
    agentConfig: AgentCapabilityConfig
  ): Promise<ExecutorCapabilityCheckResult | null> {
    // 构建完整文本，包含前序任务结果（如果有）
    let fullText = `${params.taskTitle} ${params.taskDescription}`;
    if (params.previousResult) {
      const previousResultText = typeof params.previousResult === 'string' 
        ? params.previousResult 
        : JSON.stringify(params.previousResult);
      fullText += ` ${previousResultText}`;
    }
    fullText = fullText.toLowerCase();
    
    // 按优先级排序规则
    const sortedRules = [...agentConfig.autoJudgeRules].sort((a, b) => a.priority - b.priority);
    
    for (const rule of sortedRules) {
      const matchScore = this.calculateMatchScore(fullText, rule);
      
      if (matchScore >= rule.confidence) {
        return this.buildResultFromRule(rule, matchScore, agentConfig);
      }
    }
    
    return null;
  }

  /**
   * 计算匹配分数
   */
  private static calculateMatchScore(text: string, rule: AutoJudgeRule): number {
    const lowerText = text.toLowerCase();
    const keywords = rule.keywords.map(k => k.toLowerCase());
    
    switch (rule.matchMode) {
      case 'all':
        // 所有关键词都必须匹配
        const allMatch = keywords.every(kw => lowerText.includes(kw));
        return allMatch ? 1.0 : 0.0;
        
      case 'regex':
        // 正则匹配（取最高匹配度）
        let maxRegexScore = 0;
        for (const kw of keywords) {
          try {
            const regex = new RegExp(kw, 'i');
            if (regex.test(lowerText)) {
              maxRegexScore = 1.0;
              break;
            }
          } catch (e) {
            // 非法正则，退化为包含检查
            if (lowerText.includes(kw)) {
              maxRegexScore = Math.max(maxRegexScore, 0.8);
            }
          }
        }
        return maxRegexScore;
        
      case 'any':
      default:
        // 任意关键词匹配，计算匹配率
        const matchedCount = keywords.filter(kw => lowerText.includes(kw)).length;
        if (matchedCount === 0) return 0.0;
        // 基础分 + 匹配比例加分
        return 0.6 + (matchedCount / keywords.length) * 0.4;
    }
  }

  /**
   * 检查固有能力
   */
  private static checkNativeCapabilities(
    params: ExecutorCapabilityCheckParams,
    agentConfig: AgentCapabilityConfig
  ): ExecutorCapabilityCheckResult | null {
    if (!agentConfig.nativeCapabilities || agentConfig.nativeCapabilities.length === 0) {
      return null;
    }

    // 构建完整文本，包含前序任务结果（如果有）
    let fullText = `${params.taskTitle} ${params.taskDescription}`;
    if (params.previousResult) {
      const previousResultText = typeof params.previousResult === 'string' 
        ? params.previousResult 
        : JSON.stringify(params.previousResult);
      fullText += ` ${previousResultText}`;
    }
    fullText = fullText.toLowerCase();
    
    // 简单匹配：任务描述中包含固有能力关键词
    for (const capability of agentConfig.nativeCapabilities) {
      if (fullText.includes(capability.toLowerCase())) {
        return {
          isNeedMcp: false,
          executionResult: null,
          isTaskDown: true,
          confidence: 0.75,
          reasoning: `匹配Agent固有能力: ${capability}`,
        };
      }
    }
    
    return null;
  }

  /**
   * 基于LLM的深度判定
   */
  private static async llmBasedCheck(
    params: ExecutorCapabilityCheckParams,
    agentConfig: AgentCapabilityConfig
  ): Promise<ExecutorCapabilityCheckResult> {
    // 构建前序结果文本（如果有）
    let previousResultText = '';
    if (params.previousResult !== null && params.previousResult !== undefined) {
      previousResultText = `
【前序步骤结果】
${typeof params.previousResult === 'string' 
  ? params.previousResult 
  : JSON.stringify(params.previousResult, null, 2)}
`;
    }

    const prompt = `
你是 ${params.executorAgentId} 的能力边界判定专家。

【任务信息】
- 任务标题: ${params.taskTitle}
- 任务描述: ${params.taskDescription}
- Agent名称: ${agentConfig.agentName}
- Agent描述: ${agentConfig.description || '无'}
${previousResultText}

【该Agent的固有能力】
${agentConfig.nativeCapabilities.length > 0 
  ? agentConfig.nativeCapabilities.map(c => `- ${c}`).join('\n')
  : '无特定固有能力'}

【判定任务】
分析该任务是否需要外部MCP能力介入：
1. 如果任务完全在Agent固有能力范围内 → 直接完成
2. 如果任务需要外部平台操作（搜索、发布、数据获取等）→ 需要MCP

【输出格式】
请输出JSON格式：
{
  "isNeedMcp": true/false,
  "capabilityType": "search" | "platform_publish" | "data_acquire" | null,
  "problem": "问题描述（需要MCP时填写）",
  "isTaskDown": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "判定理由"
}
`;

    try {
      const response = await callLLM(
        'system',
        '能力边界判定',
        prompt
      );

      // 解析LLM返回的JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          isNeedMcp: result.isNeedMcp ?? true,
          problem: result.problem,
          capabilityType: result.capabilityType,
          executionResult: null,
          isTaskDown: result.isTaskDown ?? false,
          confidence: result.confidence ?? 0.7,
          reasoning: result.reasoning ?? 'LLM判定',
        };
      }
    } catch (error) {
      console.error('[UniversalCapabilityChecker] LLM解析失败:', error);
    }

    // LLM失败时返回保守策略
    return {
      isNeedMcp: true,
      problem: '无法判定能力边界，需要MCP介入',
      capabilityType: 'search',
      isTaskDown: false,
      confidence: 0.6,
      reasoning: 'LLM判定失败，使用保守策略',
    };
  }

  /**
   * 从规则构建结果
   */
  private static buildResultFromRule(
    rule: AutoJudgeRule,
    confidence: number,
    agentConfig: AgentCapabilityConfig
  ): ExecutorCapabilityCheckResult {
    const isNeedMcp = rule.action === 'need_mcp';
    
    return {
      isNeedMcp,
      problem: isNeedMcp ? rule.problemTemplate : undefined,
      capabilityType: isNeedMcp ? rule.suggestedCapabilityType as any : undefined,
      executionResult: null,
      isTaskDown: !isNeedMcp,
      confidence,
      reasoning: `匹配规则: ${rule.ruleName}`,
      matchedRule: rule.ruleId,
    };
  }
}

// === 保持向后兼容的导出 ===

/**
 * 兼容旧接口的判定器
 * @deprecated 请使用 UniversalCapabilityChecker
 */
export class ExecutorCapabilityChecker {
  static async check(params: ExecutorCapabilityCheckParams): Promise<ExecutorCapabilityCheckResult> {
    console.warn('[ExecutorCapabilityChecker] 已弃用，请使用 UniversalCapabilityChecker');
    return UniversalCapabilityChecker.check(params);
  }
}

/**
 * 便捷函数：检查执行Agent能力边界
 */
export async function checkExecutorCapability(
  params: ExecutorCapabilityCheckParams
): Promise<ExecutorCapabilityCheckResult> {
  return await UniversalCapabilityChecker.check(params);
}

export default UniversalCapabilityChecker;

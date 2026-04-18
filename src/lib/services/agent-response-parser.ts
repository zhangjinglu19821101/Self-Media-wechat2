/**
 * 统一的 Agent 响应解析层
 * 所有 Agent 的响应都走统一的解析流程
 */

import { JsonParserEnhancer } from '../utils/json-parser-enhancer';
import { AgentBFormatAdapter } from '../utils/agent-b-format-adapter';
import type { AgentBUnifiedFormat } from '../types/agent-b-response';
import type { AgentBDecision } from './subtask-execution-engine';

/**
 * Agent 类型
 */
export type AgentType = 'agent-b' | 'executor' | 'unknown';

/**
 * 解析结果
 */
export interface ParseResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
  formatType?: AgentType;
  rawResponse?: string;
}

/**
 * 统一的 Agent 响应解析器
 */
export class AgentResponseParser {
  /**
   * 解析 Agent B 的响应
   */
  static parseAgentBResponse(rawResponse: string): ParseResult<AgentBDecision> {
    console.log('[AgentResponseParser] ========== 解析 Agent B 响应 ==========');
    console.log('[AgentResponseParser] 原始响应长度:', rawResponse.length, '字符');
    console.log('[AgentResponseParser] 🔴🔴🔴 完整原始响应:', rawResponse);
    console.log('[AgentResponseParser] 🔴🔴🔴 原始响应前2000字符:', rawResponse.substring(0, 2000));
    
    // 🔴 将原始响应写入文件用于调试
    const fs = require('fs');
    const debugFile = '/tmp/agent-b-raw-response.txt';
    try {
      fs.writeFileSync(debugFile, rawResponse, 'utf8');
      console.log('[AgentResponseParser] 🔴🔴🔴 原始响应已写入:', debugFile);
    } catch (e) {
      console.error('[AgentResponseParser] 写入文件失败:', e);
    }
    
    const warnings: string[] = [];
    
    try {
      // 1. 使用智能解析器解析 JSON
      console.log('[AgentResponseParser] 步骤1: 智能解析 JSON');
      const parseResult = JsonParserEnhancer.smartParse(rawResponse, 'agent-b');
      
      if (!parseResult.success) {
        console.error('[AgentResponseParser] ❌ JSON 解析失败:', parseResult.error);
        return {
          success: false,
          error: parseResult.error,
          warnings: [...warnings, ...(parseResult.warnings || [])],
          rawResponse
        };
      }
      
      if (parseResult.warnings) {
        warnings.push(...parseResult.warnings);
      }
      
      console.log('[AgentResponseParser] ✅ JSON 解析成功');
      console.log('[AgentResponseParser] 🔴🔴🔴 解析后的原始数据字段:', Object.keys(parseResult.data || {}));
      console.log('[AgentResponseParser] 🔴🔴🔴 解析后的原始数据:', JSON.stringify(parseResult.data, null, 2));
      
      // 2. 使用格式适配器转换为统一格式
      console.log('[AgentResponseParser] 步骤2: 格式适配');
      const unified = AgentBFormatAdapter.convertToUnified(parseResult.data);
      
      console.log('[AgentResponseParser] ✅ 格式适配完成:', unified.decisionType);
      console.log('[AgentResponseParser] 🔴🔴🔴 统一格式字段:', Object.keys(unified));
      console.log('[AgentResponseParser] 🔴🔴🔴 统一格式 decisionBasis:', unified.decisionBasis);
      console.log('[AgentResponseParser] 🔴🔴🔴 统一格式 notCompletedReason:', unified.notCompletedReason);
      console.log('[AgentResponseParser] 🔴🔴🔴 统一格式 context.suggestedExecutor:', unified.context?.suggestedExecutor);
      
      // 3. 转换回 AgentBDecision 类型（向后兼容）
      console.log('[AgentResponseParser] 步骤3: 转换为内部格式');
      const oldFormat = AgentBFormatAdapter.convertUnifiedToOld(unified);
      
      console.log('[AgentResponseParser] ✅ 转换完成');
      console.log('[AgentResponseParser] 🔴🔴🔴 旧格式字段:', Object.keys(oldFormat));
      console.log('[AgentResponseParser] 🔴🔴🔴 旧格式 decisionBasis:', oldFormat.decisionBasis);
      console.log('[AgentResponseParser] 🔴🔴🔴 旧格式 notCompletedReason:', oldFormat.notCompletedReason);
      console.log('[AgentResponseParser] 🔴🔴🔴 旧格式 context.suggestedExecutor:', oldFormat.context?.suggestedExecutor);
      
      return {
        success: true,
        data: oldFormat as unknown as AgentBDecision,
        warnings,
        formatType: 'agent-b',
        rawResponse
      };
      
    } catch (error) {
      console.error('[AgentResponseParser] ❌ 解析失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        warnings,
        rawResponse
      };
    }
  }

  /**
   * 解析执行 Agent 的响应
   */
  static parseExecutorResponse(rawResponse: string): ParseResult<any> {
    console.log('[AgentResponseParser] ========== 解析执行 Agent 响应 ==========');
    console.log('[AgentResponseParser] 原始响应长度:', rawResponse.length, '字符');
    
    const warnings: string[] = [];
    
    try {
      // 1. 使用智能解析器解析 JSON
      const parseResult = JsonParserEnhancer.smartParse(rawResponse, 'executor');
      
      if (!parseResult.success) {
        console.error('[AgentResponseParser] ❌ JSON 解析失败:', parseResult.error);
        return {
          success: false,
          error: parseResult.error,
          warnings: [...warnings, ...(parseResult.warnings || [])],
          rawResponse
        };
      }
      
      if (parseResult.warnings) {
        warnings.push(...parseResult.warnings);
      }
      
      console.log('[AgentResponseParser] ✅ 执行 Agent 响应解析成功');
      
      return {
        success: true,
        data: parseResult.data,
        warnings,
        formatType: 'executor',
        rawResponse
      };
      
    } catch (error) {
      console.error('[AgentResponseParser] ❌ 解析失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        warnings,
        rawResponse
      };
    }
  }

  /**
   * 通用解析入口
   */
  static parse(rawResponse: string, agentType?: AgentType): ParseResult {
    console.log('[AgentResponseParser] ========== 通用解析入口 ==========');
    
    switch (agentType) {
      case 'agent-b':
        return this.parseAgentBResponse(rawResponse);
      case 'executor':
        return this.parseExecutorResponse(rawResponse);
      default:
        // 自动检测
        const formatType = JsonParserEnhancer.detectStandardFormat(rawResponse);
        if (formatType === 'agent-b') {
          return this.parseAgentBResponse(rawResponse);
        } else if (formatType === 'executor') {
          return this.parseExecutorResponse(rawResponse);
        } else {
          // 通用解析
          const parseResult = JsonParserEnhancer.parseGenericJson(rawResponse);
          return {
            ...parseResult,
            formatType: 'unknown',
            rawResponse
          };
        }
    }
  }
}

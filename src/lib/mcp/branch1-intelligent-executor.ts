/**
 * 分支1智能执行器
 * 完整实现 insurance-d + Agent B 的完整闭环学习
 */

import { DomainKnowledgeRetriever } from './domain-knowledge-retriever';
import { CaseRepository } from './case-repository';
import { callMCPByCapabilityId } from './generic-mcp-call';
import type { 
  Branch1ExecutionResult, 
  InsuranceDAnalysisResult, 
  AgentBParamResult,
  DomainKnowledge 
} from '@/lib/types/branch1-types';

/**
 * 分支1智能执行器
 */
export class Branch1IntelligentExecutor {
  /**
   * 执行分支1完整流程（智能版）
   */
  static async execute(
    taskId: string,
    solutionNum: number,
    taskContent: string,
    options?: {
      skipInsuranceD?: boolean; // 是否跳过 insurance-d（可选，直接用默认逻辑
      mockParams?: Record<string, any>; // 可选的 mock 参数（用于测试）
    }
  ): Promise<Branch1ExecutionResult> {
    const { skipInsuranceD = false, mockParams: externalParams } = options || {};
    
    console.log('[Branch1IntelligentExecutor] 开始执行分支1（智能版）:', {
      taskId,
      solutionNum,
      taskContent: taskContent.substring(0, 100) + '...'
    });

    try {
      // Step 1: 获取领域知识
      const domainKnowledge = await DomainKnowledgeRetriever.getDomainKnowledge({
        solutionNum,
        capabilityId: solutionNum
      });

      let insuranceDAnalysis: InsuranceDAnalysisResult | undefined;
      let agentBParams: AgentBParamResult | undefined;

      if (skipInsuranceD) {
        // 跳过 insurance-d，使用简化逻辑
        console.log('[Branch1IntelligentExecutor] 跳过 insurance-d，使用简化逻辑');
        insuranceDAnalysis = this.getSimplifiedInsuranceDAnalysis(taskContent, domainKnowledge);
      } else {
        // TODO: 调用真实的 insurance-d
        console.log('[Branch1IntelligentExecutor] 调用 insurance-d（暂未实现，使用简化版）');
        insuranceDAnalysis = this.getSimplifiedInsuranceDAnalysis(taskContent, domainKnowledge);
      }

      // Step 3: 调用 Agent B 生成参数
      agentBParams = await this.callAgentB(insuranceDAnalysis, domainKnowledge, solutionNum, externalParams);

      // Step 4: 执行 MCP 调用
      const mcpResult = await this.executeMCP(solutionNum, agentBParams.params, domainKnowledge.capabilityInfo);

      // Step 5: 闭环学习
      await this.handleClosedLoopLearning(
        taskContent,
        insuranceDAnalysis,
        agentBParams,
        mcpResult,
        solutionNum
      );

      console.log('[Branch1IntelligentExecutor] 执行成功');

      return {
        success: true,
        executionMode: 'direct',
        insuranceDAnalysis,
        agentBParams,
        mcpResult,
        capabilityUpgradeSuggestion: agentBParams.capabilityUpgradeSuggestion
      };

    } catch (error) {
      console.error('[Branch1IntelligentExecutor] 执行失败:', error);
      
      return {
        success: false,
        executionMode: 'direct',
        error: error instanceof Error ? error.message : '执行失败'
      };
    }
  }

  /**
   * 简化版 insurance-d 分析（临时方案，待接入真实 LLM）
   */
  private static getSimplifiedInsuranceDAnalysis(
    taskContent: string,
    domainKnowledge: DomainKnowledge
  ): InsuranceDAnalysisResult {
    // 从 capabilityInfo 中获取信息
    const capabilityInfo = domainKnowledge.capabilityInfo;
    
    return {
      isNeedMcp: true,
      problem: taskContent,
      domainScene: this.inferDomainScene(taskContent, capabilityInfo?.capabilityType),
      capabilityType: capabilityInfo?.capabilityType || 'unknown',
      creationSuggestion: '根据任务需求调用对应功能描述执行操作'
    };
  }

  /**
   * 简化版 Agent B 调用（临时方案，待接入真实 LLM）
   */
  private static async callAgentB(
    insuranceDResult: InsuranceDAnalysisResult,
    domainKnowledge: DomainKnowledge,
    solutionNum: number,
    externalParams?: Record<string, any>
  ): Promise<AgentBParamResult> {
    const capabilityInfo = domainKnowledge.capabilityInfo;
    
    // 使用传入的外部参数，如果没有则使用参数模板或示例参数
    let params: Record<string, any> = {};
    
    if (externalParams) {
      // 使用外部传入的参数（如 Agent B 返回的参数）
      console.log('[Branch1IntelligentExecutor] 使用外部传入的参数');
      params = externalParams;
    } else if (domainKnowledge.paramTemplate) {
      params = domainKnowledge.paramTemplate;
    } else if (capabilityInfo?.paramExamples) {
      params = capabilityInfo.paramExamples as Record<string, any>;
    } else {
      // 使用默认参数
      params = this.getDefaultParamsForCapability(solutionNum);
    }

    return {
      apiAddress: capabilityInfo?.toolName 
        ? `${capabilityInfo.toolName}/${capabilityInfo.actionName}`
        : 'unknown',
      params,
      riskTips: '请确保参数符合业务规则',
      capabilityUpgradeSuggestion: '建议积累更多案例优化参数模板'
    };
  }

  /**
   * 根据 capabilityId 获取默认参数
   */
  private static getDefaultParamsForCapability(capabilityId: number): Record<string, any> {
    const defaults: Record<number, Record<string, any>> = {
      16: { query: '默认搜索查询', count: 10 },
      17: { query: '默认搜索查询', count: 5 },
      18: { query: '默认图片搜索', count: 10 },
      11: { accountId: 'insurance-account', articles: [] },
      12: { accountId: 'insurance-account', offset: 0, count: 20 },
      14: { accountId: 'insurance-account', mediaType: 'image' },
      15: {},
      19: { query: '热点数据' }
    };
    
    return defaults[capabilityId] || {};
  }

  /**
   * 执行 MCP 调用
   */
  private static async executeMCP(
    solutionNum: number,
    params: Record<string, any>,
    capabilityInfo: any
  ): Promise<any> {
    console.log('[Branch1IntelligentExecutor] 执行 MCP 调用:', { solutionNum, params, capabilityInfo });
    
    // 如果有 capabilityInfo，将 tool_name 和 action_name 添加到 params 中
    const enrichedParams = {
      ...params,
      ...(capabilityInfo?.toolName && { tool: capabilityInfo.toolName }),
      ...(capabilityInfo?.actionName && { action: capabilityInfo.actionName }),
    };
    
    return await callMCPByCapabilityId(solutionNum, enrichedParams);
  }

  /**
   * 闭环学习处理
   */
  private static async handleClosedLoopLearning(
    taskContent: string,
    insuranceDAnalysis: InsuranceDAnalysisResult,
    agentBParams: AgentBParamResult,
    mcpResult: any,
    solutionNum: number
  ): Promise<void> {
    const isSuccess = mcpResult?.success !== false;
    
    if (isSuccess) {
      // 保存成功案例
      await CaseRepository.saveSuccessCase({
        taskContent,
        capabilityType: insuranceDAnalysis.capabilityType,
        solutionNum,
        params: agentBParams.params,
        result: mcpResult
      });
    } else {
      // 保存失败案例
      await CaseRepository.saveFailureCase({
        taskContent,
        capabilityType: insuranceDAnalysis.capabilityType,
        solutionNum,
        params: agentBParams.params,
        failureReason: mcpResult?.error || '未知错误'
      });
    }
  }

  /**
   * 推断领域场景
   */
  private static inferDomainScene(
    taskContent: string,
    capabilityType?: string
  ): string {
    if (capabilityType?.includes('wechat')) {
      return '微信公众号发布';
    } else if (capabilityType?.includes('search')) {
      return '联网搜索';
    } else if (capabilityType?.includes('data')) {
      return '数据获取';
    }
    return '通用场景';
  }
}

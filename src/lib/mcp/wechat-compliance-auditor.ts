/**
 * 微信公众号合规审核 MCP 能力实现
 *
 * 能力 ID：20（content_audit - 完整审核）、21（content_audit_simple - 快速检查）
 * 能力名称：微信公众号内容合规审核
 *
 * 设计原则：
 * 1. 继承 BaseMCPCapabilityExecutor
 * 2. 实现 execute 方法
 * 3. 注册到 MCPCapabilityExecutorFactory
 *
 * 实现说明：
 * - 保留原有关键词检查、RAG 检索等逻辑
 * - 支持两种审核模式：full（完整审核）和 simple（快速检查）
 * - 基于 RAG 向量库 + LLM 实现微信公众号内容合规审核
 * - 返回格式化的自然语言摘要，便于LLM理解
 */

import { BaseMCPCapabilityExecutor, MCPCapabilityExecutorFactory } from './mcp-executor';
import { MCPExecutionResult } from './types';
import { createVectorRetriever } from '@/lib/rag/retriever';
import { ComplianceResultFormatter } from '@/lib/utils/compliance-result-formatter';

/**
 * 合规审核结果
 */
interface ComplianceAuditResult {
  approved: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  issues: string[];
  suggestions: string[];
  referencedRules: string[];
  auditTime: string;
}

/**
 * 快速审核结果
 */
interface SimpleAuditResult {
  approved: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  auditTime: string;
}

/**
 * 将MCP合规审核结果转换为格式化摘要
 */
function formatMcpAuditResultToSummary(auditResult: any): string {
  // 构建兼容的合规检查结果格式
  const complianceResult = {
    isCompliant: auditResult.approved || false,
    score: auditResult.riskLevel === 'low' ? 90 : 
           auditResult.riskLevel === 'medium' ? 70 : 
           auditResult.riskLevel === 'high' ? 50 : 30,
    issues: (auditResult.issues || []).map((issue: string, index: number) => ({
      type: auditResult.riskLevel === 'critical' ? 'critical' : 
            auditResult.riskLevel === 'high' ? 'warning' : 'info',
      category: '内容合规',
      description: issue,
      suggestion: (auditResult.suggestions || [])[index] || '请根据合规要求修改'
    })),
    summary: auditResult.summary || '合规审核完成',
    recommendations: auditResult.suggestions || []
  };

  // 使用格式化器生成摘要
  return ComplianceResultFormatter.format(complianceResult);
}

/**
 * 内部快速检查逻辑（共享）
 */
function quickCheckInternal(content: string): {
  issues: string[];
  suggestions: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
} {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // 绝对化用语检查
  const absoluteTerms = [
    '最好', '最佳', '最棒', '顶级', '第一', '唯一', '首个',
    '首选', '绝对', '完全', '彻底', '100%', '百分之百',
    '永不', '绝不', '完美', '极致', '终极', '巅峰'
  ];

  const foundAbsoluteTerms = absoluteTerms.filter(term => content.includes(term));
  if (foundAbsoluteTerms.length > 0) {
    issues.push(`使用了绝对化用语：${foundAbsoluteTerms.join('、')}`);
    suggestions.push('建议避免使用绝对化用语，使用更客观的表述');
  }

  // 保险行业敏感词检查（简化版）
  const insuranceSensitiveTerms = [
    '保本', '保息', '刚性兑付', '无风险', '零风险',
    '承诺收益', '保证收益', '稳赚不赔', '只赚不亏'
  ];

  const foundInsuranceTerms = insuranceSensitiveTerms.filter(term => content.includes(term));
  if (foundInsuranceTerms.length > 0) {
    issues.push(`使用了保险行业敏感用语：${foundInsuranceTerms.join('、')}`);
    suggestions.push('建议避免使用违规承诺类用语，遵守保险行业监管规定');
  }

  // 判定风险等级
  let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (issues.length > 0) {
    riskLevel = issues.length >= 3 ? 'high' : 'medium';
  }

  return { issues, suggestions, riskLevel };
}

/**
 * 从 RAG 上下文中提取引用的规则（共享）
 */
function extractReferencedRules(context: string): string[] {
  if (!context) return [];

  const rules: string[] = [];
  const lines = context.split('\n');

  for (const line of lines) {
    if (line.includes('[文档片段') || line.trim().length === 0) {
      continue;
    }
    if (line.trim().length > 20) {
      rules.push(line.trim().substring(0, 100));
    }
  }

  return rules.slice(0, 5); // 最多返回 5 条引用规则
}

/**
 * 微信公众号合规审核 MCP 能力执行器（完整审核 - ID 20）
 */
export class WeChatComplianceAuditExecutor extends BaseMCPCapabilityExecutor {
  readonly capabilityId = 20;
  readonly capabilityName = '微信公众号内容合规审核（RAG + LLM）';

  private retriever: ReturnType<typeof createVectorRetriever>;

  constructor() {
    super();
    this.retriever = createVectorRetriever('compliance_rules');
  }

  /**
   * 执行微信公众号内容合规审核
   *
   * @param params 参数（包含 articleTitle, articleContent, auditMode）
   * @returns MCP 执行结果
   */
  protected async execute(params: Record<string, any>): Promise<MCPExecutionResult> {
    const { articleTitle, articleContent, auditMode = 'full' } = params;

    console.log(`[WeChatComplianceAudit] 开始合规审核...`);
    console.log(`[WeChatComplianceAudit] 审核模式：${auditMode}`);
    console.log(`[WeChatComplianceAudit] 文章标题：${articleTitle}`);
    console.log(`[WeChatComplianceAudit] 文章内容长度：${articleContent?.length || 0} 字符`);

    try {
      let auditResult: ComplianceAuditResult | SimpleAuditResult;

      if (auditMode === 'simple') {
        // 快速检查
        auditResult = await this.quickCheck(articleContent);
      } else {
        // 完整审核
        auditResult = await this.auditContent(articleTitle, articleContent);
      }

      console.log(`[WeChatComplianceAudit] 审核完成`);

      // 🔥 修改：返回格式化后的摘要，便于LLM理解
      const formattedSummary = formatMcpAuditResultToSummary(auditResult);
      console.log(`[WeChatComplianceAudit] 生成格式化摘要完成`);

      return {
        success: true,
        data: {
          ...auditResult,
          formattedSummary // 🔥 新增：返回格式化摘要
        },
        executionTime: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`[WeChatComplianceAudit] 审核失败：`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        executionTime: new Date().toISOString(),
      };
    }
  }

  /**
   * 完整合规审核（RAG + LLM）
   * 注意：LLM 调用部分待接入
   */
  private async auditContent(
    articleTitle: string,
    articleContent: string
  ): Promise<ComplianceAuditResult> {
    const auditTime = new Date().toISOString();

    try {
      // 1. RAG 检索相关合规规则
      const searchQuery = `${articleTitle}\n${articleContent}`.substring(0, 500);
      const context = await this.retriever.retrieveContext(searchQuery, {
        topK: 5,
        minScore: 0.6,
      });

      // 2. 提取引用的规则
      const referencedRules = extractReferencedRules(context);

      // 3. 基于规则进行初步检查（硬编码部分快速检查）
      const { issues, suggestions, riskLevel } = quickCheckInternal(articleContent);

      // 4. 构建审核结果
      const approved = issues.length === 0;

      return {
        approved,
        riskLevel,
        issues,
        suggestions,
        referencedRules,
        auditTime,
      };
    } catch (error) {
      console.error('[WeChatComplianceAudit] 审核失败:', error);
      return {
        approved: false,
        riskLevel: 'high',
        issues: ['审核过程中发生错误，请稍后重试'],
        suggestions: ['请检查文章内容后重新提交审核'],
        referencedRules: [],
        auditTime,
      };
    }
  }

  /**
   * 快速合规检查（基于关键词和规则片段）
   */
  private async quickCheck(articleContent: string): Promise<SimpleAuditResult> {
    const auditTime = new Date().toISOString();

    try {
      const { issues, suggestions, riskLevel } = quickCheckInternal(articleContent);

      const approved = issues.length === 0;
      const summary = approved
        ? '文章内容合规，未发现明显违规问题'
        : `发现 ${issues.length} 个潜在问题，请查看详细审核结果`;

      return {
        approved,
        riskLevel,
        summary,
        auditTime,
      };
    } catch (error) {
      console.error('[WeChatComplianceAudit] 快速检查失败:', error);
      return {
        approved: false,
        riskLevel: 'high',
        summary: '审核过程中发生错误，请稍后重试',
        auditTime,
      };
    }
  }
}

/**
 * 微信公众号合规审核 MCP 能力执行器（快速检查 - ID 21）
 * 仅使用 RAG 向量库检索，不调用 LLM
 */
export class WeChatComplianceAuditSimpleExecutor extends BaseMCPCapabilityExecutor {
  readonly capabilityId = 21;
  readonly capabilityName = '微信公众号内容合规审核（快速检查 - 仅用 RAG）';

  private retriever: ReturnType<typeof createVectorRetriever>;

  constructor() {
    super();
    this.retriever = createVectorRetriever('compliance_rules');
  }

  /**
   * 执行微信公众号内容合规审核（快速检查 - 仅用 RAG）
   *
   * @param params 参数（包含 articleTitle, articleContent）
   * @returns MCP 执行结果
   */
  protected async execute(params: Record<string, any>): Promise<MCPExecutionResult> {
    const { articleTitle, articleContent } = params;

    console.log(`[WeChatComplianceAuditSimple] 开始快速合规审核（仅用 RAG）...`);
    console.log(`[WeChatComplianceAuditSimple] 文章标题：${articleTitle}`);
    console.log(`[WeChatComplianceAuditSimple] 文章内容长度：${articleContent?.length || 0} 字符`);

    try {
      const auditTime = new Date().toISOString();

      // 1. RAG 检索相关合规规则（仅用 RAG，不用 LLM）
      const searchQuery = `${articleTitle}\n${articleContent}`.substring(0, 500);
      const context = await this.retriever.retrieveContext(searchQuery, {
        topK: 3,  // 快速版减少检索数量
        minScore: 0.6,
      });

      // 2. 提取引用的规则
      const referencedRules = extractReferencedRules(context);

      // 3. 关键词快速检查
      const { issues, suggestions, riskLevel } = quickCheckInternal(articleContent);

      // 4. 构建审核结果（包含 RAG 检索到的规则）
      const approved = issues.length === 0;
      const summary = approved
        ? '文章内容合规，未发现明显违规问题'
        : `发现 ${issues.length} 个潜在问题，请查看详细审核结果`;

      const auditResult = {
        approved,
        riskLevel,
        summary,
        referencedRules,  // RAG 检索到的相关规则
        suggestions,      // 改进建议
        auditTime,
      };

      console.log(`[WeChatComplianceAuditSimple] 审核完成，风险等级：${riskLevel}`);

      // 🔥 修改：返回格式化后的摘要，便于LLM理解
      const formattedSummary = formatMcpAuditResultToSummary(auditResult);
      console.log(`[WeChatComplianceAuditSimple] 生成格式化摘要完成`);

      return {
        success: true,
        data: {
          ...auditResult,
          formattedSummary // 🔥 新增：返回格式化摘要
        },
        executionTime: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`[WeChatComplianceAuditSimple] 审核失败：`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        executionTime: new Date().toISOString(),
      };
    }
  }
}

// 注册执行器到工厂
// 🧪 测试：数据库已禁用 ID=20，Agent T 只能选择 ID=21
MCPCapabilityExecutorFactory.registerExecutor(new WeChatComplianceAuditExecutor());
MCPCapabilityExecutorFactory.registerExecutor(new WeChatComplianceAuditSimpleExecutor());

/**
 * 微信公众号合规审核 MCP 工具集
 * 供 tool-auto-registrar 自动注册使用
 */
export const WechatComplianceAuditor = {
  /**
   * 完整合规审核（RAG + LLM）
   */
  contentAudit: async (params: any) => {
    console.log('[WechatComplianceAuditor] contentAudit 被调用，参数:', params);
    
    try {
      // 从参数中提取文章内容（适配不同的参数格式）
      let articleTitle = params.articleTitle || params.title || '未命名文章';
      let articleContent = params.articleContent || params.content;
      
      // 兼容 articles 数组的情况
      if (!articleContent && params.articles && Array.isArray(params.articles) && params.articles.length > 0) {
        articleTitle = params.articles[0].title || articleTitle;
        articleContent = params.articles[0].content;
      }
      
      if (!articleContent) {
        return {
          success: false,
          error: '缺少文章内容参数，请提供 articleContent 或 articles 参数',
          metadata: { timestamp: Date.now() }
        };
      }
      
      const executor = new WeChatComplianceAuditExecutor();
      const result = await executor.execute({
        articleTitle,
        articleContent,
        auditMode: 'full'
      });
      
      return {
        success: result.success,
        data: result.data,
        error: result.error,
        metadata: { timestamp: Date.now() }
      };
    } catch (error) {
      console.error('[WechatComplianceAuditor] contentAudit 执行失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: { timestamp: Date.now() }
      };
    }
  },
  
  /**
   * 快速合规检查（仅用 RAG）
   */
  contentAuditSimple: async (params: any) => {
    console.log('[WechatComplianceAuditor] contentAuditSimple 被调用，参数:', params);
    
    try {
      // 从参数中提取文章内容（适配不同的参数格式）
      let articleTitle = params.articleTitle || params.title || '未命名文章';
      let articleContent = params.articleContent || params.content;
      
      // 兼容 articles 数组的情况
      if (!articleContent && params.articles && Array.isArray(params.articles) && params.articles.length > 0) {
        articleTitle = params.articles[0].title || articleTitle;
        articleContent = params.articles[0].content;
      }
      
      if (!articleContent) {
        return {
          success: false,
          error: '缺少文章内容参数，请提供 articleContent 或 articles 参数',
          metadata: { timestamp: Date.now() }
        };
      }
      
      const executor = new WeChatComplianceAuditSimpleExecutor();
      const result = await executor.execute({
        articleTitle,
        articleContent
      });
      
      return {
        success: result.success,
        data: result.data,
        error: result.error,
        metadata: { timestamp: Date.now() }
      };
    } catch (error) {
      console.error('[WechatComplianceAuditor] contentAuditSimple 执行失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: { timestamp: Date.now() }
      };
    }
  }
};


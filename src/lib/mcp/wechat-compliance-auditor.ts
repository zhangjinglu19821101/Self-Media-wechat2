/**
 * 微信公众号合规审核 MCP 能力实现
 *
 * 能力 ID：20（content_audit - 完整审核）、21（content_audit_simple - 快速检查）
 * 能力名称：微信公众号内容合规审核
 *
 * 三层审核架构：
 *   第1层：关键词硬匹配（零成本、确定性、即时）
 *   第2层：RAG 全量检索（低成本、召回相关规则）
 *   第3层：LLM 语义判定（核心环节：判断"规则是否被违反"）
 *
 * 设计原则：
 * 1. 继承 BaseMCPCapabilityExecutor
 * 2. 实现 execute 方法
 * 3. 注册到 MCPCapabilityExecutorFactory
 * 4. ID=20 完整模式：三层全部执行；ID=21 快速模式：仅第1层
 */

import { BaseMCPCapabilityExecutor, MCPCapabilityExecutorFactory } from './mcp-executor';
import { MCPExecutionResult } from './types';
import { createVectorRetriever } from '@/lib/rag/retriever';
import { ComplianceResultFormatter } from '@/lib/utils/compliance-result-formatter';
import { ComplianceCheckResult, ComplianceIssue } from '@/lib/agents/prompts/compliance-check';
import { callLLM } from '@/lib/agent-llm';
import { readFileSync } from 'fs';
import { join } from 'path';

// ============================================================================
// 类型定义
// ============================================================================

/** 合规审核结果（完整模式） */
interface ComplianceAuditResult {
  approved: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  issues: string[];
  suggestions: string[];
  referencedRules: string[];
  /** 第3层 LLM 判定的详细违规项 */
  llmViolations?: LlmViolation[];
  /** 各层审核详情 */
  auditDetails?: AuditDetails;
  auditTime: string;
}

/** 快速审核结果 */
interface SimpleAuditResult {
  approved: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  auditTime: string;
}

/** LLM 判定的单个违规项 */
interface LlmViolation {
  ruleIndex: number;
  violated: boolean;
  severity: 'critical' | 'warning' | 'info';
  evidence: string;
  suggestion: string;
  category: string;
}

/** LLM 判定的整体输出 */
interface LlmJudgeOutput {
  violations: LlmViolation[];
  overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
}

/** 各层审核详情 */
interface AuditDetails {
  layer1KeywordHit: { issues: string[]; hitCount: number };
  layer2RagRetrieval: { rulesCount: number; topScores: number[] };
  layer3LlmJudge: { called: boolean; violationCount: number; latencyMs?: number; error?: string };
}

/** RAG 检索到的带分数的规则 */
interface RetrievedRule {
  text: string;
  score: number;
}

// ============================================================================
// 第1层：关键词硬匹配（增强版）
// ============================================================================

/**
 * 关键词词库定义
 * 每个词库包含：关键词列表、违规类型、风险等级、建议
 */
const KEYWORD_DICTIONARIES = [
  {
    name: '绝对化用语',
    terms: [
      '最好', '最佳', '最棒', '顶级', '第一', '唯一', '首个',
      '首选', '绝对', '完全', '彻底', '100%', '百分之百',
      '永不', '绝不', '完美', '极致', '终极', '巅峰',
      'No.1', 'number1', '冠军', '王者', '无敌', '史无前例',
      '绝无仅有', '空前绝后', '万能', '包治百病',
    ],
    riskLevel: 'high' as const,
    suggestion: '建议避免使用绝对化用语，使用更客观的表述（如"较为推荐""市场上名列前茅"）',
  },
  {
    name: '保险行业敏感用语',
    terms: [
      '保本', '保息', '刚性兑付', '无风险', '零风险',
      '承诺收益', '保证收益', '稳赚不赔', '只赚不亏',
      '稳赚', '必赚', '包赚', '铁赚', '躺赚',
      '零门槛', '无门槛', '白嫖', '免费领取',
    ],
    riskLevel: 'critical' as const,
    suggestion: '建议删除违规承诺类用语，遵守保险行业监管规定，使用"收益存在波动风险"等合规表述',
  },
  {
    name: '虚假承诺与夸大宣传',
    terms: [
      '返本', '全额返还', '不花一分钱', '白送',
      '买了不亏', '闭眼入', '错过后悔', '再不买就晚了',
      '限量发售', '最后名额', '仅剩X个', '售罄即将',
    ],
    riskLevel: 'high' as const,
    suggestion: '建议删除夸大宣传和饥饿营销用语，使用客观事实陈述',
  },
  {
    name: '贬低同业与不实对比',
    terms: [
      '别家都不行', '其他公司都是坑', '只有我们',
      '同业最差', '别人家的都不好', '被坑了',
    ],
    riskLevel: 'medium' as const,
    suggestion: '建议避免贬低同业，如需对比应基于客观公开数据并标注来源',
  },
];

/**
 * 第1层：关键词硬匹配检查
 * - 对完整文章进行精确关键词匹配
 * - 按词库维度输出命中的关键词
 */
/**
 * 关键词匹配：支持大小写不敏感 + 中文词边界检测
 *
 * 修复 P0-3：原 content.includes(term) 存在两个问题：
 * 1. 大小写敏感：No.1 不匹配 no.1
 * 2. 部分匹配："唯一"匹配"唯一性"，"第一"匹配"第一反应"
 *
 * 改进策略：
 * - 英文/数字/符号类关键词：大小写不敏感的 includes
 * - 纯中文关键词：检查词边界（前后不能是汉字），避免"唯一"匹配"唯一性"
 */
function isKeywordMatch(content: string, term: string): boolean {
  const lowerContent = content.toLowerCase();
  const lowerTerm = term.toLowerCase();

  // 策略1：非纯中文关键词（含英文/数字/符号），仅做大小写不敏感匹配
  if (/[a-zA-Z0-9%!%]/.test(term)) {
    return lowerContent.includes(lowerTerm);
  }

  // 策略2：纯中文关键词，检查词边界
  // 词边界定义：关键词前面不能是汉字，后面也不能是汉字
  // 这样"唯一"不会匹配"唯一性"，"第一"不会匹配"第一反应"
  const idx = lowerContent.indexOf(lowerTerm);
  if (idx === -1) return false;

  // 检查所有出现位置，只要有任意一处满足词边界即可
  let searchFrom = 0;
  while (searchFrom < lowerContent.length) {
    const pos = lowerContent.indexOf(lowerTerm, searchFrom);
    if (pos === -1) break;

    const beforeChar = pos > 0 ? lowerContent[pos - 1] : '';
    const afterIdx = pos + lowerTerm.length;
    const afterChar = afterIdx < lowerContent.length ? lowerContent[afterIdx] : '';

    const isChineseChar = (ch: string) => /[\u4e00-\u9fff]/.test(ch);

    // 前后都不是汉字 → 满足词边界
    if (!isChineseChar(beforeChar) && !isChineseChar(afterChar)) {
      return true;
    }

    searchFrom = pos + 1;
  }

  return false;
}

function quickCheckInternal(content: string): {
  issues: string[];
  suggestions: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  details: Array<{ name: string; found: string[]; riskLevel: string }>;
} {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let maxRisk: 'low' | 'medium' | 'high' | 'critical' = 'low';
  const details: Array<{ name: string; found: string[]; riskLevel: string }> = [];

  for (const dict of KEYWORD_DICTIONARIES) {
    const found = dict.terms.filter(term => isKeywordMatch(content, term));
    if (found.length > 0) {
      issues.push(`使用了${dict.name}：${found.join('、')}`);
      suggestions.push(dict.suggestion);
      details.push({ name: dict.name, found, riskLevel: dict.riskLevel });

      // 更新最高风险等级
      const riskOrder = ['low', 'medium', 'high', 'critical'] as const;
      if (riskOrder.indexOf(dict.riskLevel) > riskOrder.indexOf(maxRisk)) {
        maxRisk = dict.riskLevel;
      }
    }
  }

  // 综合风险等级修正：命中3个及以上维度 → 升级
  if (details.length >= 3 && maxRisk !== 'critical') {
    maxRisk = 'critical';
  } else if (details.length >= 2 && maxRisk === 'medium') {
    maxRisk = 'high';
  }

  return { issues, suggestions, riskLevel: maxRisk, details };
}

// ============================================================================
// 第2层：RAG 全量检索（增强版）
// ============================================================================

/**
 * 将文章分段用于 RAG 检索
 * - 每段 ≤ segmentMaxChars 字符
 * - 段间重叠 overlapChars 字符
 * - 避免只检索前500字导致文章后半部分遗漏
 */
function splitArticleIntoSegments(
  articleTitle: string,
  articleContent: string,
  segmentMaxChars: number = 800,
  overlapChars: number = 100
): string[] {
  const fullText = `${articleTitle}\n${articleContent}`;

  // 文章较短，无需分段
  if (fullText.length <= segmentMaxChars) {
    return [fullText];
  }

  const segments: string[] = [];
  let start = 0;

  while (start < fullText.length) {
    const end = Math.min(start + segmentMaxChars, fullText.length);
    segments.push(fullText.substring(start, end));

    // 最后一段不需要继续
    if (end >= fullText.length) break;

    start = end - overlapChars;

    // 防止无限循环
    if (start <= segments.length * (segmentMaxChars - overlapChars) - segmentMaxChars) {
      break;
    }
  }

  return segments;
}

/**
 * 从 RAG 上下文中提取引用的规则（增强版）
 * - 返回带分数的规则
 * - 更精确的提取逻辑
 */
function extractReferencedRulesEnhanced(context: string): RetrievedRule[] {
  if (!context) return [];

  const rules: RetrievedRule[] = [];
  const lines = context.split('\n');
  let currentScore = 0;

  for (const line of lines) {
    // 提取相似度分数
    const scoreMatch = line.match(/相似度:\s*([\d.]+)/);
    if (scoreMatch) {
      currentScore = parseFloat(scoreMatch[1]);
      continue;
    }

    // 跳过标记行和空行
    if (line.includes('[文档片段') || line.trim().length === 0) {
      continue;
    }

    // 有效规则行（长度 > 15 字符）
    const trimmed = line.trim();
    if (trimmed.length > 15) {
      rules.push({
        text: trimmed.substring(0, 300),  // 保留更多原文（100→300）
        score: currentScore,
      });
    }
  }

  return rules.slice(0, 10);  // 最多返回 10 条
}

/**
 * 第2层：RAG 全量检索相关合规规则
 * - 文章分段 → 每段 Embedding → 向量搜索
 * - 去重合并 → 按相似度排序 → 返回 Top 规则
 */
async function retrieveRelevantRulesFullArticle(
  retriever: ReturnType<typeof createVectorRetriever>,
  articleTitle: string,
  articleContent: string,
  options: { topKPerSegment?: number; minScore?: number; maxTotalRules?: number } = {}
): Promise<{ rules: RetrievedRule[]; segmentCount: number; topScores: number[] }> {
  const {
    topKPerSegment = 3,
    minScore = 0.55,  // 稍微降低阈值（0.6→0.55），召回更多相关规则
    maxTotalRules = 10,
  } = options;

  // 分段
  const segments = splitArticleIntoSegments(articleTitle, articleContent);
  console.log(`[RAG全量检索] 文章分段: ${segments.length} 段, 每段约 800 字符`);

  const allRules: RetrievedRule[] = [];

  // 对每段进行 RAG 检索
  for (let i = 0; i < segments.length; i++) {
    try {
      const context = await retriever.retrieveContext(segments[i], {
        topK: topKPerSegment,
        minScore,
      });

      const segmentRules = extractReferencedRulesEnhanced(context);
      allRules.push(...segmentRules);
    } catch (error) {
      console.warn(`[RAG全量检索] 第${i + 1}段检索失败:`, error);
    }
  }

  // 去重：按文本前50字符去重（同一规则可能被多段召回）
  const seen = new Set<string>();
  const uniqueRules: RetrievedRule[] = [];
  for (const rule of allRules) {
    const key = rule.text.substring(0, 50);
    if (!seen.has(key)) {
      seen.add(key);
      uniqueRules.push(rule);
    }
  }

  // 按相似度排序，取 Top N
  uniqueRules.sort((a, b) => b.score - a.score);
  const finalRules = uniqueRules.slice(0, maxTotalRules);

  const topScores = finalRules.map(r => r.score);

  console.log(`[RAG全量检索] 检索完成: 总召回 ${allRules.length} 条 → 去重后 ${uniqueRules.length} 条 → Top ${finalRules.length} 条`);
  console.log(`[RAG全量检索] Top 分数: [${topScores.map(s => s.toFixed(3)).join(', ')}]`);

  return { rules: finalRules, segmentCount: segments.length, topScores };
}

// ============================================================================
// 第3层：LLM 语义判定
// ============================================================================

/** 缓存合规判定提示词 */
let complianceJudgePrompt: string | null = null;

/**
 * 加载合规判定提示词
 */
function getComplianceJudgePrompt(): string {
  if (complianceJudgePrompt) return complianceJudgePrompt;

  try {
    const promptPath = join(process.cwd(), 'src/lib/agents/prompts/compliance-judge.md');
    complianceJudgePrompt = readFileSync(promptPath, 'utf-8');
    return complianceJudgePrompt;
  } catch (error) {
    console.warn('[合规判定] 加载提示词文件失败，使用内嵌版本:', error);
    // 内嵌简版提示词作为兜底
    complianceJudgePrompt = `你是保险行业内容合规审核专家。根据给定的合规规则，判断文章是否违反。

输出严格JSON格式：
{
  "violations": [
    {"ruleIndex": 0, "violated": true/false, "severity": "critical/warning/info", "evidence": "文章原文", "suggestion": "修改建议", "category": "保险合规/绝对化用语/虚假误导/平台规则"}
  ],
  "overallRiskLevel": "low/medium/high/critical",
  "summary": "一句话总结"
}`;
    return complianceJudgePrompt;
  }
}

/**
 * 第3层：调用 LLM 对文章 + 检索到的规则进行语义判定
 * - 使用轻量模型（doubao-seed-1-6-lite）控制成本
 * - 30秒超时，失败降级
 * - 违规判定必须有原文证据
 */
async function llmJudgeViolations(
  articleContent: string,
  rules: RetrievedRule[],
  workspaceId?: string
): Promise<{ output: LlmJudgeOutput | null; latencyMs: number; error?: string }> {
  const startTime = Date.now();

  if (rules.length === 0) {
    console.log('[合规LLM判定] 无相关规则，跳过 LLM 判定');
    return { output: null, latencyMs: 0 };
  }

  // 截断文章内容（避免超长输入，保留 8000 字符约 4000 token）
  const maxArticleLength = 8000;
  const truncatedArticle = articleContent.length > maxArticleLength
    ? articleContent.substring(0, maxArticleLength) + '\n\n[...文章内容已截断...]'
    : articleContent;

  // 构建规则列表文本
  const rulesText = rules.map((rule, index) =>
    `【规则${index}】(相似度: ${rule.score.toFixed(3)})\n${rule.text}`
  ).join('\n\n');

  // 构建用户提示词
  // 使用 XML 边界标记隔离文章内容，防止提示词注入攻击
  const userPrompt = `## 待审核文章

<article>
${truncatedArticle}
</article>

---

## 相关合规规则（来自向量检索）

<rules>
${rulesText}
</rules>

---

请逐条判断 <article> 标签内的文章是否违反了 <rules> 标签内的规则，严格输出 JSON 格式。`;

  const systemPrompt = getComplianceJudgePrompt();

  console.log(`[合规LLM判定] 开始调用 LLM，规则数: ${rules.length}，文章长度: ${truncatedArticle.length}`);

  try {
    const response = await callLLM(
      'compliance_judge',
      '合规审核专家',
      systemPrompt,
      userPrompt,
      {
        timeout: 120000,  // 120秒超时（合规判定需逐条分析规则，60s易超时）
        workspaceId,     // BYOK 支持
        maxRetries: 1,   // 最多重试1次
      }
    );

    const latencyMs = Date.now() - startTime;
    console.log(`[合规LLM判定] LLM 响应完成，耗时: ${latencyMs}ms，响应长度: ${response.length}`);

    // 解析 LLM 输出
    const output = parseLlmJudgeResponse(response);

    if (output) {
      const violatedCount = output.violations.filter(v => v.violated).length;
      console.log(`[合规LLM判定] 判定结果: ${violatedCount} 处违规，整体风险: ${output.overallRiskLevel}`);
    }

    return { output, latencyMs, error: output ? undefined : 'JSON 解析失败' };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[合规LLM判定] LLM 调用失败 (${latencyMs}ms):`, errorMsg);
    return { output: null, latencyMs, error: errorMsg };
  }
}

/**
 * 解析 LLM 判定输出的 JSON
 * - 容错处理：清理 markdown 代码块、多余空白
 * - 提取最外层 JSON 对象
 */
function parseLlmJudgeResponse(response: string): LlmJudgeOutput | null {
  try {
    // 清理 markdown 代码块
    let cleaned = response.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    // 尝试直接解析
    try {
      const parsed = JSON.parse(cleaned);
      return validateLlmJudgeOutput(parsed);
    } catch {
      // 直接解析失败，尝试提取 JSON 对象
    }

    // 提取最外层 {...}
    const braceStart = cleaned.indexOf('{');
    const braceEnd = cleaned.lastIndexOf('}');
    if (braceStart !== -1 && braceEnd > braceStart) {
      const jsonStr = cleaned.substring(braceStart, braceEnd + 1);
      const parsed = JSON.parse(jsonStr);
      return validateLlmJudgeOutput(parsed);
    }

    console.warn('[合规LLM判定] 无法从响应中提取 JSON');
    return null;
  } catch (error) {
    console.error('[合规LLM判定] JSON 解析失败:', error);
    return null;
  }
}

/**
 * 校验 LLM 判定输出的结构完整性
 */
function validateLlmJudgeOutput(parsed: Record<string, unknown>): LlmJudgeOutput | null {
  if (!parsed || !Array.isArray(parsed.violations)) {
    console.warn('[合规LLM判定] 输出缺少 violations 数组');
    return null;
  }

  // 确保每个 violation 的字段完整性
  const validSeverities = ['critical', 'warning', 'info'] as const;
  const validRiskLevels = ['low', 'medium', 'high', 'critical'] as const;
  const violations: LlmViolation[] = (parsed.violations as Record<string, unknown>[]).map((v) => ({
    ruleIndex: typeof v.ruleIndex === 'number' ? v.ruleIndex : 0,
    violated: v.violated === true,
    severity: validSeverities.includes(v.severity as typeof validSeverities[number]) ? v.severity as LlmViolation['severity'] : 'info',
    evidence: typeof v.evidence === 'string' ? v.evidence : '',
    suggestion: typeof v.suggestion === 'string' ? v.suggestion : '',
    category: typeof v.category === 'string' ? v.category : '保险合规',
  }));

  return {
    violations,
    overallRiskLevel: validRiskLevels.includes(parsed.overallRiskLevel as typeof validRiskLevels[number])
      ? (parsed.overallRiskLevel as LlmJudgeOutput['overallRiskLevel'])
      : 'medium',
    summary: typeof parsed.summary === 'string' ? parsed.summary : '合规审核完成',
  };
}

// ============================================================================
// 格式化输出
// ============================================================================

/**
 * 将 MCP 合规审核结果转换为格式化摘要
 */
function formatMcpAuditResultToSummary(auditResult: ComplianceAuditResult | SimpleAuditResult): string {
  // 提取 issues 和 suggestions（兼容两种结果类型）
  const rawIssues: string[] = 'issues' in auditResult ? (auditResult.issues || []) : [];
  const suggestions: string[] = 'suggestions' in auditResult ? (auditResult.suggestions || []) : [];
  const summary: string = 'summary' in auditResult ? (auditResult.summary || '合规审核完成') :
    (auditResult.approved ? '文章内容合规，未发现明显违规问题' : '合规审核未通过');

  // 构建合规检查结果格式（与 ComplianceCheckResult 接口对齐）
  const complianceResult: ComplianceCheckResult = {
    isCompliant: auditResult.approved || false,
    score: auditResult.riskLevel === 'low' ? 90 :
           auditResult.riskLevel === 'medium' ? 70 :
           auditResult.riskLevel === 'high' ? 50 : 30,
    issues: rawIssues.map((issue: string, index: number): ComplianceIssue => ({
      type: auditResult.riskLevel === 'critical' ? 'critical' :
            auditResult.riskLevel === 'high' ? 'warning' : 'info',
      category: '内容合规',
      description: issue,
      suggestion: suggestions[index] || '请根据合规要求修改'
    })),
    summary,
    recommendations: suggestions
  };

  // 使用格式化器生成摘要
  return ComplianceResultFormatter.format(complianceResult);
}

// ============================================================================
// MCP 执行器：完整审核（ID=20）— 三层审核架构
// ============================================================================

export class WeChatComplianceAuditExecutor extends BaseMCPCapabilityExecutor {
  readonly capabilityId = 20;
  readonly capabilityName = '微信公众号内容合规审核（关键词 + RAG + LLM 三层审核）';

  private retriever: ReturnType<typeof createVectorRetriever>;

  constructor() {
    super();
    this.retriever = createVectorRetriever('wechat_compliance_rules');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 基类 BaseMCPCapabilityExecutor 的签名
  protected async execute(params: Record<string, any>): Promise<MCPExecutionResult> {
    const { articleTitle, articleContent, auditMode = 'full', workspaceId } = params;

    console.log(`[WeChatComplianceAudit] 开始完整合规审核（三层架构）...`);
    console.log(`[WeChatComplianceAudit] 文章标题：${articleTitle}`);
    console.log(`[WeChatComplianceAudit] 文章内容长度：${articleContent?.length || 0} 字符`);
    console.log(`[WeChatComplianceAudit] workspaceId：${workspaceId || '未传入'}`);

    try {
      let auditResult: ComplianceAuditResult | SimpleAuditResult;

      if (auditMode === 'simple') {
        auditResult = await this.quickCheck(articleContent);
      } else {
        auditResult = await this.auditContentThreeLayers(articleTitle, articleContent, workspaceId);
      }

      console.log(`[WeChatComplianceAudit] 审核完成`);

      const formattedSummary = formatMcpAuditResultToSummary(auditResult);

      return {
        success: true,
        data: {
          ...auditResult,
          formattedSummary,
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
   * 三层合规审核（核心方法）
   *
   * 第1层：关键词硬匹配 → 确定性违规
   * 第2层：RAG 全量检索 → 召回相关规则
   * 第3层：LLM 语义判定 → 判断"规则是否被违反"
   */
  private async auditContentThreeLayers(
    articleTitle: string,
    articleContent: string,
    workspaceId?: string
  ): Promise<ComplianceAuditResult> {
    const auditTime = new Date().toISOString();
    const allIssues: string[] = [];
    const allSuggestions: string[] = [];
    let maxRiskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    const auditDetails: AuditDetails = {
      layer1KeywordHit: { issues: [], hitCount: 0 },
      layer2RagRetrieval: { rulesCount: 0, topScores: [] },
      layer3LlmJudge: { called: false, violationCount: 0 },
    };

    // ==================== 第1层：关键词硬匹配 ====================
    console.log('[合规审核] ===== 第1层：关键词硬匹配 =====');
    const layer1Result = quickCheckInternal(articleContent);
    auditDetails.layer1KeywordHit = {
      issues: layer1Result.issues,
      hitCount: layer1Result.details.reduce((sum, d) => sum + d.found.length, 0),
    };

    if (layer1Result.issues.length > 0) {
      allIssues.push(...layer1Result.issues);
      allSuggestions.push(...layer1Result.suggestions);
      console.log(`[合规审核] 第1层命中 ${layer1Result.details.reduce((s, d) => s + d.found.length, 0)} 个关键词`);

      // 更新风险等级
      const riskOrder = ['low', 'medium', 'high', 'critical'] as const;
      if (riskOrder.indexOf(layer1Result.riskLevel) > riskOrder.indexOf(maxRiskLevel)) {
        maxRiskLevel = layer1Result.riskLevel;
      }
    } else {
      console.log('[合规审核] 第1层未命中任何关键词');
    }

    // ==================== 第2层：RAG 全量检索 ====================
    console.log('[合规审核] ===== 第2层：RAG 全量检索 =====');
    let retrievedRules: RetrievedRule[] = [];

    try {
      const ragResult = await retrieveRelevantRulesFullArticle(
        this.retriever,
        articleTitle,
        articleContent,
        { topKPerSegment: 3, minScore: 0.55, maxTotalRules: 10 }
      );
      retrievedRules = ragResult.rules;
      auditDetails.layer2RagRetrieval = {
        rulesCount: retrievedRules.length,
        topScores: ragResult.topScores,
      };
      console.log(`[合规审核] 第2层检索到 ${retrievedRules.length} 条相关规则`);
    } catch (error) {
      console.warn('[合规审核] 第2层 RAG 检索失败（降级跳过）:', error);
      auditDetails.layer2RagRetrieval = { rulesCount: 0, topScores: [] };
    }

    // ==================== 第3层：LLM 语义判定 ====================
    console.log('[合规审核] ===== 第3层：LLM 语义判定 =====');
    let llmViolations: LlmViolation[] = [];

    if (retrievedRules.length > 0) {
      try {
        const llmResult = await llmJudgeViolations(articleContent, retrievedRules, workspaceId);
        auditDetails.layer3LlmJudge = {
          called: true,
          violationCount: 0,
          latencyMs: llmResult.latencyMs,
          error: llmResult.error,
        };

        if (llmResult.output) {
          llmViolations = llmResult.output.violations.filter(v => v.violated);
          auditDetails.layer3LlmJudge.violationCount = llmViolations.length;

          // 将 LLM 判定的违规项合并到结果中
          for (const v of llmViolations) {
            const ruleText = v.ruleIndex < retrievedRules.length
              ? retrievedRules[v.ruleIndex].text
              : '未知规则';

            allIssues.push(`[LLM判定-${v.category}] ${v.evidence}（违反规则：${ruleText.substring(0, 60)}...）`);
            allSuggestions.push(v.suggestion);
          }

          // 更新风险等级
          const riskOrder = ['low', 'medium', 'high', 'critical'] as const;
          if (riskOrder.indexOf(llmResult.output.overallRiskLevel) > riskOrder.indexOf(maxRiskLevel)) {
            maxRiskLevel = llmResult.output.overallRiskLevel;
          }

          console.log(`[合规审核] 第3层判定 ${llmViolations.length} 处违规，风险等级: ${llmResult.output.overallRiskLevel}`);
        } else {
          console.warn('[合规审核] 第3层 LLM 判定输出为空（降级：仅使用第1层+第2层结果）');
        }
      } catch (error) {
        console.error('[合规审核] 第3层 LLM 判定异常（降级）:', error);
        auditDetails.layer3LlmJudge = {
          called: true,
          violationCount: 0,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    } else {
      console.log('[合规审核] 第2层无相关规则，跳过第3层 LLM 判定');
      auditDetails.layer3LlmJudge = { called: false, violationCount: 0 };
    }

    // ==================== 汇总三层结果 ====================
    const approved = allIssues.length === 0;
    const referencedRules = retrievedRules.map(r => r.text);

    console.log(`[合规审核] ===== 三层审核汇总 =====`);
    console.log(`[合规审核] 第1层关键词命中: ${auditDetails.layer1KeywordHit.hitCount} 个`);
    console.log(`[合规审核] 第2层RAG检索: ${auditDetails.layer2RagRetrieval.rulesCount} 条规则`);
    console.log(`[合规审核] 第3层LLM判定违规: ${auditDetails.layer3LlmJudge.violationCount} 处`);
    console.log(`[合规审核] 最终结果: ${approved ? '通过' : '未通过'}，风险等级: ${maxRiskLevel}`);

    return {
      approved,
      riskLevel: maxRiskLevel,
      issues: allIssues,
      suggestions: allSuggestions,
      referencedRules,
      llmViolations,
      auditDetails,
      auditTime,
    };
  }

  /**
   * 快速合规检查（仅第1层关键词匹配）
   */
  private async quickCheck(articleContent: string): Promise<SimpleAuditResult> {
    const auditTime = new Date().toISOString();

    try {
      const { issues, riskLevel } = quickCheckInternal(articleContent);
      const approved = issues.length === 0;
      const summary = approved
        ? '文章内容合规，未发现明显违规问题'
        : `发现 ${issues.length} 个潜在问题，请查看详细审核结果`;

      return { approved, riskLevel, summary, auditTime };
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

// ============================================================================
// MCP 执行器：快速检查（ID=21）— 仅关键词匹配
// ============================================================================

export class WeChatComplianceAuditSimpleExecutor extends BaseMCPCapabilityExecutor {
  readonly capabilityId = 21;
  readonly capabilityName = '微信公众号内容合规审核（快速检查 - 仅关键词匹配）';

  constructor() {
    super();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 基类 BaseMCPCapabilityExecutor 的签名
  protected async execute(params: Record<string, any>): Promise<MCPExecutionResult> {
    const { articleTitle, articleContent } = params;

    console.log(`[WeChatComplianceAuditSimple] 开始快速合规审核（仅关键词匹配）...`);
    console.log(`[WeChatComplianceAuditSimple] 文章标题：${articleTitle}`);
    console.log(`[WeChatComplianceAuditSimple] 文章内容长度：${articleContent?.length || 0} 字符`);

    try {
      const auditTime = new Date().toISOString();

      // 快速模式：仅第1层关键词匹配
      const { issues, suggestions, riskLevel } = quickCheckInternal(articleContent);

      const approved = issues.length === 0;
      const summary = approved
        ? '文章内容合规，未发现明显违规问题'
        : `发现 ${issues.length} 个潜在问题，请查看详细审核结果`;

      const auditResult = {
        approved,
        riskLevel,
        summary,
        suggestions,
        auditTime,
      };

      console.log(`[WeChatComplianceAuditSimple] 审核完成，风险等级：${riskLevel}`);

      const formattedSummary = formatMcpAuditResultToSummary(auditResult);

      return {
        success: true,
        data: {
          ...auditResult,
          formattedSummary,
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

/** MCP 工具调用参数 */
interface McpToolParams {
  articleTitle?: string;
  title?: string;
  articleContent?: string;
  content?: string;
  articles?: Array<{ title?: string; content?: string }>;
  workspaceId?: string;
  auditMode?: string;
}

// ============================================================================
// 注册执行器到工厂
// ============================================================================

MCPCapabilityExecutorFactory.registerExecutor(new WeChatComplianceAuditExecutor());
MCPCapabilityExecutorFactory.registerExecutor(new WeChatComplianceAuditSimpleExecutor());

// ============================================================================
// 微信公众号合规审核 MCP 工具集（供 tool-auto-registrar 使用）
// ============================================================================

export const WechatComplianceAuditor = {
  /**
   * 完整合规审核（三层架构：关键词 + RAG + LLM）
   */
  contentAudit: async (params: McpToolParams) => {
    console.log('[WechatComplianceAuditor] contentAudit 被调用，参数:', params);

    try {
      const articleTitle = params.articleTitle || params.title || '未命名文章';
      let articleContent = params.articleContent || params.content;

      if (!articleContent && params.articles && Array.isArray(params.articles) && params.articles.length > 0) {
        articleContent = params.articles[0].content;
      }

      if (!articleContent) {
        return {
          success: false,
          error: '缺少文章内容参数，请提供 articleContent 或 articles 参数',
          metadata: { timestamp: Date.now() }
        };
      }

      // 直接调用三层审核逻辑（不通过 protected execute 方法）
      const auditTime = new Date().toISOString();
      const allIssues: string[] = [];
      const allSuggestions: string[] = [];
      let maxRiskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
      const auditDetails: AuditDetails = {
        layer1KeywordHit: { issues: [], hitCount: 0 },
        layer2RagRetrieval: { rulesCount: 0, topScores: [] },
        layer3LlmJudge: { called: false, violationCount: 0 },
      };

      // 第1层：关键词硬匹配
      const layer1Result = quickCheckInternal(articleContent);
      auditDetails.layer1KeywordHit = {
        issues: layer1Result.issues,
        hitCount: layer1Result.details.reduce((sum, d) => sum + d.found.length, 0),
      };
      if (layer1Result.issues.length > 0) {
        allIssues.push(...layer1Result.issues);
        allSuggestions.push(...layer1Result.suggestions);
        const riskOrder = ['low', 'medium', 'high', 'critical'] as const;
        if (riskOrder.indexOf(layer1Result.riskLevel) > riskOrder.indexOf(maxRiskLevel)) {
          maxRiskLevel = layer1Result.riskLevel;
        }
      }

      // 第2层：RAG 全量检索
      let retrievedRules: RetrievedRule[] = [];
      try {
        const retriever = createVectorRetriever('wechat_compliance_rules');
        const ragResult = await retrieveRelevantRulesFullArticle(retriever, articleTitle, articleContent);
        retrievedRules = ragResult.rules;
        auditDetails.layer2RagRetrieval = { rulesCount: retrievedRules.length, topScores: ragResult.topScores };
      } catch (error) {
        console.warn('[WechatComplianceAuditor] RAG 检索失败:', error);
      }

      // 第3层：LLM 语义判定
      let llmViolations: LlmViolation[] = [];
      if (retrievedRules.length > 0) {
        try {
          const llmResult = await llmJudgeViolations(articleContent, retrievedRules, params.workspaceId);
          auditDetails.layer3LlmJudge = { called: true, violationCount: 0, latencyMs: llmResult.latencyMs };
          if (llmResult.output) {
            llmViolations = llmResult.output.violations.filter(v => v.violated);
            auditDetails.layer3LlmJudge.violationCount = llmViolations.length;
            for (const v of llmViolations) {
              allIssues.push(`[LLM判定-${v.category}] ${v.evidence}`);
              allSuggestions.push(v.suggestion);
            }
            const riskOrder = ['low', 'medium', 'high', 'critical'] as const;
            if (riskOrder.indexOf(llmResult.output.overallRiskLevel) > riskOrder.indexOf(maxRiskLevel)) {
              maxRiskLevel = llmResult.output.overallRiskLevel;
            }
          }
        } catch (error) {
          console.error('[WechatComplianceAuditor] LLM 判定失败:', error);
        }
      }

      const approved = allIssues.length === 0;
      const auditResult = {
        approved,
        riskLevel: maxRiskLevel,
        issues: allIssues,
        suggestions: allSuggestions,
        referencedRules: retrievedRules.map(r => r.text),
        llmViolations,
        auditDetails,
        auditTime,
      };

      const formattedSummary = formatMcpAuditResultToSummary(auditResult);

      return {
        success: true,
        data: { ...auditResult, formattedSummary },
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
   * 快速合规检查（仅关键词匹配）
   */
  contentAuditSimple: async (params: McpToolParams) => {
    console.log('[WechatComplianceAuditor] contentAuditSimple 被调用，参数:', params);

    try {
      let articleContent = params.articleContent || params.content;

      if (!articleContent && params.articles && Array.isArray(params.articles) && params.articles.length > 0) {
        articleContent = params.articles[0].content;
      }

      if (!articleContent) {
        return {
          success: false,
          error: '缺少文章内容参数，请提供 articleContent 或 articles 参数',
          metadata: { timestamp: Date.now() }
        };
      }

      // 直接调用第1层关键词匹配（不通过 protected execute 方法）
      const auditTime = new Date().toISOString();
      const { issues, suggestions, riskLevel } = quickCheckInternal(articleContent);
      const approved = issues.length === 0;
      const summary = approved
        ? '文章内容合规，未发现明显违规问题'
        : `发现 ${issues.length} 个潜在问题，请查看详细审核结果`;

      const auditResult = { approved, riskLevel, summary, suggestions, auditTime };
      const formattedSummary = formatMcpAuditResultToSummary(auditResult);

      return {
        success: true,
        data: { ...auditResult, formattedSummary },
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

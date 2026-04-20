/**
 * 信息速记 LLM 自动填充服务
 * 
 * 用户只需输入原始内容，LLM 自动完成：
 * 1. 分类判定（5类优先级）
 * 2. 标题生成
 * 3. 来源识别
 * 4. 摘要生成（15-30字）
 * 5. 关键词提取（3-6个）
 * 6. 适用场景识别
 * 7. 保险类合规三维校验
 * 8. 素材ID生成
 */

import { LLMClient, Config } from 'coze-coding-dev-sdk';
import type { SnippetCategory, MaterialStatus } from '@/lib/db/schema/info-snippets';

/**
 * LLM 自动填充结果
 */
export interface SnippetEnrichmentResult {
  category: SnippetCategory;
  title: string;
  sourceOrg: string;
  publishDate: string;
  url: string;
  summary: string;
  keywords: string;
  applicableScenes: string;
  complianceWarnings: ComplianceWarnings | null;
  complianceLevel: 'A' | 'B' | 'C' | null;
  materialId: string;
  materialStatus: MaterialStatus;
}

/**
 * 合规预警结构
 */
export interface ComplianceWarnings {
  source?: { status: 'pass' | 'warning'; detail: string };
  content?: { status: 'pass' | 'warning' | 'violation'; detail: string; violations?: string[] };
  timeliness?: { status: 'pass' | 'expired'; detail: string };
}

/**
 * 系统提示词
 */
const SYSTEM_PROMPT = `你是信息速记智能分类助手。用户会输入一段原始信息，你需要完成以下任务：

# 分类精准判定标准（按优先级从高到低）

1. **real_case（身边真实案例）** — 最高优先级
   仅当内容明确包含用户亲身接触的、非全网公开的、第一视角的真实案例时归入此类。
   包括：线下客户咨询、投保理赔经历、亲友真实故事、粉丝私信真实痛点、本地用户真实场景。
   禁止：全网公开通用案例归入此类。

2. **insurance（保险）**
   保险、金融理财、银行利率、监管政策、合规规则、官方机构网址、保险产品条款、行业史料、理财规划、金融科普、行业公开案例、文案素材。

3. **intelligence（智能化）**
   AI、Agent、大模型、RAG、提示词、系统开发、产品设计、自动化、知识库、技术研发相关。

4. **medical（医疗）**
   医保、健康、医学、就医、养生、疾病科普、医疗行业相关。

5. **quick_note（简要内容速记）**
   无法匹配以上四类的零散备忘、临时杂记、碎片灵感。

# 输出要求（严格JSON格式）

输出一个JSON对象，包含以下字段：
- category: 分类代码（real_case/insurance/intelligence/medical/quick_note）
- title: 15-30字的摘要性标题
- sourceOrg: 来源机构（无法识别则填"未知"）
- publishDate: 发布时间（从内容推断，无法识别则填空字符串）
- url: 原文链接（内容中包含则提取，否则填空字符串）
- summary: 15-30字核心内容摘要
- keywords: 3-6个核心关键词，逗号分隔
- applicableScenes: 适用场景标签，逗号分隔（如：保险科普,产品测评,理赔案例）

# 保险类特殊处理（仅 category=insurance 时）

额外输出合规校验结果：
- complianceLevel: A(合规) / B(预警) / C(违规)
- complianceWarnings: 合规三维校验结果
  - source: 来源校验 {status: "pass"/"warning", detail: "说明"}
    - 白名单来源（银保监会/央行/保险行业协会/官方保险公司官网/权威媒体）→ pass
    - 非白名单 → warning
  - content: 内容校验 {status: "pass"/"warning"/"violation", detail: "说明", violations: ["违规话术1","违规话术2"]}
    - 检测是否包含监管禁止话术：保本高收益、刚性兑付、秒杀存款、零风险、稳赚不赔等
    - 无违规 → pass，疑似违规 → warning，明确违规 → violation
  - timeliness: 时效性校验 {status: "pass"/"expired", detail: "说明"}
    - 检测是否包含过期政策、停售产品、过时数据
    - 当前有效 → pass，已过期 → expired

非保险类 complianceLevel 填 null，complianceWarnings 填 null。

# 核心规则
1. 所有内容必须忠于原文，禁止篡改、扩写、编造
2. 分类判定必须100%精准，严格遵守优先级规则
3. 只输出JSON，不输出其他内容
4. 素材ID格式：CAT-YYYYMMDD-NNN（CAT为分类缩写，YYYYMMDD为当天日期，NNN为3位序号，从001开始）`;

/**
 * 使用 LLM 自动填充速记信息
 */
export async function enrichSnippetWithLLM(rawContent: string): Promise<SnippetEnrichmentResult> {
  const config = new Config();
  const client = new LLMClient(config);

  const messages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    { role: 'user' as const, content: rawContent },
  ];

  try {
    const response = await client.invoke(messages, {
      model: 'doubao-seed-2-0-lite-260215',
      temperature: 0.1,
    });

    const result = parseLLMResponse(response.content);
    return result;
  } catch (error) {
    console.error('[enrichSnippetWithLLM] LLM 调用失败，使用兜底逻辑:', error);
    return buildFallbackResult(rawContent);
  }
}

/**
 * 解析 LLM 返回的 JSON
 */
function parseLLMResponse(content: string): SnippetEnrichmentResult {
  // 尝试提取 JSON
  let jsonStr = content.trim();
  
  // 移除 markdown 代码块标记
  jsonStr = jsonStr.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '');
  
  // 尝试找到 JSON 对象
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    jsonStr = jsonMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonStr);
    
    // 生成素材ID
    const now = new Date();
    const dateStr = now.getFullYear().toString() +
      (now.getMonth() + 1).toString().padStart(2, '0') +
      now.getDate().toString().padStart(2, '0');
    const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
    const catPrefix: Record<string, string> = {
      real_case: 'RC',
      insurance: 'INS',
      intelligence: 'AI',
      medical: 'MED',
      quick_note: 'QN',
    };
    const category = validateCategory(parsed.category);
    const materialId = `${catPrefix[category] || 'QN'}-${dateStr}-${seq}`;

    return {
      category,
      title: String(parsed.title || '').slice(0, 50),
      sourceOrg: String(parsed.sourceOrg || '未知'),
      publishDate: String(parsed.publishDate || ''),
      url: String(parsed.url || ''),
      summary: String(parsed.summary || '').slice(0, 60),
      keywords: String(parsed.keywords || ''),
      applicableScenes: String(parsed.applicableScenes || ''),
      complianceWarnings: parsed.complianceWarnings || null,
      complianceLevel: parsed.complianceLevel || null,
      materialId,
      materialStatus: determineMaterialStatus(category, parsed.complianceLevel),
    };
  } catch (e) {
    console.error('[parseLLMResponse] JSON 解析失败:', e);
    return buildFallbackResult(content);
  }
}

/**
 * 校验分类值
 */
function validateCategory(val: unknown): SnippetCategory {
  const valid: SnippetCategory[] = ['real_case', 'insurance', 'intelligence', 'medical', 'quick_note'];
  if (typeof val === 'string' && valid.includes(val as SnippetCategory)) {
    return val as SnippetCategory;
  }
  return 'quick_note';
}

/**
 * 根据分类和合规等级确定素材状态
 */
function determineMaterialStatus(category: SnippetCategory, complianceLevel: string | null): MaterialStatus {
  if (category === 'insurance') {
    if (complianceLevel === 'C') return 'disabled';
    if (complianceLevel === 'B') return 'draft';
    return 'archived';
  }
  return 'archived';
}

/**
 * 兜底结果（LLM 调用失败时使用）
 */
function buildFallbackResult(rawContent: string): SnippetEnrichmentResult {
  const now = new Date();
  const dateStr = now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');

  return {
    category: 'quick_note',
    title: rawContent.slice(0, 30) + (rawContent.length > 30 ? '...' : ''),
    sourceOrg: '未知',
    publishDate: '',
    url: '',
    summary: rawContent.slice(0, 30) + (rawContent.length > 30 ? '...' : ''),
    keywords: '',
    applicableScenes: '',
    complianceWarnings: null,
    complianceLevel: null,
    materialId: `QN-${dateStr}-${seq}`,
    materialStatus: 'draft',
  };
}

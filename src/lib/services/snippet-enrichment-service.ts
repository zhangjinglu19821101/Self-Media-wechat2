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
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { SnippetCategory, MaterialStatus } from '@/lib/db/schema/info-snippets';

/**
 * LLM 自动填充结果
 */
export interface SnippetEnrichmentResult {
  category: SnippetCategory;
  secondaryCategories: string[];  // 副分类数组（跨领域多标签）
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
 * 提示词缓存
 */
let cachedPrompt: string | null = null;

/**
 * 加载提示词文件
 */
function loadPrompt(): string {
  if (cachedPrompt) {
    return cachedPrompt;
  }
  
  const promptPath = join(process.cwd(), 'src', 'lib', 'agents', 'prompts', 'snippet-enrichment.md');
  
  if (!existsSync(promptPath)) {
    throw new Error('提示词文件不存在: ' + promptPath);
  }
  
  cachedPrompt = readFileSync(promptPath, 'utf-8');
  console.log(`✅ [snippet-enrichment] 加载提示词文件，长度: ${cachedPrompt!.length} 字符`);
  
  return cachedPrompt!;
}

/**
 * 使用 LLM 自动填充速记信息
 */
export async function enrichSnippetWithLLM(rawContent: string): Promise<SnippetEnrichmentResult> {
  const config = new Config();
  const client = new LLMClient(config);

  // 从 .md 文件加载提示词
  const systemPrompt = loadPrompt();

  const messages = [
    { role: 'system' as const, content: systemPrompt },
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

    // 解析副分类数组
    const secondaryCategories = validateSecondaryCategories(parsed.secondaryCategories, category);

    return {
      category,
      secondaryCategories,
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
 * 校验副分类数组
 */
function validateSecondaryCategories(val: unknown, mainCategory: SnippetCategory): string[] {
  const valid: SnippetCategory[] = ['real_case', 'insurance', 'intelligence', 'medical', 'quick_note'];
  
  if (!Array.isArray(val)) {
    return [];
  }
  
  // 过滤有效分类，且不与主分类重复
  return val.filter((item): item is SnippetCategory => 
    typeof item === 'string' && 
    valid.includes(item as SnippetCategory) && 
    item !== mainCategory
  );
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
    secondaryCategories: [],
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

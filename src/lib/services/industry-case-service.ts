/**
 * 行业案例库服务
 * 
 * 功能：
 * 1. 解析 MD 案例文件，提取结构化数据
 * 2. 按险种/人群/场景检索案例
 * 3. 记录案例使用情况
 */

import { db } from '@/lib/db';
import { industryCaseLibrary, caseUsageLog } from '@/lib/db/schema';
import { eq, and, or, desc, inArray, sql } from 'drizzle-orm';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// ============================================================================
// 类型定义
// ============================================================================

export interface CaseSearchParams {
  industry?: string;           // 行业类型
  caseType?: string;           // 案例类型
  productTags?: string[];      // 产品标签（险种）
  crowdTags?: string[];        // 人群标签
  sceneTags?: string[];        // 场景标签
  emotionTags?: string[];      // 情绪标签
  keywords?: string;           // 关键词搜索
  limit?: number;
  offset?: number;
}

export interface CaseMatchResult {
  id: string;
  title: string;
  protagonist: string;
  background: string;
  insuranceAction: string;
  result: string;
  applicableProducts: string[];
  applicableScenarios: string[];
  productTags: string[];
  crowdTags: string[];
  sceneTags: string[];
  emotionTags: string[];
  relevanceScore: number;      // 相关度分数
}

// ============================================================================
// 案例解析器
// ============================================================================

/**
 * 解析 MD 案例文件，提取结构化数据
 * 
 * @param filePath MD 文件路径
 * @returns 解析后的案例数组
 */
export function parseInsuranceCaseFile(filePath: string): any[] {
  if (!existsSync(filePath)) {
    console.error(`[CaseParser] 文件不存在: ${filePath}`);
    return [];
  }

  const content = readFileSync(filePath, 'utf-8');
  
  // 预处理：移除 Markdown 转义字符（\> \. \- \[ \] \( \) 等）
  const processedContent = content
    .replace(/\\&gt;/g, '>')
    .replace(/\\&amp;/g, '&')
    .replace(/\\\./g, '.')
    .replace(/\\-/g, '-')
    .replace(/\\\[/g, '[')
    .replace(/\\\]/g, ']')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\+/g, '+');
  
  const cases: any[] = [];

  // 按险种分类拆分（格式：# 1. 个人意外险（普惠型））
  const sections = processedContent.split(/^# \d+\.\s+/m).filter(Boolean);
  
  console.log(`[CaseParser] 拆分出 ${sections.length} 个分类`);
  
  for (const section of sections) {
    // 提取险种名称（第一个行的内容）
    const firstLine = section.split('\n')[0];
    // 匹配 "个人意外险（普惠型）" 或 "个人意外险(普惠型)" 格式
    const categoryMatch = firstLine.match(/^(.+?)[（(](.+?)[）)]/);
    
    if (!categoryMatch) {
      console.log(`[CaseParser] 无法匹配分类: ${firstLine.substring(0, 50)}...`);
      continue;
    }
    
    const categoryName = categoryMatch[1].trim();
    const categoryDesc = categoryMatch[2].trim();
    console.log(`[CaseParser] 解析分类: ${categoryName}（${categoryDesc}）`);
    
    // 提取该分类下的适配关键词
    const keywordMatch = section.match(/适配AI检索关键词[：:]\s*(.+?)(?:\n|$)/);
    const keywords = keywordMatch ? keywordMatch[1].split(/[,，、]/).map(k => k.trim()) : [];
    
    // 拆分案例（格式：## 案例001｜标题 或 ## 案例001|标题）
    const caseBlocks = section.split(/## 案例\d+[｜|]/).filter(Boolean);
    
    console.log(`[CaseParser] 分类 ${categoryName} 下有 ${caseBlocks.length} 个案例块`);
    
    for (const caseBlock of caseBlocks) {
      const caseData = parseCaseBlock(caseBlock, categoryName, keywords);
      if (caseData) {
        cases.push(caseData);
      }
    }
  }

  console.log(`[CaseParser] 从 ${filePath} 解析出 ${cases.length} 个案例`);
  return cases;
}

/**
 * 解析单个案例块
 */
function parseCaseBlock(caseBlock: string, categoryName: string, categoryKeywords: string[]): any | null {
  try {
    // 提取案例标题（第一行）
    const titleMatch = caseBlock.match(/^(.+?)(?:\n|$)/);
    const title = titleMatch ? titleMatch[1].trim() : '';
    
    if (!title) return null;
    
    // 提取各字段（格式：- **字段名**：值 或 - **字段名**: 值）
    const extractField = (fieldName: string): string => {
      // 匹配 "- **字段名**：" 或 "- **字段名**:" 后面的内容
      // 内容可能跨多行，直到遇到下一个 "- **" 或文件结束
      const regex = new RegExp(`-\\s*\\*\\*${fieldName}\\*\\*[：:]\\s*([\\s\\S]*?)(?=\\n-\\s*\\*\\*|$)`, 'm');
      const match = caseBlock.match(regex);
      if (match) {
        // 清理提取的内容：移除开头的换行和多余空格
        return match[1].trim();
      }
      return '';
    };
    
    const applicableProducts = extractField('适用险种');
    const protagonist = extractField('人物') || extractField('主体');
    const background = extractField('核心背景');
    const insuranceAction = extractField('保险动作');
    const result = extractField('结果详情') || extractField('事件经过');
    const applicableScenarios = extractField('适用场景') || extractField('本地适配场景');
    const complianceNote = extractField('合规备注');
    
    // 提取警示要点（反面案例）
    const warningPoints = extractField('警示要点');
    
    console.log(`[CaseParser] 解析案例: ${title.substring(0, 30)}...`);
    console.log(`[CaseParser]   - 适用险种: ${applicableProducts.substring(0, 30)}...`);
    console.log(`[CaseParser]   - 核心背景: ${background.substring(0, 30)}...`);
    
    // 判断案例类型
    let caseType: 'positive' | 'warning' | 'milestone' = 'positive';
    if (title.includes('反面') || title.includes('警示') || title.includes('无保障') || caseBlock.includes('反面警示')) {
      caseType = 'warning';
    } else if (title.includes('里程碑') || caseBlock.includes('里程碑')) {
      caseType = 'milestone';
    }
    
    // 生成标签
    const productTags = extractTags(applicableProducts, categoryKeywords);
    const crowdTags = extractCrowdTags(protagonist + ' ' + background);
    const sceneTags = extractTags(applicableScenarios, []);
    const emotionTags = extractEmotionTags(title + ' ' + background + ' ' + result);
    
    // 生成案例ID
    const caseId = `insurance-${categoryName}-${title.substring(0, 20).replace(/\s+/g, '-')}`;
    
    return {
      industry: 'insurance',
      caseType,
      caseId,
      title,
      applicableProducts: productTags,
      protagonist,
      background,
      insuranceAction,
      result,
      applicableScenarios: sceneTags,
      productTags,
      crowdTags,
      sceneTags,
      emotionTags,
      sourceDesc: extractSource(complianceNote),
      complianceNote,
    };
  } catch (error) {
    console.error('[CaseParser] 解析案例块失败:', error);
    return null;
  }
}

/**
 * 从文本中提取标签
 * 
 * 匹配策略：按关键词长度降序匹配，长词优先（避免"寿险"先于"增额终身寿险"匹配）
 * 同义词扩展：匹配到长词时，自动关联短词（如"增额终身寿险" → 同时匹配"寿险"）
 */
function extractTags(text: string, additionalKeywords: string[]): string[] {
  const tags: string[] = [];
  
  // 保险产品关键词（包含同义词映射）
  const productKeywords = [
    // 意外险类
    '意外险', '意外伤害险', '意外医疗',
    // 健康险类
    '重疾险', '重大疾病险', '大病险', '医疗险', '百万医疗险', '住院医疗', '门诊医疗',
    // 寿险类（包含同义词）
    '寿险', '终身寿险', '定期寿险', '增额寿', '增额终身寿险', '定额寿险', '年金险', '年金', '养老年金', '教育金',
    // 财产险类
    '财产险', '企业财产险', '家庭财产险', '家财险',
    // 责任险类
    '雇主责任险', '公众责任险', '职业责任险',
    // 其他
    '车险', '农业保险', '碳保险', '宠物保险', '定制保险', '旅行险', '航意险'
  ];
  
  // 同义词映射：长词 → 关联的短词标签（用于扩大匹配范围）
  const synonymMap: Record<string, string[]> = {
    '增额终身寿险': ['寿险', '终身寿险', '增额寿'],
    '终身寿险': ['寿险'],
    '定期寿险': ['寿险'],
    '增额寿': ['寿险'],
    '定额寿险': ['寿险'],
    '养老年金': ['年金险', '年金'],
    '教育金': ['年金险'],
    '百万医疗险': ['医疗险'],
    '意外伤害险': ['意外险'],
    '意外医疗': ['意外险', '医疗险'],
    '住院医疗': ['医疗险'],
    '门诊医疗': ['医疗险'],
    '重大疾病险': ['重疾险'],
    '大病险': ['重疾险'],
    '企业财产险': ['财产险'],
    '家庭财产险': ['财产险'],
    '家财险': ['财产险'],
    '雇主责任险': ['财产险'],
  };
  
  // 合并关键词，按长度降序排列（长词优先匹配）
  const allKeywords = [...productKeywords, ...additionalKeywords]
    .sort((a, b) => b.length - a.length);
  
  for (const keyword of allKeywords) {
    if (text.includes(keyword) && !tags.includes(keyword)) {
      tags.push(keyword);
      // 同义词扩展：匹配到长词时，同时添加关联的短词标签
      const synonyms = synonymMap[keyword];
      if (synonyms) {
        for (const syn of synonyms) {
          if (!tags.includes(syn)) {
            tags.push(syn);
          }
        }
      }
    }
  }
  
  return tags;
}

/**
 * 从文本中提取人群标签
 */
function extractCrowdTags(text: string): string[] {
  const crowdKeywords = [
    '上班族', '学生', '老年人', '儿童', '中年', '年轻群体', '高收入',
    '工薪阶层', '企业主', '小微企业', '高净值', '退休', '家庭经济支柱',
    '户外爱好者', '网红', '主播', '明星'
  ];
  
  const tags: string[] = [];
  for (const keyword of crowdKeywords) {
    if (text.includes(keyword) && !tags.includes(keyword)) {
      tags.push(keyword);
    }
  }
  return tags;
}

/**
 * 中文文本分词：先用关键词表正向最大匹配分词，再按空格拆分
 * 
 * 例如 "增额终身寿险产品测评" → ["增额终身寿险", "产品", "测评"]
 * 例如 "重疾险 医疗险" → ["重疾险", "医疗险"]
 */
function tokenizeChineseText(text: string): string[] {
  const tokens: string[] = [];
  
  // 所有已知关键词（按长度降序，长词优先匹配）
  const allKnownKeywords = [
    // 产品关键词
    '意外险', '意外伤害险', '意外医疗',
    '重疾险', '重大疾病险', '大病险', '医疗险', '百万医疗险', '住院医疗', '门诊医疗',
    '寿险', '终身寿险', '定期寿险', '增额寿', '增额终身寿险', '定额寿险',
    '年金险', '年金', '养老年金', '教育金',
    '财产险', '企业财产险', '家庭财产险', '家财险',
    '雇主责任险', '公众责任险', '职业责任险',
    '车险', '农业保险', '碳保险', '宠物保险', '定制保险', '旅行险', '航意险',
    // 人群关键词
    '上班族', '学生', '老年人', '儿童', '中年', '年轻群体', '高收入',
    '工薪阶层', '企业主', '小微企业', '高净值', '退休', '家庭经济支柱',
    '户外爱好者', '网红', '主播', '明星',
    // 通用关键词
    '保险', '理赔', '投保', '保费', '保额', '免赔', '续保',
    '产品', '测评', '对比', '推荐', '避坑', '踩坑', '攻略',
  ].sort((a, b) => b.length - a.length);
  
  // 先按空格/标点拆分，再对每个片段做正向最大匹配
  const segments = text.split(/[\s,，、|｜：:；;。！!？?]+/);
  
  for (const segment of segments) {
    if (!segment) continue;
    
    let remaining = segment;
    while (remaining.length > 0) {
      let matched = false;
      // 尝试从已知关键词中匹配（长词优先）
      for (const keyword of allKnownKeywords) {
        if (remaining.startsWith(keyword)) {
          tokens.push(keyword);
          remaining = remaining.slice(keyword.length);
          matched = true;
          break;
        }
      }
      if (!matched) {
        // 无匹配：跳过一个字符
        // 但把单个有意义的中文字也作为 token（如"好"、"贵"等）
        remaining = remaining.slice(1);
      }
    }
  }
  
  return tokens.filter(t => t.length > 0);
}

/**
 * 从文本中提取情绪标签
 */
function extractEmotionTags(text: string): string[] {
  const emotionKeywords: Record<string, string[]> = {
    '踩坑': ['踩坑', '陷阱', '被坑', '被骗'],
    '避坑': ['避坑', '避开', '注意', '警惕'],
    '省钱': ['省钱', '便宜', '低预算', '性价比'],
    '安心': ['安心', '放心', '保障', '理赔成功'],
    '警示': ['警示', '反面', '破产', '返贫', '困境'],
    '温情': ['温情', '家庭', '帮助', '支持'],
  };
  
  const tags: string[] = [];
  for (const [tag, keywords] of Object.entries(emotionKeywords)) {
    if (keywords.some(kw => text.includes(kw)) && !tags.includes(tag)) {
      tags.push(tag);
    }
  }
  return tags;
}

/**
 * 从合规备注中提取来源
 */
function extractSource(complianceNote: string): string {
  const sourceMatch = complianceNote.match(/出处[：:]\s*(.+?)(?=，|。|$)/);
  return sourceMatch ? sourceMatch[1].trim() : '';
}

// ============================================================================
// 案例检索服务
// ============================================================================

/**
 * 检索匹配的案例
 * 
 * @param params 搜索参数
 * @returns 匹配的案例列表
 */
export async function searchCases(params: CaseSearchParams): Promise<CaseMatchResult[]> {
  const { industry, caseType, productTags, crowdTags, sceneTags, keywords, limit = 5, offset = 0 } = params;
  
  // 构建查询条件
  const conditions: any[] = [];
  
  if (industry) {
    conditions.push(eq(industryCaseLibrary.industry, industry));
  }
  
  if (caseType) {
    conditions.push(eq(industryCaseLibrary.caseType, caseType));
  }
  
  // 执行查询（获取更多结果用于相关度计算）
  let query = db.select().from(industryCaseLibrary);
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  // 获取更多结果用于相关度排序
  const allCases = await query
    .orderBy(desc(industryCaseLibrary.useCount))
    .limit(100); // 获取最多100条用于相关度计算
  
  // 分桶收集：精确匹配 vs 无关案例（兜底候选）
  const matchedResults: CaseMatchResult[] = [];
  const fallbackResults: CaseMatchResult[] = [];
  
  for (const caseItem of allCases) {
    let relevanceScore = 0;
    
    // 产品标签匹配
    if (productTags && productTags.length > 0) {
      const matchedProducts = productTags.filter(tag => 
        (caseItem.productTags as string[]).includes(tag)
      );
      relevanceScore += matchedProducts.length * 3;
    }
    
    // 人群标签匹配
    if (crowdTags && crowdTags.length > 0) {
      const matchedCrowds = crowdTags.filter(tag => 
        (caseItem.crowdTags as string[]).includes(tag)
      );
      relevanceScore += matchedCrowds.length * 2;
    }
    
    // 场景标签匹配
    if (sceneTags && sceneTags.length > 0) {
      const matchedScenes = sceneTags.filter(tag => 
        (caseItem.sceneTags as string[]).includes(tag)
      );
      relevanceScore += matchedScenes.length * 2;
    }
    
    // 关键词搜索（在标题、背景、结果、产品标签中搜索）
    if (keywords) {
      const searchText = `${caseItem.title} ${caseItem.background} ${caseItem.result}`.toLowerCase();
      const productTagsText = (caseItem.productTags as string[]).join(' ').toLowerCase();
      
      // 中文分词策略：先用关键词表正向最大匹配分词，再按空格拆分
      const keywordList = tokenizeChineseText(keywords.toLowerCase());
      
      for (const keyword of keywordList) {
        if (!keyword) continue;
        // 在文本内容中搜索
        if (searchText.includes(keyword)) {
          relevanceScore += 1;
        }
        // 在产品标签中搜索（权重更高）
        if (productTagsText.includes(keyword)) {
          relevanceScore += 2;
        }
      }
    }
    
    const caseResult: CaseMatchResult = {
      id: caseItem.id,
      title: caseItem.title,
      protagonist: caseItem.protagonist || '',
      background: caseItem.background,
      insuranceAction: caseItem.insuranceAction || '',
      result: caseItem.result,
      applicableProducts: caseItem.applicableProducts as string[],
      applicableScenarios: caseItem.applicableScenarios as string[],
      productTags: caseItem.productTags as string[],
      crowdTags: caseItem.crowdTags as string[],
      sceneTags: caseItem.sceneTags as string[],
      emotionTags: caseItem.emotionTags as string[],
      relevanceScore,
    };
    
    // 有相关度 → 精确匹配桶；无相关度 → 兜底候选桶
    if (relevanceScore > 0) {
      matchedResults.push(caseResult);
    } else {
      fallbackResults.push(caseResult);
    }
  }
  
  // 精确匹配按相关度降序
  matchedResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  // 兜底策略：仅在有关键词/标签搜索条件时才用热门案例补充
  // 如果用户没有提供任何搜索条件，允许返回热门案例
  const hasSearchConditions = !!(keywords || (productTags && productTags.length > 0) || (crowdTags && crowdTags.length > 0) || (sceneTags && sceneTags.length > 0));
  
  let finalResults: CaseMatchResult[];
  if (hasSearchConditions && matchedResults.length > 0) {
    // 有搜索条件且有匹配结果 → 匹配结果优先，不足时用热门补充
    finalResults = [
      ...matchedResults,
      ...fallbackResults.slice(0, Math.max(limit - matchedResults.length, 0)),
    ];
  } else if (hasSearchConditions && matchedResults.length === 0) {
    // 有搜索条件但无匹配结果 → 不返回不相关的热门案例，保持空列表
    // 前端会显示"暂无匹配案例"的友好提示
    finalResults = [];
  } else {
    // 无搜索条件 → 返回热门案例（浏览模式）
    finalResults = [
      ...matchedResults,
      ...fallbackResults.slice(0, Math.max(limit - matchedResults.length, 0)),
    ];
  }
  
  // 应用分页
  return finalResults.slice(offset, offset + limit);
}

/**
 * 根据 ID 列表批量获取案例
 * 
 * 用于执行引擎获取用户手动选择的案例，直接按 ID 查询，不走 searchCases 的相关度排序逻辑。
 * 
 * @param caseIds 案例 ID 数组
 * @returns 匹配的案例列表
 */
export async function getCasesByIds(caseIds: string[]): Promise<CaseMatchResult[]> {
  if (caseIds.length === 0) return [];
  
  const cases = await db
    .select()
    .from(industryCaseLibrary)
    .where(inArray(industryCaseLibrary.id, caseIds));
  
  return cases.map(c => ({
    id: c.id,
    title: c.title,
    protagonist: c.protagonist || '',
    background: c.background,
    insuranceAction: c.insuranceAction || '',
    result: c.result,
    applicableProducts: c.applicableProducts as string[],
    applicableScenarios: c.applicableScenarios as string[],
    productTags: c.productTags as string[],
    crowdTags: c.crowdTags as string[],
    sceneTags: c.sceneTags as string[],
    emotionTags: c.emotionTags as string[],
    relevanceScore: 100, // 用户手动选择的案例，设为最高相关度
  }));
}

/**
 * 根据指令推荐案例
 * 
 * @param instruction 用户指令
 * @param platform 发布平台
 * @returns 推荐的案例列表
 */
export async function recommendCases(instruction: string, platform?: string, limit = 5): Promise<CaseMatchResult[]> {
  // 从指令中提取关键词
  const productTags = extractTags(instruction, []);
  const crowdTags = extractCrowdTags(instruction);
  const sceneTags = extractTags(instruction, []);
  
  // 根据平台调整权重
  const searchParams: CaseSearchParams = {
    industry: 'insurance',
    productTags,
    crowdTags,
    sceneTags,
    keywords: instruction,
    limit,
  };
  
  return searchCases(searchParams);
}

/**
 * 格式化案例为提示词文本
 * 
 * @param cases 案例列表
 * @param mode 'manual' = 用户手动选择（必须使用），'auto' = 自动推荐（参考使用）
 * @returns 格式化后的文本
 */
export function formatCasesForPrompt(cases: CaseMatchResult[], mode: 'manual' | 'auto' = 'auto'): string {
  if (cases.length === 0) {
    return '';
  }
  
  const isManual = mode === 'manual';
  const lines: string[] = [
    isManual
      ? '## 指定案例（用户选定，必须在文章中引用）'
      : '## 推荐案例（可用于增强文章说服力）',
    '',
    isManual
      ? '以下是用户明确指定要引用的真实案例，你必须在文章中合理引用这些案例：'
      : '以下是与你写作主题相关的真实案例，你可以选择性地在文章中引用：',
    '',
  ];
  
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    lines.push(`### 案例${i + 1}：${c.title}`);
    lines.push(`- **人物/主体**：${c.protagonist}`);
    lines.push(`- **背景**：${c.background}`);
    lines.push(`- **保险方案**：${c.insuranceAction}`);
    lines.push(`- **结果**：${c.result}`);
    lines.push(`- **适用场景**：${c.applicableScenarios.join('、')}`);
    lines.push('');
  }
  
  if (isManual) {
    lines.push('**使用要求**：');
    lines.push('1. 必须在文章中引用上述案例，至少引用 1 个');
    lines.push('2. 引用案例时要标注来源（如"据《XX报》报道"）');
    lines.push('3. 可以适当简化案例描述，但保留核心数据和结论');
  } else {
    lines.push('**使用建议**：');
    lines.push('1. 选择与文章主题最相关的案例');
    lines.push('2. 可以适当简化案例描述，保留核心数据');
    lines.push('3. 引用案例时要标注来源（如"据《XX报》报道"）');
  }
  lines.push('');
  
  return lines.join('\n');
}

/**
 * 批量导入案例
 * 
 * @param cases 案例数据数组
 * @param workspaceId 工作空间ID
 * @returns 导入结果
 */
export async function importCases(cases: any[], workspaceId?: string): Promise<{ success: number; failed: number; skipped: number }> {
  let success = 0;
  let failed = 0;
  let skipped = 0;
  
  for (const caseData of cases) {
    try {
      // 去重检查：按 caseId + industry 判断是否已存在
      const existing = await db
        .select({ id: industryCaseLibrary.id })
        .from(industryCaseLibrary)
        .where(
          and(
            eq(industryCaseLibrary.caseId, caseData.caseId),
            eq(industryCaseLibrary.industry, caseData.industry)
          )
        )
        .limit(1);
      
      if (existing.length > 0) {
        skipped++;
        continue;
      }
      
      await db.insert(industryCaseLibrary).values({
        ...caseData,
        workspaceId,
        status: 'active',
      });
      success++;
    } catch (error) {
      console.error(`[CaseImport] 导入案例失败: ${caseData.caseId}`, error);
      failed++;
    }
  }
  
  console.log(`[CaseImport] 导入完成: 成功 ${success}, 跳过(已存在) ${skipped}, 失败 ${failed}`);
  return { success, failed, skipped };
}

/**
 * 获取案例统计
 */
export async function getCaseStats(industry?: string): Promise<{
  total: number;
  byType: Record<string, number>;
  byProduct: Record<string, number>;
}> {
  const whereClause = industry 
    ? eq(industryCaseLibrary.industry, industry)
    : undefined;
  
  const cases = whereClause
    ? await db.select().from(industryCaseLibrary).where(whereClause)
    : await db.select().from(industryCaseLibrary);
  
  const stats = {
    total: cases.length,
    byType: {} as Record<string, number>,
    byProduct: {} as Record<string, number>,
  };
  
  for (const c of cases) {
    // 按类型统计
    stats.byType[c.caseType] = (stats.byType[c.caseType] || 0) + 1;
    
    // 按产品统计
    for (const tag of (c.productTags as string[])) {
      stats.byProduct[tag] = (stats.byProduct[tag] || 0) + 1;
    }
  }
  
  return stats;
}

// 导出单例
export const industryCaseService = {
  parseInsuranceCaseFile,
  searchCases,
  recommendCases,
  formatCasesForPrompt,
  importCases,
  getCaseStats,
  getCasesByIds,
};

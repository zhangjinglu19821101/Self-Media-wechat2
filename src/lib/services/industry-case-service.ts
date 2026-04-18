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
 */
function extractTags(text: string, additionalKeywords: string[]): string[] {
  const tags: string[] = [];
  
  // 保险产品关键词
  const productKeywords = [
    '意外险', '重疾险', '医疗险', '百万医疗险', '寿险', '年金险',
    '财产险', '企业财产险', '家庭财产险', '雇主责任险', '车险',
    '农业保险', '碳保险', '宠物保险', '定制保险'
  ];
  
  // 合并关键词
  const allKeywords = [...productKeywords, ...additionalKeywords];
  
  for (const keyword of allKeywords) {
    if (text.includes(keyword) && !tags.includes(keyword)) {
      tags.push(keyword);
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
  
  // 计算相关度分数并过滤
  const results: CaseMatchResult[] = [];
  
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
      const keywordList = keywords.toLowerCase().split(/\s+/);
      
      for (const keyword of keywordList) {
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
    
    // 如果有匹配条件但没有匹配到，跳过
    if ((productTags?.length || crowdTags?.length || sceneTags?.length || keywords) && relevanceScore === 0) {
      continue;
    }
    
    results.push({
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
    });
  }
  
  // 按相关度排序
  results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  // 应用分页
  return results.slice(offset, offset + limit);
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
export async function importCases(cases: any[], workspaceId?: string): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;
  
  for (const caseData of cases) {
    try {
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
  
  console.log(`[CaseImport] 导入完成: 成功 ${success}, 失败 ${failed}`);
  return { success, failed };
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
};

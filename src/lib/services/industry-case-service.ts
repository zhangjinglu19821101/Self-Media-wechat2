/**
 * 行业案例库服务
 * 
 * 功能：
 * 1. 解析 MD 案例文件，提取结构化数据
 * 2. 按险种/人群/场景检索案例
 * 3. 记录案例使用情况
 * 
 * 可见性规则：
 * - workspace_id = 'system' → 系统预置案例，所有用户可见
 * - workspace_id = 其他 → 用户私有案例，仅自己可见
 */

import { db } from '@/lib/db';
import { industryCaseLibrary, caseUsageLog, CASE_SYSTEM_WORKSPACE_ID } from '@/lib/db/schema';
import type { NewIndustryCase, IndustryCase } from '@/lib/db/schema';
import { eq, and, or, desc, inArray, sql, like } from 'drizzle-orm';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getLLMClient } from '@/lib/agent-llm';
import type { Message } from 'coze-coding-dev-sdk';

// ============================================================================
// 类型定义
// ============================================================================

export interface CaseSearchParams {
  workspaceId?: string;         // 工作空间ID（用于可见性过滤）
  industry?: string;            // 行业类型（支持逗号分隔多选，如 'insurance,trust'）
  caseType?: string;            // 案例类型
  productTags?: string[];       // 产品标签（险种）
  crowdTags?: string[];         // 人群标签
  sceneTags?: string[];         // 场景标签
  emotionTags?: string[];       // 情绪标签
  keywords?: string;            // 关键词搜索
  limit?: number;
  offset?: number;
}

export interface CaseMatchResult {
  id: string;
  title: string;
  caseType: string;            // 案例类型：positive/warning/milestone
  eventFullStory: string;      // 事件完整原版经过
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
  productTagMatchCount: number; // 🔥 产品标签匹配数（最高优先级排序依据）
  workspaceId?: string;        // 工作空间ID（区分系统预置 vs 用户私有）
  createdAt?: Date;            // 创建时间（用于排序：最新优先）
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
    // 储蓄险类（储蓄/理财/增值类保险）
    '储蓄险', '少儿储蓄险', '教育储蓄', '理财险', '增额寿', '增额终身寿险', '增额终身寿', '年金险', '年金', '养老年金', '教育金', '教育年金', '少儿年金',
    // 其他
    '车险', '农业保险', '碳保险', '宠物保险', '定制保险', '旅行险', '航意险',
    // 继承/传承类概念（自动映射到增额终身寿险/年金险）
    { text: '遗产继承', tags: ['增额终身寿险', '年金险', '寿险'] },
    { text: '财富传承', tags: ['增额终身寿险', '年金险', '终身寿险'] },
    { text: '资产传承', tags: ['增额终身寿险', '年金险'] },
    { text: '财产继承', tags: ['增额终身寿险', '年金险', '增额寿'] },
    { text: '代际传承', tags: ['增额终身寿险', '年金险', '终身寿险'] },
    { text: '家族传承', tags: ['增额终身寿险', '年金险', '终身寿险'] },
    { text: '遗产税', tags: ['增额终身寿险', '年金险'] },
    { text: '税务筹划', tags: ['增额终身寿险', '年金险', '储蓄险'] },
    { text: '资产保全', tags: ['增额终身寿险', '年金险', '增额寿'] },
    { text: '身后传承', tags: ['增额终身寿险', '终身寿险', '年金险'] },
    { text: '定向传承', tags: ['增额终身寿险', '终身寿险', '年金险'] },
    { text: '传承规划', tags: ['增额终身寿险', '年金险', '增额寿'] },
    { text: '继承纠纷', tags: ['增额终身寿险', '终身寿险', '年金险'] },
    { text: '遗产纠纷', tags: ['增额终身寿险', '终身寿险', '年金险'] },
    { text: '财富传承', tags: ['增额终身寿险', '终身寿险', '年金险'] },
    { text: '资产传承', tags: ['增额终身寿险', '年金险'] },
    { text: '家企隔离', tags: ['增额终身寿险', '终身寿险', '年金险'] },
    { text: '债务隔离', tags: ['增额终身寿险', '终身寿险', '年金险'] },
    { text: '婚姻风险', tags: ['增额终身寿险', '终身寿险'] },
    { text: '婚姻财富', tags: ['增额终身寿险', '终身寿险'] },
    { text: '家企不分', tags: ['增额终身寿险', '企业财产险'] },
  ];
  
  // 同义词映射：长词 → 关联的短词标签（用于扩大匹配范围）
  const synonymMap: Record<string, string[]> = {
    '增额终身寿险': ['寿险', '终身寿险', '增额寿', '储蓄险'],
    '终身寿险': ['寿险'],
    '定期寿险': ['寿险'],
    '增额寿': ['寿险'],
    '定额寿险': ['寿险'],
    '养老年金': ['年金险', '年金', '储蓄险'],
    '教育金': ['年金险', '储蓄险'],
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
    // 储蓄险类同义词
    '储蓄险': ['理财险', '增额寿', '增额终身寿险'],
    '少儿储蓄险': ['储蓄险', '教育金', '教育年金'],
    '教育储蓄': ['储蓄险', '教育金', '年金险'],
    '理财险': ['储蓄险', '增额寿'],
    '增额终身寿': ['寿险', '终身寿险', '增额寿', '储蓄险'],
    '教育年金': ['年金险', '教育金', '储蓄险'],
    // 继承/传承类概念 → 映射到增额终身寿险/年金险
    '遗产继承': ['增额终身寿险', '终身寿险', '年金险', '寿险'],
    '财富传承': ['增额终身寿险', '终身寿险', '年金险', '寿险'],
    '资产传承': ['增额终身寿险', '终身寿险', '增额寿'],
    '财产继承': ['增额终身寿险', '终身寿险', '增额寿'],
    '代际传承': ['增额终身寿险', '终身寿险', '年金险'],
    '家族传承': ['增额终身寿险', '终身寿险', '增额寿', '年金险'],
    '遗产税': ['增额终身寿险', '终身寿险', '年金险'],
    '税务筹划': ['增额终身寿险', '年金险', '储蓄险'],
    '资产保全': ['增额终身寿险', '增额寿', '储蓄险'],
    '身后传承': ['增额终身寿险', '终身寿险', '年金险'],
    '定向传承': ['增额终身寿险', '终身寿险', '年金险'],
    '传承规划': ['增额终身寿险', '年金险', '增额寿'],
    '继承纠纷': ['增额终身寿险', '终身寿险', '年金险'],
    '遗产纠纷': ['增额终身寿险', '终身寿险', '年金险'],
  };
  
  // 合并关键词：字符串关键词按长度降序排列（长词优先匹配）
  const stringKeywords = [...productKeywords.filter(k => typeof k === 'string'), ...additionalKeywords]
    .sort((a, b) => b.length - a.length);
  
  for (const keyword of stringKeywords) {
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
  
  // 处理对象格式的关键词（{text, tags}）
  const objectKeywords = productKeywords.filter(k => typeof k === 'object' && k !== null);
  for (const item of objectKeywords) {
    const keywordItem = item as { text: string; tags: string[] };
    if (text.includes(keywordItem.text)) {
      for (const tag of keywordItem.tags) {
        if (!tags.includes(tag)) {
          tags.push(tag);
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
    '年金险', '年金', '养老年金', '教育金', '教育年金', '少儿年金',
    '储蓄险', '少儿储蓄险', '教育储蓄', '理财险', '增额终身寿',
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
    // 继承/传承概念词（语义映射到产品标签）
    '遗产', '继承', '传承', '财富传承', '资产传承', '家业传承', '代际传承',
    '资产继承', '财富继承', '家产继承', '遗产分割', '遗产纠纷', '继承纠纷',
    '资产保全', '财富保全', '家企隔离', '家企不分', '资产隔离',
    '定向传承', '身后传承', '身前传承', '身前给', '身故后',
    '传承工具', '财富管理', '资产管理', '家企财务',
    '家族信托', '保险信托', '资产信托', '财富信托',
    '税务筹划', '税务规划', '遗产税', '继承税',
    // 知名人物名称（用于案例搜索）
    '宗庆后', '马云', '马化腾', '任正非', '王健林', '李嘉诚',
    '刘强东', '雷军', '董明珠', '张一鸣', '黄峥', '王兴',
    '李彦宏', '丁磊', '周鸿祎', '史玉柱', '郭台铭', '柳传志',
    '何享健', '杨国强', '许家印', '孙宏斌', '姚振华', '王石',
    '潘石屹', '冯仑', '俞敏洪', '张朝阳', '王小川', '李斌',
    '李想', '程维', '王卫', '陈东升', '泰康', '沈南鹏', '张磊',
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
        // 无匹配：将当前字符作为单字 token，并跳过
        // 这样"蛮好人生"会被分词为 ["蛮", "好", "人", "生"]
        const char = remaining[0];
        if (/[一-龥]/.test(char)) {
          tokens.push(char);
        }
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
 * 可见性规则：
 * - 用户私有案例（workspace_id = 用户ID）
 * - 系统预置案例（workspace_id = 'system'）
 * 
 * @param params 搜索参数
 * @returns 匹配的案例列表
 */
export async function searchCases(params: CaseSearchParams): Promise<CaseMatchResult[]> {
  const { workspaceId, industry, caseType, productTags, crowdTags, sceneTags, keywords, limit = 5, offset = 0 } = params;
  
  // 构建查询条件
  const conditions: any[] = [];
  
  // 🔥 可见性过滤：用户私有案例 + 系统预置案例（始终执行，与素材库保持一致）
  conditions.push(
    or(
      eq(industryCaseLibrary.workspaceId, workspaceId || 'default-workspace'),  // 用户私有
      eq(industryCaseLibrary.workspaceId, CASE_SYSTEM_WORKSPACE_ID)             // 系统预置
    )!
  );
  
  if (industry) {
    // 支持逗号分隔的多选 industry（如 'insurance,trust'）
    const industries = industry.split(',').map(s => s.trim()).filter(Boolean);
    // 构建匹配条件：支持数据库中逗号分隔的多选值
    // 例如：数据库存储 'trust,insurance'，搜索 'insurance' 也应该匹配
    const industryConditions = industries.map(ind => 
      or(
        eq(industryCaseLibrary.industry, ind),                    // 精确匹配：industry = 'insurance'
        like(industryCaseLibrary.industry, `${ind},%`),           // 在开头：'insurance,...'
        like(industryCaseLibrary.industry, `%,${ind},%`),         // 在中间：'...,insurance,...'
        like(industryCaseLibrary.industry, `%,${ind}`)            // 在结尾：'...,insurance'
      )
    );
    if (industryConditions.length === 1) {
      conditions.push(industryConditions[0]!);
    } else if (industryConditions.length > 1) {
      conditions.push(or(...industryConditions)!);
    }
  }
  
  if (caseType) {
    conditions.push(eq(industryCaseLibrary.caseType, caseType));
  }
  
  // 执行查询（获取更多结果用于相关度计算）
  let query = db.select().from(industryCaseLibrary);
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  // 🔥 过滤空壳案例：只有标题但没有实际内容（protagonist/background/result 全空）的案例不参与推荐
  const allCasesRaw = await query
    .orderBy(desc(industryCaseLibrary.useCount))
    .limit(100); // 获取最多100条用于相关度计算

  const allCases = allCasesRaw.filter(c =>
    ((c.protagonist && c.protagonist.trim()) ||
    (c.background && c.background.trim()) ||
    (c.result && c.result.trim()) ||
    (c.insuranceAction && c.insuranceAction.trim()))
    // 🔥 过滤"待人工确认"标签的案例，不参与搜索推荐
    && !(c.productTags as string[])?.includes('待人工确认')
  );
  
  // 分桶收集：精确匹配 vs 无关案例（兜底候选）
  const matchedResults: CaseMatchResult[] = [];
  const fallbackResults: CaseMatchResult[] = [];
  
  for (const caseItem of allCases) {
    let relevanceScore = 0;
    let productTagMatchCount = 0;  // 🔥 产品标签匹配数（最高优先级排序依据）
    
    // 产品标签匹配（权重最高）
    if (productTags && productTags.length > 0) {
      const matchedProducts = productTags.filter(tag => 
        (caseItem.productTags as string[]).includes(tag)
      );
      productTagMatchCount = matchedProducts.length;
      relevanceScore += matchedProducts.length * 100;  // 🔥 权重提高到100，确保最高优先级
    }
    
    // 人群标签匹配
    if (crowdTags && crowdTags.length > 0) {
      const matchedCrowds = crowdTags.filter(tag => 
        (caseItem.crowdTags as string[]).includes(tag)
      );
      relevanceScore += matchedCrowds.length * 10;
    }
    
    // 场景标签匹配
    if (sceneTags && sceneTags.length > 0) {
      const matchedScenes = sceneTags.filter(tag => 
        (caseItem.sceneTags as string[]).includes(tag)
      );
      relevanceScore += matchedScenes.length * 10;
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
          relevanceScore += 5;
        }
      }
    }

    // 🔥 标题关键词匹配（额外加分，弥补产品标签匹配不足）
    if (keywords) {
      const titleLower = caseItem.title.toLowerCase();
      const titleKeywordList = tokenizeChineseText(keywords.toLowerCase());
      for (const keyword of titleKeywordList) {
        if (!keyword || keyword.length < 2) continue;  // 忽略单字
        if (titleLower.includes(keyword)) {
          relevanceScore += 50;  // 标题命中关键词，高分
        }
      }
    }

    // 🔥 用户案例额外加分（同一匹配数下，用户案例优先）
    if (caseItem.workspaceId !== 'system') {
      relevanceScore += 200;  // 用户案例加权
    }

    const caseResult: CaseMatchResult = {
      id: caseItem.id,
      title: caseItem.title,
      caseType: caseItem.caseType || 'positive',
      eventFullStory: caseItem.eventFullStory || '',
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
      productTagMatchCount,
      workspaceId: caseItem.workspaceId,
      createdAt: caseItem.createdAt,
    };
    
    // 有相关度 → 精确匹配桶；无相关度 → 兜底候选桶
    if (relevanceScore > 0) {
      matchedResults.push(caseResult);
    } else {
      fallbackResults.push(caseResult);
    }
  }
  
  // 🔥 排序：按综合得分降序（产品标签匹配*100 + 标题匹配*50 + 用户案例+200 + 时间新+50）
  // 所有权重已合并到 relevanceScore 中，直接按总分排序
  matchedResults.sort((a, b) => {
    return b.relevanceScore - a.relevanceScore;
  });
  
  // 兜底策略：仅在有关键词/标签搜索条件时才用热门案例补充
  // 如果用户没有提供任何搜索条件，允许返回热门案例
  const hasSearchConditions = !!(keywords || (productTags && productTags.length > 0) || (crowdTags && crowdTags.length > 0) || (sceneTags && sceneTags.length > 0));
  
  let finalResults: CaseMatchResult[];
  if (hasSearchConditions) {
    // 有搜索条件 → 只返回匹配结果，不用热门案例补充
    // 用户期望精准搜索，返回不相关案例会降低体验
    finalResults = matchedResults;
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
 * 可见性规则：
 * - 用户只能获取自己的私有案例 + 系统预置案例
 * 
 * @param caseIds 案例 ID 数组
 * @param workspaceId 工作空间ID（用于可见性过滤）
 * @returns 匹配的案例列表
 */
export async function getCasesByIds(caseIds: string[], workspaceId?: string): Promise<CaseMatchResult[]> {
  if (caseIds.length === 0) return [];
  
  // 构建查询条件：ID 匹配 + 可见性过滤
  const conditions: any[] = [
    inArray(industryCaseLibrary.id, caseIds)
  ];
  
  // 🔥 可见性过滤：用户私有案例 + 系统预置案例（始终执行）
  conditions.push(
    or(
      eq(industryCaseLibrary.workspaceId, workspaceId || 'default-workspace'),  // 用户私有
      eq(industryCaseLibrary.workspaceId, CASE_SYSTEM_WORKSPACE_ID)             // 系统预置
    )!
  );
  
  const cases = await db
    .select()
    .from(industryCaseLibrary)
    .where(and(...conditions));
  
  return cases.map(c => ({
    id: c.id,
    title: c.title,
    caseType: c.caseType || 'positive',
    eventFullStory: c.eventFullStory || '',
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
    productTagMatchCount: 0,  // 手动选择不涉及产品标签匹配
    workspaceId: c.workspaceId,  // 🔥 传递 workspaceId，区分系统/用户案例
  }));
}

/**
 * 根据指令推荐案例
 * 
 * @param instruction 用户指令
 * @param platform 发布平台
 * @param limit 返回数量
 * @param workspaceId 工作空间ID（用于可见性过滤）
 * @returns 推荐的案例列表
 */
export async function recommendCases(instruction: string, platform?: string, limit = 5, workspaceId?: string, industry = 'insurance'): Promise<CaseMatchResult[]> {
  // 从指令中提取关键词
  const productTags = extractTags(instruction, []);
  const crowdTags = extractCrowdTags(instruction);
  const sceneTags = extractTags(instruction, []);
  
  // 🔥 使用传入的 industry 参数（支持逗号分隔多选，默认 'insurance'）
  // 之前硬编码 industry: 'insurance' 导致 trust 等类型的案例被过滤掉
  // 现在由前端控制 industry 选择，搜索时按 industry 过滤 + product_tags 排序
  const searchParams: CaseSearchParams = {
    workspaceId,  // 🔥 传递 workspaceId
    industry,     // 🔥 使用传入的 industry（默认 insurance，支持多选）
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
// ============================================================================
// LLM 自动标签补全
// ============================================================================

/**
 * 调用 LLM 为案例自动生成标签
 * 当关键词提取不出标签时，使用 LLM 分析案例内容生成精准标签
 */
async function generateTagsWithLLM(caseData: any): Promise<{
  productTags: string[];
  crowdTags: string[];
  emotionTags: string[];
}> {
  const defaultResult = { productTags: [], crowdTags: [], emotionTags: [] };
  
  try {
    const llmClient = getLLMClient();
    
    const caseContent = [
      caseData.title ? `标题：${caseData.title}` : '',
      caseData.applicableProducts ? `适用险种：${caseData.applicableProducts}` : '',
      caseData.protagonist ? `人物：${caseData.protagonist}` : '',
      caseData.background ? `背景：${caseData.background}` : '',
      caseData.insuranceAction ? `保险方案：${caseData.insuranceAction}` : '',
      caseData.result ? `结果：${caseData.result}` : '',
    ].filter(Boolean).join('\n');

    const messages: Message[] = [
      {
        role: 'system',
        content: `你是一个保险行业标签专家。根据案例内容，生成精准的分类标签。

输出格式为 JSON，包含三个字段：
- productTags: 产品/险种标签（如：重疾险、医疗险、意外险、储蓄险、少儿储蓄险、增额终身寿险、年金险、教育金、养老年金、万能险、寿险、企业财产险等）
- crowdTags: 人群标签（如：少儿、中年家庭、高净值人群、企业主、老年人、新婚家庭等）
- emotionTags: 情感标签（如：焦虑、恐惧、安心、温馨、紧迫、后悔、释然等）

要求：
1. 标签要精准，不要泛泛的标签如"保险"
2. 每个类别2-5个标签
3. 只输出 JSON，不要其他文字`,
      },
      {
        role: 'user',
        content: caseContent,
      },
    ];

    const response = await llmClient.invoke(messages, { temperature: 0.3 });
    
    // 解析 LLM 返回的 JSON
    const content = response.content.trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[CaseImport] LLM 标签生成返回非 JSON:', content.substring(0, 100));
      return defaultResult;
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      productTags: Array.isArray(parsed.productTags) ? parsed.productTags : [],
      crowdTags: Array.isArray(parsed.crowdTags) ? parsed.crowdTags : [],
      emotionTags: Array.isArray(parsed.emotionTags) ? parsed.emotionTags : [],
    };
  } catch (error) {
    console.error('[CaseImport] LLM 标签生成失败:', error instanceof Error ? error.message : String(error));
    return defaultResult;
  }
}

export async function importCases(cases: any[], workspaceId?: string): Promise<{
  success: number;
  failed: number;
  skipped: number;
  autoTaggedCases: string[]; // LLM 自动补全标签的案例标题列表
}> {
  let success = 0;
  let failed = 0;
  let skipped = 0;
  const autoTaggedCases: string[] = [];
  
  for (const caseData of cases) {
    try {
      // 去重检查：按 caseId + industry + workspaceId 判断是否已存在
      const dedupConditions: any[] = [
        eq(industryCaseLibrary.caseId, caseData.caseId),
        eq(industryCaseLibrary.industry, caseData.industry),
      ];
      if (workspaceId) {
        dedupConditions.push(eq(industryCaseLibrary.workspaceId, workspaceId));
      }
      
      const existing = await db
        .select({ id: industryCaseLibrary.id })
        .from(industryCaseLibrary)
        .where(and(...dedupConditions))
        .limit(1);
      
      if (existing.length > 0) {
        skipped++;
        continue;
      }
      
      // 🔥 标签自动补全策略：
      // 1. 先用关键词提取（快、免费）
      // 2. 如果关键词提取为空，调用 LLM 生成（慢、准、有成本）
      // 3. LLM 生成的标签标记 autoGeneratedTags
      const needsAutoTag = (
        (!caseData.productTags || caseData.productTags.length === 0) ||
        (!caseData.crowdTags || caseData.crowdTags.length === 0) ||
        (!caseData.emotionTags || caseData.emotionTags.length === 0)
      );
      
      if (needsAutoTag) {
        // 第1步：先尝试关键词提取
        if (!caseData.productTags || caseData.productTags.length === 0) {
          const contentText = [caseData.title || '', caseData.applicableProducts || '', caseData.background || '', caseData.result || ''].join(' ');
          caseData.productTags = extractTags(contentText, []);
        }
        if (!caseData.crowdTags || caseData.crowdTags.length === 0) {
          const contentText = [caseData.protagonist || '', caseData.background || ''].join(' ');
          caseData.crowdTags = extractCrowdTags(contentText);
        }
        if (!caseData.emotionTags || caseData.emotionTags.length === 0) {
          const contentText = [caseData.title || '', caseData.background || '', caseData.result || ''].join(' ');
          caseData.emotionTags = extractEmotionTags(contentText);
        }
        
        // 第2步：关键词仍提取不出 → 调用 LLM
        const stillEmpty = (
          (!caseData.productTags || caseData.productTags.length === 0) ||
          (!caseData.crowdTags || caseData.crowdTags.length === 0) ||
          (!caseData.emotionTags || caseData.emotionTags.length === 0)
        );
        
        if (stillEmpty) {
          console.log(`[CaseImport] 关键词提取标签为空，调用 LLM 补全: ${caseData.title}`);
          const llmTags = await generateTagsWithLLM(caseData);
          
          if (llmTags.productTags.length > 0 && (!caseData.productTags || caseData.productTags.length === 0)) {
            caseData.productTags = llmTags.productTags;
          }
          if (llmTags.crowdTags.length > 0 && (!caseData.crowdTags || caseData.crowdTags.length === 0)) {
            caseData.crowdTags = llmTags.crowdTags;
          }
          if (llmTags.emotionTags.length > 0 && (!caseData.emotionTags || caseData.emotionTags.length === 0)) {
            caseData.emotionTags = llmTags.emotionTags;
          }
          
          // LLM 补全后仍有空标签 → 打上"待人工确认"标记，该案例不会被搜索推荐
          const stillEmptyAfterLLM = (
            (!caseData.productTags || caseData.productTags.length === 0) ||
            (!caseData.crowdTags || caseData.crowdTags.length === 0) ||
            (!caseData.emotionTags || caseData.emotionTags.length === 0)
          );
          if (stillEmptyAfterLLM) {
            if (!caseData.productTags || caseData.productTags.length === 0) {
              caseData.productTags = ['待人工确认'];
            }
            if (!caseData.crowdTags || caseData.crowdTags.length === 0) {
              caseData.crowdTags = ['待人工确认'];
            }
            if (!caseData.emotionTags || caseData.emotionTags.length === 0) {
              caseData.emotionTags = ['待人工确认'];
            }
            console.warn(`[CaseImport] LLM 标签补全仍不完整，标记为"待人工确认": ${caseData.title}`);
          }
          
          // 标记为 LLM 自动生成的标签
          caseData.metadata = { ...caseData.metadata, autoGeneratedTags: true };
          autoTaggedCases.push(caseData.title || caseData.caseId);
          console.log(`[CaseImport] LLM 自动补全标签: ${caseData.title} → productTags: ${JSON.stringify(caseData.productTags)}, crowdTags: ${JSON.stringify(caseData.crowdTags)}`);
        }
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
  
  if (autoTaggedCases.length > 0) {
    console.log(`[CaseImport] ⚠️ 以下 ${autoTaggedCases.length} 个案例标签为 LLM 自动生成，建议人工确认：`);
    autoTaggedCases.forEach(title => console.log(`  - ${title}`));
  }
  
  console.log(`[CaseImport] 导入完成: 成功 ${success}, 跳过(已存在) ${skipped}, 失败 ${failed}`);
  return { success, failed, skipped, autoTaggedCases };
}

/**
 * 获取案例统计
 * 
 * @param industry 行业筛选
 * @param workspaceId 工作空间ID（用于可见性过滤）
 * @returns 统计结果
 */
export async function getCaseStats(
  industry?: string,
  workspaceId?: string
): Promise<{
  total: number;
  byType: Record<string, number>;
  byProduct: Record<string, number>;
}> {
  // 构建查询条件：行业筛选 + 可见性过滤
  const conditions: any[] = [];
  
  // 🔥 可见性过滤：用户私有案例 + 系统预置案例
  conditions.push(
    or(
      eq(industryCaseLibrary.workspaceId, workspaceId || 'default-workspace'),  // 用户私有
      eq(industryCaseLibrary.workspaceId, CASE_SYSTEM_WORKSPACE_ID)             // 系统预置
    )!
  );
  
  if (industry) {
    conditions.push(eq(industryCaseLibrary.industry, industry));
  }
  
  const cases = conditions.length > 0
    ? await db.select().from(industryCaseLibrary).where(and(...conditions))
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

/**
 * 创建用户自定义案例
 * 
 * @param caseData 案例数据
 * @param workspaceId 工作空间ID（必须提供，用于可见性隔离）
 * @returns 创建的案例
 */
export async function createCase(
  caseData: Omit<NewIndustryCase, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'useCount'>,
  workspaceId: string
): Promise<IndustryCase> {
  const [newCase] = await db
    .insert(industryCaseLibrary)
    .values({
      ...caseData,
      workspaceId,  // 🔥 用户私有案例
      useCount: 0,
    })
    .returning();
  
  return newCase;
}

/**
 * 更新案例
 * 
 * @param caseId 案例ID
 * @param updates 更新数据
 * @param workspaceId 工作空间ID（用于权限校验）
 * @returns 更新后的案例
 */
export async function updateCase(
  caseId: string,
  updates: Partial<Omit<NewIndustryCase, 'id' | 'workspaceId' | 'createdAt'>>,
  workspaceId: string
): Promise<IndustryCase | null> {
  // 🔥 原子操作：在 UPDATE 的 WHERE 条件中同时校验权限，避免 TOCTOU 竞态
  // 条件：id 匹配 + workspaceId 匹配（非系统案例）→ 只有自己的案例才能更新
  const [updated] = await db
    .update(industryCaseLibrary)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(industryCaseLibrary.id, caseId),
        eq(industryCaseLibrary.workspaceId, workspaceId),  // 只能更新自己的案例
        sql`${industryCaseLibrary.workspaceId} != ${CASE_SYSTEM_WORKSPACE_ID}`  // 系统案例不可修改
      )
    )
    .returning();
  
  if (!updated) {
    // 区分"不存在"和"无权修改"
    const existing = await db
      .select({ workspaceId: industryCaseLibrary.workspaceId })
      .from(industryCaseLibrary)
      .where(eq(industryCaseLibrary.id, caseId))
      .limit(1);
    
    if (!existing.length) {
      return null;  // 案例不存在
    }
    if (existing[0].workspaceId === CASE_SYSTEM_WORKSPACE_ID) {
      throw new Error('系统预置案例不允许修改');
    }
    throw new Error('无权修改此案例');
  }
  
  return updated;
}

/**
 * 删除案例
 * 
 * @param caseId 案例ID
 * @param workspaceId 工作空间ID（用于权限校验）
 * @returns 是否删除成功
 */
export async function deleteCase(caseId: string, workspaceId: string): Promise<boolean> {
  // 🔥 原子操作：在 DELETE 的 WHERE 条件中同时校验权限，避免 TOCTOU 竞态
  const deleted = await db
    .delete(industryCaseLibrary)
    .where(
      and(
        eq(industryCaseLibrary.id, caseId),
        eq(industryCaseLibrary.workspaceId, workspaceId),  // 只能删除自己的案例
        sql`${industryCaseLibrary.workspaceId} != ${CASE_SYSTEM_WORKSPACE_ID}`  // 系统案例不可删除
      )
    )
    .returning({ id: industryCaseLibrary.id });
  
  if (deleted.length === 0) {
    // 区分"不存在"和"无权删除"
    const existing = await db
      .select({ workspaceId: industryCaseLibrary.workspaceId })
      .from(industryCaseLibrary)
      .where(eq(industryCaseLibrary.id, caseId))
      .limit(1);
    
    if (!existing.length) {
      return false;  // 案例不存在
    }
    if (existing[0].workspaceId === CASE_SYSTEM_WORKSPACE_ID) {
      throw new Error('系统预置案例不允许删除');
    }
    throw new Error('无权删除此案例');
  }
  
  return true;
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
  createCase,      // 🔥 新增：创建用户案例
  updateCase,      // 🔥 新增：更新用户案例
  deleteCase,      // 🔥 新增：删除用户案例
};

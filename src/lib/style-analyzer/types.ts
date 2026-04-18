/**
 * 文章风格类型定义
 */

/**
 * 风格特征
 */
export interface StyleFeatures {
  // 基础特征
  tone: string;                       // 语气（专业/亲切/幽默/严肃）
  complexity: 'simple' | 'moderate' | 'complex'; // 复杂度
  length: 'short' | 'medium' | 'long';         // 文章长度偏好

  // 语言特征
  vocabularyLevel: 'basic' | 'intermediate' | 'advanced'; // 词汇水平
  sentenceStructure: 'simple' | 'mixed' | 'complex';      // 句式结构
  punctuationStyle: 'minimal' | 'standard' | 'rich';      // 标点风格

  // 内容特征
  contentStructure: string[];         // 内容结构（如：引言-正文-结论）
  typicalSections: string[];          // 典型段落类型
  useOfExamples: 'none' | 'few' | 'many'; // 案例使用频率

  // 表达特征
  useOfMetaphors: 'none' | 'occasional' | 'frequent'; // 比喻使用
  useOfData: 'none' | 'minimal' | 'moderate' | 'extensive'; // 数据使用
  useOfQuotes: 'none' | 'occasional' | 'frequent'; // 引用使用

  // 关键词特征
  commonKeywords: string[];           // 常用关键词
  keyPhrases: string[];              // 关键短语

  // 标题特征
  titleStyle: string;                // 标题风格
  typicalTitleLength: number;        // 典型标题长度

  // 段落特征
  averageParagraphLength: number;    // 平均段落长度
  paragraphCount: number;            // 段落数量

  // 其他特征
  signature: string;                 // 风格签名（唯一标识）
  confidence: number;                // 分析置信度（0-1）
}

/**
 * 风格模板
 */
export interface StyleTemplate {
  id: string;
  name: string;
  description: string;
  category: string;                  // 分类（保险/AI/通用等）
  features: StyleFeatures;
  sampleArticles: string[];          // 样本文章（用于学习）
  createdAt: number;
  updatedAt: number;
  metadata: {
    sourceCount: number;             // 来源文章数量
    lastAnalyzedAt: number;
    tags: string[];
  };
}

/**
 * 风格分析请求
 */
export interface StyleAnalysisRequest {
  articles: string[];                // 要分析的文章列表
  categoryName?: string;             // 分类名称
}

/**
 * 风格分析结果
 */
export interface StyleAnalysisResult {
  success: boolean;
  template: StyleTemplate;
  summary: string;
  recommendations: string[];
}

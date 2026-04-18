/**
 * 风格相似度校验服务
 * 
 * 核心能力：
 * 1. 计算文章风格与模板的相似度
 * 2. 提供统一的校验入口
 * 3. 支持风格推荐
 * 
 * 设计原则：
 * - 防止风格污染：相似度过低时拒绝保存
 * - 帮助用户选择：推荐更匹配的模板
 * - 保持一致性：确保模板风格统一
 */

import { db } from '@/lib/db';
import { styleAssets } from '@/lib/db/schema/digital-assets';
import { eq, and } from 'drizzle-orm';
import { styleDepositionService, type SixDimensionAnalysis } from './style-deposition-service';

// ================================================================
// 常量定义
// ================================================================

/** 相似度阈值：低于此值拒绝保存 */
const SIMILARITY_THRESHOLD_REJECT = 0.5;

/** 相似度阈值：低于此值显示警告 */
const SIMILARITY_THRESHOLD_WARN = 0.7;

// ================================================================
// 类型定义
// ================================================================

export interface StyleValidationResult {
  /** 是否允许保存 */
  canSave: boolean;
  
  /** 相似度分数 (0.0 - 1.0) */
  similarity: number;
  
  /** 是否跳过了校验（模板规则太少） */
  skipped: boolean;
  
  /** 警告信息（相似度较低但允许保存） */
  warning?: string;
  
  /** 推荐的其他模板 */
  recommendation?: {
    templateId: string;
    templateName: string;
    similarity: number;
  };
  
  /** 详细分数 */
  details?: {
    dimensionScore: number;   // 6维度相似度
    vocabularyScore: number;  // 词汇相似度
    toneScore: number;        // 语气相似度
  };
}

export interface StyleRule {
  ruleType: string;
  ruleContent: string;
  sampleExtract?: string;
  priority: number;
}

// ================================================================
// 核心服务
// ================================================================

class StyleSimilarityValidatorService {
  
  /**
   * 统一校验入口
   * 
   * @param articleStyle 文章的6维度风格分析结果
   * @param templateId 目标模板ID
   * @param workspaceId 工作空间ID（用于获取模板列表，Phase 6: 原参数名 userId 已修正）
   * @returns 校验结果
   */
  async validate(
    articleStyle: SixDimensionAnalysis,
    templateId: string,
    workspaceId?: string
  ): Promise<StyleValidationResult> {
    console.log(`[StyleValidator] 开始校验，模板ID: ${templateId}`);
    
    // 1. 获取模板已有规则
    const templateRules = await this.getTemplateRules(templateId);
    
    // 2. 模板无规则：建立基准阶段，允许保存
    if (templateRules.length === 0) {
      console.log(`[StyleValidator] 模板规则数为 0，建立基准阶段，允许保存`);
      return {
        canSave: true,
        similarity: 1.0,
        skipped: true,
        warning: '模板规则数为空，本文将作为风格基准',
      };
    }
    
    // 3. 计算相似度（有规则就必须校验）
    const similarity = this.calculateSimilarity(articleStyle, templateRules);
    const details = this.calculateDetailedScores(articleStyle, templateRules);
    
    console.log(`[StyleValidator] 相似度: ${(similarity * 100).toFixed(1)}%`);
    
    // 4. 根据阈值判断
    if (similarity < SIMILARITY_THRESHOLD_REJECT) {
      // 相似度过低，尝试推荐其他模板
      const recommendation = await this.findBetterTemplate(articleStyle, templateId, workspaceId);
      
      return {
        canSave: false,
        similarity,
        skipped: false,
        warning: `风格相似度仅 ${(similarity * 100).toFixed(0)}%，与该模板风格差异较大，建议更换模板`,
        recommendation,
        details,
      };
    }
    
    if (similarity < SIMILARITY_THRESHOLD_WARN) {
      // 相似度中等，警告但允许保存
      return {
        canSave: true,
        similarity,
        skipped: false,
        warning: `风格相似度 ${(similarity * 100).toFixed(0)}%，略低于推荐值，建议检查模板选择`,
        details,
      };
    }
    
    // 相似度足够高
    return {
      canSave: true,
      similarity,
      skipped: false,
      details,
    };
  }
  
  /**
   * 批量校验（用于定时任务）
   * 
   * @param articleTexts 多篇文章文本
   * @param templateId 目标模板ID
   * @returns 是否全部通过校验
   */
  async validateBatch(
    articleTexts: string[],
    templateId: string
  ): Promise<{
    passed: boolean;
    avgSimilarity: number;
    details: StyleValidationResult[];
  }> {
    if (articleTexts.length === 0) {
      return { passed: true, avgSimilarity: 1.0, details: [] };
    }
    
    const details: StyleValidationResult[] = [];
    let totalSimilarity = 0;
    
    for (const text of articleTexts) {
      try {
        const style = await styleDepositionService.analyzeSixDimensions(text);
        const result = await this.validate(style, templateId);
        details.push(result);
        totalSimilarity += result.similarity;
      } catch (e) {
        console.error('[StyleValidator] 分析文章失败:', e);
        // 分析失败时默认通过（避免阻塞）
        details.push({ canSave: true, similarity: 0.5, skipped: true });
        totalSimilarity += 0.5;
      }
    }
    
    const avgSimilarity = totalSimilarity / articleTexts.length;
    const passed = details.every(d => d.canSave);
    
    return { passed, avgSimilarity, details };
  }
  
  /**
   * 获取模板的风格规则
   */
  private async getTemplateRules(templateId: string): Promise<StyleRule[]> {
    try {
      const rules = await db
        .select({
          ruleType: styleAssets.ruleType,
          ruleContent: styleAssets.ruleContent,
          sampleExtract: styleAssets.sampleExtract,
          priority: styleAssets.priority,
        })
        .from(styleAssets)
        .where(eq(styleAssets.templateId, templateId));
      
      return rules.map(r => ({
        ruleType: r.ruleType,
        ruleContent: r.ruleContent || '',
        sampleExtract: r.sampleExtract || undefined,
        priority: r.priority || 3,
      }));
    } catch (e) {
      console.error('[StyleValidator] 获取模板规则失败:', e);
      return [];
    }
  }
  
  /**
   * 计算风格相似度
   * 
   * 算法：加权平均
   * - 6维度相似度：权重 50%
   * - 词汇相似度：权重 30%
   * - 语气相似度：权重 20%
   */
  private calculateSimilarity(
    articleStyle: SixDimensionAnalysis,
    templateRules: StyleRule[]
  ): number {
    const scores = this.calculateDetailedScores(articleStyle, templateRules);
    
    // 加权平均
    const similarity = 
      scores.dimensionScore * 0.5 +
      scores.vocabularyScore * 0.3 +
      scores.toneScore * 0.2;
    
    return Math.max(0, Math.min(1, similarity));
  }
  
  /**
   * 计算详细分数
   */
  private calculateDetailedScores(
    articleStyle: SixDimensionAnalysis,
    templateRules: StyleRule[]
  ): { dimensionScore: number; vocabularyScore: number; toneScore: number } {
    // 1. 计算6维度相似度
    const dimensionScore = this.calculateDimensionScore(articleStyle, templateRules);
    
    // 2. 计算词汇相似度
    const vocabularyScore = this.calculateVocabularyScore(articleStyle, templateRules);
    
    // 3. 计算语气相似度
    const toneScore = this.calculateToneScore(articleStyle, templateRules);
    
    return { dimensionScore, vocabularyScore, toneScore };
  }
  
  /**
   * 计算6维度相似度
   * 
   * 比较文章的6维度评分与模板的平均评分
   */
  private calculateDimensionScore(
    articleStyle: SixDimensionAnalysis,
    templateRules: StyleRule[]
  ): number {
    // 从模板规则中提取维度评分（如果有）
    const dimensionRules = templateRules.filter(r => 
      r.ruleType === 'emotion' || r.ruleType === 'tone'
    );
    
    if (dimensionRules.length === 0) {
      return 0.7; // 无维度规则时返回默认值
    }
    
    // 简化计算：检查文章的整体调性是否与模板规则关键词匹配
    const articleTone = articleStyle.overallTone?.overallTone || '';
    const articleSummary = articleStyle.overallTone?.summary || '';
    
    let matchCount = 0;
    for (const rule of dimensionRules) {
      const keywords = this.extractKeywords(rule.ruleContent);
      for (const keyword of keywords) {
        if (articleTone.includes(keyword) || articleSummary.includes(keyword)) {
          matchCount++;
          break;
        }
      }
    }
    
    return Math.min(1, matchCount / Math.max(1, dimensionRules.length) + 0.3);
  }
  
  /**
   * 计算词汇相似度
   * 
   * 比较文章的高频词与模板的高频词
   */
  private calculateVocabularyScore(
    articleStyle: SixDimensionAnalysis,
    templateRules: StyleRule[]
  ): number {
    // 提取文章的高频词
    const articleWords = new Set<string>();
    if (articleStyle.expressionHabits?.highFrequencyWords) {
      for (const w of articleStyle.expressionHabits.highFrequencyWords) {
        articleWords.add(w.word);
      }
    }
    
    if (articleWords.size === 0) {
      return 0.5; // 无高频词时返回中等分数
    }
    
    // 提取模板的高频词规则
    const vocabRules = templateRules.filter(r => 
      r.ruleType === 'vocabulary' || r.ruleType === 'high_frequency'
    );
    
    if (vocabRules.length === 0) {
      return 0.5;
    }
    
    // 计算重叠率
    let matchCount = 0;
    for (const rule of vocabRules) {
      const ruleWords = this.extractKeywords(rule.ruleContent);
      for (const word of ruleWords) {
        if (articleWords.has(word)) {
          matchCount++;
        }
      }
    }
    
    const overlapRatio = matchCount / Math.max(1, articleWords.size);
    return Math.min(1, overlapRatio + 0.3);
  }
  
  /**
   * 计算语气相似度
   * 
   * 比较文章的语气特征与模板的语气规则
   */
  private calculateToneScore(
    articleStyle: SixDimensionAnalysis,
    templateRules: StyleRule[]
  ): number {
    const articleTone = articleStyle.toneAndVoice || {};
    
    // 从模板规则中提取语气特征
    const toneRules = templateRules.filter(r => r.ruleType === 'tone');
    
    if (toneRules.length === 0) {
      return 0.6; // 无语气规则时返回默认值
    }
    
    // 检查口语化程度是否匹配
    const colloquialScore = articleTone.colloquialismScore || 0;
    
    // 检查模板规则中是否包含口语化/正式的描述
    const isColloquial = toneRules.some(r => 
      r.ruleContent.includes('口语') || r.ruleContent.includes('轻松')
    );
    const isFormal = toneRules.some(r => 
      r.ruleContent.includes('正式') || r.ruleContent.includes('专业')
    );
    
    // 匹配程度
    if (isColloquial && colloquialScore > 0.5) {
      return 0.8;
    }
    if (isFormal && colloquialScore < 0.3) {
      return 0.8;
    }
    
    return 0.5;
  }
  
  /**
   * 提取关键词
   */
  private extractKeywords(text: string): string[] {
    // 简单分词：按标点和空格分割
    const words = text
      .replace(/[，。、；：""''！？\-\s]+/g, ' ')
      .split(' ')
      .map(w => w.trim())
      .filter(w => w.length >= 2);
    
    return [...new Set(words)];
  }
  
  /**
   * 查找更匹配的模板
   */
  private async findBetterTemplate(
    articleStyle: SixDimensionAnalysis,
    excludeTemplateId: string,
    workspaceId?: string
  ): Promise<{ templateId: string; templateName: string; similarity: number } | undefined> {
    try {
      // 获取工作空间的所有模板
      const { styleTemplateService } = await import('./style-template-service');
      const templates = await styleTemplateService.listTemplates(workspaceId || 'default-workspace');
      
      let bestMatch: { templateId: string; templateName: string; similarity: number } | undefined;
      let bestSimilarity = 0;
      
      for (const template of templates) {
        if (template.id === excludeTemplateId) continue;
        
        const rules = await this.getTemplateRules(template.id);
        // 跳过无规则的模板
        if (rules.length === 0) continue;
        
        const similarity = this.calculateSimilarity(articleStyle, rules);
        
        if (similarity > bestSimilarity && similarity >= SIMILARITY_THRESHOLD_WARN) {
          bestSimilarity = similarity;
          bestMatch = {
            templateId: template.id,
            templateName: template.name,
            similarity,
          };
        }
      }
      
      return bestMatch;
    } catch (e) {
      console.error('[StyleValidator] 查找推荐模板失败:', e);
      return undefined;
    }
  }

  // ========== 小红书风格校验（P1-6 修复）==========

  /**
   * 小红书风格相似度校验
   *
   * 与公众号6维度校验并行，专门处理 XiaohongshuStyleAnalysis 类型。
   * 核心维度：标题套路、Emoji密度、语气基调、排版风格
   *
   * @param xhsAnalysis 小红书风格分析结果
   * @param templateId 目标模板ID
   * @param workspaceId 工作空间ID
   * @returns 校验结果
   */
  async validateXiaohongshu(
    xhsAnalysis: import('@/types/style-analysis').XiaohongshuStyleAnalysis,
    templateId: string,
    workspaceId?: string
  ): Promise<StyleValidationResult> {
    console.log(`[StyleValidator] 开始小红书校验，模板ID: ${templateId}`);

    // 1. 获取模板已有规则（仅小红书相关类型）
    const XHS_RULE_TYPES = ['title_pattern', 'emoji_usage', 'visual_layout', 'tone', 'vocabulary', 'card_style'];
    const templateRules = await this.getTemplateRules(templateId);
    const xhsTemplateRules = templateRules.filter(r => XHS_RULE_TYPES.includes(r.ruleType));

    // 2. 模板无小红书规则：建立基准阶段，允许保存
    if (xhsTemplateRules.length === 0) {
      console.log('[StyleValidator] 模板无小红书规则，建立基准阶段，允许保存');
      return {
        canSave: true,
        similarity: 1.0,
        skipped: true,
        warning: '模板暂无小红书风格规则，本文将作为图文风格基准',
      };
    }

    // 3. 计算小红书维度相似度
    const similarity = this.calculateXhsSimilarity(xhsAnalysis, xhsTemplateRules);
    const details = this.calculateXhsDetailedScores(xhsAnalysis, xhsTemplateRules);

    console.log(`[StyleValidator] 小红书风格相似度: ${(similarity * 100).toFixed(1)}%`);

    // 4. 根据阈值判断（复用公众号相同阈值）
    if (similarity < SIMILARITY_THRESHOLD_REJECT) {
      const recommendation = await this.findBetterXhsTemplate(xhsAnalysis, templateId, workspaceId);

      return {
        canSave: false,
        similarity,
        skipped: false,
        warning: `小红书风格相似度仅 ${(similarity * 100).toFixed(0)}%，与该模板风格差异较大，建议更换模板或新建模板`,
        recommendation,
        details,
      };
    }

    if (similarity < SIMILARITY_THRESHOLD_WARN) {
      return {
        canSave: true,
        similarity,
        skipped: false,
        warning: `小红书风格相似度 ${(similarity * 100).toFixed(0)}%，略低于推荐值`,
        details,
      };
    }

    return { canSave: true, similarity, skipped: false, details };
  }

  /**
   * 计算小红书风格相似度
   *
   * 对比维度：
   * - titlePattern.type（标题套路是否一致）
   * - tone.primary（语气基调是否一致）
   * - emojiUsage.density（Emoji密度等级）
   * - visualLayout.paragraphStyle（段落风格）
   */
  private calculateXhsSimilarity(
    analysis: import('@/types/style-analysis').XiaohongshuStyleAnalysis,
    existingRules: StyleRule[]
  ): number {
    let matchCount = 0;
    let totalDimensions = 0;

    // 按 ruleType 分组已有规则
    const rulesByType = new Map<string, StyleRule[]>();
    for (const rule of existingRules) {
      const list = rulesByType.get(rule.ruleType) || [];
      list.push(rule);
      rulesByType.set(rule.ruleType, list);
    }

    // 维度1：标题套路
    totalDimensions++;
    const titleRules = rulesByType.get('title_pattern') || [];
    if (titleRules.length > 0) {
      // 检查是否有相同类型的标题套路
      const hasMatchingPattern = titleRules.some(r =>
        r.ruleContent.includes(analysis.titlePattern.type) ||
        analysis.titlePattern.pattern.includes(r.ruleContent.slice(0, 5))
      );
      if (hasMatchingPattern) matchCount++;
    } else {
      matchCount++; // 无此维度规则，不扣分
    }

    // 维度2：语气基调
    totalDimensions++;
    const toneRules = rulesByType.get('tone') || [];
    if (toneRules.length > 0) {
      const hasMatchingTone = toneRules.some(r =>
        r.ruleContent.includes(analysis.tone.primary)
      );
      if (hasMatchingTone) matchCount++;
    } else {
      matchCount++;
    }

    // 维度3：Emoji密度
    totalDimensions++;
    const emojiRules = rulesByType.get('emoji_usage') || [];
    if (emojiRules.length > 0) {
      const hasMatchingDensity = emojiRules.some(r =>
        r.ruleContent.includes(analysis.emojiUsage.density)
      );
      if (hasMatchingDensity) matchCount++;
    } else {
      matchCount++;
    }

    // 维度4：排版风格
    totalDimensions++;
    const layoutRules = rulesByType.get('visual_layout') || [];
    if (layoutRules.length > 0) {
      const hasMatchingLayout = layoutRules.some(r =>
        r.ruleContent.includes(analysis.visualLayout.paragraphStyle)
      );
      if (hasMatchingLayout) matchCount++;
    } else {
      matchCount++;
    }

    return totalDimensions > 0 ? matchCount / totalDimensions : 1.0;
  }

  /**
   * 计算小红书详细分数
   */
  private calculateXhsDetailedScores(
    analysis: import('@/types/style-analysis').XiaohongshuStyleAnalysis,
    existingRules: StyleRule[]
  ): NonNullable<StyleValidationResult['details']> {
    const rulesByType = new Map<string, StyleRule[]>();
    for (const rule of existingRules) {
      const list = rulesByType.get(rule.ruleType) || [];
      list.push(rule);
      rulesByType.set(rule.ruleType, list);
    }

    // 简化版：基于规则匹配度计算各维度分数
    const toneRules = rulesByType.get('tone') || [];
    const toneScore = toneRules.length > 0
      ? (toneRules.some(r => r.ruleContent.includes(analysis.tone.primary)) ? 0.9 : 0.3)
      : 1.0;

    const emojiRules = rulesByType.get('emoji_usage') || [];
    const vocabScore = emojiRules.length > 0
      ? (emojiRules.some(r => r.ruleContent.includes(analysis.emojiUsage.density)) ? 0.85 : 0.4)
      : 1.0;

    return {
      dimensionScore: this.calculateXhsSimilarity(analysis, existingRules),
      vocabularyScore: vocabScore,
      toneScore: toneScore,
    };
  }

  /**
   * 为小红书分析查找更匹配的模板
   */
  private async findBetterXhsTemplate(
    xhsAnalysis: import('@/types/style-analysis').XiaohongshuStyleAnalysis,
    excludeTemplateId: string,
    workspaceId?: string
  ): Promise<StyleValidationResult['recommendation']> {
    try {
      const { styleTemplateService } = await import('./style-template-service');
      const templates = await styleTemplateService.listTemplates(workspaceId || 'default-workspace');

      let bestMatch: { templateId: string; templateName: string; similarity: number } | undefined;
      let bestSimilarity = 0;

      for (const template of templates) {
        if (template.id === excludeTemplateId) continue;

        const rules = await this.getTemplateRules(template.id);
        const xhsRules = rules.filter(r => XHS_RULE_TYPES.includes(r.ruleType));
        if (xhsRules.length === 0) continue;

        const similarity = this.calculateXhsSimilarity(xhsAnalysis, xhsRules);

        if (similarity > bestSimilarity && similarity >= SIMILARITY_THRESHOLD_WARN) {
          bestSimilarity = similarity;
          bestMatch = {
            templateId: template.id,
            templateName: template.name,
            similarity,
          };
        }
      }

      return bestMatch;
    } catch (e) {
      console.error('[StyleValidator] 查找小红书推荐模板失败:', e);
      return undefined;
    }
  }
}

// 导出单例
export const styleSimilarityValidator = new StyleSimilarityValidatorService();

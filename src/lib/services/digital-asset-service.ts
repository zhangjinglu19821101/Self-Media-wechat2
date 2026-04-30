/**
 * 数字资产管理服务
 *
 * 功能：
 * - 从数据库读取用户专属规则（style_assets + feedback_assets 表）
 * - 从素材库读取可用素材（使用现有 material_library 表）
 * - 提供数字资产的查询、创建、更新操作
 *
 * Phase 3 已完成：
 * ✅ style_assets / feedback_assets / core_anchor_assets 表已建好并对接
 * ✅ getUserExclusiveRules() — 从 style_assets + feedback_assets 读取真实数据
 * ✅ getStyleRules() — 从 style_assets 读取真实数据
 * ⏳ getSampleArticles() — sample_articles 表属于 Phase 4（样本文章管理），当前返回空数组
 */

import { db } from '@/lib/db';
import { materialLibrary, materialUsageLog, SYSTEM_WORKSPACE_ID } from '@/lib/db/schema/material-library';
import { styleAssets, feedbackAssets, coreAnchorAssets } from '@/lib/db/schema/digital-assets';
import {
  eq,
  and,
  or,
  like,
  desc,
  asc,
  sql,
  isNull,
  gte,
  ne,
} from 'drizzle-orm';
import type {
  StyleAsset,
  NewStyleAsset,
  FeedbackAsset,
  CoreAnchorAsset,
  NewCoreAnchorAsset,
} from '@/lib/db/schema/digital-assets';

// ========== 类型定义 ==========

/**
 * 用户专属动态规则（需求文档 3.2.2）
 *
 * 5 类动态规则：
 * 1. high_frequency_word — 用户高频用词，贴合用户表达习惯
 * 2. forbidden_supplement — 用户禁用补充，禁止使用的称呼/行为
 * 3. core_stance — 用户核心立场补充，从历史观点中提取
 * 4. structure_supplement — 用户固定结构补充，结构模块的具体风格要求
 * 5. material_habit — 用户素材使用习惯，偏好的素材来源/使用方式
 */
export interface UserExclusiveRule {
  id: string;
  ruleType: 'high_frequency_word' | 'forbidden_supplement' | 'core_stance' | 'structure_supplement' | 'material_habit';
  ruleContent: string;
  priority: number; // 1 = 最高优先级
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 风格复刻规则（需求文档 3.3.1 风格资产）
 *
 * 通用文字风格规则：
 * 1. tone — 语气与句式习惯
 * 2. vocabulary — 高频词 / 禁用词
 * 3. logic — 思维逻辑和论证方式
 * 4. emotion — 情感基调
 *
 * 小红书/短视频平台特有规则：
 * 5. title_pattern — 标题套路
 * 6. emoji_usage — emoji 使用
 * 7. visual_layout — 图文排版
 * 8. card_style — 卡片风格
 * 9. image_structure — 图文结构
 * 10. color_scheme — 配色方案
 */
export interface StyleRule {
  id: string;
  ruleType: 'tone' | 'vocabulary' | 'logic' | 'emotion' 
    | 'title_pattern' | 'emoji_usage' | 'visual_layout' | 'card_style' | 'image_structure' | 'color_scheme';
  ruleContent: string;
  sampleExtract?: string; // 从样本中提取的示例
  confidence: number; // 0-1，置信度
  priority?: number; // 优先级（1 = 最高优先级，默认为 2）
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 样本文章（需求文档 3.3.1 风格资产）
 */
export interface SampleArticle {
  id: string;
  title: string;
  content: string;
  source: string;
  wordCount: number;
  isAnalyzed: boolean;
  analysisResult?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ========== 规则类型标签映射 ==========
const USER_RULE_TYPE_LABELS: Record<UserExclusiveRule['ruleType'], string> = {
  high_frequency_word: '高频用词',
  forbidden_supplement: '禁用补充',
  core_stance: '核心立场补充',
  structure_supplement: '固定结构补充',
  material_habit: '素材使用习惯',
};

const STYLE_RULE_TYPE_LABELS: Record<StyleRule['ruleType'], string> = {
  tone: '语气与句式习惯',
  vocabulary: '高频词/禁用词',
  logic: '思维逻辑和论证方式',
  emotion: '情感基调',
  // 🔥 小红书图文风格规则
  title_pattern: '标题套路',
  emoji_usage: 'Emoji使用习惯',
  visual_layout: '图文排版风格',
  card_style: '卡片视觉风格',
  image_structure: '图文结构（图片模式/分工）',
  color_scheme: '精确配色方案',
};

export { USER_RULE_TYPE_LABELS, STYLE_RULE_TYPE_LABELS };

// ========== 规则映射表：style_assets.ruleType → UserExclusiveRule.ruleType ==========

/**
 * 将 style_assets 的 4 类 ruleType 映射为 UserExclusiveRule 的 5 类 ruleType
 *
 * 映射逻辑：
 * - positive(正向) 规则：
 *   - tone → structure_supplement（语气要求 → 结构风格补充）
 *   - vocabulary → high_frequency_word（高频词 → 高频用词）
 *   - logic → material_habit（论证方式 → 素材使用习惯）
 *   - emotion → core_stance（情感基调 → 核心立场补充）
 * - negative(禁止) 规则：
 *   - tone/vocabulary/logic/emotion → forbidden_supplement（所有禁止项统一归入）
 */
function mapStyleAssetToUserExclusiveRule(
  asset: StyleAsset
): UserExclusiveRule[] {
  const rules: UserExclusiveRule[] = [];
  const baseProps = {
    id: asset.id,
    ruleContent: asset.ruleContent,
    priority: asset.priority,
    isActive: asset.isActive,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  };

  if (asset.ruleCategory === 'positive') {
    // 正向规则按 ruleType 分配到对应类别
    switch (asset.ruleType) {
      case 'vocabulary':
        rules.push({ ...baseProps, ruleType: 'high_frequency_word' });
        break;
      case 'tone':
        rules.push({ ...baseProps, ruleType: 'structure_supplement' });
        break;
      case 'logic':
        rules.push({ ...baseProps, ruleType: 'material_habit' });
        break;
      case 'emotion':
        rules.push({ ...baseProps, ruleType: 'core_stance' });
        break;
    }
  } else if (asset.ruleCategory === 'negative') {
    // 所有禁止项归入 forbidden_supplement
    rules.push({ ...baseProps, ruleType: 'forbidden_supplement' });
  }

  return rules;
}

/**
 * 将 feedback_assets 中已验证的反馈映射为 UserExclusiveRule
 */
function mapFeedbackToUserExclusiveRule(
  feedback: FeedbackAsset
): UserExclusiveRule | null {
  if (!feedback.extractedRuleType || !feedback.extractedRuleContent) {
    return null;
  }

  // 反馈中的规则默认映射
  let ruleType: UserExclusiveRule['ruleType'] = 'forbidden_supplement';

  // 尝试根据反馈类型推断规则类别
  switch (feedback.feedbackType) {
    case 'content':
      ruleType = 'core_stance';
      break;
    case 'style':
      ruleType = 'forbidden_supplement';
      break;
    case 'structure':
      ruleType = 'structure_supplement';
      break;
    case 'overall':
      ruleType = 'core_stance';
      break;
  }

  return {
    id: feedback.id,
    ruleType,
    ruleContent: feedback.extractedRuleContent,
    priority: 2, // 反馈提取的规则默认中等优先级
    isActive: true,
    createdAt: feedback.createdAt,
    updatedAt: feedback.createdAt,
  };
}

// ========== 数字资产管理服务 ==========

export class DigitalAssetService {
  /**
   * 获取用户专属规则（需求文档 3.2.2 定义的5类动态规则）
   *
   * 数据来源：
   * 1. style_assets 表 — 手工录入或自动沉淀的风格规则
   * 2. feedback_assets 表 — 从用户反馈中提取且已审核通过的规则
   *
   * 合并去重后按优先级排序，最多返回 20 条（提示词长度控制）
   */
  async getUserExclusiveRules(workspaceId?: string): Promise<UserExclusiveRule[]> {
    try {
      // 并行查询两个数据源
      const [styleRows, feedbackRows] = await Promise.all([
        // 1. 从 style_assets 查询活跃的正向+负向规则
        db
          .select()
          .from(styleAssets)
          .where(
            and(
              eq(styleAssets.isActive, true),
              workspaceId ? eq(styleAssets.workspaceId, workspaceId) : undefined
            )
          )
          .orderBy(asc(styleAssets.priority))
          .limit(20),

        // 2. 从 feedback_assets 查询已验证且未过期的反馈规则
        db
          .select()
          .from(feedbackAssets)
          .where(
            and(
              eq(feedbackAssets.isValidated, true),
              or(
                isNull(feedbackAssets.validityExpiresAt),
                gte(feedbackAssets.validityExpiresAt, new Date())
              )
            )
          )
          .limit(10),
      ]);

      // 3. 合并映射
      const mappedFromStyles = styleRows.flatMap(mapStyleAssetToUserExclusiveRule);
      const mappedFromFeedbacks = feedbackRows
        .map(mapFeedbackToUserExclusiveRule)
        .filter((r): r is UserExclusiveRule => r !== null);

      // 4. 合并去重（按 ruleType+ruleContent 组合键去重，保留优先级更高的）
      const seenKeys = new Set<string>();
      const merged: UserExclusiveRule[] = [];

      for (const rule of [...mappedFromStyles, ...mappedFromFeedbacks]) {
        // 使用组合键：ruleType + 内容，避免相同内容不同类型时丢失
        const dedupKey = `${rule.ruleType}|${rule.ruleContent}`;
        if (!seenKeys.has(dedupKey)) {
          seenKeys.add(dedupKey);
          merged.push(rule);
        }
      }

      // 5. 按优先级排序，截断至 20 条
      return merged.sort((a, b) => a.priority - b.priority).slice(0, 20);
    } catch (error) {
      console.error('[DigitalAssetService] 获取用户专属规则失败:', error);
      // 表不存在时降级为空数组（兼容 Phase 3 未执行迁移的情况）
      return [];
    }
  }

  /**
   * 获取风格复刻规则（需求文档 3.3.1 风格资产）
   *
   * 🔥 优化后的选择逻辑：
   * 1. 按规则类型分组
   * 2. 每组内按 confidence × (1/priority) 综合评分排序
   * 3. 每组取 Top N，保证各维度覆盖均衡
   *
   * 🔥 Phase 5.5 更新：支持按模板ID查询
   */
  async getStyleRules(workspaceId?: string, templateId?: string): Promise<StyleRule[]> {
    try {
      // 🔥 各规则类型的建议取值数量（保证维度均衡）
      const TYPE_LIMITS: Record<string, number> = {
        emotion: 2,              // 整体调性
        core_stance: 2,          // 核心立场
        vocabulary: 5,           // 词汇表达（高频词等）
        logic: 3,                // 逻辑合规
        structure_supplement: 3, // 结构排版
        forbidden_supplement: 3, // 禁用词补充
      };

      // 🔥 Step 1: 查询所有激活的规则（支持按模板筛选）
      const whereConditions = [
        eq(styleAssets.isActive, true),
        workspaceId ? eq(styleAssets.workspaceId, workspaceId) : undefined,
        templateId ? eq(styleAssets.templateId, templateId) : undefined,
      ].filter((c): c is NonNullable<typeof c> => c !== undefined);

      const rows = await db
        .select()
        .from(styleAssets)
        .where(and(...whereConditions));

      if (rows.length === 0) {
        return [];
      }

      // 🔥 Step 2: 按规则类型分组
      const groupedByType = new Map<string, typeof rows>();
      for (const row of rows) {
        const ruleType = row.ruleType || 'unknown';
        if (!groupedByType.has(ruleType)) {
          groupedByType.set(ruleType, []);
        }
        groupedByType.get(ruleType)!.push(row);
      }

      // 🔥 Step 3: 每组内按综合评分排序，取 Top N
      const selectedRules: StyleRule[] = [];

      for (const [ruleType, typeRows] of groupedByType) {
        const limit = TYPE_LIMITS[ruleType] || 3; // 默认每类型取 3 条

        // 计算综合评分：confidence × (1/priority)
        // priority 越小优先级越高，confidence 越大置信度越高
        const scoredRows = typeRows.map(row => {
          const confidence = Number(row.confidence) || 0.5;
          const priority = Number(row.priority) || 2;
          const score = confidence * (1 / priority);
          return { row, score };
        });

        // 按评分降序排序
        scoredRows.sort((a, b) => b.score - a.score);

        // 取 Top N
        const topRows = scoredRows.slice(0, limit);

        for (const { row } of topRows) {
          selectedRules.push({
            id: row.id,
            ruleType: row.ruleType as StyleRule['ruleType'],
            ruleContent: row.ruleContent,
            sampleExtract: row.sampleExtract ?? undefined,
            confidence: Number(row.confidence),
            isActive: row.isActive,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          });
        }
      }

      console.log(`[DigitalAssetService] 选择风格规则: 总计 ${rows.length} 条 → 筛选后 ${selectedRules.length} 条${templateId ? ` (模板: ${templateId})` : ''}`);

      return selectedRules;
    } catch (error) {
      console.error('[DigitalAssetService] 获取风格规则失败:', error);
      return [];
    }
  }

  /**
   * 获取样本文章列表
   *
   * ⏳ Phase 4 待实现：
   * 需要 sample_articles 表（存储标杆文章全文）。
   * 当前阶段该表尚未创建，返回空数组。
   */
  async getSampleArticles(_limit = 10): Promise<SampleArticle[]> {
    // Phase 4 TODO: 从 sample_articles 表读取标杆样本文章
    // 需要新建 sample_articles 表，包含：title/content/source/wordCount/isAnalyzed/analysisResult
    return [];
  }

  /**
   * 获取素材库中的可用素材（支持关键词搜索）
   *
   * 使用现有 material_library 表，已对接真实数据库。
   */
  async getMaterials(
    keyword?: string,
    materialType?: string,
    limit = 20,
    workspaceId?: string
  ): Promise<{
    id: string;
    title: string;
    content: string;
    type: string;
    topicTags: string[];
    sceneTags: string[];
    emotionTags: string[];
    useCount: number;
    status: string;
    createdAt: Date;
  }[]> {
    try {
      // 可见性条件：指定workspace时，用户workspace OR 系统预置
      const visibilityCondition = workspaceId
        ? or(
            eq(materialLibrary.workspaceId, workspaceId),
            eq(materialLibrary.workspaceId, SYSTEM_WORKSPACE_ID)
          )
        : undefined;

      let whereCondition;

      if (keyword && materialType) {
        whereCondition = and(
          eq(materialLibrary.status, 'active'),
          or(
            like(materialLibrary.title, `%${keyword}%`),
            like(materialLibrary.content, `%${keyword}%`)
          ),
          eq(materialLibrary.type, materialType),
          visibilityCondition,
        );
      } else if (keyword) {
        whereCondition = and(
          eq(materialLibrary.status, 'active'),
          or(
            like(materialLibrary.title, `%${keyword}%`),
            like(materialLibrary.content, `%${keyword}%`)
          ),
          visibilityCondition,
        );
      } else if (materialType) {
        whereCondition = and(
          eq(materialLibrary.status, 'active'),
          eq(materialLibrary.type, materialType),
          visibilityCondition,
        );
      } else {
        whereCondition = and(
          eq(materialLibrary.status, 'active'),
          visibilityCondition,
        );
      }

      const results = await db
        .select()
        .from(materialLibrary)
        .where(whereCondition)
        .orderBy(desc(materialLibrary.useCount))
        .limit(limit);

      return results.map((item) => ({
        id: item.id,
        title: item.title,
        content: item.content,
        type: item.type,
        topicTags: item.topicTags ?? [],
        sceneTags: item.sceneTags ?? [],
        emotionTags: item.emotionTags ?? [],
        useCount: item.useCount,
        status: item.status,
        createdAt: item.createdAt,
      }));
    } catch (error) {
      console.error('[DigitalAssetService] 获取素材失败:', error);
      return [];
    }
  }

  /**
   * 获取数字资产集合（用于提示词拼接）
   * 🔥 Phase 5.5 更新：支持按模板ID筛选风格规则
   */
  async getDigitalAssetsForPrompt(workspaceId?: string, templateId?: string): Promise<{
    userExclusiveRules: UserExclusiveRule[];
    styleRules: StyleRule[];
    sampleArticles: SampleArticle[];
    availableMaterials: Awaited<ReturnType<typeof this.getMaterials>>;
  }> {
    const [userExclusiveRules, styleRules, sampleArticles, availableMaterials] =
      await Promise.all([
        this.getUserExclusiveRules(workspaceId),
        this.getStyleRules(workspaceId, templateId), // 🔥 传递 templateId
        this.getSampleArticles(),
        this.getMaterials(undefined, undefined, 20, workspaceId),
      ]);

    return {
      userExclusiveRules,
      styleRules,
      sampleArticles,
      availableMaterials,
    };
  }

  // ================================================================
  // Phase 3 新增：风格规则 CRUD 操作
  // ================================================================

  /**
   * 创建风格规则（手工录入或自动分析）
   * 🔥 Phase 5.5 更新：支持绑定到模板
   */
  async createStyleRule(data: {
    ruleType: StyleAsset['ruleType'];
    ruleContent: string;
    ruleCategory: 'positive' | 'negative';
    sampleExtract?: string;
    confidence?: number;
    priority?: number;
    workspaceId?: string;
    templateId?: string; // 🔥 新增：绑定到模板
  }): Promise<StyleAsset> {
    const effectiveWorkspaceId = data.workspaceId;
    const insertData: NewStyleAsset = {
      ruleType: data.ruleType,
      ruleContent: data.ruleContent,
      ruleCategory: data.ruleCategory,
      sampleExtract: data.sampleExtract ?? null,
      confidence: String(data.confidence ?? 0.50),
      priority: data.priority ?? 2,
      sourceType: 'manual',
      isActive: true,
      validityExpiresAt: null,
      workspaceId: effectiveWorkspaceId ?? null,
      templateId: data.templateId ?? null, // 🔥 新增
    };

    const result = await db.insert(styleAssets).values(insertData).returning();
    return result[0];
  }

  /**
   * 更新风格规则
   */
  async updateStyleRule(
    id: string,
    data: Partial<Pick<NewStyleAsset, 'ruleType' | 'ruleContent' | 'ruleCategory' | 'sampleExtract' | 'confidence' | 'priority' | 'isActive'>>
  ): Promise<StyleAsset | null> {
    const result = await db
      .update(styleAssets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(styleAssets.id, id))
      .returning();

    return result.length > 0 ? result[0] : null;
  }

  /**
   * 删除风格规则（软删除：设 isActive=false）
   */
  async deleteStyleRule(id: string): Promise<boolean> {
    const result = await db
      .update(styleAssets)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(styleAssets.id, id))
      .returning();

    return result.length > 0;
  }

  /**
   * 获取风格规则列表（支持筛选和分页，用于管理页面）
   */
  async listStyleRules(options: {
    workspaceId?: string;
    templateId?: string;
    ruleType?: StyleAsset['ruleType'];
    ruleCategory?: 'positive' | 'negative';
    isActive?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: StyleAsset[]; total: number }> {
    const {
      workspaceId,
      templateId,
      ruleType,
      ruleCategory,
      isActive,
      page = 1,
      pageSize = 20,
    } = options;

    const conditions = [
      workspaceId ? eq(styleAssets.workspaceId, workspaceId) : undefined,
      templateId ? eq(styleAssets.templateId, templateId) : undefined,
      ruleType ? eq(styleAssets.ruleType, ruleType) : undefined,
      ruleCategory ? eq(styleAssets.ruleCategory, ruleCategory) : undefined,
      isActive !== undefined ? eq(styleAssets.isActive, isActive) : undefined,
    ].filter((c): c is NonNullable<typeof c> => c !== undefined);

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 并行查询总数和数据
    const [countResult, items] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(styleAssets).where(whereClause),
      db
        .select()
        .from(styleAssets)
        .where(whereClause)
        .orderBy(desc(styleAssets.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    return {
      items,
      total: Number(countResult[0]?.count ?? 0),
    };
  }

  // ================================================================
  // Phase 3 新增：核心锚点资产操作
  // ================================================================

  /**
   * 归档核心锚点（insurance-d 执行完成后自动调用）
   */
  async archiveCoreAnchor(data: {
    sourceTaskId: string;
    anchorType: CoreAnchorAsset['anchorType'];
    rawContent: string;
    workspaceId?: string;
  }): Promise<CoreAnchorAsset> {
    const insertData: NewCoreAnchorAsset = {
      sourceTaskId: data.sourceTaskId,
      anchorType: data.anchorType,
      rawContent: data.rawContent,
      extractedKeywords: [],
      usageCount: 0,
      isEffective: true,
      workspaceId: data.workspaceId ?? null,
    };

    const result = await db.insert(coreAnchorAssets).values(insertData).returning();
    return result[0];
  }

  /**
   * 获取核心锚点历史记录
   */
  async listCoreAnchors(options: {
    workspaceId?: string;
    anchorType?: CoreAnchorAsset['anchorType'];
    limit?: number;
  }): Promise<CoreAnchorAsset[]> {
    const { workspaceId, anchorType, limit = 50 } = options;

    const conditions = [
      workspaceId ? eq(coreAnchorAssets.workspaceId, workspaceId) : undefined,
      anchorType ? eq(coreAnchorAssets.anchorType, anchorType) : undefined,
    ].filter((c): c is NonNullable<typeof c> => c !== undefined);

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    return db
      .select()
      .from(coreAnchorAssets)
      .where(whereClause)
      .orderBy(desc(coreAnchorAssets.createdAt))
      .limit(limit);
  }

  // ================================================================
  // Phase 3 新增：反馈资产操作
  // ================================================================

  /**
   * 记录用户反馈
   */
  async recordFeedback(data: {
    sourceArticleId: string;
    feedbackType: FeedbackAsset['feedbackType'];
    feedbackRaw: string;
    extractedRuleType?: string;
    extractedRuleContent?: string;
  }): Promise<FeedbackAsset> {
    const result = await db
      .insert(feedbackAssets)
      .values({
        sourceArticleId: data.sourceArticleId,
        feedbackType: data.feedbackType,
        feedbackRaw: data.feedbackRaw,
        extractedRuleType: data.extractedRuleType ?? null,
        extractedRuleContent: data.extractedRuleContent ?? null,
        isValidated: false,
        validityExpiresAt: null,
      })
      .returning();

    return result[0];
  }

  /**
   * 审核反馈（通过后将转化为可用的风格规则候选）
   */
  async validateFeedback(
    id: string,
    isValidated: boolean,
    options?: { extractedRuleType?: string; extractedRuleContent?: string }
  ): Promise<FeedbackAsset | null> {
    const updateData: Partial<Record<string, unknown>> = {
      isValidated,
      validityExpiresAt: isValidated
        ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 审核通过后90天有效
        : null,
    };

    if (options?.extractedRuleType) {
      updateData.extractedRuleType = options.extractedRuleType;
    }
    if (options?.extractedRuleContent) {
      updateData.extractedRuleContent = options.extractedRuleContent;
    }

    const result = await db
      .update(feedbackAssets)
      .set(updateData)
      .where(eq(feedbackAssets.id, id))
      .returning();

    return result.length > 0 ? result[0] : null;
  }

  // ================================================================
  // 素材使用记录（已有功能，保持不变）
  // ================================================================

  /**
   * 记录素材使用（用于素材推荐和使用频率统计）
   */
  async recordMaterialUsage(
    materialId: string,
    options: {
      articleId?: string;
      articleTitle?: string;
      usedPosition?: string;
      effectType?: string;
    }
  ): Promise<void> {
    try {
      await db.insert(materialUsageLog).values({
        id: crypto.randomUUID(),
        materialId,
        articleId: options.articleId ?? null,
        position: options.usedPosition ?? null,
        effectiveness: options.effectType ?? null,
      });

      await db
        .update(materialLibrary)
        .set({
          useCount: sql`${materialLibrary.useCount} + 1`,
          lastUsedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(materialLibrary.id, materialId));
    } catch (error) {
      console.error('[DigitalAssetService] 记录素材使用失败:', error);
    }
  }
}

// 导出单例实例
export const digitalAssetService = new DigitalAssetService();

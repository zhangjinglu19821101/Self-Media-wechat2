/**
 * 文章全维度提取体系 - 数据库 Schema
 * 
 * 5层21维提取结果存储，将文章从"不可复用的单篇内容"
 * 拆解为可标准化提取、可无限复用的数字资产。
 * 
 * 设计原则：
 * - article_extractions: 一篇文章一次提取的主记录
 * - extraction_layers: 5个层级的提取结果（每层一条记录）
 * - extraction_assets: 从提取结果转化的可复用数字资产
 */
import { pgTable, uuid, text, timestamp, jsonb, integer, boolean, varchar, index } from 'drizzle-orm/pg-core';

// ==================== 类型常量 ====================

/** 5大层级 */
export const EXTRACTION_LAYERS = [
  'meta_info',        // 第一层：文章元信息层
  'core_logic',       // 第二层：核心逻辑层
  'content_module',   // 第三层：内容模块层
  'language_style',   // 第四层：语言风格层
  'atomic_material',  // 第五层：原子素材单元层
] as const;

export type ExtractionLayer = typeof EXTRACTION_LAYERS[number];

/** 第一层：文章类型 */
export const ARTICLE_TYPES = [
  'customer_misconception',  // 客户误区型
  'event_driven',            // 事件驱动型
  'industry_insight',        // 行业新认知型
] as const;

export type ArticleType = typeof ARTICLE_TYPES[number];

/** 第一层：情感基调 */
export const EMOTION_TONES = [
  'empathetic_breakthrough',  // 共情式破局
  'rational_objective',       // 理性客观
  'pitfall_warning',          // 踩坑警醒
  'professional_authority',   // 专业权威
] as const;

export type EmotionTone = typeof EMOTION_TONES[number];

/** 第一层：发布平台 */
export const PUBLISH_PLATFORMS = [
  'wechat_official',  // 公众号
  'xiaohongshu',      // 小红书
  'douyin',           // 抖音
  'moments',          // 朋友圈
] as const;

/** 资产类型（21个维度的资产转化） */
export const ASSET_TYPES = [
  // 第一层（7个）
  'title_material',           // 爆款标题素材
  'article_structure_template', // 文章结构模板
  'topic_tag',                // 主题标签
  'user_persona',             // 用户画像
  'style_rule',               // 风格规则
  'platform_adaptation_rule', // 多平台适配规则
  'timeline_event',           // 热点时间轴事件
  // 第二层（5个）
  'core_argument',            // 核心论点
  'logic_misalignment_model', // 逻辑错位模型
  'argumentation_structure',  // 标准论证结构
  'value_proposition',        // 价值主张
  'conversion_script',        // 转化话术
  // 第三层（6个）
  'hook_material',            // 钩子素材
  'emotion_acceptance_phrase', // 情绪接纳句式
  'breakthrough_phrase',      // 破局句式
  'explanation_template',     // 解释模板
  'value_reconstruction_phrase', // 价值重构句式
  'closing_golden_phrase',    // 收尾金句
  // 第四层（5个）
  'personal_sentence_pattern', // 个人句式
  'tone_feature',             // 风格特征
  'catchphrase',              // 口头禅
  'taboo_vocabulary',         // 合规禁忌
  'layout_rule',              // 排版规则
  // 第五层（4+个）
  'misconception_material',   // 误区素材
  'analogy_material',         // 类比素材
  'case_material',            // 案例素材
  'data_material',            // 数据素材
] as const;

export type AssetType = typeof ASSET_TYPES[number];

// ==================== 主表：文章提取记录 ====================

export const articleExtractions = pgTable('article_extractions', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').notNull(),
  articleTitle: text('article_title').notNull(),
  articleText: text('article_text').notNull(),
  articleHash: varchar('article_hash', { length: 64 }), // SHA-256 去重
  
  // 5层提取结果（JSONB 快照，与 extraction_layers 表冗余存储便于快速读取）
  layer1Data: jsonb('layer1_data').$type<Record<string, any>>(),
  layer2Data: jsonb('layer2_data').$type<Record<string, any>>(),
  layer3Data: jsonb('layer3_data').$type<Record<string, any>>(),
  layer4Data: jsonb('layer4_data').$type<Record<string, any>>(),
  layer5Data: jsonb('layer5_data').$type<Record<string, any>>(),
  
  // 提取摘要与评估
  extractionSummary: text('extraction_summary'),
  assetValueScore: integer('asset_value_score').default(0),
  reusableDimensionCount: integer('reusable_dimension_count').default(0),
  
  // 元信息层快捷字段（高频查询）
  articleType: varchar('article_type', { length: 50 }),
  coreTheme: text('core_theme'),
  emotionTone: varchar('emotion_tone', { length: 50 }),
  targetAudience: text('target_audience'),
  publishPlatform: varchar('publish_platform', { length: 50 }),
  
  // 关联模板
  templateId: uuid('template_id'),
  
  // 统计
  totalAssetsCreated: integer('total_assets_created').default(0),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_article_extractions_workspace').on(table.workspaceId),
  index('idx_article_extractions_hash').on(table.articleHash),
  index('idx_article_extractions_template').on(table.templateId),
]);

// ==================== 层级提取结果 ====================

export const extractionLayers = pgTable('extraction_layers', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').notNull(),
  extractionId: uuid('extraction_id').notNull().references(() => articleExtractions.id),
  
  layerName: varchar('layer_name', { length: 50 }).notNull(), // EXTRACTION_LAYERS 之一
  layerIndex: integer('layer_index').notNull(), // 1-5
  
  // 该层的完整提取结果（JSONB，结构随层级不同而不同）
  extractionData: jsonb('extraction_data').notNull().$type<Record<string, any>>(),
  
  // 提取质量评估
  confidence: integer('confidence'), // 0-100
  extractionNotes: text('extraction_notes'), // AI 自评备注
  
  assetsCreated: integer('assets_created').default(0),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_extraction_layers_extraction').on(table.extractionId),
  index('idx_extraction_layers_workspace').on(table.workspaceId),
  index('idx_extraction_layers_name').on(table.layerName),
]);

// ==================== 提取转化的数字资产 ====================

export const extractionAssets = pgTable('extraction_assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').notNull(),
  extractionId: uuid('extraction_id').notNull().references(() => articleExtractions.id),
  layerId: uuid('layer_id').references(() => extractionLayers.id),
  
  // 资产归属维度
  layerName: varchar('layer_name', { length: 50 }).notNull(),
  dimensionName: varchar('dimension_name', { length: 100 }).notNull(), // 如 "钩子引入"、"错误认知"
  assetType: varchar('asset_type', { length: 50 }).notNull(), // ASSET_TYPES 之一
  
  // 资产内容
  assetName: varchar('asset_name', { length: 200 }).notNull(), // 资产名称
  assetContent: text('asset_content').notNull(), // 核心内容
  assetMetadata: jsonb('asset_metadata').$type<Record<string, any>>(), // 扩展元数据
  
  // 关联信息
  templateId: uuid('template_id'), // 绑定的风格模板
  sourceArticleTitle: text('source_article_title'), // 来源文章标题
  
  // 复用统计
  reuseCount: integer('reuse_count').default(0),
  lastUsedAt: timestamp('last_used_at'),
  
  // 状态
  isActive: boolean('is_active').default(true),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_extraction_assets_workspace').on(table.workspaceId),
  index('idx_extraction_assets_extraction').on(table.extractionId),
  index('idx_extraction_assets_type').on(table.assetType),
  index('idx_extraction_assets_layer').on(table.layerName),
  index('idx_extraction_assets_template').on(table.templateId),
  index('idx_extraction_assets_active').on(table.isActive),
]);

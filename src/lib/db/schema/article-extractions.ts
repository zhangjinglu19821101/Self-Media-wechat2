/**
 * 文章提取 Schema v2 — 范式识别 + 关系型素材提取
 * 
 * 核心升级：
 * - 从5层21维全量拆解 → 两步拆解法（范式识别 + 7维关系型素材）
 * - 新增 paradigm 字段：范式识别结果
 * - 新增 relationalMaterials 字段：7维关系型素材
 * - 新增 emotionCurve / paragraphRhythm：情绪曲线和段落节奏
 * - 保留 layer1Data~layer5Data 做向后兼容
 */
import { pgTable, uuid, text, timestamp, jsonb, integer, boolean, varchar, index } from 'drizzle-orm/pg-core';

// ==================== 范式识别常量（v2） ====================

/** 10套标准范式 */
export const PARADIGM_TYPES = [
  'standard_misalignment_breakthrough',  // 标准错位破局范式
  'industry_reflection',                 // 行业反思范式
  'case_reductio_ad_absurdum',           // 案例归谬范式
  'essential_definition',                // 本质定义范式
  'hot_event_analysis',                  // 热点事件范式
  'product_interpretation',              // 产品解读范式
  'personal_experience',                 // 个人经历范式
  'pitfall_guide',                       // 避坑指南范式
  'comparative_analysis',                // 对比分析范式
  'annual_summary',                      // 年终总结范式
] as const;

export type ParadigmType = typeof PARADIGM_TYPES[number];

/** 范式中文名映射 */
export const PARADIGM_LABELS: Record<ParadigmType, string> = {
  standard_misalignment_breakthrough: '标准错位破局',
  industry_reflection: '行业反思',
  case_reductio_ad_absurdum: '案例归谬',
  essential_definition: '本质定义',
  hot_event_analysis: '热点事件',
  product_interpretation: '产品解读',
  personal_experience: '个人经历',
  pitfall_guide: '避坑指南',
  comparative_analysis: '对比分析',
  annual_summary: '年终总结',
};

/** 范式描述映射 */
export const PARADIGM_DESCRIPTIONS: Record<ParadigmType, string> = {
  standard_misalignment_breakthrough: '先抛出错误认知→共情接纳→点破标准错位→通俗类比→真实案例→反问→价值重构→金句收尾',
  industry_reflection: '引出行业问题→承认行业不足→区分工具与人→分析问题根源→提出改进方向→收尾升华',
  case_reductio_ad_absurdum: '抛出错误观点→讲述反面案例→用案例归谬错误观点→给出正确结论→收尾',
  essential_definition: '抛出常见错误定义→拆解错误定义的问题→给出正确的本质定义→用类比解释→案例佐证→收尾',
  hot_event_analysis: '引出热点事件→分析事件中的保险相关问题→给出正确的应对方式→延伸到普遍情况→收尾',
  product_interpretation: '介绍产品基本信息→分析产品优势→分析产品不足→适合人群→不适合人群→购买建议',
  personal_experience: '讲述自己的亲身经历→从经历中得到的感悟→延伸到保险的价值→收尾升华',
  pitfall_guide: '引出某类保险的常见问题→逐条讲解每个坑的表现和危害→给出避坑方法→收尾',
  comparative_analysis: '介绍两种不同的选择→分别分析各自的优缺点→给出不同情况下的选择建议→收尾',
  annual_summary: '回顾过去一年的行业变化→总结自己的感悟→对未来的展望→给读者的建议→收尾',
};

/** 7维关系型素材类型 */
export const RELATIONAL_MATERIAL_TYPES = [
  'misconception',    // 错误认知
  'analogy',          // 类比
  'case',             // 真实案例
  'data',             // 权威数据
  'golden_sentence',  // 金句
  'hook',             // 钩子引入
  'closing',          // 收尾升华
] as const;

export type RelationalMaterialType = typeof RELATIONAL_MATERIAL_TYPES[number];

/** 关系型素材中文名映射 */
export const MATERIAL_TYPE_LABELS: Record<RelationalMaterialType, string> = {
  misconception: '错误认知',
  analogy: '类比',
  case: '真实案例',
  data: '权威数据',
  golden_sentence: '金句',
  hook: '钩子引入',
  closing: '收尾升华',
};

/** 范式匹配5维度权重 */
export const PARADIGM_MATCH_WEIGHTS = {
  structureOrder: 0.40,      // 文章结构顺序
  fixedTransitions: 0.30,    // 固定衔接句式
  emotionCurve: 0.15,        // 情绪节奏曲线
  paragraphRhythm: 0.10,     // 段落换行规则
  articleType: 0.05,         // 文章类型
} as const;

// ==================== 类型常量（向后兼容） ====================

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
  
  // v2: 范式识别结果（两步拆解法第一步）
  paradigmName: varchar('paradigm_name', { length: 80 }), // 匹配到的范式名称
  paradigmType: varchar('paradigm_type', { length: 50 }), // PARADIGM_TYPES 枚举值
  paradigmMatchScore: integer('paradigm_match_score'),     // 匹配度 0-100
  paradigmDiffNote: text('paradigm_diff_note'),            // 结构差异说明
  
  // v2: 关系型素材（两步拆解法第二步，7维）
  relationalMaterials: jsonb('relational_materials').$type<Record<string, any>>(),
  
  // v2: 写作特征（怎么写的）
  emotionCurve: jsonb('emotion_curve').$type<Array<{ position: number; emotion: string; intensity: number }>>(),
  paragraphRhythm: jsonb('paragraph_rhythm').$type<Array<{ position: number; length: number; type: string }>>(),
  fixedTransitions: jsonb('fixed_transitions').$type<string[]>(), // 固定衔接句式
  sentencePatterns: jsonb('sentence_patterns').$type<string[]>(), // 标志性句式
  
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

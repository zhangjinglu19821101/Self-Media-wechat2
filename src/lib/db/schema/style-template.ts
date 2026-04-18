/**
 * 风格模板 + 平台账号 Schema
 * 
 * 设计理念：
 * 1. 风格模板（style_templates）- 一组风格规则的集合，属于作者
 * 2. 风格规则（style_assets）- 具体的写作习惯，绑定到模板
 * 3. 平台账号（platform_accounts）- 各平台的账号信息
 * 4. 账号配置（account_style_configs）- 账号与风格模板的绑定关系
 */

import { pgTable, text, boolean, timestamp, jsonb, integer, numeric, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ==================== 平台专属配置类型 ====================

/** 小红书平台专属配置 */
export interface XiaohongshuPlatformConfig {
  /** 封面图风格 */
  coverStyle?: 'warm' | 'cool' | 'neutral' | 'vibrant';
  /** 卡片数量模式 */
  cardCountMode?: '3-card' | '5-card' | '7-card';
  /** 图文分工规则 */
  imageTextDivision?: {
    imageOnly: string[];  // 图片放什么内容
    textOnly: string[];   // 正文放什么内容
  };
  /** emoji 密度 */
  emojiDensity?: 'low' | 'medium' | 'high';
  /** 默认标签 */
  defaultTags?: string[];
}

/** 微信公众号专属配置 */
export interface WechatOfficialPlatformConfig {
  /** 段落风格 */
  paragraphStyle?: 'short' | 'medium' | 'long';
  /** 开头引导语模板 */
  headerTemplate?: string;
  /** 结尾引导语模板 */
  footerTemplate?: string;
  /** 标题风格 */
  titleStyle?: 'professional' | 'emotional' | 'curiosity';
}

/** 知乎专属配置 */
export interface ZhihuPlatformConfig {
  /** 回答/文章模式 */
  contentType?: 'answer' | 'article';
  /** 引用风格 */
  citationStyle?: 'inline' | 'footnote' | 'none';
  /** 专业度偏好 */
  professionalismLevel?: 'accessible' | 'moderate' | 'academic';
}

/** 抖音专属配置 */
export interface DouyinPlatformConfig {
  /** 视频文案风格 */
  scriptStyle?: 'storytelling' | 'knowledge' | 'emotional';
  /** 开场白模板 */
  openingTemplate?: string;
  /** 默认话题标签 */
  defaultTags?: string[];
}

/** 微博专属配置 */
export interface WeiboPlatformConfig {
  /** 文字长度偏好 */
  lengthPreference?: 'short' | 'medium' | 'long';
  /** 话题标签策略 */
  hashtagStrategy?: 'none' | 'single' | 'multiple';
  /** 默认话题 */
  defaultHashtags?: string[];
}

/** 平台专属配置联合类型（按 platform 字段分发） */
export type PlatformConfigMap = {
  xiaohongshu: XiaohongshuPlatformConfig;
  wechat_official: WechatOfficialPlatformConfig;
  zhihu: ZhihuPlatformConfig;
  douyin: DouyinPlatformConfig;
  weibo: WeiboPlatformConfig;
};

/** 平台专属配置（JSONB 存储的整体类型） */
export type PlatformConfig = Partial<PlatformConfigMap>;

/** 获取特定平台的配置类型 */
export type PlatformConfigFor<P extends PlatformType> = PlatformConfigMap[P];

/**
 * 获取平台配置的字段描述（用于前端渲染表单）
 */
export const PLATFORM_CONFIG_FIELDS: Record<PlatformType, Array<{
  key: string;
  label: string;
  type: 'select' | 'text' | 'tags' | 'textarea';
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  description?: string;
}>> = {
  xiaohongshu: [
    {
      key: 'coverStyle',
      label: '封面图风格',
      type: 'select',
      options: [
        { value: 'warm', label: '暖色渐变' },
        { value: 'cool', label: '冷色简约' },
        { value: 'neutral', label: '中性百搭' },
        { value: 'vibrant', label: '高饱和撞色' },
      ],
      description: '笔记封面图的视觉风格',
    },
    {
      key: 'cardCountMode',
      label: '卡片数量',
      type: 'select',
      options: [
        { value: '3-card', label: '3张极简' },
        { value: '5-card', label: '5张标准' },
        { value: '7-card', label: '7张详细' },
      ],
      description: '笔记配图的数量模式',
    },
    {
      key: 'emojiDensity',
      label: 'emoji密度',
      type: 'select',
      options: [
        { value: 'low', label: '低（≤5%）' },
        { value: 'medium', label: '中（5-15%）' },
        { value: 'high', label: '高（>15%）' },
      ],
      description: '正文中 emoji 的使用频率',
    },
    {
      key: 'defaultTags',
      label: '默认标签',
      type: 'tags',
      placeholder: '如：保险避坑、港险攻略',
      description: '笔记发布时自动添加的标签',
    },
  ],
  wechat_official: [
    {
      key: 'paragraphStyle',
      label: '段落风格',
      type: 'select',
      options: [
        { value: 'short', label: '短段落（≤30字）' },
        { value: 'medium', label: '中段落（30-80字）' },
        { value: 'long', label: '长段落（80字+）' },
      ],
      description: '正文的段落长度偏好',
    },
    {
      key: 'titleStyle',
      label: '标题风格',
      type: 'select',
      options: [
        { value: 'professional', label: '专业权威' },
        { value: 'emotional', label: '情感共鸣' },
        { value: 'curiosity', label: '悬念好奇' },
      ],
      description: '文章标题的创作风格',
    },
    {
      key: 'headerTemplate',
      label: '开头引导语',
      type: 'textarea',
      placeholder: '如：大家好，今天聊聊...',
      description: '文章开头的固定引导语模板',
    },
    {
      key: 'footerTemplate',
      label: '结尾引导语',
      type: 'textarea',
      placeholder: '如：关注我，了解更多...',
      description: '文章结尾的固定引导语模板',
    },
  ],
  zhihu: [
    {
      key: 'contentType',
      label: '内容类型',
      type: 'select',
      options: [
        { value: 'answer', label: '回答模式' },
        { value: 'article', label: '文章模式' },
      ],
      description: '知乎内容的展示形式',
    },
    {
      key: 'professionalismLevel',
      label: '专业度',
      type: 'select',
      options: [
        { value: 'accessible', label: '通俗易懂' },
        { value: 'moderate', label: '适度专业' },
        { value: 'academic', label: '学术深度' },
      ],
      description: '内容的专业程度偏好',
    },
    {
      key: 'citationStyle',
      label: '引用风格',
      type: 'select',
      options: [
        { value: 'inline', label: '行内引用' },
        { value: 'footnote', label: '脚注引用' },
        { value: 'none', label: '不引用' },
      ],
      description: '数据来源的引用方式',
    },
  ],
  douyin: [
    {
      key: 'scriptStyle',
      label: '文案风格',
      type: 'select',
      options: [
        { value: 'storytelling', label: '故事叙述' },
        { value: 'knowledge', label: '知识科普' },
        { value: 'emotional', label: '情感共鸣' },
      ],
      description: '视频文案的创作风格',
    },
    {
      key: 'openingTemplate',
      label: '开场白',
      type: 'textarea',
      placeholder: '如：你知道吗？90%的人都...',
      description: '视频开场的固定文案模板',
    },
    {
      key: 'defaultTags',
      label: '默认话题',
      type: 'tags',
      placeholder: '如：保险知识、避坑指南',
      description: '视频发布时自动添加的话题标签',
    },
  ],
  weibo: [
    {
      key: 'lengthPreference',
      label: '长度偏好',
      type: 'select',
      options: [
        { value: 'short', label: '短文（≤140字）' },
        { value: 'medium', label: '中篇（140-500字）' },
        { value: 'long', label: '长文（500字+）' },
      ],
      description: '微博内容的长度偏好',
    },
    {
      key: 'hashtagStrategy',
      label: '话题策略',
      type: 'select',
      options: [
        { value: 'none', label: '不添加' },
        { value: 'single', label: '单个话题' },
        { value: 'multiple', label: '多话题' },
      ],
      description: '微博话题标签的添加策略',
    },
    {
      key: 'defaultHashtags',
      label: '默认话题',
      type: 'tags',
      placeholder: '如：#保险# #理财#',
      description: '微博发布时自动添加的话题',
    },
  ],
};

// ==================== 平台类型定义 ====================

/** 支持的平台类型 */
export type PlatformType = 'wechat_official' | 'xiaohongshu' | 'zhihu' | 'douyin' | 'weibo';

/** 平台标签映射 */
export const PLATFORM_LABELS: Record<PlatformType, string> = {
  wechat_official: '微信公众号',
  xiaohongshu: '小红书',
  zhihu: '知乎',
  douyin: '抖音',
  weibo: '微博',
};

/** 平台选项列表（用于前端下拉） */
export const PLATFORM_OPTIONS: Array<{ value: PlatformType; label: string }> = [
  { value: 'wechat_official', label: '微信公众号' },
  { value: 'xiaohongshu', label: '小红书' },
  { value: 'zhihu', label: '知乎' },
  { value: 'douyin', label: '抖音' },
  { value: 'weibo', label: '微博' },
];

/** 有效的平台类型列表 */
export const VALID_PLATFORMS: PlatformType[] = ['wechat_official', 'xiaohongshu', 'zhihu', 'douyin', 'weibo'];

/** 默认平台 */
export const DEFAULT_PLATFORM: PlatformType = 'wechat_official';

/**
 * 校验平台类型是否有效
 * @param platform 平台类型字符串
 * @returns 是否为有效的平台类型
 */
export function isValidPlatform(platform: string): platform is PlatformType {
  return VALID_PLATFORMS.includes(platform as PlatformType);
}

/**
 * 获取有效的平台类型，如果无效则返回默认平台
 * @param platform 平台类型字符串
 * @returns 有效的平台类型
 */
export function getValidPlatform(platform: string | undefined | null): PlatformType {
  if (!platform || !isValidPlatform(platform)) {
    return DEFAULT_PLATFORM;
  }
  return platform;
}

// ==================== 风格模板表 ====================
export const styleTemplates = pgTable('style_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  // 工作空间归属（由 user_id 重命名而来）
  workspaceId: text('workspace_id').notNull(),
  
  // 模板基本信息
  name: text('name').notNull(), // 模板名称，如"专业严谨"、"轻松活泼"
  description: text('description'), // 模板描述
  
  // 🔥 平台维度（新增）
  platform: text('platform').notNull().default('wechat_official'), // 目标平台：wechat_official / xiaohongshu / zhihu 等
  
  // 模板元信息
  sourceArticles: jsonb('source_articles').$type<Array<{
    title: string;
    contentPreview: string;
    analyzedAt: string;
  }>>().default([]), // 分析来源的文章列表
  
  // 统计信息
  ruleCount: integer('rule_count').default(0), // 包含的规则数量
  articleCount: integer('article_count').default(0), // 分析的文章数量
  
  // 状态
  isDefault: boolean('is_default').default(false), // 是否为默认模板
  isActive: boolean('is_active').default(true),
  
  // 时间戳
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ==================== 平台账号表 ====================
export const platformAccounts = pgTable('platform_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  // 工作空间归属（由 user_id 重命名而来）
  workspaceId: text('workspace_id').notNull(),
  
  // 平台信息
  platform: text('platform').notNull(), // wechat_official / xiaohongshu / zhihu / douyin 等
  platformLabel: text('platform_label'), // 显示名称：公众号 / 小红书 / 知乎 / 抖音
  
  // 账号信息
  accountId: text('account_id'), // 平台账号ID（如有）
  accountName: text('account_name').notNull(), // 账号名称，如"保险科普小助手"
  accountDescription: text('account_description'), // 账号描述
  
  // 认证信息（可选，用于自动发布）
  authInfo: jsonb('auth_info').$type<{
    appId?: string;
    appSecret?: string;
    refreshToken?: string;
  }>(), // 平台认证信息（加密存储）
  
  // 🔥 平台专属配置（按平台动态解析）
  platformConfig: jsonb('platform_config').$type<PlatformConfig>(),
  
  // 状态
  isActive: boolean('is_active').default(true),
  
  // 时间戳
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ==================== 账号-模板绑定表 ====================
export const accountStyleConfigs = pgTable('account_style_configs', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  // 关联
  workspaceId: text('workspace_id').notNull(),
  accountId: uuid('account_id').notNull().references(() => platformAccounts.id, { onDelete: 'cascade' }),
  templateId: uuid('template_id').notNull().references(() => styleTemplates.id, { onDelete: 'cascade' }),
  
  // 优先级（同一账号可以绑定多个模板，按优先级排序）
  priority: integer('priority').default(1),
  
  // 状态
  isActive: boolean('is_active').default(true),
  
  // 时间戳
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ==================== 修改 style_assets 表（添加模板关联） ====================
// 注意：这个改动需要在现有表上添加字段
// ALTER TABLE style_assets ADD COLUMN template_id UUID REFERENCES style_templates(id);

// ==================== 关系定义 ====================
export const styleTemplatesRelations = relations(styleTemplates, ({ many }) => ({
  // 一个模板可被多个账号绑定
  accountConfigs: many(accountStyleConfigs),
}));

export const platformAccountsRelations = relations(platformAccounts, ({ many }) => ({
  // 一个账号可绑定多个模板
  styleConfigs: many(accountStyleConfigs),
}));

export const accountStyleConfigsRelations = relations(accountStyleConfigs, ({ one }) => ({
  // 绑定的账号
  account: one(platformAccounts, {
    fields: [accountStyleConfigs.accountId],
    references: [platformAccounts.id],
  }),
  // 绑定的模板
  template: one(styleTemplates, {
    fields: [accountStyleConfigs.templateId],
    references: [styleTemplates.id],
  }),
}));

// ==================== 类型导出 ====================
export type StyleTemplate = typeof styleTemplates.$inferSelect;
export type NewStyleTemplate = typeof styleTemplates.$inferInsert;
export type PlatformAccount = typeof platformAccounts.$inferSelect;
export type NewPlatformAccount = typeof platformAccounts.$inferInsert;
export type AccountStyleConfig = typeof accountStyleConfigs.$inferSelect;
export type NewAccountStyleConfig = typeof accountStyleConfigs.$inferInsert;

// 平台类型枚举
export const PLATFORM_TYPES = {
  WECHAT_OFFICIAL: 'wechat_official',
  XIAOHONGSHU: 'xiaohongshu',
  ZHIHU: 'zhihu',
  DOUYIN: 'douyin',
  OTHER: 'other',
} as const;

// 注意：PLATFORM_LABELS 已在文件顶部定义，此处不再重复

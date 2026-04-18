/**
 * 行业案例库 Schema 定义
 * 按行业分类存储标准化案例，支持AI写作时精准检索
 * 
 * 设计原则：
 * 1. 行业隔离：不同行业案例独立存储
 * 2. 结构化字段：便于AI精准匹配
 * 3. 标签系统：多维度检索（险种/人群/场景/情绪）
 * 4. 向量预留：支持后续语义检索升级
 */

import { pgTable, text, timestamp, jsonb, uuid, integer, numeric, index, boolean } from 'drizzle-orm/pg-core';

/**
 * 行业类型枚举
 */
export type IndustryType = 
  | 'insurance'     // 保险行业
  | 'education'     // 教育行业
  | 'healthcare'    // 医疗健康
  | 'finance'       // 金融理财
  | 'real_estate'   // 房地产
  | 'legal';        // 法律服务

/**
 * 案例类型枚举
 */
export type CaseType = 
  | 'positive'      // 正面案例（成功理赔、合理配置）
  | 'warning'       // 反面警示案例（无保障、保障不足）
  | 'milestone';    // 行业里程碑案例

/**
 * 行业案例库表
 */
export const industryCaseLibrary = pgTable('industry_case_library', {
  // === 主键 ===
  id: uuid('id').primaryKey().defaultRandom(),
  
  // === 行业分类 ===
  industry: text('industry').notNull(),              // 行业类型：insurance/education/healthcare等
  caseType: text('case_type').notNull().default('positive'),  // 案例类型：positive/warning/milestone
  
  // === 核心标识 ===
  caseId: text('case_id').notNull(),                 // 案例编号（如：案例001）
  title: text('title').notNull(),                    // 案例标题（如：普通上班族日常通勤意外理赔案例）
  
  // === 结构化内容 ===
  applicableProducts: jsonb('applicable_products').$type<string[]>().default([]),  // 适用产品/险种
  protagonist: text('protagonist'),                  // 人物/主体（如：刘敏，28岁，上海某互联网公司上班族）
  background: text('background').notNull(),          // 核心背景（风险场景描述）
  insuranceAction: text('insurance_action'),         // 保险动作（投保方案）
  result: text('result').notNull(),                  // 结果详情（理赔结果）
  
  // === 适用信息 ===
  applicableScenarios: jsonb('applicable_scenarios').$type<string[]>().default([]), // 适用场景标签
  
  // === 标签系统（多维度检索） ===
  productTags: jsonb('product_tags').$type<string[]>().default([]),     // 产品标签：意外险、重疾险、医疗险
  crowdTags: jsonb('crowd_tags').$type<string[]>().default([]),         // 人群标签：上班族、学生、老年人、企业主
  sceneTags: jsonb('scene_tags').$type<string[]>().default([]),         // 场景标签：通勤意外、校园意外、居家意外
  emotionTags: jsonb('emotion_tags').$type<string[]>().default([]),     // 情绪标签：踩坑、避坑、省钱、警惕、安心
  
  // === 合规信息 ===
  sourceDesc: text('source_desc'),                   // 来源描述（如：《都市快报》2023年7月专题报道）
  sourceUrl: text('source_url'),                     // 来源链接
  complianceNote: text('compliance_note'),           // 合规备注
  
  // === 向量ID（预留，后续升级用） ===
  vectorId: text('vector_id'),
  
  // === 使用统计 ===
  useCount: integer('use_count').notNull().default(0),
  lastUsedAt: timestamp('last_used_at'),
  
  // === 效果统计 ===
  effectiveCount: integer('effective_count').default(0),
  ineffectiveCount: integer('ineffective_count').default(0),
  
  // === 状态 ===
  status: text('status').notNull().default('active'),
  
  // === 工作空间归属 ===
  workspaceId: text('workspace_id'),
  
  // === 时间戳 ===
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  // 索引：支持快速查询
  industryIdx: index('idx_case_industry').on(table.industry),
  caseTypeIdx: index('idx_case_type').on(table.caseType),
  statusIdx: index('idx_case_status').on(table.status),
  workspaceIdIdx: index('idx_case_workspace_id').on(table.workspaceId),
  useCountIdx: index('idx_case_use_count').on(table.useCount),
  // GIN索引：支持JSONB数组查询
  productTagsIdx: index('idx_case_product_tags').using('gin', table.productTags),
  crowdTagsIdx: index('idx_case_crowd_tags').using('gin', table.crowdTags),
  sceneTagsIdx: index('idx_case_scene_tags').using('gin', table.sceneTags),
}));

/**
 * 案例使用记录表
 * 记录案例在哪些文章中使用过
 */
export const caseUsageLog = pgTable('case_usage_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  caseId: uuid('case_id').notNull().references(() => industryCaseLibrary.id, { onDelete: 'cascade' }),
  
  // === 使用信息 ===
  taskId: uuid('task_id'),                           // 关联的子任务ID
  articleTitle: text('article_title'),               // 文章标题
  articleSnippet: text('article_snippet'),           // 文章中使用案例的片段
  
  // === 效果反馈 ===
  isEffective: boolean('is_effective'),              // 是否有效（用户反馈）
  feedbackNote: text('feedback_note'),               // 反馈备注
  
  // === 时间戳 ===
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  caseIdIdx: index('idx_case_usage_case_id').on(table.caseId),
  taskIdIdx: index('idx_case_usage_task_id').on(table.taskId),
}));

/**
 * 类型导出
 */
export type IndustryCase = typeof industryCaseLibrary.$inferSelect;
export type NewIndustryCase = typeof industryCaseLibrary.$inferInsert;
export type CaseUsageLog = typeof caseUsageLog.$inferSelect;
export type NewCaseUsageLog = typeof caseUsageLog.$inferInsert;

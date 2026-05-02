/**
 * 信息速记 Schema 定义
 * 
 * 用户只需输入原始内容(rawContent)，其余字段由 LLM 自动填充：
 * - categories: 分类数组（并列多标签，无主次之分）
 * - title: 自动生成标题
 * - sourceOrg: 自动识别来源
 * - summary: 自动生成摘要
 * - keywords: 自动提取关键词
 * - complianceWarnings: 合规预警（保险类三维校验）
 * - applicableScenes: 适用场景标签
 * - materialStatus: 素材生命周期状态
 */

import { pgTable, text, timestamp, uuid, index, jsonb } from 'drizzle-orm/pg-core';

/**
 * 素材分类
 */
export type SnippetCategory = 'real_case' | 'insurance' | 'intelligence' | 'medical' | 'quick_note';

/**
 * 素材生命周期状态
 */
export type MaterialStatus = 'archived' | 'expired' | 'draft' | 'disabled';

/**
 * 信息速记表
 * 用户随时收集的零散行业信息，LLM 自动结构化处理
 */
export const infoSnippets = pgTable('info_snippets', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // 用户原始输入（完整保存，不做截断）
  rawContent: text('raw_content'),             // 用户输入的原始内容（完整保存）
  
  // LLM 自动填充字段
  categories: jsonb('categories').$type<string[]>().default([]), // 分类数组（并列多标签，无主次）
  title: text('title'),                        // 自动生成标题（15-30字摘要性标题）
  sourceOrg: text('source_org'),               // 自动识别来源机构
  publishDate: text('publish_date'),           // 发布时间
  url: text('url'),                            // 直达链接
  highlights: text('highlights'),              // 要点/亮点（历史字段，nullable）
  summary: text('summary'),                    // 自动生成摘要（15-30字核心内容摘要）
  keywords: text('keywords'),                  // 自动提取关键词（逗号分隔，3-6个）
  applicableScenes: text('applicable_scenes'), // 适用场景标签（逗号分隔）
  
  // 合规校验（仅保险类）
  complianceWarnings: jsonb('compliance_warnings'), // 合规预警 {source?, content?, timeliness?}
  complianceLevel: text('compliance_level'),        // A/B/C 级（A级=合规，B级=预警，C级=违规）
  
  // 素材生命周期
  materialStatus: text('material_status').default('draft'), // archived | expired | draft | disabled
  materialId: text('material_id'),                        // 唯一素材ID（格式：CAT-YYYYMMDD-NNN）

  // 案例关联（一对一：每个速记最多对应一个案例）
  caseId: uuid('case_id'),                              // 关联的行业案例ID
  
  // 提醒相关
  snippetType: text('snippet_type').default('memory'),     // memory(记忆) | reminder(提醒)
  remindAt: timestamp('remind_at'),                        // 提醒时间
  remindStatus: text('remind_status').default('pending'),  // pending | triggered | dismissed
  remindedAt: timestamp('reminded_at'),                    // 实际提醒时间
  
  // 元数据
  status: text('status').default('pending'),   // pending | organized
  userId: text('user_id'),
  workspaceId: text('workspace_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  // 索引
  statusIdx: index('idx_info_snippet_status').on(table.status),
  workspaceIdIdx: index('idx_info_snippets_workspace_id').on(table.workspaceId),
  createdAtIdx: index('idx_info_snippet_created_at').on(table.createdAt),
  snippetTypeIdx: index('idx_info_snippets_snippet_type').on(table.snippetType),
  materialStatusIdx: index('idx_info_snippets_material_status').on(table.materialStatus),
}));

/**
 * 分类标签映射
 */
export const CATEGORY_LABELS: Record<SnippetCategory, string> = {
  real_case: '身边真实案例',
  insurance: '保险',
  intelligence: '智能化',
  medical: '医疗',
  quick_note: '简要内容速记',
};

/**
 * 分类颜色映射
 */
export const CATEGORY_COLORS: Record<SnippetCategory, { bg: string; text: string; border: string }> = {
  real_case: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  insurance: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  intelligence: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  medical: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  quick_note: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
};

/**
 * 合规等级标签
 */
export const COMPLIANCE_LEVEL_LABELS: Record<string, { label: string; color: string }> = {
  A: { label: '合规', color: 'text-green-600' },
  B: { label: '预警', color: 'text-amber-600' },
  C: { label: '违规', color: 'text-red-600' },
};

/**
 * 素材状态标签
 */
export const MATERIAL_STATUS_LABELS: Record<MaterialStatus, string> = {
  archived: '已归档',
  expired: '已失效',
  draft: '草稿',
  disabled: '禁用',
};

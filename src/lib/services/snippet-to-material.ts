/**
 * 信息速记 → 素材库 转换工具
 * 
 * 统一的字段映射逻辑，供多个 API 共用：
 * - POST /api/info-snippets（保存时自动入库）
 * - POST /api/info-snippets/[id]/convert-to-material（单独转化）
 * - POST /api/info-snippets/batch-convert（批量转化）
 */

import { materialLibrary } from '@/lib/db/schema/material-library';
import { db } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { DrizzleError } from 'drizzle-orm';

// ================================================================
// 类型定义
// ================================================================

/** Drizzle 事务类型 */
export type DrizzleTx = PgTransaction<any, any, any>;

/** 有效的速记分类 */
export const VALID_CATEGORIES = ['real_case', 'insurance', 'medical', 'intelligence', 'quick_note'] as const;
export type SnippetCategory = typeof VALID_CATEGORIES[number];

/** 素材类型 */
export type MaterialType = 'case' | 'data' | 'story' | 'quote' | 'opening' | 'ending';

/** 速记数据（用于转化） */
export interface SnippetData {
  rawContent: string | null;
  title: string | null;
  sourceOrg: string | null;
  publishDate: string | null;
  url: string | null;
  summary: string | null;
  keywords: string | null;
  applicableScenes: string | null;
  complianceLevel: string | null;
  categories: unknown;
}

/** 转化结果 */
export interface ConversionResult {
  materialId: string;
  materialType: MaterialType;
  topicTags: string[];
  sceneTags: string[];
  emotionTags: string[];
}

// ================================================================
// 类型守卫
// ================================================================

/**
 * 校验 categories 是否为有效数组
 */
export function isValidCategories(value: unknown): value is SnippetCategory[] {
  if (!Array.isArray(value)) return false;
  return value.every(item => typeof item === 'string' && VALID_CATEGORIES.includes(item as SnippetCategory));
}

/**
 * 安全获取 categories 数组
 */
export function safeGetCategories(categories: unknown): SnippetCategory[] {
  if (isValidCategories(categories)) {
    return categories;
  }
  return ['quick_note'];
}

// ================================================================
// 字段映射函数
// ================================================================

/**
 * 速记分类 → 素材类型 映射
 * 
 * 信息速记的分类维度（领域）与素材库的类型维度（用途）不同：
 * - 速记分类：内容属于什么领域（保险/医疗/案例...）
 * - 素材类型：内容能怎么用（案例/数据/故事/引用...）
 */
export function inferMaterialType(categories: SnippetCategory[]): MaterialType {
  if (categories.includes('real_case')) return 'case';
  if (categories.includes('insurance')) return 'data';
  if (categories.includes('medical')) return 'data';
  if (categories.includes('intelligence')) return 'data';
  return 'data';
}

/**
 * 速记分类 → 素材标签 映射
 */
export function mapCategoriesToTags(
  categories: SnippetCategory[],
  complianceLevel: string | null,
  applicableScenes: string | null,
): { topicTags: string[]; sceneTags: string[]; emotionTags: string[] } {
  const topicMap: Record<string, string> = {
    insurance: '保险',
    medical: '医疗健康',
    intelligence: '智能化',
    real_case: '真实案例',
    quick_note: '速记',
  };

  // 主题标签 = 分类 → 领域名（排除 quick_note）
  const topicTags = categories
    .filter(c => c !== 'quick_note')
    .map(c => topicMap[c] || c);

  // 场景标签 = applicableScenes 拆分
  const sceneTags = applicableScenes
    ? applicableScenes.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  // 情绪标签 = 基于合规等级 + 分类推断
  const emotionTags: string[] = [];
  if (complianceLevel === 'C') emotionTags.push('违规风险');
  if (complianceLevel === 'B') emotionTags.push('需注意');
  if (categories.includes('real_case')) emotionTags.push('真实');

  return { topicTags, sceneTags, emotionTags };
}

/**
 * 构建素材库 content 字段
 * 包含原始内容 + AI 分析结果（完整保存）
 */
export function buildMaterialContent(snippet: SnippetData): string {
  return [
    '📝 【原始信息】',
    snippet.rawContent || '',
    '',
    '📋 【AI 分析结果】',
    `标题：${snippet.title || '无标题'}`,
    `来源：${snippet.sourceOrg || '未知'}`,
    snippet.publishDate ? `发布时间：${snippet.publishDate}` : '',
    '',
    `摘要：${snippet.summary || ''}`,
    snippet.keywords ? `关键词：${snippet.keywords}` : '',
    snippet.applicableScenes ? `适用场景：${snippet.applicableScenes}` : '',
    snippet.complianceLevel ? `合规等级：${snippet.complianceLevel}` : '',
    snippet.url ? `\n📎 原文链接：${snippet.url}` : '',
  ].filter(Boolean).join('\n');
}

// ================================================================
// 核心转化函数
// ================================================================

/**
 * 将速记转化为素材库记录
 * 
 * @param snippet 速记数据
 * @param workspaceId 工作空间 ID
 * @param overrideType 用户指定的素材类型（可选）
 * @param tx Drizzle 事务对象（可选，用于在事务内执行）
 * @returns 转化结果
 */
export async function convertSnippetToMaterial(
  snippet: SnippetData,
  workspaceId: string,
  overrideType?: MaterialType,
  tx?: DrizzleTx,
): Promise<ConversionResult> {
  // 安全获取 categories
  const categories = safeGetCategories(snippet.categories);
  
  // 推断素材类型
  const materialType = overrideType || inferMaterialType(categories);
  
  // 映射标签
  const { topicTags, sceneTags, emotionTags } = mapCategoriesToTags(
    categories,
    snippet.complianceLevel,
    snippet.applicableScenes,
  );
  
  // 构建 content
  const materialContent = buildMaterialContent(snippet);
  
  // 使用事务客户端或普通客户端
  const client = tx || db;
  
  // 插入素材库
  const [material] = await client.insert(materialLibrary).values({
    title: snippet.title || '无标题速记',
    type: materialType,
    content: materialContent,
    sourceType: 'info_snippet',
    sourceDesc: snippet.sourceOrg ? `来源：${snippet.sourceOrg}` : '信息速记',
    sourceUrl: snippet.url || null,
    topicTags,
    sceneTags,
    emotionTags,
    status: 'active',
    workspaceId,
  }).returning();
  
  return {
    materialId: material.id,
    materialType,
    topicTags,
    sceneTags,
    emotionTags,
  };
}

/**
 * 删除素材库关联记录
 * 用于速记删除时的级联删除
 * 
 * @param materialId 素材 ID
 * @param tx Drizzle 事务对象（可选，用于在事务内执行）
 */
export async function deleteRelatedMaterial(materialId: string, tx?: DrizzleTx): Promise<void> {
  if (!materialId) return;
  
  const client = tx || db;
  
  try {
    await client.delete(materialLibrary).where(eq(materialLibrary.id, materialId));
    console.log(`[snippet-to-material] 删除关联素材: ${materialId}`);
  } catch (error) {
    console.error(`[snippet-to-material] 删除关联素材失败: ${materialId}`, error);
    // 如果在事务内，抛出错误让事务回滚
    if (tx) throw error;
    // 事务外不抛出错误，避免阻塞速记删除
  }
}

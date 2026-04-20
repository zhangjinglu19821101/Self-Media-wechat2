import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { infoSnippets } from '@/lib/db/schema/info-snippets';
import { materialLibrary } from '@/lib/db/schema/material-library';
import { desc, eq, sql, and, ilike, or } from 'drizzle-orm';
import { getWorkspaceId } from '@/lib/auth/context';
import { snippetDedupService } from '@/lib/services/snippet-dedup-service';

// ================================================================
// 速记 → 素材 字段映射
// ================================================================

/**
 * 速记分类 → 素材类型 映射
 * 
 * 信息速记的分类维度（领域）与素材库的类型维度（用途）不同：
 * - 速记分类：内容属于什么领域（保险/医疗/案例...）
 * - 素材类型：内容能怎么用（案例/数据/故事/引用...）
 */
function inferMaterialType(categories: string[]): string {
  if (categories.includes('real_case')) return 'case';
  if (categories.includes('insurance')) return 'data';
  if (categories.includes('medical')) return 'data';
  if (categories.includes('intelligence')) return 'data';
  return 'data';
}

/**
 * 速记分类 → 素材标签 映射
 */
function mapCategoriesToTags(
  categories: string[],
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

  const topicTags = categories.filter(c => c !== 'quick_note').map(c => topicMap[c] || c);
  const sceneTags = applicableScenes
    ? applicableScenes.split(',').map(s => s.trim()).filter(Boolean)
    : [];
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
function buildMaterialContent(snippet: {
  rawContent: string | null;
  title: string | null;
  sourceOrg: string | null;
  publishDate: string | null;
  summary: string | null;
  keywords: string | null;
  applicableScenes: string | null;
  complianceLevel: string | null;
  url: string | null;
}): string {
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
// GET
// ================================================================

/**
 * GET /api/info-snippets
 * 获取信息速记列表（按 workspaceId 隔离）
 */
export async function GET(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || '';
    const status = searchParams.get('status') || '';
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const conditions = [eq(infoSnippets.workspaceId, workspaceId)];
    
    if (category && category !== 'all') {
      conditions.push(sql`${infoSnippets.categories} @> ${JSON.stringify([category])}::jsonb`);
    }
    
    if (status && status !== 'all') {
      conditions.push(eq(infoSnippets.status, status));
    }
    if (search) {
      conditions.push(
        or(
          ilike(infoSnippets.title, `%${search}%`),
          ilike(infoSnippets.rawContent, `%${search}%`),
          ilike(infoSnippets.summary, `%${search}%`),
          ilike(infoSnippets.keywords, `%${search}%`)
        )!
      );
    }

    const whereClause = conditions.reduce((acc, cond) => sql`${acc} AND ${cond}`);

    const countResult = await db.select({ count: sql<number>`count(*)::int` }).from(infoSnippets).where(whereClause);
    const total = countResult[0]?.count || 0;

    const data = await db.select().from(infoSnippets)
      .where(whereClause)
      .orderBy(desc(infoSnippets.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    return NextResponse.json({
      success: true,
      data: {
        list: data,
        pagination: {
          page,
          pageSize: limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error: any) {
    console.error('[info-snippets GET] 错误:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ================================================================
// POST — 保存速记 + 自动入库素材库
// ================================================================

/**
 * POST /api/info-snippets
 * 保存信息速记，同时自动创建素材库记录
 * 
 * 数据流（一步到位）：
 * 1. 保存到 info_snippets（原始内容 + AI 结构化字段）
 * 2. 自动创建 material_library 记录（content = 原始内容 + AI 分析结果）
 * 3. 反写 materialId 到 info_snippets（双向关联）
 * 4. 保存哈希记录（去重用）
 */
export async function POST(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const body = await request.json();
    const {
      rawContent,
      categories,
      title,
      sourceOrg,
      publishDate,
      url,
      summary,
      keywords,
      applicableScenes,
      complianceWarnings,
      complianceLevel,
      snippetType,
      remindAt,
    } = body;

    if (!rawContent?.trim()) {
      return NextResponse.json({ error: '请输入要记录的信息' }, { status: 400 });
    }

    // 提醒类型必须设置提醒时间
    if (snippetType === 'reminder' && !remindAt) {
      return NextResponse.json({ error: '提醒类型必须设置提醒时间' }, { status: 400 });
    }

    const snippetCategories = categories || ['quick_note'];

    // === Step 1: 保存到 info_snippets ===
    const result = await db.insert(infoSnippets).values({
      rawContent: rawContent.trim(),
      categories: snippetCategories,
      title: title || null,
      sourceOrg: sourceOrg || null,
      publishDate: publishDate || null,
      url: url || null,
      summary: summary || null,
      keywords: keywords || null,
      applicableScenes: applicableScenes || null,
      complianceWarnings: complianceWarnings || null,
      complianceLevel: complianceLevel || null,
      materialStatus: 'draft',
      snippetType: snippetType || 'memory',
      remindAt: remindAt ? new Date(remindAt) : null,
      remindStatus: snippetType === 'reminder' ? 'pending' : null,
      status: 'organized',  // 已入库
      workspaceId,
    }).returning();

    const savedSnippet = result[0];

    // === Step 2: 自动创建素材库记录 ===
    let materialId: string | null = null;
    let materialType = 'data';
    try {
      materialType = inferMaterialType(snippetCategories);
      const { topicTags, sceneTags, emotionTags } = mapCategoriesToTags(
        snippetCategories,
        complianceLevel || null,
        applicableScenes || null,
      );
      const materialContent = buildMaterialContent({
        rawContent: rawContent.trim(),
        title: title || null,
        sourceOrg: sourceOrg || null,
        publishDate: publishDate || null,
        summary: summary || null,
        keywords: keywords || null,
        applicableScenes: applicableScenes || null,
        complianceLevel: complianceLevel || null,
        url: url || null,
      });

      const [material] = await db.insert(materialLibrary).values({
        title: title || '无标题速记',
        type: materialType,
        content: materialContent,
        sourceType: 'info_snippet',
        sourceDesc: sourceOrg ? `来源：${sourceOrg}` : '信息速记',
        sourceUrl: url || null,
        topicTags,
        sceneTags,
        emotionTags,
        status: 'active',
        workspaceId,
      }).returning();

      materialId = material.id;

      // === Step 3: 反写 materialId 到 info_snippets ===
      await db.update(infoSnippets).set({
        materialId: materialId,
        updatedAt: new Date(),
      }).where(eq(infoSnippets.id, savedSnippet.id));

      console.log(`[info-snippets POST] 速记 ${savedSnippet.id} → 素材 ${materialId}，类型=${materialType}`);
    } catch (materialError) {
      console.error('[info-snippets POST] 自动入库失败:', materialError);
      // 入库失败不阻塞速记保存
    }

    // === Step 4: 保存哈希记录（去重用） ===
    try {
      await snippetDedupService.saveSnippetHash({
        content: rawContent.trim(),
        snippetId: savedSnippet.id,
        workspaceId,
      });
    } catch (hashError) {
      console.error('[info-snippets POST] 保存哈希失败:', hashError);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...savedSnippet,
        materialId,  // 确保返回最新的 materialId
      },
    });
  } catch (error: any) {
    console.error('[info-snippets POST] 错误:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { infoSnippets } from '@/lib/db/schema/info-snippets';
import { desc, eq, sql, and, ilike, or } from 'drizzle-orm';
import { getWorkspaceId } from '@/lib/auth/context';
import { snippetDedupService } from '@/lib/services/snippet-dedup-service';
import {
  convertSnippetToMaterial,
  safeGetCategories,
  type SnippetData,
} from '@/lib/services/snippet-to-material';

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

    const snippetCategories = safeGetCategories(categories);

    // 使用事务确保数据一致性
    const result = await db.transaction(async (tx) => {
      // === Step 1: 保存到 info_snippets ===
      const [savedSnippet] = await tx.insert(infoSnippets).values({
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

      // === Step 2: 自动创建素材库记录 ===
      let materialId: string | null = null;
      let materialType = 'data';
      let materialError: string | null = null;
      
      try {
        const snippetData: SnippetData = {
          rawContent: rawContent.trim(),
          title: title || null,
          sourceOrg: sourceOrg || null,
          publishDate: publishDate || null,
          url: url || null,
          summary: summary || null,
          keywords: keywords || null,
          applicableScenes: applicableScenes || null,
          complianceLevel: complianceLevel || null,
          categories: snippetCategories,
        };
        
        // 在事务内执行素材转化，传递 tx 参数
        const conversionResult = await convertSnippetToMaterial(snippetData, workspaceId, undefined, tx);
        materialId = conversionResult.materialId;
        materialType = conversionResult.materialType;

        // === Step 3: 反写 materialId 到 info_snippets ===
        await tx.update(infoSnippets).set({
          materialId: materialId,
          updatedAt: new Date(),
        }).where(eq(infoSnippets.id, savedSnippet.id));

        console.log(`[info-snippets POST] 速记 ${savedSnippet.id} → 素材 ${materialId}，类型=${materialType}`);
      } catch (err: any) {
        console.error('[info-snippets POST] 自动入库失败:', err);
        materialError = err.message || '入库失败';
        // 入库失败不阻塞速记保存，但返回错误信息
      }

      return {
        savedSnippet,
        materialId,
        materialType,
        materialError,
      };
    });

    // === Step 4: 保存哈希记录（去重用，事务外执行） ===
    try {
      await snippetDedupService.saveSnippetHash({
        content: rawContent.trim(),
        snippetId: result.savedSnippet.id,
        workspaceId,
      });
    } catch (hashError) {
      console.error('[info-snippets POST] 保存哈希失败:', hashError);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...result.savedSnippet,
        materialId: result.materialId,
        materialType: result.materialType,
        materialError: result.materialError,  // 返回入库错误信息
      },
    });
  } catch (error: any) {
    console.error('[info-snippets POST] 错误:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

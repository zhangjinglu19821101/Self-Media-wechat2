import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { infoSnippets } from '@/lib/db/schema/info-snippets';
import { materialLibrary } from '@/lib/db/schema/material-library';
import { eq, and, inArray } from 'drizzle-orm';
import { getWorkspaceId } from '@/lib/auth/context';

/**
 * 速记分类 → 素材类型 映射
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
) {
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
 * POST /api/info-snippets/batch-convert
 * 批量将信息速记转化为素材
 * 
 * Body: { ids: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const { ids } = await request.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: '请选择要转化的速记' }, { status: 400 });
    }

    if (ids.length > 50) {
      return NextResponse.json({ error: '单次最多转化50条' }, { status: 400 });
    }

    // 查询所有待转化的速记
    const snippets = await db.select().from(infoSnippets).where(
      and(
        inArray(infoSnippets.id, ids),
        eq(infoSnippets.workspaceId, workspaceId)
      )
    );

    if (snippets.length === 0) {
      return NextResponse.json({ error: '未找到符合条件的速记' }, { status: 404 });
    }

    const results: { id: string; title: string | null; status: string; materialId?: string; error?: string }[] = [];

    for (const snippet of snippets) {
      // 跳过已转化的
      if (snippet.status === 'organized' && snippet.materialId) {
        results.push({
          id: snippet.id,
          title: snippet.title,
          status: 'skipped',
          materialId: snippet.materialId,
        });
        continue;
      }

      try {
        const snippetCategories = (snippet.categories as string[]) || ['quick_note'];
        const materialType = inferMaterialType(snippetCategories);
        const { topicTags, sceneTags, emotionTags } = mapCategoriesToTags(
          snippetCategories,
          snippet.complianceLevel,
          snippet.applicableScenes,
        );

        const materialContent = [
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

        const [material] = await db.insert(materialLibrary).values({
          title: snippet.title || '无标题速记',
          type: materialType,
          content: materialContent,
          sourceType: 'info_snippet',
          sourceDesc: snippet.sourceOrg ? `来源：${snippet.sourceOrg}` : '信息速记转化',
          sourceUrl: snippet.url || null,
          topicTags,
          sceneTags,
          emotionTags,
          status: 'active',
          workspaceId,
        }).returning();

        // 反写 materialId
        await db.update(infoSnippets).set({
          status: 'organized',
          materialId: material.id,
          updatedAt: new Date(),
        }).where(eq(infoSnippets.id, snippet.id));

        results.push({
          id: snippet.id,
          title: snippet.title,
          status: 'converted',
          materialId: material.id,
        });
      } catch (err: any) {
        results.push({
          id: snippet.id,
          title: snippet.title,
          status: 'error',
          error: err.message,
        });
      }
    }

    const converted = results.filter(r => r.status === 'converted').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const errors = results.filter(r => r.status === 'error').length;

    return NextResponse.json({
      success: true,
      data: {
        results,
        summary: { total: ids.length, converted, skipped, errors },
      },
    });
  } catch (error: any) {
    console.error('[batch-convert] 错误:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { infoSnippets } from '@/lib/db/schema/info-snippets';
import { eq, and, inArray } from 'drizzle-orm';
import { getWorkspaceId } from '@/lib/auth/context';
import {
  convertSnippetToMaterial,
  safeGetCategories,
  type SnippetData,
} from '@/lib/services/snippet-to-material';

/**
 * POST /api/info-snippets/batch-convert
 * 批量将信息速记转化为素材
 * 
 * Body: { ids: string[] }
 * 
 * 使用事务确保数据一致性，部分失败时返回详细结果
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

    const results: { 
      id: string; 
      title: string | null; 
      status: 'converted' | 'skipped' | 'error'; 
      materialId?: string; 
      materialType?: string;
      error?: string;
    }[] = [];

    // 使用事务处理每个速记
    await db.transaction(async (tx) => {
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
          // 构建转化数据
          const snippetData: SnippetData = {
            rawContent: snippet.rawContent,
            title: snippet.title,
            sourceOrg: snippet.sourceOrg,
            publishDate: snippet.publishDate,
            url: snippet.url,
            summary: snippet.summary,
            keywords: snippet.keywords,
            applicableScenes: snippet.applicableScenes,
            complianceLevel: snippet.complianceLevel,
            categories: snippet.categories,
          };

          // 执行转化（在事务内，传递 tx 参数）
          const conversionResult = await convertSnippetToMaterial(snippetData, workspaceId, undefined, tx);

          // 反写 materialId
          await tx.update(infoSnippets).set({
            status: 'organized',
            materialId: conversionResult.materialId,
            updatedAt: new Date(),
          }).where(eq(infoSnippets.id, snippet.id));

          results.push({
            id: snippet.id,
            title: snippet.title,
            status: 'converted',
            materialId: conversionResult.materialId,
            materialType: conversionResult.materialType,
          });
        } catch (err: any) {
          results.push({
            id: snippet.id,
            title: snippet.title,
            status: 'error',
            error: err.message || '转化失败',
          });
        }
      }
    });

    const converted = results.filter(r => r.status === 'converted').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const errors = results.filter(r => r.status === 'error').length;

    console.log(`[batch-convert] 完成: 总计=${ids.length}, 转化=${converted}, 跳过=${skipped}, 失败=${errors}`);

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

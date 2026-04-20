import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { infoSnippets } from '@/lib/db/schema/info-snippets';
import { eq, and } from 'drizzle-orm';
import { getWorkspaceId } from '@/lib/auth/context';
import {
  convertSnippetToMaterial,
  safeGetCategories,
  type SnippetData,
  type MaterialType,
} from '@/lib/services/snippet-to-material';

/**
 * POST /api/info-snippets/[id]/convert-to-material
 * 将信息速记转化为正式素材（按 workspaceId 隔离）
 * 
 * 数据流：
 * 1. 读取 info_snippets 完整记录
 * 2. 映射字段到 material_library
 * 3. content 包含原始内容 + AI 分析结果（完整保存）
 * 4. categories → topicTags/sceneTags/emotionTags（智能映射）
 * 5. 反写 materialId 到 info_snippets（双向关联）
 * 6. 更新 info_snippets.status = 'organized'
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const overrideType = body.type as MaterialType | undefined; // 用户手动指定的素材类型（可选）

    // 使用事务确保数据一致性
    const result = await db.transaction(async (tx) => {
      // 查询原始速记（带 workspaceId 隔离）
      const snippets = await tx.select().from(infoSnippets).where(
        and(
          eq(infoSnippets.id, id),
          eq(infoSnippets.workspaceId, workspaceId)
        )
      );

      if (snippets.length === 0) {
        throw new Error('NOT_FOUND');
      }

      const snippet = snippets[0];

      // 防重复转化
      if (snippet.status === 'organized' && snippet.materialId) {
        throw new Error(`ALREADY_CONVERTED:${snippet.materialId}`);
      }

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
      const conversionResult = await convertSnippetToMaterial(
        snippetData,
        workspaceId,
        overrideType,
        tx,
      );

      // 反写 materialId 到速记表（双向关联）
      await tx.update(infoSnippets).set({
        status: 'organized',
        materialId: conversionResult.materialId,
        updatedAt: new Date(),
      }).where(
        and(
          eq(infoSnippets.id, id),
          eq(infoSnippets.workspaceId, workspaceId)
        )
      );

      return {
        snippet,
        conversionResult,
      };
    });

    const categories = safeGetCategories(result.snippet.categories);

    console.log(`[convert-to-material] 速记 ${id} → 素材 ${result.conversionResult.materialId}，类型=${result.conversionResult.materialType}，标签=主题${result.conversionResult.topicTags.length}/场景${result.conversionResult.sceneTags.length}/情绪${result.conversionResult.emotionTags.length}`);

    return NextResponse.json({
      success: true,
      data: {
        materialId: result.conversionResult.materialId,
        materialType: result.conversionResult.materialType,
        topicTags: result.conversionResult.topicTags,
        sceneTags: result.conversionResult.sceneTags,
        emotionTags: result.conversionResult.emotionTags,
        message: `已将「${result.snippet.title}」转化为${result.conversionResult.materialType === 'case' ? '案例' : '数据'}素材`,
      },
    });
  } catch (error: any) {
    // 处理特定错误
    if (error.message === 'NOT_FOUND') {
      return NextResponse.json({ error: '未找到该速记' }, { status: 404 });
    }
    if (error.message.startsWith('ALREADY_CONVERTED:')) {
      const materialId = error.message.split(':')[1];
      return NextResponse.json({ 
        error: '该速记已转化为素材', 
        materialId,
      }, { status: 409 });
    }
    
    console.error('[convert-to-material] 错误:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

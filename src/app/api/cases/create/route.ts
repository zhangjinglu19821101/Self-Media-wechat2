import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { materialLibrary } from '@/lib/db/schema/material-library';
import { infoSnippets } from '@/lib/db/schema/info-snippets';
import { getWorkspaceId } from '@/lib/auth/context';
import { eq, and } from 'drizzle-orm';

/**
 * POST /api/cases/create
 * 创建案例素材（写入 material_library，type='case'）
 * 
 * 改造说明：原写入 industry_case_library，现统一写入 material_library
 * - caseData → material_library(type='case')
 * - snippet.caseId → snippet.materialId（双向关联）
 * 
 * 幂等：相同 snippetId 不会重复创建
 */
export async function POST(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const body = await request.json();

    // 必填字段校验
    if (!body.title?.trim()) {
      return NextResponse.json({ error: '案例标题不能为空' }, { status: 400 });
    }

    // === 快速路径：如果传了 snippetId，先检查是否已关联素材 ===
    if (body.snippetId) {
      const snippetQuery = await db
        .select({ materialId: infoSnippets.materialId })
        .from(infoSnippets)
        .where(eq(infoSnippets.id, body.snippetId))
        .limit(1);

      const existingMaterialId = snippetQuery[0]?.materialId;

      if (existingMaterialId) {
        // 已存在关联素材，返回已有素材
        const existingMaterial = await db
          .select()
          .from(materialLibrary)
          .where(eq(materialLibrary.id, existingMaterialId))
          .limit(1);

        if (existingMaterial[0]) {
          console.log(`[cases/create] snippetId=${body.snippetId} 已存在素材 id=${existingMaterialId}，返回已有素材`);
          return NextResponse.json({
            success: true,
            alreadyExists: true,
            data: {
              id: existingMaterial[0].id,
              caseId: existingMaterial[0].id, // 兼容前端 CaseItem 格式
              title: existingMaterial[0].title,
            },
          });
        }
      }
    }

    // === 创建新素材（type='case'）===
    const productTags = Array.isArray(body.productTags) ? body.productTags : [];
    const emotionTags = Array.isArray(body.emotionTags) ? body.emotionTags : [];
    const crowdTags = Array.isArray(body.crowdTags) ? body.crowdTags : [];

    // 将案例结构化数据序列化为素材内容
    const contentParts = [
      body.eventFullStory?.trim() ? `【事件经过】\n${body.eventFullStory.trim()}` : '',
      body.background?.trim() ? `【核心背景】\n${body.background.trim()}` : '',
      body.insuranceAction?.trim() ? `【保险动作】\n${body.insuranceAction.trim()}` : '',
      body.result?.trim() ? `【结果】\n${body.result.trim()}` : '',
      body.protagonist?.trim() ? `【主人公】\n${body.protagonist.trim()}` : '',
    ].filter(Boolean).join('\n\n');

    const materialData = {
      title: body.title.trim(),
      type: 'case' as const,
      content: contentParts || body.background?.trim() || '',
      analysisText: body.result?.trim() || '',
      topicTags: productTags,
      sceneTags: crowdTags,
      emotionTags: emotionTags,
      sourceType: 'info_snippet' as const,
      ownerType: 'user' as const,
      workspaceId: workspaceId,
    };

    // 事务：插入素材 + 反写 materialId 到 info_snippets
    const result = await db.transaction(async (tx) => {
      // 1. 插入素材
      const [inserted] = await tx.insert(materialLibrary).values(materialData).returning();

      // 2. 反写 materialId 到 info_snippets（如果有 snippetId）
      if (body.snippetId) {
        try {
          await tx
            .update(infoSnippets)
            .set({ materialId: inserted.id, updatedAt: new Date() })
            .where(eq(infoSnippets.id, body.snippetId));
          console.log(`[cases/create] 素材 ${inserted.id} 反写到 info_snippets.material_id`);
        } catch (updateError: any) {
          // UNIQUE 冲突：并发场景
          if (updateError?.code === '23505') {
            console.log(`[cases/create] 并发冲突：snippetId=${body.snippetId} 已被关联，回滚`);
            tx.rollback();
            return null;
          }
          throw updateError;
        }
      }

      return inserted;
    });

    // 事务回滚（并发冲突），重新查询已有素材返回
    if (!result && body.snippetId) {
      const snippetQuery = await db
        .select({ materialId: infoSnippets.materialId })
        .from(infoSnippets)
        .where(eq(infoSnippets.id, body.snippetId))
        .limit(1);

      const existingMaterialId = snippetQuery[0]?.materialId;
      if (existingMaterialId) {
        const existingMaterial = await db
          .select()
          .from(materialLibrary)
          .where(eq(materialLibrary.id, existingMaterialId))
          .limit(1);

        if (existingMaterial[0]) {
          return NextResponse.json({
            success: true,
            alreadyExists: true,
            data: {
              id: existingMaterial[0].id,
              caseId: existingMaterial[0].id,
              title: existingMaterial[0].title,
            },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      alreadyExists: false,
      data: {
        id: result!.id,
        caseId: result!.id, // 兼容前端
        title: result!.title,
      },
    });
  } catch (error) {
    console.error('[cases/create] 创建案例素材失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    }, { status: 500 });
  }
}

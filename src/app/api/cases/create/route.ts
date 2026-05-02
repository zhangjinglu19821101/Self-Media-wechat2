import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { industryCaseLibrary } from '@/lib/db/schema/industry-case-library';
import { infoSnippets } from '@/lib/db/schema/info-snippets';
import { getWorkspaceId } from '@/lib/auth/context';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

/**
 * POST /api/cases/create
 * 创建行业案例（用户确认后的结构化数据入库）
 * 支持幂等：相同 snippetId 不会重复创建，返回已存在的案例
 *
 * 并发安全：
 * - info_snippets.case_id 有 UNIQUE 约束，DB 层保证一对一
 * - 整个操作在事务中执行，防止 TOCTOU 竞态
 *
 * Body:
 * - snippetId: 关联的速记ID（可选，用于溯源和防重）
 * - title: 案例标题（必填）
 * - eventFullStory: 事件完整原版经过（可选）
 * - background: 核心背景（必填）
 * - insuranceAction: 保险动作（可选）
 * - result: 结果详情（必填）
 * - productTags: 产品标签数组（可选）
 * - protagonist: 主人公描述（可选）
 * - crowdTags: 人群标签数组（可选）
 * - emotionTags: 情绪标签数组（可选）
 * - caseType: 案例类型（可选，默认 positive）
 * - industry: 行业（可选，默认 insurance）
 * - sourceDesc: 来源描述（可选）
 * - sourceUrl: 来源链接（可选）
 */
export async function POST(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const body = await request.json();

    // 必填字段校验
    if (!body.title?.trim()) {
      return NextResponse.json({ error: '案例标题不能为空' }, { status: 400 });
    }
    if (!body.background?.trim()) {
      return NextResponse.json({ error: '案例背景不能为空' }, { status: 400 });
    }
    if (!body.result?.trim()) {
      return NextResponse.json({ error: '案例结果不能为空' }, { status: 400 });
    }

    // === 快速路径：如果传了 snippetId，先检查是否已关联案例 ===
    if (body.snippetId) {
      const snippetQuery = await db
        .select({ caseId: infoSnippets.caseId })
        .from(infoSnippets)
        .where(eq(infoSnippets.id, body.snippetId))
        .limit(1);

      const existingCaseId = snippetQuery[0]?.caseId;

      if (existingCaseId) {
        // 已存在案例，查询并返回
        const existingCase = await db
          .select()
          .from(industryCaseLibrary)
          .where(eq(industryCaseLibrary.id, existingCaseId))
          .limit(1);

        if (existingCase[0]) {
          console.log(`[cases/create] snippetId=${body.snippetId} 已存在案例 id=${existingCaseId}，返回已有案例`);
          return NextResponse.json({
            success: true,
            alreadyExists: true,
            data: {
              id: existingCase[0].id,
              caseId: existingCase[0].caseId,
              title: existingCase[0].title,
            },
          });
        }
      }
    }

    // === 创建新案例（事务保证原子性） ===
    const productTags = Array.isArray(body.productTags) ? body.productTags : [];
    const caseBusinessId = `CASE-${randomUUID().slice(0, 8).toUpperCase()}`;

    const caseData = {
      industry: body.industry || 'insurance',
      caseType: body.caseType || 'positive',
      caseId: caseBusinessId,
      title: body.title.trim(),
      eventFullStory: body.eventFullStory?.trim() || null,
      protagonist: body.protagonist?.trim() || null,
      background: body.background.trim(),
      insuranceAction: body.insuranceAction?.trim() || null,
      result: body.result.trim(),
      applicableProducts: productTags,
      productTags: productTags,
      crowdTags: body.crowdTags || [],
      sceneTags: [],
      emotionTags: body.emotionTags || [],
      applicableScenarios: [],
      sourceDesc: body.sourceDesc?.trim() || (body.snippetId ? `由信息速记转化` : null),
      sourceUrl: body.sourceUrl?.trim() || null,
      complianceNote: body.complianceNote?.trim() || null,
      workspaceId,
      status: 'active',
    };

    // 事务：插入案例 + 反写 snippet.caseId（原子操作，防竞态）
    const result = await db.transaction(async (tx) => {
      // 1. 插入案例
      const [inserted] = await tx.insert(industryCaseLibrary).values(caseData).returning();

      // 2. 反写 caseId 到 info_snippets（如果有 snippetId）
      if (body.snippetId) {
        try {
          await tx
            .update(infoSnippets)
            .set({ caseId: inserted.id, updatedAt: new Date() })
            .where(eq(infoSnippets.id, body.snippetId));
          console.log(`[cases/create] 案例 ${inserted.id} 反写到 info_snippets.case_id`);
        } catch (updateError: any) {
          // UNIQUE 冲突：并发场景下另一事务已先写入，说明案例已存在
          if (updateError?.code === '23505') {
            console.log(`[cases/create] 并发冲突：snippetId=${body.snippetId} 已被另一请求关联案例，回滚本次创建`);
            tx.rollback();
            return null;
          }
          throw updateError;
        }
      }

      return inserted;
    });

    // 事务回滚（并发冲突），重新查询已有案例返回
    if (!result && body.snippetId) {
      const snippetQuery = await db
        .select({ caseId: infoSnippets.caseId })
        .from(infoSnippets)
        .where(eq(infoSnippets.id, body.snippetId))
        .limit(1);

      const existingCaseId = snippetQuery[0]?.caseId;
      if (existingCaseId) {
        const existingCase = await db
          .select()
          .from(industryCaseLibrary)
          .where(eq(industryCaseLibrary.id, existingCaseId))
          .limit(1);

        if (existingCase[0]) {
          return NextResponse.json({
            success: true,
            alreadyExists: true,
            data: {
              id: existingCase[0].id,
              caseId: existingCase[0].caseId,
              title: existingCase[0].title,
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
        caseId: result!.caseId,
        title: result!.title,
      },
    });
  } catch (error) {
    console.error('[cases/create] 创建失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '案例创建失败' },
      { status: 500 }
    );
  }
}

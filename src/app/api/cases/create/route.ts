import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { industryCaseLibrary } from '@/lib/db/schema/industry-case-library';
import { getWorkspaceId } from '@/lib/auth/context';
import { randomUUID } from 'crypto';

/**
 * POST /api/cases/create
 * 创建行业案例（用户确认后的结构化数据入库）
 * 
 * Body:
 * - snippetId: 关联的速记ID（可选，用于溯源）
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

    // 产品标签（同时填充 applicableProducts 和 productTags，保持历史兼容性）
    // 注：applicableProducts 用于展示，productTags 用于 GIN 索引检索
    const productTags = Array.isArray(body.productTags) ? body.productTags : [];

    // 生成案例编号（使用 UUID 避免碰撞）
    const caseId = `CASE-${randomUUID().slice(0, 8).toUpperCase()}`;

    // 构建入库数据
    const caseData = {
      industry: body.industry || 'insurance',
      caseType: body.caseType || 'positive',
      caseId,
      title: body.title.trim(),
      eventFullStory: body.eventFullStory?.trim() || null,
      protagonist: body.protagonist?.trim() || null,
      background: body.background.trim(),
      insuranceAction: body.insuranceAction?.trim() || null,
      result: body.result.trim(),
      applicableProducts: productTags,      // 与 productTags 同步，历史兼容
      productTags: productTags,             // 主字段，有 GIN 索引用于检索
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

    // 入库
    const [inserted] = await db.insert(industryCaseLibrary).values(caseData).returning();

    return NextResponse.json({
      success: true,
      data: {
        id: inserted.id,
        caseId: inserted.caseId,
        title: inserted.title,
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

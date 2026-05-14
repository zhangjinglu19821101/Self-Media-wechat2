/**
 * 案例素材检索 API
 * 
 * 统一从 material_library (type='case') 查询，替代原 industry_case_library
 * 
 * GET /api/cases/recommend?productTags=意外险,重疾险&crowdTags=上班族&limit=5
 * POST /api/cases/recommend - 根据指令推荐案例素材
 * POST /api/cases/recommend - 创建案例素材（写入 material_library）
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { materialLibrary } from '@/lib/db/schema/material-library';
import { getWorkspaceId } from '@/lib/auth/context';
import { eq, and, or, desc, sql } from 'drizzle-orm';

/**
 * 从 material_library 查询 case 类型素材，格式化为前端 CaseItem 格式
 */
function formatMaterialAsCase(m: any) {
  return {
    id: m.id,
    title: m.title || '',
    caseType: m.emotionTags?.includes('警示') ? 'warning' : 'positive',
    eventFullStory: m.content || '',
    protagonist: '',
    background: '',
    insuranceAction: '',
    result: '',
    applicableProducts: m.topicTags || [],
    applicableScenarios: m.sceneTags || [],
    productTags: m.topicTags || [],
    crowdTags: [],
    sceneTags: m.sceneTags || [],
    emotionTags: m.emotionTags || [],
    relevanceScore: 0,
    productTagMatchCount: 0,
    workspaceId: m.workspaceId,
    createdAt: m.createdAt,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = await getWorkspaceId(request);
    
    const productTags = searchParams.get('productTags')?.split(',').filter(Boolean);
    const crowdTags = searchParams.get('crowdTags')?.split(',').filter(Boolean);
    const sceneTags = searchParams.get('sceneTags')?.split(',').filter(Boolean);
    const keywords = searchParams.get('keywords') || undefined;
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    // 构建查询条件：type='case' + 可见性
    const conditions = [
      eq(materialLibrary.type, 'case'),
      or(
        eq(materialLibrary.ownerType, 'system'),
        eq(materialLibrary.workspaceId, workspaceId || '')
      )
    ];

    // 关键词搜索
    if (keywords) {
      conditions.push(
        or(
          sql`${materialLibrary.title} ILIKE ${'%' + keywords + '%'}`,
          sql`${materialLibrary.content} ILIKE ${'%' + keywords + '%'}`,
          sql`${materialLibrary.topicTags}::text ILIKE ${'%' + keywords + '%'}`
        )!
      );
    }

    // 产品标签筛选
    if (productTags && productTags.length > 0) {
      conditions.push(
        sql`${materialLibrary.topicTags}::text ILIKE ANY(${productTags.map(t => '%' + t + '%')})`
      );
    }

    const cases = await db
      .select()
      .from(materialLibrary)
      .where(and(...conditions))
      .orderBy(desc(materialLibrary.createdAt))
      .limit(limit)
      .offset(offset);

    const formatted = cases.map(formatMaterialAsCase);

    return NextResponse.json({
      success: true,
      data: formatted,
      total: formatted.length,
    });
  } catch (error) {
    console.error('[API] 案例素材检索失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    }, { status: 500 });
  }
}

/**
 * POST 方法支持两种模式：
 * 1. 推荐案例素材：传递 instruction 参数
 * 2. 创建案例素材：传递 caseData 参数（写入 material_library）
 */
export async function POST(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const body = await request.json();

    // 模式1：创建案例素材（写入 material_library）
    if (body.caseData) {
      if (!workspaceId) {
        return NextResponse.json({
          success: false,
          error: '创建案例需要登录',
        }, { status: 401 });
      }

      const caseData = body.caseData;
      const newMaterial = await db.insert(materialLibrary).values({
        title: caseData.title || '未命名案例',
        type: 'case',
        content: caseData.eventFullStory || caseData.content || '',
        analysisText: caseData.result || '',
        topicTags: caseData.productTags || [],
        sceneTags: caseData.applicableScenarios || caseData.sceneTags || [],
        emotionTags: caseData.emotionTags || [],
        sourceType: 'manual',
        ownerType: 'user',
        workspaceId: workspaceId,
      }).returning();

      const formatted = formatMaterialAsCase(newMaterial[0]);

      return NextResponse.json({
        success: true,
        data: formatted,
        message: '案例素材创建成功',
      });
    }

    // 模式2：推荐案例素材
    const { instruction, limit } = body;
    if (!instruction) {
      return NextResponse.json({
        success: false,
        error: '缺少 instruction 参数',
      }, { status: 400 });
    }

    // 从指令提取关键词，匹配 material_library 的 case 类型素材
    const keywords = instruction.slice(0, 50);
    const cases = await db
      .select()
      .from(materialLibrary)
      .where(
        and(
          eq(materialLibrary.type, 'case'),
          or(
            eq(materialLibrary.ownerType, 'system'),
            eq(materialLibrary.workspaceId, workspaceId || '')
          ),
          or(
            sql`${materialLibrary.title} ILIKE ${'%' + keywords.slice(0, 10) + '%'}`,
            sql`${materialLibrary.topicTags}::text ILIKE ${'%' + keywords.slice(0, 6) + '%'}`,
            sql`${materialLibrary.sceneTags}::text ILIKE ${'%' + keywords.slice(0, 6) + '%'}`,
            sql`${materialLibrary.content} ILIKE ${'%' + keywords.slice(0, 10) + '%'}`
          )
        )
      )
      .orderBy(desc(materialLibrary.createdAt))
      .limit(limit || 10);

    const formatted = cases.map(formatMaterialAsCase);

    // 格式化为提示词文本
    const promptText = formatted.map((c, i) => {
      const tags = [...(c.productTags || []), ...(c.sceneTags || []), ...(c.emotionTags || [])].join('、');
      return `案例${i + 1}：${c.title}${tags ? `（${tags}）` : ''}\n${c.eventFullStory}`;
    }).join('\n\n');

    return NextResponse.json({
      success: true,
      data: {
        cases: formatted,
        promptText,
      },
    });
  } catch (error) {
    console.error('[API] 案例素材操作失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    }, { status: 500 });
  }
}

/**
 * 素材检索 API
 * 
 * 统一从 material_library 查询，替代原 industry_case_library
 * 支持7维关系型素材：misconception/analogy/case/data/golden_sentence/fixed_phrase/personal_fragment
 * 补充类型：hook_sentence/value_reconstruction
 * 
 * GET /api/cases/recommend?productTags=意外险,重疾险&crowdTags=上班族&limit=5
 * POST /api/cases/recommend - 根据指令推荐素材
 * POST /api/cases/recommend - 创建素材（写入 material_library）
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { materialLibrary } from '@/lib/db/schema/material-library';
import { getWorkspaceId } from '@/lib/auth/context';
import { eq, and, or, desc, sql, inArray } from 'drizzle-orm';
import { formatMaterialAsItem, is7DMaterialType, MATERIAL_TYPE_CONFIG } from '@/lib/utils/material-formatter';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = await getWorkspaceId(request);
    
    const productTags = searchParams.get('productTags')?.split(',').filter(Boolean);
    const crowdTags = searchParams.get('crowdTags')?.split(',').filter(Boolean);
    const sceneTags = searchParams.get('sceneTags')?.split(',').filter(Boolean);
    const keywords = searchParams.get('keywords') || undefined;
    const caseType = searchParams.get('caseType') || undefined;
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    // 构建查询条件：可见性（系统素材 + 用户素材）
    const conditions = [
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

    // 产品标签筛选（topicTags 是 JSONB 数组，使用包含操作符 @>）
    if (productTags && productTags.length > 0) {
      // 使用 OR 组合：每个标签独立匹配 JSONB 数组
      const tagConditions = productTags.map(tag =>
        sql`${materialLibrary.topicTags} @> ${JSON.stringify([tag])}::jsonb`
      );
      conditions.push(or(...tagConditions)!);
    }

    // 人群标签筛选（crowdTags 映射到 sceneTags 字段，JSONB 包含查询）
    if (crowdTags && crowdTags.length > 0) {
      const tagConditions = crowdTags.map(tag =>
        sql`${materialLibrary.sceneTags} @> ${JSON.stringify([tag])}::jsonb`
      );
      conditions.push(or(...tagConditions)!);
    }

    // 场景标签筛选（sceneTags，JSONB 包含查询）
    if (sceneTags && sceneTags.length > 0) {
      const tagConditions = sceneTags.map(tag =>
        sql`${materialLibrary.sceneTags} @> ${JSON.stringify([tag])}::jsonb`
      );
      conditions.push(or(...tagConditions)!);
    }

    // 素材类型筛选（caseType 参数映射到 type 字段）
    if (caseType) {
      // 前端传来的 caseType 可能是 warning/positive/milestone（旧格式）
      // 或者 misconception/analogy/data 等（新7维格式）
      const caseTypeToDbType: Record<string, string[]> = {
        // 旧格式映射
        warning: ['case', 'misconception'],
        positive: ['case', 'golden_sentence', 'story', 'quote'],
        milestone: ['case', 'data'],
        // 新7维格式直接使用
        misconception: ['misconception'],
        golden_sentence: ['golden_sentence'],
        personal_fragment: ['personal_fragment'],
        analogy: ['analogy'],
        data: ['data'],
        fixed_phrase: ['fixed_phrase'],
        case: ['case'],
        hook_sentence: ['hook_sentence'],
        value_reconstruction: ['value_reconstruction'],
        story: ['story'],
        quote: ['quote'],
        opening: ['opening'],
        ending: ['ending'],
      };
      const dbTypes = caseTypeToDbType[caseType];
      if (dbTypes) {
        conditions.push(inArray(materialLibrary.type, dbTypes));
      }
    }

    const items = await db
      .select()
      .from(materialLibrary)
      .where(and(...conditions))
      .orderBy(desc(materialLibrary.createdAt))
      .limit(limit)
      .offset(offset);

    const formatted = items.map(formatMaterialAsItem);

    return NextResponse.json({
      success: true,
      data: formatted,
      total: formatted.length,
    });
  } catch (error) {
    console.error('[API] 素材检索失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    }, { status: 500 });
  }
}

/**
 * POST 方法支持两种模式：
 * 1. 推荐素材：传递 instruction 参数
 * 2. 创建素材：传递 caseData 参数（写入 material_library）
 */
export async function POST(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const body = await request.json();

    // 模式1：创建素材（写入 material_library）
    if (body.caseData) {
      if (!workspaceId) {
        return NextResponse.json({
          success: false,
          error: '创建素材需要登录',
        }, { status: 401 });
      }

      const caseData = body.caseData;
      // 优先使用 caseData.type（前端传入的实际素材类型），不再硬编码为 'case'
      const materialType = caseData.type || caseData.sceneType || 'case';

      // 内容构建：7维素材是纯文本，旧结构化案例需要拼接标记
      let content = '';
      if (is7DMaterialType(materialType) || !caseData.eventFullStory?.includes('【')) {
        // 7维素材或无结构标记：直接使用纯文本
        content = caseData.eventFullStory || caseData.content || '';
      } else {
        // 旧结构化案例：拼接标记
        const parts = [
          caseData.eventFullStory ? `【事件经过】\n${caseData.eventFullStory}` : '',
          caseData.background ? `【核心背景】\n${caseData.background}` : '',
          caseData.insuranceAction ? `【保险动作】\n${caseData.insuranceAction}` : '',
          caseData.result ? `【最终结果】\n${caseData.result}` : '',
        ].filter(Boolean).join('\n\n');
        content = parts || caseData.content || '';
      }

      const newMaterial = await db.insert(materialLibrary).values({
        title: caseData.title || '未命名素材',
        type: materialType,
        content,
        analysisText: caseData.result || '',
        topicTags: caseData.productTags || [],
        sceneTags: caseData.applicableScenarios || caseData.sceneTags || [],
        emotionTags: caseData.emotionTags || [],
        sceneType: caseData.sceneType || 'event',
        industry: caseData.industry || 'insurance',
        sourceType: 'manual',
        ownerType: 'user',
        workspaceId: workspaceId,
      }).returning();

      const formatted = formatMaterialAsItem(newMaterial[0]);

      return NextResponse.json({
        success: true,
        data: formatted,
        message: '素材创建成功',
      });
    }

    // 模式2：推荐素材
    const { instruction, limit } = body;
    if (!instruction) {
      return NextResponse.json({
        success: false,
        error: '缺少 instruction 参数',
      }, { status: 400 });
    }

    // 从指令提取关键词，匹配 material_library 素材
    // 改进：提取多段关键词（取指令前50字，分词匹配提高召回率）
    const instructionText = instruction.slice(0, 50);
    const shortKeyword = instruction.slice(0, 10);
    
    const items = await db
      .select()
      .from(materialLibrary)
      .where(
        and(
          or(
            eq(materialLibrary.ownerType, 'system'),
            eq(materialLibrary.workspaceId, workspaceId || '')
          ),
          or(
            sql`${materialLibrary.title} ILIKE ${'%' + shortKeyword + '%'}`,
            sql`${materialLibrary.topicTags}::text ILIKE ${'%' + shortKeyword + '%'}`,
            sql`${materialLibrary.sceneTags}::text ILIKE ${'%' + shortKeyword + '%'}`,
            sql`${materialLibrary.content} ILIKE ${'%' + shortKeyword + '%'}`,
            // 长指令额外匹配
            instructionText.length > 10 ? sql`${materialLibrary.content} ILIKE ${'%' + instructionText.slice(10, 20) + '%'}` : sql`1=0`
          )
        )
      )
      .orderBy(desc(materialLibrary.createdAt))
      .limit(limit || 10);

    const formatted = items.map(formatMaterialAsItem);

    // 格式化为提示词文本：统一使用 content 字段（所有素材类型都有）
    const promptText = formatted.map((c: Record<string, any>, i: number) => {
      const config = MATERIAL_TYPE_CONFIG[c.type || ''] || MATERIAL_TYPE_CONFIG.story!;
      const tags = [...(c.productTags || []), ...(c.sceneTags || []), ...(c.emotionTags || [])].join('、');
      const mainContent = c.content || c.eventFullStory || c.background || '';
      return `素材${i + 1}（${config.label}）：${c.title}${tags ? `（${tags}）` : ''}\n${mainContent}`;
    }).join('\n\n');

    return NextResponse.json({
      success: true,
      data: {
        cases: formatted,
        promptText,
      },
    });
  } catch (error) {
    console.error('[API] 素材操作失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    }, { status: 500 });
  }
}

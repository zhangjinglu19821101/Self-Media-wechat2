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
    if (!workspaceId) {
      return NextResponse.json({ success: false, error: '未授权访问' }, { status: 401 });
    }

    const productTags = searchParams.get('productTags')?.split(',').filter(Boolean);
    const crowdTags = searchParams.get('crowdTags')?.split(',').filter(Boolean);
    const sceneTags = searchParams.get('sceneTags')?.split(',').filter(Boolean);
    const keywords = searchParams.get('keywords') || undefined;
    const caseType = searchParams.get('caseType') || undefined;
    const industry = searchParams.get('industry') || undefined; // 🔥 行业过滤参数
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    // 构建查询条件：可见性（系统素材 + 用户素材）
    const conditions = [
      or(
        eq(materialLibrary.ownerType, 'system'),
        eq(materialLibrary.workspaceId, workspaceId)
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

    // 🔥 行业过滤：按 industry 字段或 topicTags 匹配
    if (industry) {
      conditions.push(
        or(
          eq(materialLibrary.industry, industry),
          sql`${materialLibrary.topicTags}::text ILIKE ${'%' + industry + '%'}`
        )!
      );
    }

    const items = await db
      .select()
      .from(materialLibrary)
      .where(and(...conditions))
      .orderBy(desc(materialLibrary.createdAt))
      .limit(limit)
      .offset(offset);

    // Fallback：无任何筛选条件且结果为空时，返回所有可见素材（确保用户总能看到素材）
    const hasAnyFilter = keywords || (productTags && productTags.length > 0) || (crowdTags && crowdTags.length > 0) || (sceneTags && sceneTags.length > 0) || caseType;
    let finalItems = items;
    if (!hasAnyFilter && items.length === 0) {
      finalItems = await db
        .select()
        .from(materialLibrary)
        .where(
          or(
            eq(materialLibrary.ownerType, 'system'),
            eq(materialLibrary.workspaceId, workspaceId)
          )
        )
        .orderBy(desc(materialLibrary.createdAt))
        .limit(limit)
        .offset(offset);
    }

    const formatted = finalItems.map(formatMaterialAsItem);

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
        industry: caseData.industry || null,
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
    const trimmedInstruction = instruction?.trim();
    if (!trimmedInstruction) {
      return NextResponse.json({
        success: false,
        error: '缺少 instruction 参数',
      }, { status: 400 });
    }
    if (!workspaceId) {
      return NextResponse.json({
        success: false,
        error: '未授权访问',
      }, { status: 401 });
    }

    // ===== 改进关键词提取：多段渐进式匹配 + fallback =====
    // 1. 从指令中提取有意义的关键词（去除常见停用词/虚词）
    const stopWords = /^(写一篇|写一个|帮我|请|关于|的|了|是|在|和|与|或|一篇|一个|怎么|如何|什么|为什么|哪些|那种|进行|做出|完成|创作|撰写|编写|生成|制作|提供|分析|解读|介绍|说明|解释|比较|对比|总结|整理|列出|描述|讲述|阐述)/;
    
    // 提取核心关键词：去除指令前缀停用词
    let coreKeyword = trimmedInstruction;
    for (let i = 0; i < 5; i++) {
      const prev = coreKeyword;
      coreKeyword = coreKeyword.replace(stopWords, '').trim();
      if (coreKeyword === prev) break; // 没有更多停用词可去除
    }
    
    // 2. 生成多段搜索关键词（渐进式缩短，提高召回率）
    const searchKeywords: string[] = [];
    
    // 核心关键词（2-6字，最精准的匹配单元）
    if (coreKeyword.length >= 2) {
      searchKeywords.push(coreKeyword.slice(0, Math.min(6, coreKeyword.length)));
    }
    // 原始指令前10字（保留完整语义）
    if (trimmedInstruction.length >= 4) {
      searchKeywords.push(trimmedInstruction.slice(0, 10));
    }
    // 从核心关键词中提取2字短关键词（高召回）
    if (coreKeyword.length >= 4) {
      searchKeywords.push(coreKeyword.slice(0, 2));
    }
    // 去重
    const uniqueKeywords = [...new Set(searchKeywords.filter(k => k.length >= 2))];
    
    // 3. 构建多段 OR 关键词匹配条件
    const keywordConditions = uniqueKeywords.map(keyword =>
      or(
        sql`${materialLibrary.title} ILIKE ${'%' + keyword + '%'}`,
        sql`${materialLibrary.topicTags}::text ILIKE ${'%' + keyword + '%'}`,
        sql`${materialLibrary.sceneTags}::text ILIKE ${'%' + keyword + '%'}`,
        sql`${materialLibrary.content} ILIKE ${'%' + keyword + '%'}`,
        sql`${materialLibrary.emotionTags}::text ILIKE ${'%' + keyword + '%'}`
      )!
    );

    // 可见性条件（系统素材 OR 当前工作区素材）
    const visibilityCondition = or(
      eq(materialLibrary.ownerType, 'system'),
      eq(materialLibrary.workspaceId, workspaceId)
    );

    // 🔥 行业检测：从指令中识别保险细分行业，用于精确过滤
    // 键必须与数据库 industry 枚举值一致（insurance_life/insurance_health/insurance_property/finance）
    const industryKeywordMap: Record<string, string[]> = {
      'insurance_property': ['车险', '交强险', '商业车险', '车保', '车损', '三者险', '车辆', '家财险'],
      'insurance_health': ['医疗', '百万医疗', '医疗险', '医保', '惠民保', '意外', '意外险', '意外伤害', 'DRG', '防癌'],
      'insurance_life': ['重疾', '重大疾病', '重疾险', '寿险', '定期寿险', '终身寿险', '增额寿',
        '分红', '分红险', '年金', '年金险', '养老', '退休', '养老金',
        '少儿', '儿童', '宝宝', '孩子', '港险', '传承', '信托',
        '理赔', '投保', '核保', '退保', '续保', '豁免'],
      'finance': ['理财', '利率', '收益', '存款', '降息', '加息', '银行', '储蓄'],
    };
    
    // 检测指令中涉及的行业
    const detectedIndustries: string[] = [];
    for (const [industry, keywords] of Object.entries(industryKeywordMap)) {
      if (keywords.some(kw => trimmedInstruction.includes(kw))) {
        detectedIndustries.push(industry);
      }
    }
    
    console.log(`[API] 素材推荐 - 指令: "${trimmedInstruction.slice(0, 30)}", 检测行业: ${detectedIndustries.join(',') || '未明确'}`);

    // 4. 先尝试关键词匹配搜索 + 行业过滤
    let items;
    if (keywordConditions.length > 0) {
      // 4a. 优先搜索：关键词 + 行业匹配（最精准）
      if (detectedIndustries.length > 0) {
        const industryConditions = detectedIndustries.map(ind =>
          sql`(${materialLibrary.industry} = ${ind} OR ${materialLibrary.topicTags}::text ILIKE ${'%' + ind + '%'} OR ${materialLibrary.title} ILIKE ${'%' + ind + '%'})`
        );
        items = await db
          .select()
          .from(materialLibrary)
          .where(
            and(
              visibilityCondition,
              or(...keywordConditions),
              or(...industryConditions)
            )
          )
          .orderBy(desc(materialLibrary.createdAt))
          .limit(limit || 10);
      }
      
      // 4b. 如果行业精确匹配无结果，降级为关键词匹配（无行业过滤）
      if (!items || items.length === 0) {
        items = await db
          .select()
          .from(materialLibrary)
          .where(
            and(
              visibilityCondition,
              or(...keywordConditions)
            )
          )
          .orderBy(desc(materialLibrary.createdAt))
          .limit(limit || 10);
      }
    }
    
    // 5. Fallback：关键词搜索无结果时，按行业返回（仍保持相关性）
    if (!items || items.length === 0) {
      if (detectedIndustries.length > 0) {
        console.log('[API] 素材推荐关键词无匹配，按行业 fallback');
        const industryConditions = detectedIndustries.map(ind =>
          sql`(${materialLibrary.industry} = ${ind} OR ${materialLibrary.topicTags}::text ILIKE ${'%' + ind + '%'} OR ${materialLibrary.title} ILIKE ${'%' + ind + '%'})`
        );
        items = await db
          .select()
          .from(materialLibrary)
          .where(
            and(
              visibilityCondition,
              or(...industryConditions)
            )
          )
          .orderBy(desc(materialLibrary.createdAt))
          .limit(limit || 10);
      }
      
      // 最终 fallback：返回所有可见素材
      if (!items || items.length === 0) {
        console.log('[API] 素材推荐行业也无匹配，返回全部可见素材');
        items = await db
          .select()
          .from(materialLibrary)
          .where(visibilityCondition)
          .orderBy(desc(materialLibrary.createdAt))
          .limit(limit || 10);
      }
    }

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

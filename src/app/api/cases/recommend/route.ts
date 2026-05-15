/**
 * 素材检索 API
 * 
 * 统一从 material_library 查询，替代原 industry_case_library
 * 支持7维关系型素材：misconception/analogy/case/data/golden_sentence/fixed_phrase/personal_fragment
 * 
 * GET /api/cases/recommend?productTags=意外险,重疾险&crowdTags=上班族&limit=5
 * POST /api/cases/recommend - 根据指令推荐素材
 * POST /api/cases/recommend - 创建素材（写入 material_library）
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { materialLibrary } from '@/lib/db/schema/material-library';
import { getWorkspaceId } from '@/lib/auth/context';
import { eq, and, or, desc, sql } from 'drizzle-orm';

/**
 * 素材类型 → 中文标签映射
 */
const MATERIAL_TYPE_LABELS: Record<string, string> = {
  misconception: '错误认知',
  golden_sentence: '金句',
  personal_fragment: '个人碎片',
  analogy: '生活类比',
  data: '权威数据',
  fixed_phrase: '固定句式',
  case: '真实案例',
  quote: '引用',
  opening: '开头',
  ending: '结尾',
  story: '故事',
};

/**
 * 素材类型 → Badge 样式类型
 * 用于前端渲染不同颜色的 Badge
 */
const MATERIAL_TYPE_BADGE: Record<string, string> = {
  misconception: 'warning',    // 琥珀色 - 错误认知
  golden_sentence: 'golden',   // 金色 - 金句
  personal_fragment: 'personal', // 紫色 - 个人碎片
  analogy: 'analogy',          // 青色 - 生活类比
  data: 'data',                // 蓝色 - 权威数据
  fixed_phrase: 'phrase',      // 灰色 - 固定句式
  case: 'positive',            // 绿色 - 真实案例
  quote: 'positive',
  opening: 'positive',
  ending: 'positive',
  story: 'positive',
};

/**
 * 素材类型 → 详情展示字段映射
 * 每种类型在详情弹窗中展示的主内容字段名不同
 */
const MATERIAL_TYPE_CONTENT_LABEL: Record<string, string> = {
  misconception: '认知内容',
  golden_sentence: '金句原文',
  personal_fragment: '个人经历',
  analogy: '类比内容',
  data: '数据详情',
  fixed_phrase: '句式内容',
  case: '事件经过',
  quote: '引用内容',
  opening: '开头内容',
  ending: '结尾内容',
  story: '故事内容',
};

/**
 * 从内容中生成可读标题
 * 替代数据库中 [提取] 错误认知 - ? 这样的占位标题
 */
function generateReadableTitle(m: any): string {
  // 如果标题不是占位格式，直接使用
  const title = m.title || '';
  if (!title.includes('[提取]') && !title.includes(' - ?')) {
    return title;
  }

  // 从内容生成可读标题
  const content = (m.content || '').trim();
  if (!content) {
    // 使用类型标签作为标题
    const typeLabel = MATERIAL_TYPE_LABELS[m.type] || m.type || '素材';
    return typeLabel;
  }

  // 取内容第一句（到第一个句号/问号/感叹号），最多30字
  const firstSentence = content.match(/^[^。！？\n]{1,30}[。！？]?/)?.[0] || content.slice(0, 30);
  const typeLabel = MATERIAL_TYPE_LABELS[m.type] || '素材';
  
  // 如果内容很短（<=30字），直接用类型标签 + 内容
  if (content.length <= 30) {
    return `${typeLabel}：${content}`;
  }
  
  return `${typeLabel}：${firstSentence}...`;
}

/**
 * 检测是否为7维关系型素材（scene_type 匹配7维类型）
 */
function isRelationalMaterial(type: string): boolean {
  return ['misconception', 'golden_sentence', 'personal_fragment', 'analogy', 'data', 'fixed_phrase', 'case'].includes(type);
}

/**
 * 从 material_library 查询素材，格式化为前端 MaterialItem 格式
 * 
 * 统一处理两种数据来源：
 * 1. 结构化案例（旧格式）：content 中包含 【事件经过】【核心背景】 等标记
 * 2. 7维关系型素材（新格式）：content 为纯文本，type 为 misconception/analogy/data 等
 */
function formatMaterialAsItem(m: any) {
  const content = m.content || '';
  const rawTitle = m.title || '';
  const materialType = m.type || 'case';
  const typeLabel = MATERIAL_TYPE_LABELS[materialType] || materialType;
  const badgeType = MATERIAL_TYPE_BADGE[materialType] || 'positive';
  
  // 从 content 中解析结构化段落（旧格式：带 【事件经过】 等标记）
  const sections: Record<string, string> = {};
  const sectionRegex = /【(.+?)】\n([\s\S]*?)(?=\n【|$)/g;
  let match;
  while ((match = sectionRegex.exec(content)) !== null) {
    sections[match[1]] = match[2].trim();
  }
  
  const hasStructuredContent = Object.keys(sections).length > 0;

  // 生成可读标题
  const displayTitle = generateReadableTitle(m);

  // 从 sceneTags 提取场景描述作为摘要
  const sceneTagsArray = Array.isArray(m.sceneTags) ? m.sceneTags : [];
  const sceneDesc = sceneTagsArray.length > 0 ? sceneTagsArray.join('、') : '';

  // 内容字段填充策略：区分7维关系型素材 vs 结构化案例
  let eventFullStory = '';
  let background = '';
  let insuranceAction = '';
  let resultText = '';
  let protagonist = '';
  let contentLabel = MATERIAL_TYPE_CONTENT_LABEL[materialType] || '素材内容';

  if (isRelationalMaterial(materialType)) {
    // 7维关系型素材：content 是纯文本，直接使用
    eventFullStory = content;       // 向后兼容：卡片展示用 eventFullStory || content
    background = content;           // 详情弹窗用 background
    resultText = m.analysisText || '';
  } else if (hasStructuredContent) {
    // 旧格式结构化案例：从标记段落提取
    eventFullStory = sections['事件经过'] || content;
    background = sections['核心背景'] || '';
    insuranceAction = sections['保险动作'] || '';
    resultText = sections['结果'] || m.analysisText || '';
    protagonist = sections['主人公'] || '';
  } else {
    // 无结构标记的普通素材
    eventFullStory = content;
    background = content;
    resultText = m.analysisText || '';
  }

  return {
    id: m.id,
    title: displayTitle,
    rawTitle,  // 保留原始标题供参考
    type: materialType,
    typeLabel,  // 中文类型标签
    badgeType,  // Badge 样式类型
    contentLabel,  // 详情展示字段名
    caseType: badgeType,  // 向后兼容前端 caseType 字段
    content,   // 保留完整原始内容
    eventFullStory,
    protagonist,
    background,
    insuranceAction,
    result: resultText,
    applicableProducts: Array.isArray(m.topicTags) ? m.topicTags : [],
    applicableScenarios: Array.isArray(m.sceneTags) ? m.sceneTags : [],
    productTags: Array.isArray(m.topicTags) ? m.topicTags : [],
    crowdTags: Array.isArray(m.sceneTags) ? m.sceneTags : [],
    sceneTags: sceneTagsArray,
    emotionTags: Array.isArray(m.emotionTags) ? m.emotionTags : [],
    industry: m.industry || 'insurance',
    sceneType: m.sceneType || '',
    paradigmId: m.paradigmId || '',
    sceneDesc,  // 场景描述摘要
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

    // 产品标签筛选
    if (productTags && productTags.length > 0) {
      conditions.push(
        sql`${materialLibrary.topicTags}::text ILIKE ANY(${productTags.map(t => '%' + t + '%')})`
      );
    }

    // 人群标签筛选
    if (crowdTags && crowdTags.length > 0) {
      conditions.push(
        sql`${materialLibrary.sceneTags}::text ILIKE ANY(${crowdTags.map(t => '%' + t + '%')})`
      );
    }

    // 素材类型筛选（caseType 参数映射到 type 字段）
    if (caseType) {
      // 前端传来的 caseType 可能是 warning/positive/milestone（旧格式）
      // 或者 misconception/analogy/data 等（新7维格式）
      // 需要映射
      const caseTypeToDbType: Record<string, string[]> = {
        // 旧格式映射
        warning: ['case', 'misconception'],
        positive: ['case', 'golden_sentence'],
        milestone: ['case', 'data'],
        // 新7维格式直接使用
        misconception: ['misconception'],
        golden_sentence: ['golden_sentence'],
        personal_fragment: ['personal_fragment'],
        analogy: ['analogy'],
        data: ['data'],
        fixed_phrase: ['fixed_phrase'],
        case: ['case'],
      };
      const dbTypes = caseTypeToDbType[caseType];
      if (dbTypes) {
        conditions.push(
          sql`${materialLibrary.type} IN (${sql.join(dbTypes, sql`, `)})`
        );
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
      const newMaterial = await db.insert(materialLibrary).values({
        title: caseData.title || '未命名素材',
        type: 'case',
        content: caseData.eventFullStory || caseData.content || '',
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
    const keywords = instruction.slice(0, 50);
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
            sql`${materialLibrary.title} ILIKE ${'%' + keywords.slice(0, 10) + '%'}`,
            sql`${materialLibrary.topicTags}::text ILIKE ${'%' + keywords.slice(0, 6) + '%'}`,
            sql`${materialLibrary.sceneTags}::text ILIKE ${'%' + keywords.slice(0, 6) + '%'}`,
            sql`${materialLibrary.content} ILIKE ${'%' + keywords.slice(0, 10) + '%'}`
          )
        )
      )
      .orderBy(desc(materialLibrary.createdAt))
      .limit(limit || 10);

    const formatted = items.map(formatMaterialAsItem);

    // 格式化为提示词文本：统一使用 content 字段（所有素材类型都有）
    const promptText = formatted.map((c, i) => {
      const tags = [...(c.productTags || []), ...(c.sceneTags || []), ...(c.emotionTags || [])].join('、');
      const mainContent = c.content || c.eventFullStory || c.background || '';
      return `素材${i + 1}（${c.typeLabel}）：${c.title}${tags ? `（${tags}）` : ''}\n${mainContent}`;
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

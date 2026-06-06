/**
 * 素材库 API
 * GET  - 获取素材列表（支持归属筛选、搜索、分页）
 * POST - 创建新素材（普通用户创建用户素材，管理员可创建系统素材）
 * 
 * 权限控制：
 * - 普通用户：只能看到系统素材 + 自己的素材
 * - 管理员：可以看到所有素材，可以创建/编辑/删除系统素材
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { materialLibrary, materialBookmarks } from '@/lib/db/schema/material-library';
import { articleContent } from '@/lib/db/schema';
import { desc, eq, ilike, or, sql, and, isNull, inArray } from 'drizzle-orm';
import { getWorkspaceId, isSuperAdmin, getAuthContext } from '@/lib/auth/context';
import { expandKeywordsWithSynonyms } from '@/lib/utils/synonym-dictionary';

/**
 * 行业关键词映射表（用于自动检测素材所属行业）
 * key = 行业标识（必须与数据库 industry 枚举值一致）, value = 该行业相关的关键词列表
 */
const INDUSTRY_KEYWORD_MAP: Record<string, { label: string; keywords: string[] }> = {
  insurance_property: {
    label: '车险/财产险',
    keywords: ['车险', '交强险', '商业车险', '车损险', '三者险', '盗抢险', '车上人员', '涉水险', '自燃险', '玻璃险', '不计免赔', '新车险', '车险理赔', '车险报价', '车保', '机动车', '驾驶证', '行驶证', '过户车', '营运车', '新能源车险', '电动车险', '保费改革', '综改', '家财险', '财产险', '火灾险', '责任险', '雇主责任', '公众责任', '工程险', '企业财产'],
  },
  insurance_health: {
    label: '健康险/意外险',
    keywords: ['百万医疗', '医疗险', '重疾', '重疾险', '健康险', '住院医疗', '门诊险', '防癌险', '抗癌', '特药险', '惠民保', '普惠保', '大病医保', '医保目录', '免赔额', '保证续保', '等待期', '既往症', '健康告知', '核保', '意外险', '意外伤害', '意外医疗', '交通意外', '航空意外', '综合意外', '猝死', '意外身故', '意外伤残', '意外住院', '意外津贴', 'DRG'],
  },
  insurance_life: {
    label: '人寿险/年金',
    keywords: ['寿险', '定期寿险', '终身寿险', '增额终身寿', '定额寿险', '减额寿险', '分红险', '万能险', '投连险', '年金', '养老年金', '教育金', '生存金', '身故', '受益人', '保额', '现金价值', '退保', '减保', '港险', '香港保险', '传承', '信托', '遗嘱', '继承', '遗产', '理赔', '投保', '续保', '豁免', '少儿', '儿童', '宝宝', '孩子', '社保', '养老保险', '公积金', '五险一金', '新农合', '城镇职工', '居民医保', '灵活就业', '社保断缴', '退休金', '养老金', '生育险', '工伤险', '失业险'],
  },
  finance: {
    label: '金融理财',
    keywords: ['理财', '利率', '收益', '存款', '降息', '加息', '银行', '储蓄', '投资', '基金', '股票'],
  },
};

/**
 * 从内容中自动检测行业标签
 * 返回匹配度最高的行业列表（按匹配关键词数量降序）
 */
function detectIndustriesFromContent(title: string, content: string): string[] {
  const text = `${title} ${content}`.toLowerCase();
  const scores: { industry: string; score: number }[] = [];

  for (const [industry, config] of Object.entries(INDUSTRY_KEYWORD_MAP)) {
    let score = 0;
    for (const kw of config.keywords) {
      if (text.includes(kw.toLowerCase())) {
        score++;
      }
    }
    if (score > 0) {
      scores.push({ industry, score });
    }
  }

  // 按匹配数降序，返回所有有匹配的行业
  scores.sort((a, b) => b.score - a.score);
  return scores.map(s => s.industry);
}

/**
 * 从内容中自动检测主题标签
 * 基于行业关键词映射，提取匹配的关键词作为主题标签
 */
function detectTopicTagsFromContent(title: string, content: string, industries: string[]): string[] {
  const text = `${title} ${content}`.toLowerCase();
  const tags: string[] = [];

  for (const industry of industries) {
    const config = INDUSTRY_KEYWORD_MAP[industry];
    if (!config) continue;
    for (const kw of config.keywords) {
      if (text.includes(kw.toLowerCase()) && !tags.includes(kw)) {
        tags.push(kw);
      }
    }
  }

  return tags.slice(0, 10); // 最多10个主题标签
}

/**
 * 归属筛选参数
 * - all:             系统素材 + 当前用户素材（默认）
 * - user:            仅当前用户素材
 * - system:          仅系统素材
 * - bookmarked:      当前用户收藏的素材
 */
type OwnerFilter = 'all' | 'user' | 'system' | 'bookmarked';
const VALID_OWNER_FILTERS: OwnerFilter[] = ['all', 'user', 'system', 'bookmarked'];

/**
 * GET /api/materials
 * 获取素材列表
 * 
 * Query Parameters:
 * - owner: 归属筛选 (all/user/system/bookmarked，默认all)
 * - type: 素材类型筛选 (case/data/story/quote/opening/ending)
 * - status: 状态筛选 (active/archived/draft，默认active)
 * - tags: 标签筛选（逗号分隔）
 * - tagType: 标签类型 (topic/scene/emotion)
 * - search: 关键词搜索（标题+内容）
 * - page: 页码（默认1）
 * - pageSize: 每页数量（默认20，最大100）
 * - paradigmId: 范式ID筛选（位置ID三重绑定）
 * - slotId: 位置ID筛选（位置ID三重绑定，优先级最高）
 */
export async function GET(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const adminFlag = await isSuperAdmin(request);
    const { searchParams } = new URL(request.url);
    
    const ownerFilter = (searchParams.get('owner') || 'all') as OwnerFilter;
    const type = searchParams.get('type');
    const status = searchParams.get('status') || 'active';
    const tags = searchParams.get('tags');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20', 10), 100);
    const tagType = searchParams.get('tagType');
    const paradigmId = searchParams.get('paradigmId');
    const slotId = searchParams.get('slotId');
    const sourceArticleId = searchParams.get('sourceArticleId');

    // 校验归属筛选参数
    if (!VALID_OWNER_FILTERS.includes(ownerFilter)) {
      return NextResponse.json({
        success: false,
        error: `无效的归属筛选参数，有效值为：${VALID_OWNER_FILTERS.join(', ')}`
      }, { status: 400 });
    }

    // ─── 收藏查询：单独处理 ───
    if (ownerFilter === 'bookmarked') {
      return await getBookmarkedMaterials(workspaceId, { type, status, search, tags, tagType, page, pageSize });
    }

    // ─── 构建查询条件 ───
    const conditions = [];

    // 归属筛选
    if (ownerFilter === 'system') {
      // 仅系统素材
      conditions.push(eq(materialLibrary.ownerType, 'system'));
    } else if (ownerFilter === 'user') {
      // 仅当前用户素材
      conditions.push(eq(materialLibrary.ownerType, 'user'));
      conditions.push(eq(materialLibrary.workspaceId, workspaceId));
    } else {
      // all: 系统素材 + 当前用户素材
      conditions.push(
        or(
          eq(materialLibrary.ownerType, 'system'),
          eq(materialLibrary.workspaceId, workspaceId)
        )!
      );
    }

    // 状态筛选
    if (status) {
      conditions.push(eq(materialLibrary.status, status));
    }

    // 类型筛选
    if (type) {
      conditions.push(eq(materialLibrary.type, type));
    }

    // 🔥 位置ID三重绑定：范式ID筛选
    if (paradigmId) {
      conditions.push(eq(materialLibrary.paradigmId, paradigmId));
    }

    // 🔥 位置ID三重绑定：slotId筛选（最高优先级精确匹配）
    if (slotId) {
      conditions.push(eq(materialLibrary.slotId, slotId));
    }

    // 来源文章筛选
    if (sourceArticleId) {
      conditions.push(eq(materialLibrary.sourceArticleId, sourceArticleId));
    }

    // 标签筛选
    if (tags) {
      const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean);
      if (tagArray.length > 0) {
        const tagField = tagType === 'scene' ? materialLibrary.sceneTags :
                         tagType === 'emotion' ? materialLibrary.emotionTags :
                         materialLibrary.topicTags;
        conditions.push(sql`${tagField} @> ${JSON.stringify(tagArray)}`);
      }
    }

    // 关键词搜索（支持同义词扩展）
    if (search) {
      const searchWords = search.split(/[\s,，、]+/).filter(s => s.length >= 2);
      const expandedWords = expandKeywordsWithSynonyms(searchWords);
      if (!expandedWords.includes(search)) {
        expandedWords.push(search);
      }

      const searchConditions = expandedWords.flatMap((word) => [
        ilike(materialLibrary.title, `%${word}%`),
        ilike(materialLibrary.content, `%${word}%`),
      ]);

      conditions.push(or(...searchConditions)!);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 获取总数
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(materialLibrary)
      .where(whereClause);
    const total = Number(countResult[0]?.count || 0);

    // 获取列表（系统素材优先，同归属内按使用次数+创建时间排序）
    const materials = await db
      .select()
      .from(materialLibrary)
      .where(whereClause)
      .orderBy(
        // 系统素材排在前面
        sql`${materialLibrary.ownerType} = 'system' DESC`,
        desc(materialLibrary.useCount),
        desc(materialLibrary.createdAt)
      )
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    // 查询当前用户的收藏状态（用于前端标记）
    const materialIds = materials.map(m => m.id);
    let bookmarkedIds: string[] = [];
    if (materialIds.length > 0) {
      const bookmarks = await db
        .select({ materialId: materialBookmarks.materialId })
        .from(materialBookmarks)
        .where(
          and(
            eq(materialBookmarks.workspaceId, workspaceId),
            inArray(materialBookmarks.materialId, materialIds)
          )
        );
      bookmarkedIds = bookmarks.map(b => b.materialId);
    }

    // 附加收藏状态
    const materialsWithBookmark = materials.map(m => ({
      ...m,
      isBookmarked: bookmarkedIds.includes(m.id),
    }));

    // 附加来源文章标题
    const sourceArticleIds = [...new Set(
      materialsWithBookmark
        .map(m => m.sourceArticleId)
        .filter((id): id is string => !!id)
    )];
    let sourceArticleTitleMap: Record<string, string> = {};
    if (sourceArticleIds.length > 0) {
      const articles = await db
        .select({ articleId: articleContent.articleId, articleTitle: articleContent.articleTitle })
        .from(articleContent)
        .where(inArray(articleContent.articleId, sourceArticleIds));
      sourceArticleTitleMap = Object.fromEntries(
        articles.map(a => [a.articleId, a.articleTitle || '未知文章'])
      );
    }
    const materialsWithSourceTitle = materialsWithBookmark.map(m => ({
      ...m,
      sourceArticleTitle: m.sourceArticleId
        ? (sourceArticleTitleMap[m.sourceArticleId] || '未知文章')
        : null,
    }));

    return NextResponse.json({
      success: true,
      data: {
        list: materialsWithSourceTitle,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      }
    });
  } catch (error: any) {
    console.error('[MaterialsAPI] GET error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * 获取收藏的素材列表
 */
async function getBookmarkedMaterials(
  workspaceId: string,
  options: {
    type?: string | null;
    status: string;
    search?: string | null;
    tags?: string | null;
    tagType?: string | null;
    page: number;
    pageSize: number;
  }
) {
  const { type, status, search, tags, tagType, page, pageSize } = options;

  // 先查收藏记录
  const bookmarkConditions = [eq(materialBookmarks.workspaceId, workspaceId)];
  
  const bookmarks = await db
    .select()
    .from(materialBookmarks)
    .where(and(...bookmarkConditions));

  if (bookmarks.length === 0) {
    return NextResponse.json({
      success: true,
      data: { list: [], pagination: { page, pageSize, total: 0, totalPages: 0 } }
    });
  }

  const bookmarkedMaterialIds = bookmarks.map(b => b.materialId);

  // 再查素材详情
  const materialConditions = [
    inArray(materialLibrary.id, bookmarkedMaterialIds),
    eq(materialLibrary.status, status),
  ];

  if (type) {
    materialConditions.push(eq(materialLibrary.type, type));
  }

  if (tags) {
    const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean);
    if (tagArray.length > 0) {
      const tagField = tagType === 'scene' ? materialLibrary.sceneTags :
                       tagType === 'emotion' ? materialLibrary.emotionTags :
                       materialLibrary.topicTags;
      materialConditions.push(sql`${tagField} @> ${JSON.stringify(tagArray)}`);
    }
  }

  if (search) {
    const searchWords = search.split(/[\s,，、]+/).filter(s => s.length >= 2);
    const expandedWords = expandKeywordsWithSynonyms(searchWords);
    if (!expandedWords.includes(search)) {
      expandedWords.push(search);
    }
    const searchConditions = expandedWords.flatMap((word) => [
      ilike(materialLibrary.title, `%${word}%`),
      ilike(materialLibrary.content, `%${word}%`),
    ]);
    materialConditions.push(or(...searchConditions)!);
  }

  const whereClause = and(...materialConditions);

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(materialLibrary)
    .where(whereClause);
  const total = Number(countResult[0]?.count || 0);

  const materials = await db
    .select()
    .from(materialLibrary)
    .where(whereClause)
    .orderBy(desc(materialLibrary.useCount), desc(materialLibrary.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  // 构建收藏映射（用于附加用户标签和备注）
  const bookmarkMap = new Map(bookmarks.map(b => [b.materialId, b]));

  const materialsWithBookmark = materials.map(m => {
    const bookmark = bookmarkMap.get(m.id);
    return {
      ...m,
      isBookmarked: true,
      bookmarkUserTags: bookmark?.userTags || [],
      bookmarkNotes: bookmark?.notes || null,
    };
  });

  return NextResponse.json({
    success: true,
    data: {
      list: materialsWithBookmark,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    }
  });
}

/**
 * POST /api/materials
 * 创建新素材
 * 
 * 权限控制：
 * - 普通用户：只能创建 owner_type='user' 的素材（自动绑定 workspaceId）
 * - 管理员：可以创建 owner_type='system' 的素材（workspaceId 为 NULL）
 * - 任何用户不允许创建 owner_type='system' 的素材（除非是管理员）
 * 
 * Body:
 * - title: 标题（必须）
 * - type: 类型（必须）
 * - content: 内容（必须）
 * - ownerType: 归属类型（默认 'user'，仅管理员可设为 'system'）
 * - sourceType: 来源类型（默认manual）
 * - sourceDesc: 来源描述
 * - sourceUrl: 来源链接
 * - topicTags: 主题标签[]
 * - sceneTags: 场景标签[]
 * - emotionTags: 情绪标签[]
 * - applicablePositions: 适用位置[]
 * - paradigmId: 适用范式ID（位置ID三重绑定，如 P001）
 * - paradigmPosition: 范式段落位置（如 P001-段落1）
 * - slotId: 位置ID（位置ID三重绑定，如 P001-01）
 */
export async function POST(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const adminFlag = await isSuperAdmin(request);
    const body = await request.json();
    const {
      title,
      type,
      content,
      ownerType = 'user',
      sourceType = 'manual',
      sourceDesc,
      sourceUrl,
      topicTags = [],
      sceneTags = [],
      emotionTags = [],
      applicablePositions = [],
      industry,
      sourceArticleId,
      sceneType,
      analysisText,
      // 🔥 位置ID三重绑定：素材初始化时绑定范式和位置
      paradigmId,
      paradigmPosition,
      slotId,
    } = body;

    // 参数校验
    if (!title || !type || !content) {
      return NextResponse.json({
        success: false,
        error: '缺少必要参数：title, type, content 为必填项'
      }, { status: 400 });
    }

    // 验证类型 - 对齐范式系统 7 大 materialTypes
    const validTypes = ['misconception', 'analogy', 'case', 'data', 'golden_sentence', 'fixed_phrase', 'personal_fragment'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({
        success: false,
        error: `无效的素材类型，有效值为：misconception/analogy/case/data/golden_sentence/fixed_phrase/personal_fragment`
      }, { status: 400 });
    }

    // ─── 权限校验：非管理员禁止创建系统素材 ───
    if (ownerType === 'system' && !adminFlag) {
      return NextResponse.json({
        success: false,
        error: '权限不足：仅管理员可创建系统素材'
      }, { status: 403 });
    }

    // ─── 权限校验：非管理员只能使用用户来源类型 ───
    const SYSTEM_SOURCE_TYPES = ['system_admin', 'system_crawl'];
    if (SYSTEM_SOURCE_TYPES.includes(sourceType) && !adminFlag) {
      return NextResponse.json({
        success: false,
        error: '权限不足：仅管理员可使用系统来源类型'
      }, { status: 403 });
    }

    // 确定归属和工作区
    const finalOwnerType = ownerType === 'system' ? 'system' : 'user';
    const finalWorkspaceId = finalOwnerType === 'system' ? null : workspaceId;

    // ─── 自动检测行业和主题标签（当用户未提供时） ───
    let finalIndustry = industry || null;
    let finalTopicTags = topicTags || [];
    if (!finalIndustry || !finalTopicTags.length) {
      const detectedIndustries = detectIndustriesFromContent(title, content);
      if (!finalIndustry && detectedIndustries.length > 0) {
        finalIndustry = detectedIndustries[0]; // 取匹配度最高的行业
      }
      if ((!finalTopicTags || finalTopicTags.length === 0) && detectedIndustries.length > 0) {
        finalTopicTags = detectTopicTagsFromContent(title, content, detectedIndustries);
      }
    }

    // 插入数据
    const [newMaterial] = await db
      .insert(materialLibrary)
      .values({
        title,
        type,
        content,
        ownerType: finalOwnerType,
        workspaceId: finalWorkspaceId,
        sourceType,
        sourceDesc,
        sourceUrl,
        topicTags: finalTopicTags,
        sceneTags,
        emotionTags,
        applicablePositions,
        industry: finalIndustry,
        sourceArticleId: sourceArticleId || null,
        sceneType: sceneType || null,
        analysisText: analysisText || null,
        // 🔥 位置ID三重绑定：素材初始化时即绑定范式和位置
        paradigmId: paradigmId || null,
        paradigmPosition: paradigmPosition || null,
        slotId: slotId || null,
        status: 'active',
        useCount: 0,
        effectiveCount: 0,
        ineffectiveCount: 0,
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: newMaterial,
      message: '素材创建成功'
    });
  } catch (error: any) {
    console.error('[MaterialsAPI] POST error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

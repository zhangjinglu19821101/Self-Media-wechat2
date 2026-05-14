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
import { desc, eq, ilike, or, sql, and, isNull, inArray } from 'drizzle-orm';
import { getWorkspaceId, isSuperAdmin, getAuthContext } from '@/lib/auth/context';
import { expandKeywordsWithSynonyms } from '@/lib/utils/synonym-dictionary';

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
        topicTags,
        sceneTags,
        emotionTags,
        applicablePositions,
        industry: industry || null,
        sourceArticleId: sourceArticleId || null,
        sceneType: sceneType || null,
        analysisText: analysisText || null,
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

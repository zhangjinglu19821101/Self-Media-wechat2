/**
 * 素材库 API
 * GET  - 获取素材列表（支持搜索、筛选、分页）
 * POST - 创建新素材
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { materialLibrary } from '@/lib/db/schema/material-library';
import { desc, eq, ilike, or, sql, and } from 'drizzle-orm';
import { getWorkspaceId } from '@/lib/auth/context';
import { expandKeywordsWithSynonyms } from '@/lib/utils/synonym-dictionary';

/**
 * GET /api/materials
 * 获取素材列表
 * 
 * Query Parameters:
 * - type: 素材类型筛选 (case/data/story/quote/opening/ending)
 * - status: 状态筛选 (active/archived/draft)
 * - tags: 标签筛选（逗号分隔）
 * - search: 关键词搜索（标题+内容）
 * - page: 页码（默认1）
 * - pageSize: 每页数量（默认20，最大100）
 */
export async function GET(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const status = searchParams.get('status') || 'active';
    const tags = searchParams.get('tags');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20', 10), 100);
    const tagType = searchParams.get('tagType'); // topicTags/sceneTags/emotionTags

    // 构建查询条件
    const conditions = [];

    // 数据可见性：用户的私有素材 + 系统预置素材（对所有用户可见）
    conditions.push(
      or(
        eq(materialLibrary.workspaceId, workspaceId),
        eq(materialLibrary.isSystem, true)
      )!
    );

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
        // 使用 @> 操作符检查JSONB数组是否包含指定标签
        conditions.push(sql`${tagField} @> ${JSON.stringify(tagArray)}`);
      }
    }

    // 关键词搜索（v2: 支持同义词扩展）
    if (search) {
      // 将搜索词拆分并扩展同义词
      const searchWords = search.split(/[\s,，、]+/).filter(s => s.length >= 2);
      const expandedWords = expandKeywordsWithSynonyms(searchWords);
      // 保留原始搜索词（兜底精确匹配）
      if (!expandedWords.includes(search)) {
        expandedWords.push(search);
      }

      const searchConditions = expandedWords.flatMap((word) => [
        ilike(materialLibrary.title, `%${word}%`),
        ilike(materialLibrary.content, `%${word}%`),
      ]);

      conditions.push(or(...searchConditions)!);
    }

    // 执行查询
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 获取总数
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(materialLibrary)
      .where(whereClause);
    const total = Number(countResult[0]?.count || 0);

    // 获取列表
    const materials = await db
      .select()
      .from(materialLibrary)
      .where(whereClause)
      .orderBy(desc(materialLibrary.useCount), desc(materialLibrary.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return NextResponse.json({
      success: true,
      data: {
        list: materials,
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
 * POST /api/materials
 * 创建新素材
 * 
 * Body:
 * - title: 标题（必须）
 * - type: 类型（必须）
 * - content: 内容（必须）
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
    const body = await request.json();
    const {
      title,
      type,
      content,
      sourceType = 'manual',
      sourceDesc,
      sourceUrl,
      topicTags = [],
      sceneTags = [],
      emotionTags = [],
      applicablePositions = []
    } = body;

    // 参数校验
    if (!title || !type || !content) {
      return NextResponse.json({
        success: false,
        error: '缺少必要参数：title, type, content 为必填项'
      }, { status: 400 });
    }

    // 验证类型
    const validTypes = ['case', 'data', 'story', 'quote', 'opening', 'ending'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({
        success: false,
        error: `无效的素材类型，有效值为：${validTypes.join(', ')}`
      }, { status: 400 });
    }

    // 插入数据
    const [newMaterial] = await db
      .insert(materialLibrary)
      .values({
        title,
        type,
        content,
        sourceType,
        sourceDesc,
        sourceUrl,
        topicTags,
        sceneTags,
        emotionTags,
        applicablePositions,
        status: 'active',
        useCount: 0,
        effectiveCount: 0,
        ineffectiveCount: 0,
        workspaceId,
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

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { materialLibrary } from '@/lib/db/schema/material-library';
import { infoSnippets } from '@/lib/db/schema/info-snippets';
import { or, like, desc, and, eq, sql } from 'drizzle-orm';
import { getWorkspaceId } from '@/lib/auth/context';

/**
 * GET /api/materials/recommend?instruction=xxx&limit=5
 *
 * 多路召回 + 综合分排序（关键词×3 + 标签×2 + 热度×1）
 * 同时召回信息速记中未入库的相关内容
 */
export async function GET(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const { searchParams } = new URL(request.url);
    const instruction = searchParams.get('instruction') || '';
    const limit = parseInt(searchParams.get('limit') || '5');

    if (!instruction.trim()) {
      return NextResponse.json({ success: true, data: [], snippets: [] });
    }

    // 从指令中提取关键词和标签候选
    const { keywords, tagCandidates } = extractKeywordsAndTags(instruction);

    if (keywords.length === 0 && tagCandidates.length === 0) {
      return NextResponse.json({ success: true, data: [], snippets: [] });
    }

    // ─── 多路召回（并行） ───
    const [keywordResults, tagResults, hotResults, snippetResults] = await Promise.all([
      // 路径1：关键词匹配 title/content
      recallByKeywords(workspaceId, keywords),
      // 路径2：标签匹配 topicTags/sceneTags
      recallByTags(workspaceId, tagCandidates),
      // 路径3：近期热门素材
      recallByHotness(workspaceId),
      // 路径4：信息速记关键词匹配
      recallSnippets(workspaceId, keywords),
    ]);

    // ─── 去重合并 ───
    const seen = new Set<string>();
    const candidates: CandidateItem[] = [];

    const addCandidate = (
      item: {
        id: string;
        title: string;
        type: string;
        content: string;
        sourceDesc: string | null;
        topicTags: string[] | null;
        sceneTags: string[] | null;
        emotionTags: string[] | null;
        useCount: number;
      },
      source: 'keyword' | 'tag' | 'hot',
    ) => {
      if (seen.has(item.id)) return;
      seen.add(item.id);
      candidates.push({
        id: item.id,
        title: item.title,
        type: item.type,
        content: item.content,
        sourceDesc: item.sourceDesc,
        topicTags: item.topicTags || [],
        sceneTags: item.sceneTags || [],
        emotionTags: item.emotionTags || [],
        useCount: item.useCount,
        source,
        keywordHitCount: source === 'keyword' ? countKeywordHits(item, keywords) : 0,
        tagHitCount: source === 'tag' ? countTagHits(item, tagCandidates) : 0,
        score: 0,
      });
    };

    keywordResults.forEach((r) => addCandidate(r, 'keyword'));
    tagResults.forEach((r) => addCandidate(r, 'tag'));
    hotResults.forEach((r) => addCandidate(r, 'hot'));

    // 对 keyword/tag 来源的候选也计算完整命中数
    candidates.forEach((c) => {
      if (c.source !== 'keyword') c.keywordHitCount = countKeywordHits(c, keywords);
      if (c.source !== 'tag') c.tagHitCount = countTagHits(c, tagCandidates);
    });

    // ─── 综合分排序 ───
    const maxUseCount = Math.max(...candidates.map((c) => c.useCount), 1);

    candidates.forEach((c) => {
      c.score = c.keywordHitCount * 3 + c.tagHitCount * 2 + (c.useCount / maxUseCount) * 1;
    });

    candidates.sort((a, b) => b.score - a.score);

    // 取 Top N
    const topItems = candidates.slice(0, limit).map((c) => ({
      id: c.id,
      title: c.title,
      type: c.type,
      content: c.content,
      sourceDesc: c.sourceDesc,
      topicTags: c.topicTags,
      sceneTags: c.sceneTags,
      emotionTags: c.emotionTags,
      useCount: c.useCount,
      matchLevel: c.score >= 5 ? 'high' : c.score >= 2 ? 'medium' : 'low',
    }));

    // ─── 信息速记结果 ───
    const topSnippets = snippetResults.map((s) => ({
      id: s.id,
      title: s.title || '无标题速记',
      summary: s.summary,
      categories: s.categories || [],
      materialId: s.materialId,
      complianceLevel: s.complianceLevel,
    }));

    return NextResponse.json({
      success: true,
      data: topItems,
      snippets: topSnippets,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '推荐素材失败';
    console.error('[materials/recommend] 错误:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── 类型 ───
interface CandidateItem {
  id: string;
  title: string;
  type: string;
  content: string;
  sourceDesc: string | null;
  topicTags: string[];
  sceneTags: string[];
  emotionTags: string[];
  useCount: number;
  source: 'keyword' | 'tag' | 'hot';
  keywordHitCount: number;
  tagHitCount: number;
  score: number;
}

// ─── 路径1：关键词匹配 ───
async function recallByKeywords(workspaceId: string, keywords: string[]) {
  if (keywords.length === 0) return [];

  const conditions = keywords.flatMap((kw) => [
    like(materialLibrary.title, `%${kw}%`),
    like(materialLibrary.content, `%${kw}%`),
  ]);

  const whereClause =
    conditions.length === 1
      ? and(eq(materialLibrary.status, 'active'), eq(materialLibrary.workspaceId, workspaceId), conditions[0])
      : and(eq(materialLibrary.status, 'active'), eq(materialLibrary.workspaceId, workspaceId), or(...conditions));

  return db
    .select({
      id: materialLibrary.id,
      title: materialLibrary.title,
      type: materialLibrary.type,
      content: materialLibrary.content,
      sourceDesc: materialLibrary.sourceDesc,
      topicTags: materialLibrary.topicTags,
      sceneTags: materialLibrary.sceneTags,
      emotionTags: materialLibrary.emotionTags,
      useCount: materialLibrary.useCount,
    })
    .from(materialLibrary)
    .where(whereClause!)
    .limit(15);
}

// ─── 路径2：标签匹配（topicTags / sceneTags 交集） ───
async function recallByTags(workspaceId: string, tagCandidates: string[]) {
  if (tagCandidates.length === 0) return [];

  // 使用 @> 操作符匹配 JSONB 数组包含
  const conditions = tagCandidates.map((tag) =>
    or(
      sql`${materialLibrary.topicTags} @> ${JSON.stringify([tag])}::jsonb`,
      sql`${materialLibrary.sceneTags} @> ${JSON.stringify([tag])}::jsonb`,
    ),
  );

  return db
    .select({
      id: materialLibrary.id,
      title: materialLibrary.title,
      type: materialLibrary.type,
      content: materialLibrary.content,
      sourceDesc: materialLibrary.sourceDesc,
      topicTags: materialLibrary.topicTags,
      sceneTags: materialLibrary.sceneTags,
      emotionTags: materialLibrary.emotionTags,
      useCount: materialLibrary.useCount,
    })
    .from(materialLibrary)
    .where(and(eq(materialLibrary.status, 'active'), eq(materialLibrary.workspaceId, workspaceId), or(...conditions)))
    .limit(10);
}

// ─── 路径3：近期热门 ───
async function recallByHotness(workspaceId: string) {
  return db
    .select({
      id: materialLibrary.id,
      title: materialLibrary.title,
      type: materialLibrary.type,
      content: materialLibrary.content,
      sourceDesc: materialLibrary.sourceDesc,
      topicTags: materialLibrary.topicTags,
      sceneTags: materialLibrary.sceneTags,
      emotionTags: materialLibrary.emotionTags,
      useCount: materialLibrary.useCount,
    })
    .from(materialLibrary)
    .where(and(eq(materialLibrary.status, 'active'), eq(materialLibrary.workspaceId, workspaceId)))
    .orderBy(desc(materialLibrary.useCount))
    .limit(3);
}

// ─── 路径4：信息速记召回 ───
async function recallSnippets(workspaceId: string, keywords: string[]) {
  if (keywords.length === 0) return [];

  const conditions = keywords.flatMap((kw) => [
    like(infoSnippets.rawContent, `%${kw}%`),
    like(infoSnippets.title, `%${kw}%`),
  ]);

  const whereClause =
    conditions.length === 1
      ? and(eq(infoSnippets.workspaceId, workspaceId), conditions[0])
      : and(eq(infoSnippets.workspaceId, workspaceId), or(...conditions));

  return db
    .select({
      id: infoSnippets.id,
      title: infoSnippets.title,
      summary: infoSnippets.summary,
      categories: infoSnippets.categories,
      materialId: infoSnippets.materialId,
      complianceLevel: infoSnippets.complianceLevel,
    })
    .from(infoSnippets)
    .where(whereClause!)
    .orderBy(desc(infoSnippets.createdAt))
    .limit(3);
}

// ─── 关键词 + 标签提取 ───
function extractKeywordsAndTags(instruction: string): { keywords: string[]; tagCandidates: string[] } {
  // 保险领域关键词
  const domainKeywords = [
    '增额寿', '增额终身寿', '年金', '年金险', '保险', '重疾', '重疾险', '医疗险',
    '意外险', '寿险', '终身寿', '定期寿', '万能险', '分红险', '投连险',
    '存款', '定期', '理财', '利率', '收益', '领取', '退保', '投保', '理赔',
    '保费', '保额', '现金价值', '保障', '免赔', '续保', '趸交', '期交',
    '银行', '保险年金', '储蓄', '到期', '加息', '降息',
  ];

  // 保险领域标签词（用于匹配素材库的 topicTags / sceneTags）
  const tagWords = [
    '港险', '重疾', '医疗险', '意外险', '增额寿', '年金', '终身寿', '定期寿',
    '避坑', '踩坑', '省钱', '警惕', '收益对比', '理赔纠纷', '投保攻略',
    '开头案例', '结尾金句', '数据支撑', '对比分析',
  ];

  const keywords: string[] = [];
  const tagCandidates: string[] = [];

  // 1. 领域关键词
  for (const kw of domainKeywords) {
    if (instruction.includes(kw) && !keywords.includes(kw)) {
      keywords.push(kw);
    }
  }

  // 2. 标签候选
  for (const tag of tagWords) {
    if (instruction.includes(tag) && !tagCandidates.includes(tag)) {
      tagCandidates.push(tag);
    }
  }

  // 3. 通用分词补充
  const parts = instruction
    .replace(/[，。！？、；：""''（）【】《》\n\r\t,.!?;:(){}[\]<>]/g, '|')
    .split('|')
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && s.length <= 10);

  for (const part of parts) {
    if (!keywords.includes(part) && keywords.length < 8) {
      keywords.push(part);
    }
  }

  return { keywords: keywords.slice(0, 8), tagCandidates };
}

// ─── 命中计数 ───
function countKeywordHits(item: { title: string; content: string }, keywords: string[]): number {
  let count = 0;
  const text = item.title + ' ' + item.content;
  for (const kw of keywords) {
    if (text.includes(kw)) count++;
  }
  return count;
}

function countTagHits(item: { topicTags: string[]; sceneTags: string[] }, tagCandidates: string[]): number {
  let count = 0;
  const allTags = [...(item.topicTags || []), ...(item.sceneTags || [])];
  for (const tag of tagCandidates) {
    if (allTags.includes(tag)) count++;
  }
  return count;
}

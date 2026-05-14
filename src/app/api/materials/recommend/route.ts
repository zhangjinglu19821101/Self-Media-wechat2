import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { materialLibrary, SYSTEM_WORKSPACE_ID } from '@/lib/db/schema/material-library';
import { infoSnippets } from '@/lib/db/schema/info-snippets';
import { or, like, desc, and, eq, sql, notInArray, inArray } from 'drizzle-orm';
import { PARADIGM_TO_LEGACY_TYPE_MAP } from '@/lib/services/material-paradigm-mapper';
import { getWorkspaceId } from '@/lib/auth/context';
import { expandKeywordsWithSynonyms } from '@/lib/utils/synonym-dictionary';
import { expandWithLLM } from '@/lib/services/semantic-expand-service';

/**
 * GET /api/materials/recommend?instruction=xxx&limit=5&paradigmCode=P001
 *
 * 多路召回 + 同义词扩展 + 综合分排序（关键词×3 + 标签×2 + 热度×1）
 * 同时召回信息速记中未入库的相关内容
 * 🔥 支持按范式筛选：paradigmCode 参数会优先推荐与范式素材需求匹配的素材
 */
export async function GET(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const { searchParams } = new URL(request.url);
    const instruction = searchParams.get('instruction') || '';
    const limit = parseInt(searchParams.get('limit') || '5');
    const paradigmCode = searchParams.get('paradigmCode') || '';

    if (!instruction.trim()) {
      return NextResponse.json({ success: true, data: [], snippets: [] });
    }

    // 从指令中提取关键词和标签候选
    const { keywords: rawKeywords, tagCandidates } = extractKeywordsAndTags(instruction);

    // ─── 同义词扩展 ───
    // 将"继承"扩展为["继承", "遗产", "传承", "遗嘱", ...]
    const keywords = expandKeywordsWithSynonyms(rawKeywords);

    if (keywords.length === 0 && tagCandidates.length === 0) {
      return NextResponse.json({ success: true, data: [], snippets: [] });
    }

    // ─── 🔥 范式优先召回 ───
    // 如果指定了范式代码，额外召回匹配该范式素材需求的素材
    let paradigmResults: any[] = [];
    if (paradigmCode) {
      try {
        paradigmResults = await recallByParadigm(workspaceId, paradigmCode);
      } catch (e) {
        console.warn('[materials/recommend] 范式召回失败:', e instanceof Error ? e.message : String(e));
      }
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
        paradigmId?: string | null; // 🔥 范式关联ID
      },
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
        keywordHitCount: 0,
        tagHitCount: 0,
        score: 0,
        paradigmId: item.paradigmId || null, // 🔥 传递范式关联
      });
    };

    keywordResults.forEach(addCandidate);
    tagResults.forEach(addCandidate);
    hotResults.forEach(addCandidate);
    paradigmResults.forEach(addCandidate); // 🔥 范式匹配素材

    // ─── LLM 语义扩展兜底 ───
    // 当关键词+同义词+标签都搜不到任何素材时，用 LLM 提取语义相关词再搜一轮
    if (candidates.length === 0 && instruction.length >= 4) {
      try {
        const llmKeywords = await expandWithLLM(instruction, keywords);
        if (llmKeywords.length > 0) {
          const expandedWithLLM = expandKeywordsWithSynonyms(llmKeywords);
          const llmResults = await recallByKeywords(workspaceId, expandedWithLLM);
          llmResults.forEach(addCandidate);
        }
      } catch (e) {
        // LLM 兜底失败不影响主流程
        console.warn('[materials/recommend] LLM 语义扩展兜底失败:', e instanceof Error ? e.message : String(e));
      }
    }

    // ─── 统一计算所有候选的命中数（P1-4: 消除冗余计算） ───
    candidates.forEach((c) => {
      c.keywordHitCount = countKeywordHits(c, keywords);
      c.tagHitCount = countTagHits(c, tagCandidates);
    });

    // ─── 综合分排序 ───
    const maxUseCount = Math.max(...candidates.map((c) => c.useCount), 1);

    candidates.forEach((c) => {
      c.score = c.keywordHitCount * 3 + c.tagHitCount * 2 + (c.useCount / maxUseCount) * 1;
      // 🔥 范式匹配加分：素材关联了当前范式时额外+5分（确保优先推荐）
      if (paradigmCode && (c as any).paradigmId === paradigmCode) {
        c.score += 5;
      }
    });

    candidates.sort((a, b) => b.score - a.score);

    // ─── P1-5: matchLevel 相对分级（基于得分分布） ───
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
      matchLevel: computeMatchLevel(c, candidates),
      keywordHitCount: c.keywordHitCount,
      tagHitCount: c.tagHitCount,
      sceneType: (c as any).sceneType || null, // 🔥 场景类型（范式映射用）
      paradigmId: c.paradigmId || null, // 🔥 关联范式
      paradigmPosition: (c as any).paradigmPosition || null, // 🔥 范式段落位置
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
      // 互联网搜索提示：本地结果不足时，前端可据此展示"互联网搜索"按钮
      internetSearchHint: {
        show: topItems.length === 0 && snippetResults.length === 0,
        query: instruction.slice(0, 100),
        message: '本地素材库未找到相关素材，可搜索互联网权威来源',
      },
    });
  } catch (error: unknown) {
    console.error('[materials/recommend] 错误:', error);
    // P2: 错误响应脱敏，不暴露内部信息
    return NextResponse.json({ error: '推荐服务暂时不可用' }, { status: 500 });
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
  keywordHitCount: number;
  tagHitCount: number;
  score: number;
  paradigmId?: string | null; // 🔥 范式关联ID，用于匹配加分
}

// ─── P1-2: LIKE 通配符转义 ───
function escapeLikePattern(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&');
}

// ─── 可见性条件：用户workspace OR 系统预置 ───
function workspaceVisible(workspaceId: string) {
  return or(
    eq(materialLibrary.workspaceId, workspaceId),
    eq(materialLibrary.workspaceId, SYSTEM_WORKSPACE_ID)
  );
}

// ─── 路径1：关键词匹配 ───
async function recallByKeywords(workspaceId: string, keywords: string[]) {
  if (keywords.length === 0) return [];

  // P1-2: 使用 escapeLikePattern 防止 % 和 _ 被解析为通配符
  const conditions = keywords.flatMap((kw) => [
    like(materialLibrary.title, `%${escapeLikePattern(kw)}%`),
    like(materialLibrary.content, `%${escapeLikePattern(kw)}%`),
  ]);

  // ─── 可见性条件：系统素材 + 当前工作区的用户素材 ───
  const visibilityCondition = or(
    eq(materialLibrary.ownerType, 'system'),
    eq(materialLibrary.workspaceId, workspaceId),
  );

  const whereClause =
    conditions.length === 1
      ? and(eq(materialLibrary.status, 'active'), visibilityCondition, conditions[0])
      : and(eq(materialLibrary.status, 'active'), visibilityCondition, or(...conditions));

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

  // P0-1: 使用 sql`${col} @> ${value}::jsonb` 格式
  // Drizzle 的 sql 模板会将 ${value} 参数化，::jsonb 作为 SQL 字面值保留
  // 这与项目中 info-snippets/route.ts 的写法一致，经过生产验证
  const conditions = tagCandidates.map((tag) => {
    const jsonTag = JSON.stringify([tag]);
    return or(
      sql`${materialLibrary.topicTags} @> ${jsonTag}::jsonb`,
      sql`${materialLibrary.sceneTags} @> ${jsonTag}::jsonb`,
    );
  });

  // ─── 可见性条件：系统素材 + 当前工作区的用户素材 ───
  const visibilityCondition = or(
    eq(materialLibrary.ownerType, 'system'),
    eq(materialLibrary.workspaceId, workspaceId),
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
    .where(and(eq(materialLibrary.status, 'active'), visibilityCondition, or(...conditions)))
    .limit(10);
}

// ─── 路径3：近期热门 ───
async function recallByHotness(workspaceId: string) {
  // ─── 可见性条件：系统素材 + 当前工作区的用户素材 ───
  const visibilityCondition = or(
    eq(materialLibrary.ownerType, 'system'),
    eq(materialLibrary.workspaceId, workspaceId),
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
    .where(and(eq(materialLibrary.status, 'active'), visibilityCondition))
    .orderBy(desc(materialLibrary.useCount))
    .limit(3);
}

// ─── 路径4：信息速记召回 ───
async function recallSnippets(workspaceId: string, keywords: string[]) {
  if (keywords.length === 0) return [];

  // P1-2: 使用 escapeLikePattern
  const conditions = keywords.flatMap((kw) => [
    like(infoSnippets.rawContent, `%${escapeLikePattern(kw)}%`),
    like(infoSnippets.title, `%${escapeLikePattern(kw)}%`),
  ]);

  // P1-3: 过滤已归档/已禁用/已过期的速记，只召回 draft 状态
  const statusFilter = notInArray(infoSnippets.materialStatus, ['archived', 'disabled', 'expired']);

  const whereClause =
    conditions.length === 1
      ? and(eq(infoSnippets.workspaceId, workspaceId), statusFilter, conditions[0])
      : and(eq(infoSnippets.workspaceId, workspaceId), statusFilter, or(...conditions));

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
  // 保险领域关键词（v2: 扩展覆盖更多场景）
  const domainKeywords = [
    // 险种
    '增额寿', '增额终身寿', '年金', '年金险', '保险', '重疾', '重疾险', '医疗险',
    '意外险', '寿险', '终身寿', '定期寿', '万能险', '分红险', '投连险',
    '港险', '香港保险', '年金保险', '医疗保险', '意外保险', '人寿保险',
    // 金融行为
    '存款', '定期', '理财', '利率', '收益', '领取', '退保', '投保', '理赔',
    '保费', '保额', '现金价值', '保障', '免赔', '续保', '趸交', '期交',
    '银行', '保险年金', '储蓄', '到期', '加息', '降息',
    // 传承/财富
    '继承', '遗产', '传承', '遗嘱', '财富传承', '资产传承', '家族信托', '信托',
    // 人群
    '高净值', '老年人', '养老', '孩子', '子女', '家庭',
    // 场景
    '避坑', '踩坑', '省钱', '警惕', '拒赔', '理赔纠纷',
    // 健康
    '癌症', '住院', '手术', '体检', '大病', '肿瘤',
  ];

  // 保险领域标签词（v2: 扩展覆盖更多场景）
  const tagWords = [
    '港险', '重疾', '医疗险', '意外险', '增额寿', '年金', '终身寿', '定期寿',
    '避坑', '踩坑', '省钱', '警惕', '收益对比', '理赔纠纷', '投保攻略',
    '开头案例', '结尾金句', '数据支撑', '对比分析',
    // 新增标签
    '继承', '遗产', '传承', '遗嘱', '信托', '真实案例', '保险',
    '高净值', '养老', '少儿', '家庭', '智能化',
  ];

  // P2: 停用词过滤，去除无意义的通用分词
  const stopWords = new Set([
    '我想', '一下', '这个', '关于', '就是', '还是', '或者', '而且',
    '因为', '所以', '但是', '不过', '虽然', '如果', '那么', '什么',
    '怎么', '如何', '可以', '应该', '需要', '已经', '正在', '一些',
    '这些', '那些', '他们', '我们', '你们', '自己', '现在', '之后',
    '之前', '以后', '比较', '非常', '特别', '真的', '好的', '的话',
  ]);

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

  // 3. 通用分词补充（带停用词过滤）
  const parts = instruction
    .replace(/[，。！？、；：""''（）【】《》\n\r\t,.!?;:(){}[\]<>]/g, '|')
    .split('|')
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && s.length <= 10 && !stopWords.has(s));

  for (const part of parts) {
    if (!keywords.includes(part) && keywords.length < 12) {
      keywords.push(part);
    }
  }

  return { keywords: keywords.slice(0, 12), tagCandidates };
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

// ─── P1-5: matchLevel 相对分级 ───
// 基于得分分布而非硬编码阈值：
// - 有关键词/标签命中且得分在前列 → high
// - 有命中但排名靠后 → medium
// - 无命中（仅靠热度召回）→ low
function computeMatchLevel(item: CandidateItem, allCandidates: CandidateItem[]): 'high' | 'medium' | 'low' {
  // 有关键词或标签命中
  const hasRelevanceHit = item.keywordHitCount > 0 || item.tagHitCount > 0;
  if (!hasRelevanceHit) return 'low';

  // 计算相对排名：得分在前 30% → high，否则 → medium
  const sortedScores = allCandidates
    .filter((c) => c.keywordHitCount > 0 || c.tagHitCount > 0)
    .map((c) => c.score)
    .sort((a, b) => b - a);

  if (sortedScores.length === 0) return 'low';

  const highThreshold = sortedScores[Math.floor(sortedScores.length * 0.3)];
  return item.score >= highThreshold ? 'high' : 'medium';
}

// ─── 🔥 路径5：范式匹配召回 ───
// 根据范式代码召回与范式素材需求匹配的素材
async function recallByParadigm(workspaceId: string, paradigmCode: string): Promise<any[]> {
  const visibilityCondition = or(
    eq(materialLibrary.ownerType, 'system'),
    eq(materialLibrary.workspaceId, workspaceId),
  );

  // 策略1：素材直接关联了该范式（paradigmId = paradigmCode）
  const directMatch = await db
    .select()
    .from(materialLibrary)
    .where(
      and(
        eq(materialLibrary.status, 'active'),
        visibilityCondition,
        eq(materialLibrary.paradigmId, paradigmCode),
      ),
    )
    .limit(10);

  if (directMatch.length > 0) {
    return directMatch.map((item) => ({
      ...item,
      keywordHitCount: 0,
      tagHitCount: 0,
      useCount: item.useCount || 0,
    }));
  }

  // 策略2：通过 sceneType 间接匹配
  // 获取所有有效的 sceneType 值（数据库中实际存储的值）
  const validSceneTypes = ['analogy', 'mistake', 'regulation', 'event'];

  // 查询有 sceneType 且值在有效列表中的素材
  const sceneMatch = await db
    .select()
    .from(materialLibrary)
    .where(
      and(
        eq(materialLibrary.status, 'active'),
        visibilityCondition,
        inArray(materialLibrary.sceneType, validSceneTypes),
      ),
    )
    .limit(10);

  return sceneMatch.map((item) => ({
    ...item,
    keywordHitCount: 0,
    tagHitCount: 0,
    useCount: item.useCount || 0,
  }));
}

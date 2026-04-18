import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { materialLibrary } from '@/lib/db/schema/material-library';
import { or, like, desc, and, eq } from 'drizzle-orm';
import { getWorkspaceId } from '@/lib/auth/context';

/**
 * GET /api/materials/recommend?instruction=xxx&limit=5
 * 根据任务指令推荐相关素材
 * 使用关键词匹配 + 使用频率排序
 */
export async function GET(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const { searchParams } = new URL(request.url);
    const instruction = searchParams.get('instruction') || '';
    const limit = parseInt(searchParams.get('limit') || '5');

    if (!instruction.trim()) {
      return NextResponse.json({ success: true, data: [] });
    }

    // 从指令中提取关键词
    const keywords = extractKeywords(instruction);

    if (keywords.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // 使用 Drizzle 原生 or + like 构建查询，避免手写 sql 模板
    const conditions = keywords.flatMap(kw => [
      like(materialLibrary.title, `%${kw}%`),
      like(materialLibrary.content, `%${kw}%`),
    ]);

    const whereClause = conditions.length === 1
      ? and(eq(materialLibrary.status, 'active'), eq(materialLibrary.workspaceId, workspaceId), conditions[0])
      : and(eq(materialLibrary.status, 'active'), eq(materialLibrary.workspaceId, workspaceId), or(...conditions));

    const results = await db
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
      .orderBy(desc(materialLibrary.useCount))
      .limit(limit);

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error: any) {
    console.error('[materials/recommend] 错误:', error);
    return NextResponse.json({ error: error.message || '推荐素材失败' }, { status: 500 });
  }
}

/**
 * 从指令文本中提取搜索关键词
 * 策略：
 * 1. 先按中文标点和空格分词
 * 2. 提取保险领域常见关键词（2-4字词组）
 * 3. 过滤停用词和过短的片段
 */
function extractKeywords(instruction: string): string[] {
  // 中文保险领域常见关键词（用于从长句中提取有意义的短语）
  const domainKeywords = [
    '增额寿', '增额终身寿', '年金', '年金险', '保险', '重疾', '重疾险', '医疗险',
    '意外险', '寿险', '终身寿', '定期寿', '万能险', '分红险', '投连险',
    '存款', '定期', '理财', '利率', '收益', '领取', '退保', '投保', '理赔',
    '保费', '保额', '现金价值', '保障', '免赔', '续保', '趸交', '期交',
    '银行', '保险年金', '储蓄', '到期', '加息', '降息',
  ];

  const keywords: string[] = [];

  // 1. 提取领域关键词（精确匹配，优先级最高）
  for (const kw of domainKeywords) {
    if (instruction.includes(kw) && !keywords.includes(kw)) {
      keywords.push(kw);
    }
  }

  // 2. 按标点和空格分词，补充通用关键词
  const parts = instruction
    .replace(/[，。！？、；：""''（）【】《》\n\r\t,.!?;:(){}[\]<>]/g, '|')
    .split('|')
    .map(s => s.trim())
    .filter(s => s.length >= 2 && s.length <= 10); // 过滤过短和过长的片段

  for (const part of parts) {
    if (!keywords.includes(part) && keywords.length < 8) {
      keywords.push(part);
    }
  }

  return keywords.slice(0, 8);
}

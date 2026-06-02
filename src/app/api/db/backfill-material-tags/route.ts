import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { materialLibrary } from '@/lib/db/schema/material-library';
import { eq, isNull, and, or } from 'drizzle-orm';

/**
 * GET /api/db/backfill-material-tags
 * 为已有素材自动补充 topic_tags 和 industry 字段
 * 基于内容关键词匹配，纯JS实现，无需LLM
 */
export async function GET(request: NextRequest) {
  try {
    // 主题关键词 → 标签映射
    const TOPIC_KEYWORD_MAP: Record<string, { keywords: string[]; tag: string; industry: string }> = {
      // ── 人寿保险 ──
      '重疾险': {
        keywords: ['重疾', '重疾险', '重大疾病', '大病险', '恶性肿瘤', '癌症', '肿瘤', '白血病', '重疾理赔'],
        tag: '重疾险',
        industry: 'insurance_life',
      },
      '寿险': {
        keywords: ['寿险', '终身寿', '定期寿', '增额寿', '增额终身寿', '增额终身寿险', '死亡险', '人寿保险'],
        tag: '寿险',
        industry: 'insurance_life',
      },
      '年金险': {
        keywords: ['年金', '年金险', '年金保险', '养老年金', '教育年金', '生存金', '领取', '固定领取'],
        tag: '年金险',
        industry: 'insurance_life',
      },
      '分红险': {
        keywords: ['分红险', '分红', '红利', '分红型', '保单红利'],
        tag: '分红险',
        industry: 'insurance_life',
      },
      '万能险': {
        keywords: ['万能险', '万能型', '结算利率', '保底利率', '万能账户'],
        tag: '万能险',
        industry: 'insurance_life',
      },
      '增额寿': {
        keywords: ['增额寿', '增额终身寿', '保额递增', '3.0%', '3.5%', '复利递增'],
        tag: '增额寿',
        industry: 'insurance_life',
      },
      '港险': {
        keywords: ['港险', '香港保险', '港澳保险', '赴港投保'],
        tag: '港险',
        industry: 'insurance_life',
      },
      '传承': {
        keywords: ['传承', '财富传承', '资产传承', '家族信托', '信托', '遗嘱', '继承', '遗产'],
        tag: '传承',
        industry: 'insurance_life',
      },
      // ── 健康保险 ──
      '医疗险': {
        keywords: ['医疗险', '百万医疗', '医疗', '住院', '手术', '医保', '门诊', '特需医疗', 'DRG'],
        tag: '医疗险',
        industry: 'insurance_health',
      },
      '意外险': {
        keywords: ['意外险', '意外伤害', '意外', '交通事故', '伤残'],
        tag: '意外险',
        industry: 'insurance_health',
      },
      // ── 财产保险 ──
      '车险': {
        keywords: ['车险', '交强险', '商业车险', '车保', '车损', '三者险', '车辆'],
        tag: '车险',
        industry: 'insurance_property',
      },
      // ── 通用保险 ──
      '理赔': {
        keywords: ['理赔', '赔付', '拒赔', '理赔纠纷', '理赔款', '赔付率'],
        tag: '理赔',
        industry: 'insurance_life',
      },
      '投保': {
        keywords: ['投保', '核保', '健康告知', '承保', '犹豫期', '等待期', '宽限期', '免赔'],
        tag: '投保',
        industry: 'insurance_life',
      },
      '养老': {
        keywords: ['养老', '退休', '养老金', '社保', '退休金', '老龄化'],
        tag: '养老',
        industry: 'insurance_life',
      },
      '少儿': {
        keywords: ['孩子', '子女', '少儿', '儿童', '宝宝', '新生儿'],
        tag: '少儿',
        industry: 'insurance_life',
      },
      // ── 金融理财 ──
      '理财': {
        keywords: ['理财', '利率', '收益', '存款', '降息', '加息', '银行', '储蓄'],
        tag: '理财',
        industry: 'finance',
      },
    };

    // 查询所有 topic_tags 为空且 industry 为空的素材
    const materials = await db
      .select({
        id: materialLibrary.id,
        title: materialLibrary.title,
        content: materialLibrary.content,
        type: materialLibrary.type,
        topicTags: materialLibrary.topicTags,
        sceneTags: materialLibrary.sceneTags,
        industry: materialLibrary.industry,
      })
      .from(materialLibrary)
      .where(
        and(
          eq(materialLibrary.status, 'active'),
          // 只处理 topic_tags 为空且 industry 为空的素材
          or(
            isNull(materialLibrary.industry),
            and(
              isNull(materialLibrary.topicTags),
            ),
          ),
        )
      );

    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const mat of materials) {
      try {
        const text = `${mat.title} ${mat.content}`;
        const matchedTopics: string[] = [];
        let primaryIndustry = 'general';

        // 按优先级匹配主题标签
        for (const [, config] of Object.entries(TOPIC_KEYWORD_MAP)) {
          const hasMatch = config.keywords.some(kw => text.includes(kw));
          if (hasMatch) {
            if (!matchedTopics.includes(config.tag)) {
              matchedTopics.push(config.tag);
            }
            // 第一个匹配的行业作为主行业
            if (primaryIndustry === 'general') {
              primaryIndustry = config.industry;
            }
          }
        }

        // 如果没有任何主题匹配，标记为 general
        if (matchedTopics.length === 0) {
          primaryIndustry = 'general';
        }

        // 只在有变化时更新
        const currentTopics = (mat.topicTags as string[]) || [];
        const needsUpdate = matchedTopics.length > 0 && currentTopics.length === 0;

        if (needsUpdate || !mat.industry) {
          await db
            .update(materialLibrary)
            .set({
              topicTags: matchedTopics.length > 0 ? matchedTopics : currentTopics,
              industry: mat.industry || primaryIndustry,
              updatedAt: new Date(),
            })
            .where(eq(materialLibrary.id, mat.id));

          updated++;
        } else {
          skipped++;
        }
      } catch (err) {
        errors.push(`素材 ${mat.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return NextResponse.json({
      success: true,
      total: materials.length,
      updated,
      skipped,
      errors: errors.slice(0, 10),
    });
  } catch (error) {
    console.error('[backfill-material-tags] 错误:', error);
    return NextResponse.json({ error: '填充失败' }, { status: 500 });
  }
}

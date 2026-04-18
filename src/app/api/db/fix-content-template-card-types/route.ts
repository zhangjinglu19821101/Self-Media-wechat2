/**
 * 修复内容模板卡片类型
 * 
 * 问题：历史模板中所有卡片都是 point 类型，缺少 cover 和 ending
 * 修复：根据位置强制修正卡片类型
 * - 第1张 → cover
 * - 中间张 → point
 * - 最后一张 → ending
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { contentTemplates } from '@/lib/db/schema/content-template';
import { eq, isNotNull } from 'drizzle-orm';

interface CardExample {
  cardType: 'cover' | 'point' | 'ending' | 'minimal-point';
  imageText: string;
  textLength: 'title_only' | 'short' | 'standard' | 'detailed';
  styleDescription: string;
}

export async function GET(request: NextRequest) {
  try {
    // 查询所有模板
    const templates = await db
      .select()
      .from(contentTemplates)
      .where(isNotNull(contentTemplates.workspaceId));

    console.log(`[FixCardTypes] 找到 ${templates.length} 个模板需要检查`);

    const results: Array<{
      id: string;
      name: string;
      before: string[];
      after: string[];
      fixed: boolean;
    }> = [];

    for (const template of templates) {
      const details = template.details as any;
      if (!details?.cardExamples || !Array.isArray(details.cardExamples)) {
        continue;
      }

      const before = details.cardExamples.map((c: CardExample) => c.cardType);
      
      // 检查是否需要修复
      const hasCover = details.cardExamples.some((c: CardExample) => c.cardType === 'cover');
      const hasEnding = details.cardExamples.some((c: CardExample) => c.cardType === 'ending');
      
      if (hasCover && hasEnding) {
        // 已经正确，跳过
        results.push({
          id: template.id,
          name: template.name || '未命名',
          before,
          after: before,
          fixed: false,
        });
        continue;
      }

      // 执行修复
      const cardExamples = [...details.cardExamples];
      if (cardExamples.length >= 3) {
        // 第1张 → cover
        cardExamples[0] = { ...cardExamples[0], cardType: 'cover' };
        // 最后一张 → ending
        cardExamples[cardExamples.length - 1] = { ...cardExamples[cardExamples.length - 1], cardType: 'ending' };
        // 中间张 → point
        for (let i = 1; i < cardExamples.length - 1; i++) {
          if (cardExamples[i].cardType !== 'point' && cardExamples[i].cardType !== 'minimal-point') {
            cardExamples[i] = { ...cardExamples[i], cardType: 'point' };
          }
        }
      }

      const after = cardExamples.map((c: CardExample) => c.cardType);

      // 更新 promptInstruction
      const promptInstruction = generateFixedPromptInstruction(cardExamples, details.divisionRule);

      // 写入数据库
      await db
        .update(contentTemplates)
        .set({
          details: {
            ...details,
            cardExamples,
          },
          promptInstruction,
          updatedAt: new Date(),
        })
        .where(eq(contentTemplates.id, template.id));

      results.push({
        id: template.id,
        name: template.name || '未命名',
        before,
        after,
        fixed: true,
      });

      console.log(`[FixCardTypes] 模板 "${template.name}" 已修复: [${before.join(', ')}] → [${after.join(', ')}]`);
    }

    const fixedCount = results.filter(r => r.fixed).length;

    return NextResponse.json({
      success: true,
      total: templates.length,
      fixedCount,
      results,
    });
  } catch (error) {
    console.error('[FixCardTypes] 执行失败:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

/**
 * 生成修复后的 promptInstruction
 */
function generateFixedPromptInstruction(
  cardExamples: CardExample[],
  divisionRule?: { imageOnly?: string[]; textOnly?: string[] }
): string {
  const parts: string[] = [];

  // 卡片数量
  const totalCards = cardExamples.length;
  parts.push(`${totalCards}卡模式`);

  // 封面
  const coverCard = cardExamples.find(c => c.cardType === 'cover');
  if (coverCard) {
    switch (coverCard.textLength) {
      case 'title_only': parts.push('封面仅主标题'); break;
      case 'short': parts.push('封面标题+副标题'); break;
      default: parts.push('封面标准格式');
    }
  }

  // 要点
  const pointCards = cardExamples.filter(c => c.cardType === 'point' || c.cardType === 'minimal-point');
  if (pointCards.length > 0) {
    const dominant = pointCards[0].textLength;
    if (dominant === 'title_only') {
      parts.push('要点仅标题无内容');
    } else if (dominant === 'short') {
      parts.push('要点标题+简短说明(≤30字)');
    } else if (dominant === 'detailed') {
      parts.push('要点标题+详细内容(≤100字)');
    } else {
      parts.push('要点标题+标准内容(≤60字)');
    }
  }

  // 结尾
  const endingCard = cardExamples.find(c => c.cardType === 'ending');
  if (endingCard) {
    switch (endingCard.textLength) {
      case 'title_only': parts.push('结尾仅总结语'); break;
      case 'short': parts.push('结尾总结+少量标签'); break;
      default: parts.push('结尾总结+标签');
    }
  }

  // 图文分工
  if (divisionRule?.imageOnly?.length) {
    parts.push(`图片放${divisionRule.imageOnly.slice(0, 2).join('/')}`);
  }
  if (divisionRule?.textOnly?.length) {
    parts.push(`正文放${divisionRule.textOnly.slice(0, 2).join('/')}`);
  }

  return parts.join('；') + '。';
}

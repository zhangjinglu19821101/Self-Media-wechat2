import { NextRequest, NextResponse } from 'next/server';
import { enrichSnippetWithLLM } from '@/lib/services/snippet-enrichment-service';

/**
 * POST /api/info-snippets/analyze
 * AI 分析原始内容，返回结构化字段（不保存到数据库）
 * 用于前端预览和用户确认
 * 
 * Body: rawContent (必填)
 * 
 * 返回字段（对应前端表单）：
 * - category: 主分类代码
 * - categoryLabel: 主分类中文名
 * - secondaryCategories: 副分类数组（跨领域多标签）
 * - title: 标题
 * - sourceOrg: 来源机构
 * - publishDate: 发布时间
 * - url: 原文链接
 * - summary: 摘要
 * - keywords: 关键词
 * - applicableScenes: 适用场景
 * - complianceWarnings: 合规预警（保险类）
 * - complianceLevel: 合规等级（保险类）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rawContent } = body;

    if (!rawContent?.trim()) {
      return NextResponse.json({ error: '请输入要分析的信息' }, { status: 400 });
    }

    // 调用 LLM 分析
    const result = await enrichSnippetWithLLM(rawContent.trim());

    // 分类中文名映射
    const categoryLabels: Record<string, string> = {
      real_case: '身边真实案例',
      insurance: '保险',
      intelligence: '智能化',
      medical: '医疗',
      quick_note: '简要内容速记',
    };

    // 合规等级颜色映射
    const complianceLevelColors: Record<string, { bg: string; text: string }> = {
      A: { bg: 'bg-green-50', text: 'text-green-700' },
      B: { bg: 'bg-amber-50', text: 'text-amber-700' },
      C: { bg: 'bg-red-50', text: 'text-red-700' },
    };

    // 副分类标签
    const secondaryCategoryLabels = result.secondaryCategories.map(cat => categoryLabels[cat] || cat);

    return NextResponse.json({
      success: true,
      data: {
        // 原始内容
        rawContent: rawContent.trim(),
        
        // AI 分析结果
        category: result.category,
        categoryLabel: categoryLabels[result.category] || '简要内容速记',
        secondaryCategories: result.secondaryCategories,
        secondaryCategoryLabels,
        title: result.title,
        sourceOrg: result.sourceOrg,
        publishDate: result.publishDate,
        url: result.url,
        summary: result.summary,
        keywords: result.keywords,
        applicableScenes: result.applicableScenes,
        
        // 合规校验（保险类）
        complianceWarnings: result.complianceWarnings,
        complianceLevel: result.complianceLevel,
        complianceLevelLabel: result.complianceLevel ? { A: '合规', B: '预警', C: '违规' }[result.complianceLevel] : null,
        complianceLevelColor: result.complianceLevel ? complianceLevelColors[result.complianceLevel] : null,
        
        // 素材信息
        materialId: result.materialId,
        materialStatus: result.materialStatus,
      },
    });
  } catch (error: any) {
    console.error('[info-snippets/analyze POST] 错误:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

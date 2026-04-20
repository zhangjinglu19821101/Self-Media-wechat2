import { NextRequest, NextResponse } from 'next/server';
import { enrichSnippetWithLLM } from '@/lib/services/snippet-enrichment-service';
import { snippetDedupService } from '@/lib/services/snippet-dedup-service';
import { getWorkspaceId } from '@/lib/auth/context';

/**
 * POST /api/info-snippets/analyze
 * AI 分析原始内容，返回结构化字段（不保存到数据库）
 * 用于前端预览和用户确认
 * 
 * Body: rawContent (必填)
 * 
 * 返回字段（对应前端表单）：
 * - categories: 分类标签数组（并列多标签，无主次之分）
 * - categoryLabels: 分类中文名数组
 * - title: 标题
 * - sourceOrg: 来源机构
 * - publishDate: 发布时间
 * - url: 原文链接
 * - summary: 摘要
 * - keywords: 关键词
 * - applicableScenes: 适用场景
 * - complianceWarnings: 合规预警（保险类）
 * - complianceLevel: 合规等级（保险类）
 * 
 * 去重检测：
 * - duplicateInfo: { isDuplicate, duplicateType, similarity } (重复信息)
 * - fromCache: boolean (是否来自缓存)
 */
export async function POST(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const body = await request.json();
    const { rawContent } = body;

    if (!rawContent?.trim()) {
      return NextResponse.json({ error: '请输入要分析的信息' }, { status: 400 });
    }

    // 🔥 去重检测
    let duplicateInfo: {
      isDuplicate: boolean;
      duplicateType: 'exact' | 'similar' | 'none';
      similarity?: number;
    } = { isDuplicate: false, duplicateType: 'none' };

    const dedupResult = await snippetDedupService.checkSnippetDuplicate(rawContent.trim(), workspaceId);
    duplicateInfo = {
      isDuplicate: dedupResult.isDuplicate,
      duplicateType: dedupResult.duplicateType,
      similarity: dedupResult.similarity,
    };

    // 🔥 如果重复且已有缓存分析，直接返回缓存结果
    if (dedupResult.isDuplicate && dedupResult.cachedAnalysis) {
      console.log('[info-snippets/analyze] 使用缓存的分析结果');
      
      const cached = dedupResult.cachedAnalysis as Record<string, any>;
      
      return NextResponse.json({
        success: true,
        data: {
          ...cached,
          rawContent: rawContent.trim(),
        },
        fromCache: true,
        duplicateInfo: {
          ...duplicateInfo,
          existingCreatedAt: dedupResult.existingRecord?.createdAt,
        },
      });
    }

    // 调用 LLM 分析
    const result = await enrichSnippetWithLLM(rawContent.trim());

    // 分类中文名映射
    const categoryLabels: Record<string, string> = {
      real_case: '身边真实案例',
      insurance: '保险',
      intelligence: '智能化',
      medical: '医疗',
      quick_note: '简要速记',
    };

    // 合规等级颜色映射
    const complianceLevelColors: Record<string, { bg: string; text: string }> = {
      A: { bg: 'bg-green-50', text: 'text-green-700' },
      B: { bg: 'bg-amber-50', text: 'text-amber-700' },
      C: { bg: 'bg-red-50', text: 'text-red-700' },
    };

    // 分类标签数组
    const categoryLabelList = result.categories.map(cat => categoryLabels[cat] || cat);

    const analysisResult = {
      // 原始内容（完整保存）
      rawContent: rawContent.trim(),
      
      // AI 分析结果
      categories: result.categories,
      categoryLabels: categoryLabelList,
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
    };

    // 🔥 保存哈希记录（带分析结果缓存）
    try {
      await snippetDedupService.saveSnippetHash({
        content: rawContent.trim(),
        workspaceId,
        analysis: analysisResult,
      });
    } catch (hashError) {
      console.error('[info-snippets/analyze] 保存哈希失败:', hashError);
      // 不阻塞主流程
    }

    return NextResponse.json({
      success: true,
      data: analysisResult,
      fromCache: false,
      duplicateInfo,
    });
  } catch (error: any) {
    console.error('[info-snippets/analyze POST] 错误:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

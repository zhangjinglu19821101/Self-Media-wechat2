import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { infoSnippets } from '@/lib/db/schema/info-snippets';
import { materialLibrary } from '@/lib/db/schema/material-library';
import { eq, and } from 'drizzle-orm';
import { getWorkspaceId } from '@/lib/auth/context';

/**
 * 速记分类 → 素材类型 映射
 * 
 * 信息速记的分类维度（领域）与素材库的类型维度（用途）不同：
 * - 速记分类：内容属于什么领域（保险/医疗/案例...）
 * - 素材类型：内容能怎么用（案例/数据/故事/引用...）
 * 
 * 映射规则：
 * - real_case → case（真实案例自然是案例素材）
 * - insurance → data（保险类信息多为数据/政策素材）
 * - medical → data（医疗类信息多为数据素材）
 * - intelligence → data（智能化信息多为数据素材）
 * - quick_note → data（简短速记默认数据类）
 */
function inferMaterialType(categories: string[]): string {
  if (categories.includes('real_case')) return 'case';
  if (categories.includes('insurance')) return 'data';
  if (categories.includes('medical')) return 'data';
  if (categories.includes('intelligence')) return 'data';
  return 'data'; // 默认数据类
}

/**
 * 速记分类 → 素材标签 映射
 * 
 * categories 中的分类维度，映射到素材库的三维标签：
 * - topicTags（主题标签）：内容属于什么领域
 * - sceneTags（场景标签）：内容适合在什么场景使用
 * - emotionTags（情绪标签）：内容传达什么情绪
 */
function mapCategoriesToTags(
  categories: string[],
  complianceLevel: string | null,
  applicableScenes: string | null,
): {
  topicTags: string[];
  sceneTags: string[];
  emotionTags: string[];
} {
  const topicMap: Record<string, string> = {
    insurance: '保险',
    medical: '医疗健康',
    intelligence: '智能化',
    real_case: '真实案例',
    quick_note: '速记',
  };

  // 主题标签 = 分类 → 领域名
  const topicTags = categories
    .filter(c => c !== 'quick_note')
    .map(c => topicMap[c] || c);

  // 场景标签 = applicableScenes 拆分
  const sceneTags = applicableScenes
    ? applicableScenes.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  // 情绪标签 = 基于合规等级推断
  const emotionTags: string[] = [];
  if (complianceLevel === 'C') emotionTags.push('违规风险');
  if (complianceLevel === 'B') emotionTags.push('需注意');
  if (categories.includes('real_case')) emotionTags.push('真实');

  return { topicTags, sceneTags, emotionTags };
}

/**
 * POST /api/info-snippets/[id]/convert-to-material
 * 将信息速记转化为正式素材（按 workspaceId 隔离）
 * 
 * 数据流：
 * 1. 读取 info_snippets 完整记录
 * 2. 映射字段到 material_library
 * 3. content 包含原始内容 + AI 分析结果（完整保存）
 * 4. categories → topicTags/sceneTags/emotionTags（智能映射）
 * 5. 反写 materialId 到 info_snippets（双向关联）
 * 6. 更新 info_snippets.status = 'organized'
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const overrideType = body.type; // 用户手动指定的素材类型（可选）

    // 查询原始速记（带 workspaceId 隔离）
    const snippets = await db.select().from(infoSnippets).where(
      and(
        eq(infoSnippets.id, id),
        eq(infoSnippets.workspaceId, workspaceId)
      )
    );

    if (snippets.length === 0) {
      return NextResponse.json({ error: '未找到该速记' }, { status: 404 });
    }

    const snippet = snippets[0];

    // 防重复转化
    if (snippet.status === 'organized' && snippet.materialId) {
      return NextResponse.json({ 
        error: '该速记已转化为素材', 
        materialId: snippet.materialId 
      }, { status: 409 });
    }

    // === 字段映射 ===

    // 素材类型：用户指定 > 从分类推断 > 默认 data
    const snippetCategories = (snippet.categories as string[]) || ['quick_note'];
    const materialType = overrideType || inferMaterialType(snippetCategories);

    // 标签映射：categories → topicTags/sceneTags/emotionTags
    const { topicTags, sceneTags, emotionTags } = mapCategoriesToTags(
      snippetCategories,
      snippet.complianceLevel,
      snippet.applicableScenes,
    );

    // content 完整保存：原始内容 + AI 分析结果
    const materialContent = [
      '📝 【原始信息】',
      snippet.rawContent || '',
      '',
      '📋 【AI 分析结果】',
      `标题：${snippet.title || '无标题'}`,
      `来源：${snippet.sourceOrg || '未知'}`,
      snippet.publishDate ? `发布时间：${snippet.publishDate}` : '',
      '',
      `摘要：${snippet.summary || ''}`,
      snippet.keywords ? `关键词：${snippet.keywords}` : '',
      snippet.applicableScenes ? `适用场景：${snippet.applicableScenes}` : '',
      snippet.complianceLevel ? `合规等级：${snippet.complianceLevel}` : '',
      snippet.url ? `\n📎 原文链接：${snippet.url}` : '',
    ].filter(Boolean).join('\n');

    // 插入素材库
    const [material] = await db.insert(materialLibrary).values({
      title: snippet.title || '无标题速记',
      type: materialType,
      content: materialContent,
      sourceType: 'info_snippet',
      sourceDesc: snippet.sourceOrg ? `来源：${snippet.sourceOrg}` : '信息速记转化',
      sourceUrl: snippet.url || null,
      topicTags,
      sceneTags,
      emotionTags,
      status: 'active',
      workspaceId,
    }).returning();

    // 🔥 反写 materialId 到速记表（双向关联）
    await db.update(infoSnippets).set({
      status: 'organized',
      materialId: material.id,  // 关联素材库记录 ID
      updatedAt: new Date(),
    }).where(
      and(
        eq(infoSnippets.id, id),
        eq(infoSnippets.workspaceId, workspaceId)
      )
    );

    console.log(`[convert-to-material] 速记 ${id} → 素材 ${material.id}，类型=${materialType}，标签=主题${topicTags.length}/场景${sceneTags.length}/情绪${emotionTags.length}`);

    return NextResponse.json({
      success: true,
      data: {
        material,
        materialType,
        topicTags,
        sceneTags,
        emotionTags,
        message: `已将「${snippet.title}」转化为${materialType === 'case' ? '案例' : '数据'}素材`,
      },
    });
  } catch (error: any) {
    console.error('[convert-to-material] 错误:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

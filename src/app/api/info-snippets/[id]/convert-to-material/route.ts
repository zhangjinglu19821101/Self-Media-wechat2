import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { infoSnippets } from '@/lib/db/schema/info-snippets';
import { materialLibrary } from '@/lib/db/schema/material-library';
import { eq, and } from 'drizzle-orm';
import { getWorkspaceId } from '@/lib/auth/context';

/**
 * POST /api/info-snippets/[id]/convert-to-material
 * 将信息速记转化为正式素材（按 workspaceId 隔离）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const { id } = await params;
    const body = await request.json();
    const { type = 'data', topicTags = [], sceneTags = [], emotionTags = [] } = body;

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

    // 创建正式素材（内容整合原始内容+AI分析结果）
    // 🔥 修复：保留用户原始输入的完整信息
    const materialContent = [
      '📝 【原始信息】',
      snippet.rawContent,
      '',
      '📋 【AI 分析结果】',
      `标题：${snippet.title}`,
      `来源：${snippet.sourceOrg || '未知'}`,
      snippet.publishDate ? `发布时间：${snippet.publishDate}` : '',
      '',
      `摘要：${snippet.summary || ''}`,
      snippet.keywords ? `关键词：${snippet.keywords}` : '',
      snippet.applicableScenes ? `适用场景：${snippet.applicableScenes}` : '',
      snippet.url ? `\n📎 原文链接：${snippet.url}` : '',
    ].filter(Boolean).join('\n');

    // 插入素材库（带 workspaceId）
    const [material] = await db.insert(materialLibrary).values({
      title: snippet.title,
      type,
      content: materialContent,
      sourceType: 'info_snippet',
      sourceDesc: `来源：${snippet.sourceOrg}`,
      sourceUrl: snippet.url || null,
      topicTags: topicTags as string[],
      sceneTags: sceneTags as string[],
      emotionTags: emotionTags as string[],
      status: 'active',
      workspaceId,
    }).returning();

    // 标记速记为已整理
    await db.update(infoSnippets).set({
      status: 'organized',
      updatedAt: new Date(),
    }).where(
      and(
        eq(infoSnippets.id, id),
        eq(infoSnippets.workspaceId, workspaceId)
      )
    );

    return NextResponse.json({
      success: true,
      data: {
        material,
        message: `已将「${snippet.title}」转化为素材，可在素材库中查看`,
      },
    });
  } catch (error: any) {
    console.error('[convert-to-material] 错误:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

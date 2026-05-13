/**
 * Phase 3: AI 辅助生成素材并一键入库
 * POST /api/materials/ai-generate-and-save
 *
 * 先调用 AI 生成素材，再保存到素材库
 */
import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceId, getAccountId } from '@/lib/auth/context';
import { callLLM } from '@/lib/agent-llm';
import { db } from '@/lib/db';
import { materialLibrary } from '@/lib/db/schema/material-library';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface GenerateAndSaveRequest {
  generateType: 'myth_busting' | 'regulation';
  input: string;
  context?: string;
  /** 是否保存到素材库（默认 true） */
  autoSave?: boolean;
  /** 行业标识（如 insurance_life, insurance_health, finance 等） */
  industry?: string;
  /** 关联的原始文章ID */
  sourceArticleId?: string;
}

function buildMythBustingPrompt(input: string, context?: string): string {
  return `你是一位资深的保险行业内容创作专家，擅长将复杂的保险知识转化为通俗易懂的科普内容。

## 任务
用户输入了一个常见的保险认知误区，请你生成一段高质量的"破局素材"。

## 输入的误区
${input}
${context ? `\n## 相关上下文\n${context}\n` : ''}

## 输出要求（严格JSON格式）
请输出以下JSON结构（不要用markdown代码块包裹）：
{
  "title": "素材标题（15字以内，突出误区核心）",
  "mythPoint": "误区要点（一句话概括这个误区）",
  "truthPoint": "真相要点（一句话揭示正确认知）",
  "breakingLogic": "破局逻辑（3-5句话，层层递进拆解误区）",
  "analogyRecommendation": "类比推荐（生活化类比）",
  "keyData": "关键数据（1-2个支撑数据）",
  "emotionalHook": "情绪钩子（5-15字）",
  "sceneType": "myth_busting",
  "materialType": "case"
}`;
}

function buildRegulationPrompt(input: string, context?: string): string {
  return `你是一位资深的保险法规解读专家，擅长将晦涩的法规条文转化为通俗内容。

## 任务
用户输入了一段保险相关的法规原文，请你生成一段高质量的"法规解读素材"。

## 输入的法规原文
${input}
${context ? `\n## 相关上下文\n${context}\n` : ''}

## 输出要求（严格JSON格式）
请输出以下JSON结构（不要用markdown代码块包裹）：
{
  "title": "素材标题（15字以内）",
  "regulationSource": "法规来源",
  "oneSentenceSummary": "一句话总结（30字以内）",
  "plainTextInterpretation": "通俗解读（3-5句）",
  "keyPoints": ["关键要点1", "关键要点2", "关键要点3"],
  "consumerImpact": "对消费者的影响（2-3句）",
  "practicalAdvice": "实操建议（1-2句）",
  "sceneType": "regulation",
  "materialType": "data"
}`;
}

export async function POST(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    if (!workspaceId || workspaceId === 'default-workspace') {
      return NextResponse.json({ error: '需要登录后使用' }, { status: 401 });
    }
    const _accountId = await getAccountId(request);

    const body: GenerateAndSaveRequest = await request.json();
    const { generateType, input, context, autoSave = true, industry, sourceArticleId } = body;

    if (!generateType || !input) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    if (generateType !== 'myth_busting' && generateType !== 'regulation') {
      return NextResponse.json({ error: 'generateType 仅支持 myth_busting 或 regulation' }, { status: 400 });
    }

    // Step 1: 调用 AI 生成
    const systemPrompt = generateType === 'myth_busting'
      ? '你是保险行业资深内容创作专家，擅长将复杂保险知识转化为通俗科普内容。请严格按照用户要求的JSON格式输出，不要用markdown代码块包裹。'
      : '你是保险法规解读专家，擅长将晦涩法规条文转化为通俗内容。请严格按照用户要求的JSON格式输出，不要用markdown代码块包裹。';

    const userPrompt = generateType === 'myth_busting'
      ? buildMythBustingPrompt(input, context)
      : buildRegulationPrompt(input, context);

    const llmResult = await callLLM(
      'ai-material-generator',
      'AI辅助生成素材并入库',
      systemPrompt,
      userPrompt,
      { timeout: 45000, maxRetries: 1 }
    );

    if (!llmResult || !llmResult.trim()) {
      return NextResponse.json({ error: 'AI 生成失败' }, { status: 500 });
    }

    // 解析 JSON
    let parsed: Record<string, unknown>;
    try {
      let cleaned = llmResult.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }
      parsed = JSON.parse(cleaned);
    } catch {
      const jsonMatch = llmResult.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[0]); } catch {
          return NextResponse.json({ error: 'AI 返回格式异常', rawOutput: llmResult.substring(0, 500) }, { status: 500 });
        }
      } else {
        return NextResponse.json({ error: 'AI 返回格式异常', rawOutput: llmResult.substring(0, 500) }, { status: 500 });
      }
    }

    parsed.generateType = generateType;
    parsed.input = input;

    // Step 2: 可选 - 自动保存到素材库
    let savedMaterial = null;
    if (autoSave) {
      try {
        const title = String(parsed.title || `AI生成-${generateType === 'myth_busting' ? '误区破局' : '法规解读'}素材`);
        const content = generateType === 'myth_busting'
          ? `【误区】${parsed.mythPoint || ''}\n【真相】${parsed.truthPoint || ''}\n【破局逻辑】${parsed.breakingLogic || ''}\n【类比推荐】${parsed.analogyRecommendation || ''}\n【关键数据】${parsed.keyData || ''}\n【情绪钩子】${parsed.emotionalHook || ''}`
          : `【来源】${parsed.regulationSource || ''}\n【一句话总结】${parsed.oneSentenceSummary || ''}\n【通俗解读】${parsed.plainTextInterpretation || ''}\n【关键要点】${Array.isArray(parsed.keyPoints) ? (parsed.keyPoints as string[]).join('；') : ''}\n【消费者影响】${parsed.consumerImpact || ''}\n【实操建议】${parsed.practicalAdvice || ''}`;

        const [inserted] = await db.insert(materialLibrary).values({
          title,
          content,
          type: String(parsed.materialType || 'case'),
          sourceType: 'ai_generate',
          ownerType: 'user',
          workspaceId,
          useCount: 0,
          topicTags: [],
          sceneTags: [generateType],
          emotionTags: [],
          industry: industry || null,
          sourceArticleId: sourceArticleId || null,
          sceneType: generateType || null,
          analysisText: content,
        }).returning();

        savedMaterial = inserted;
        console.log('[AI-Generate-Save] 素材已入库, ID:', inserted?.id);
      } catch (saveErr) {
        console.warn('[AI-Generate-Save] 入库失败（不影响生成结果）:', saveErr);
      }
    }

    return NextResponse.json({
      success: true,
      data: parsed,
      savedMaterial: savedMaterial ? {
        id: savedMaterial.id,
        title: savedMaterial.title,
      } : null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[AI-Generate-Save] 失败:', message);
    return NextResponse.json({ error: `生成失败: ${message}` }, { status: 500 });
  }
}

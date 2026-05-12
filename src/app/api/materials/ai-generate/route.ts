/**
 * Phase 3: AI 辅助生成素材
 * POST /api/materials/ai-generate
 *
 * 支持两种生成模式：
 * 1. myth_busting: 输入错误认知 → AI 生成破局逻辑+类比推荐
 * 2. regulation: 输入法规原文 → AI 生成通俗解读+关键要点
 */
import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceId } from '@/lib/auth/context';
import { callLLM } from '@/lib/agent-llm';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface GenerateRequest {
  generateType: 'myth_busting' | 'regulation';
  input: string;
  context?: string; // 可选的上下文信息（如产品名、法规编号等）
}

/**
 * 误区素材生成提示词
 */
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
  "breakingLogic": "破局逻辑（3-5句话，层层递进拆解误区，用数据和事实说话）",
  "analogyRecommendation": "类比推荐（用一个生活化的类比帮助理解）",
  "keyData": "关键数据（如有，提供1-2个支撑数据，格式：来源-数据）",
  "emotionalHook": "情绪钩子（一个引发共鸣的开头句，5-15字）",
  "sceneType": "myth_busting",
  "materialType": "case"
}

## 创作原则
1. 破局逻辑要"先承认后反转"——先理解为什么会有这个误区，再揭示真相
2. 类比要用保险小白能理解的生活场景（买菜、打车、看病等）
3. 数据要真实可查，不确定的标注"约"
4. 情绪钩子要踩中读者的焦虑点或利益点
5. 语言风格：专业但不冰冷，通俗但不低智`;
}

/**
 * 法规解读素材生成提示词
 */
function buildRegulationPrompt(input: string, context?: string): string {
  return `你是一位资深的保险法规解读专家，擅长将晦涩的法规条文转化为保险从业者和消费者都能理解的内容。

## 任务
用户输入了一段保险相关的法规原文，请你生成一段高质量的"法规解读素材"。

## 输入的法规原文
${input}
${context ? `\n## 相关上下文\n${context}\n` : ''}

## 输出要求（严格JSON格式）
请输出以下JSON结构（不要用markdown代码块包裹）：
{
  "title": "素材标题（15字以内，突出法规核心影响）",
  "regulationSource": "法规来源（如《保险法》第XX条、《健康险管理办法》等）",
  "oneSentenceSummary": "一句话总结（用大白话概括这条法规的核心含义，30字以内）",
  "plainTextInterpretation": "通俗解读（3-5句话，用最通俗的语言解释法规对普通人的影响）",
  "keyPoints": ["关键要点1", "关键要点2", "关键要点3"],
  "consumerImpact": "对消费者的影响（2-3句话，说明这条法规如何影响消费者的权益和选择）",
  "practicalAdvice": "实操建议（1-2句，消费者应该怎么做）",
  "sceneType": "regulation",
  "materialType": "data"
}

## 创作原则
1. 通俗解读要假设读者是"保险小白"，避免使用专业术语
2. 关键要点最多3条，每条不超过20字
3. 对消费者的影响要具体到"买保险时遇到XX情况怎么办"
4. 实操建议要可执行，不要空话
5. 如果法规原文不够具体，在相关字段标注"需结合具体产品条款"`;
}

export async function POST(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    if (!workspaceId || workspaceId === 'default-workspace') {
      return NextResponse.json({ error: '需要登录后使用' }, { status: 401 });
    }

    const body: GenerateRequest = await request.json();
    const { generateType, input, context } = body;

    if (!generateType || !input) {
      return NextResponse.json({ error: '缺少必要参数：generateType 或 input' }, { status: 400 });
    }

    if (generateType !== 'myth_busting' && generateType !== 'regulation') {
      return NextResponse.json({ error: 'generateType 仅支持 myth_busting 或 regulation' }, { status: 400 });
    }

    if (input.trim().length < 5) {
      return NextResponse.json({ error: '输入内容过短，至少需要5个字符' }, { status: 400 });
    }

    // 构建提示词
    const systemPrompt = generateType === 'myth_busting'
      ? '你是保险行业资深内容创作专家，擅长将复杂保险知识转化为通俗科普内容。请严格按照用户要求的JSON格式输出，不要用markdown代码块包裹。'
      : '你是保险法规解读专家，擅长将晦涩法规条文转化为通俗内容。请严格按照用户要求的JSON格式输出，不要用markdown代码块包裹。';

    const userPrompt = generateType === 'myth_busting'
      ? buildMythBustingPrompt(input, context)
      : buildRegulationPrompt(input, context);

    // 调用 LLM
    const llmResult = await callLLM(
      'ai-material-generator',
      'AI辅助生成素材',
      systemPrompt,
      userPrompt,
      { timeout: 45000, maxRetries: 1 }
    );

    if (!llmResult || !llmResult.trim()) {
      return NextResponse.json({ error: 'AI 生成失败，请重试' }, { status: 500 });
    }

    // 解析 JSON 结果
    let parsed: Record<string, unknown>;
    try {
      // 清理可能的 markdown 代码块包裹
      let cleaned = llmResult.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }
      parsed = JSON.parse(cleaned);
    } catch {
      console.warn('[AI-Generate] JSON 解析失败，原始输出:', llmResult.substring(0, 200));
      // 尝试提取 JSON 对象
      const jsonMatch = llmResult.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          return NextResponse.json({
            error: 'AI 返回格式异常，请重试',
            rawOutput: llmResult.substring(0, 500),
          }, { status: 500 });
        }
      } else {
        return NextResponse.json({
          error: 'AI 返回格式异常，请重试',
          rawOutput: llmResult.substring(0, 500),
        }, { status: 500 });
      }
    }

    // 补充生成类型标记
    parsed.generateType = generateType;
    parsed.input = input;

    return NextResponse.json({
      success: true,
      data: parsed,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[AI-Generate] 素材生成失败:', message);
    return NextResponse.json({ error: `生成失败: ${message}` }, { status: 500 });
  }
}

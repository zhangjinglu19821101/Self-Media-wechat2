/**
 * POST /api/agents/insurance-d/preview-outline
 * 
 * 【大纲预览】纯 LLM 调用，不写数据库，不生成 commandResultId
 * 
 * 用途：用户在正式提交任务前，预览 insurance-d 将生成的大纲结构
 * 特点：
 * - ✅ 单次调用 insurance-d LLM
 * - ❌ 不写入 agent_sub_tasks 表
 * - ❌ 不生成 commandResultId
 * - ❌ 不写入 agent_sub_tasks_step_history 表
 * - 仅返回大纲预览结果供用户参考
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getWorkspaceId } from '@/lib/auth/context';
import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { createUserLLMClient } from '@/lib/llm/factory';
import { handleRouteError, isApiKeyMissingResponse } from '@/lib/api/route-error-handler';

interface PreviewOutlineParams {
  instruction: string;       // 用户原始指令
  userOpinion?: string;      // 核心观点
  emotionTone?: string;      // 情感基调
  materialIds?: string[];    // 素材ID列表（可选，用于查询素材内容）
  materialContents?: Array<{  // 素材内容（前端已查询好的）
    id: string;
    title: string;
    content: string;
    type: string;
  }>;
}

// 🔥 安全常量：防止 LLM token 超限
const MAX_INSTRUCTION_LENGTH = 10000;   // 指令最大长度
const MAX_TOTAL_MATERIAL_LENGTH = 5000; // 素材总内容最大长度
const MAX_SINGLE_MATERIAL_LENGTH = 300; // 单个素材最大展示长度

// 🔥 简单内存限流：防止 LLM 调用被滥用
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1分钟窗口
const RATE_LIMIT_MAX_REQUESTS = 5;      // 每分钟最多5次请求

function checkRateLimit(clientId: string): { allowed: boolean; remaining: number; resetAfter: number } {
  const now = Date.now();
  const record = rateLimitMap.get(clientId);
  
  if (!record || now > record.resetTime) {
    // 新窗口或已过期，重置计数
    rateLimitMap.set(clientId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetAfter: RATE_LIMIT_WINDOW_MS / 1000 };
  }
  
  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { 
      allowed: false, 
      remaining: 0, 
      resetAfter: Math.ceil((record.resetTime - now) / 1000) 
    };
  }
  
  record.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - record.count, resetAfter: Math.ceil((record.resetTime - now) / 1000) };
}

/**
 * 构建 insurance-d 大纲预览的提示词
 */
function buildOutlinePreviewPrompt(params: PreviewOutlineParams): { systemPrompt: string; userPrompt: string } {
  const { instruction, userOpinion, emotionTone, materialContents = [] } = params;

  // System Prompt：insurance-d 的身份和角色
  const systemPrompt = `你是一位资深的保险科普文章作者（insurance-d），擅长将复杂的保险知识转化为通俗易懂、引人入胜的文章。

你的任务是：根据用户的创作需求，生成文章的大纲结构（注意：只输出大纲，不要写完整正文）。`;

  // User Prompt：构建创作需求
  let userPrompt = `## 创作需求\n\n${instruction}\n`;

  if (userOpinion) {
    userPrompt += `\n## 核心观点（必须在文章中体现）\n${userOpinion}\n`;
  }

  if (emotionTone) {
    const toneMap: Record<string, string> = {
      '理性客观': '中立对比，让读者自己判断',
      '踩坑警醒': '指出常见误区，提醒避坑',
      '温情共情': '理解读者处境，温暖建议',
      '专业权威': '数据说话，专家视角',
    };
    userPrompt += `\n## 情感基调\n${emotionTone}：${toneMap[emotionTone] || emotionTone}\n`;
  }

  if (materialContents.length > 0) {
    userPrompt += `\n## 可用素材（请在大纲中标注使用位置）\n`;
    materialContents.forEach((m, i) => {
      // 🔥 使用常量限制单个素材长度
      const truncatedContent = m.content.length > MAX_SINGLE_MATERIAL_LENGTH 
        ? m.content.slice(0, MAX_SINGLE_MATERIAL_LENGTH) + '...(截断)' 
        : m.content;
      userPrompt += `\n### 素材${i + 1} [${m.type}] ${m.title}\n${truncatedContent}\n`;
    });
  }

  userPrompt += `\n## 输出要求\n`;
  userPrompt += `- 请输出**文章大纲结构**，包含：\n`;
  userPrompt += `  1. 文章标题（2-3个备选）\n`;
  userPrompt += `  2. 各段落标题和核心论点（按顺序）\n`;
  userPrompt += `  3. 每段预计字数\n`;
  userPrompt += `  4. 素材使用位置标注\n`;
  userPrompt += `  5. 开篇案例建议\n`;
  userPrompt += `- **不要输出完整正文**，只要大纲结构\n`;
  userPrompt += `- 使用 JSON 格式返回\n\n`;
  userPrompt += `请直接输出 JSON 格式的大纲：\n`;
  userPrompt += `{\n  "titles": ["标题1", "标题2", "标题3"],\n  "outline": [\n    {\n      "section": "段落标题",\n      "keyPoints": ["核心论点1", "核心论点2"],\n      "wordCount": 300,\n      "materials": ["素材1"],\n      "note": "补充说明"\n    }\n  ],\n  "openingCase": "开篇案例建议",\n  "totalWordCount": 2000,\n  "writingStyle": "风格说明"\n}`;

  return { systemPrompt, userPrompt };
}

export async function POST(request: NextRequest) {
  console.log(`\n📝 [Preview-Outline] 收到大纲预览请求`);

  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    // 🔥 限流保护：基于 IP 的简单限流
    const clientId = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = checkRateLimit(clientId);
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { 
          success: false, 
          error: `调用过于频繁，请 ${rateLimitResult.resetAfter} 秒后重试`,
          retryAfter: rateLimitResult.resetAfter,
        },
        { 
          status: 429,
          headers: { 'Retry-After': String(rateLimitResult.resetAfter) },
        }
      );
    }

    const body: PreviewOutlineParams = await request.json();
    const { instruction, userOpinion, emotionTone, materialIds, materialContents } = body;

    // 验证必填参数
    if (!instruction || instruction.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: '指令不能为空' },
        { status: 400 }
      );
    }

    // 🔥 安全校验：限制输入长度，防止 LLM token 超限
    if (instruction.length > MAX_INSTRUCTION_LENGTH) {
      return NextResponse.json(
        { success: false, error: `指令过长（${instruction.length}字符），请控制在 ${MAX_INSTRUCTION_LENGTH} 字符以内` },
        { status: 400 }
      );
    }

    // 🔥 安全校验：素材总长度限制
    const materials = materialContents || [];
    const totalMaterialLength = materials.reduce((sum, m) => sum + m.content.length, 0);
    if (totalMaterialLength > MAX_TOTAL_MATERIAL_LENGTH) {
      return NextResponse.json(
        { success: false, error: `素材内容总长度过长（${totalMaterialLength}字符），请减少选择或精简素材` },
        { status: 400 }
      );
    }

    console.log(`[Preview-Outline] 指令长度: ${instruction.length}`);
    console.log(`[Preview-Outline] 有核心观点: ${!!userOpinion}`);
    console.log(`[Preview-Outline] 情感基调: ${emotionTone || '未设置'}`);
    console.log(`[Preview-Outline] 素材数量: ${(materialContents || []).length}`);

    // 构建提示词
    const { systemPrompt, userPrompt } = buildOutlinePreviewPrompt({
      instruction,
      userOpinion,
      emotionTone,
      materialIds,
      materialContents,
    });

    // 🔥 关键：直接调用 LLM，不写数据库（BYOK: 优先使用用户 Key）
    console.log(`[Preview-Outline] 开始调用 LLM 生成大纲...`);
    
    const workspaceId = await getWorkspaceId(request);
    const { client: llmClient } = await createUserLLMClient(workspaceId, { timeout: 30000 });

    const startTime = Date.now();
    
    const completion = await llmClient.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], {
      temperature: 0.7,
    });

    const responseText = completion?.content || '';
    const elapsedMs = Date.now() - startTime;

    console.log(`[Preview-Outline] LLM 响应耗时: ${elapsedMs}ms`);
    console.log(`[Preview-Outline] 响应长度: ${responseText.length}`);

    // 尝试解析 JSON 格式的大纲
    let outlineData;
    try {
      // 处理可能的 markdown 代码块包裹
      let jsonStr = responseText.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }
      outlineData = JSON.parse(jsonStr);
    } catch (parseError) {
      // 如果解析失败，返回原始文本
      console.warn('[Preview-Outline] JSON 解析失败，返回原始文本');
      outlineData = {
        raw: responseText,
        parseError: true,
      };
    }

    // ✅ 返回预览结果（无任何数据库写入）
    return NextResponse.json({
      success: true,
      data: {
        outline: outlineData,
        rawResponse: responseText,
        previewId: `preview-${Date.now()}`, // 仅用于前端标识，不存库
        generatedAt: new Date().toISOString(),
        elapsedMs,
        note: '这是预览结果，尚未创建任务。确认后提交才会正式执行。',
      },
    });

  } catch (error: unknown) {
    console.error('❌ [Preview-Outline] Error:', error);

    // 优先检查 API Key 缺失
    const keyMissingResponse = handleRouteError(error, '大纲预览失败');
    try {
      const body = await (keyMissingResponse as NextResponse).json();
      if (body?.code === 'API_KEY_MISSING') return keyMissingResponse;
    } catch { /* 非 API Key 错误，继续下面的特殊处理 */ }

    // 🔥 安全处理：使用 instanceof 检查
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    
    // 区分不同类型的错误
    if (errorMessage.includes('timeout') || errorMessage.includes('超时')) {
      return NextResponse.json(
        { success: false, error: 'LLM 调用超时，请稍后重试' },
        { status: 408 }
      );
    }
    
    if (errorMessage.includes('rate limit') || errorMessage.includes('限流')) {
      return NextResponse.json(
        { success: false, error: '调用过于频繁，请稍后重试' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { success: false, error: process.env.NODE_ENV === 'development' ? errorMessage : '大纲预览失败，请稍后重试' },
      { status: 500 }
    );
  }
}

/**
 * AI 辅助修改 API
 * POST /api/agents/ai-revise
 *
 * 接收：段落内容 + 文章上下文 + 修改要求
 * 返回：3 个修改方案
 */
import { NextRequest, NextResponse } from 'next/server';
import { getPlatformLLM, createUserLLMClient } from '@/lib/llm/factory';
import { getWorkspaceId } from '@/lib/auth/context';

const AI_REVISE_SYSTEM_PROMPT = `你是一位资深的内容编辑专家，擅长保险领域的文章润色和改写。

用户会给你一段文章段落、文章上下文和修改要求。你需要提供3个不同风格的修改方案。

## 输出格式（严格JSON）
{
  "schemes": [
    {
      "label": "方案名称（4字以内）",
      "description": "一句话说明修改思路",
      "content": "修改后的完整段落内容"
    },
    {
      "label": "方案名称",
      "description": "一句话说明修改思路",
      "content": "修改后的完整段落内容"
    },
    {
      "label": "方案名称",
      "description": "一句话说明修改思路",
      "content": "修改后的完整段落内容"
    }
  ]
}

## 3个方案的设计原则
- 方案1「微调优化」：最小改动，仅修正语病、优化措辞，保持原意和结构不变
- 方案2「深化扩展」：适度改写，增加细节或数据支撑，让论述更有说服力
- 方案3「创意重构」：较大幅度改写，换角度或换表达方式，但保留核心论点

## 修改规则
1. 严格遵守用户的修改要求
2. 保险相关内容必须合规，不得包含承诺收益、夸大保障等违规表述
3. HTML标签保持与原文一致（如果原文有HTML标签）
4. 修改后的段落长度与原文相近（不超过原文2倍，不低于原文50%）
5. 每个方案必须是完整的段落内容，可以直接替换原文
6. 只输出JSON，不要输出其他内容`;

const AI_REVISE_USER_PROMPT = `## 文章标题
{articleTitle}

## 文章上下文（前后各1段，供参考）
{context}

## 当前段落（需要修改的段落）
{paragraph}

## 用户的修改要求
{requirement}

请提供3个修改方案。`;

/** LLM 调用超时（30秒） */
const LLM_TIMEOUT_MS = 30_000;

/**
 * 使用栈匹配精确提取 JSON 对象
 * 避免贪婪正则匹配到非 JSON 内容（如 [微信公众号] 等）
 */
function extractJsonObjectWithStack(text: string): string | null {
  // 先尝试代码块格式
  const codeBlockMatch = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // 栈匹配提取最外层 {...}
  const firstBrace = text.indexOf('{');
  if (firstBrace === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = firstBrace; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        return text.substring(firstBrace, i + 1);
      }
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      paragraph,
      articleTitle,
      contextBefore,
      contextAfter,
      requirement,
      workspaceId: bodyWorkspaceId,
    } = body;

    if (!paragraph || typeof paragraph !== 'string' || paragraph.trim().length < 5) {
      return NextResponse.json({ error: '段落内容不能为空且至少5个字' }, { status: 400 });
    }
    if (!requirement || typeof requirement !== 'string' || requirement.trim().length < 2) {
      return NextResponse.json({ error: '修改要求不能为空且至少2个字' }, { status: 400 });
    }

    const workspaceId = bodyWorkspaceId || getWorkspaceId(request);

    // 构建上下文
    const contextParts: string[] = [];
    if (contextBefore) contextParts.push(`【前文】\n${contextBefore}`);
    if (contextAfter) contextParts.push(`【后文】\n${contextAfter}`);
    const contextStr = contextParts.length > 0 ? contextParts.join('\n\n') : '（无上下文）';

    const userPrompt = AI_REVISE_USER_PROMPT
      .replace('{articleTitle}', articleTitle || '（无标题）')
      .replace('{context}', contextStr)
      .replace('{paragraph}', paragraph)
      .replace('{requirement}', requirement);

    // 调用轻量级 LLM（优先用户 Key，降级平台 Key）
    let llmClient: InstanceType<typeof import('coze-coding-dev-sdk').LLMClient>;
    try {
      const result = await createUserLLMClient(workspaceId as string);
      llmClient = result.client;
    } catch {
      // 降级到平台 Key
      llmClient = getPlatformLLM();
    }

    // 带超时的 LLM 调用
    const response = await Promise.race([
      llmClient.invoke(
        [
          { role: 'system', content: AI_REVISE_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        { model: 'doubao-seed-1-6-lite' }
      ),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('AI 响应超时，请稍后重试')), LLM_TIMEOUT_MS)
      ),
    ]);

    // 解析响应（使用栈匹配代替贪婪正则）
    const responseText = response?.content || '';
    let schemes: Array<{ label: string; description: string; content: string }> = [];

    try {
      const jsonStr = extractJsonObjectWithStack(responseText);
      if (jsonStr) {
        const parsed = JSON.parse(jsonStr);
        if (parsed.schemes && Array.isArray(parsed.schemes)) {
          schemes = parsed.schemes.slice(0, 3).map((s: Record<string, unknown>) => ({
            label: String(s.label || '方案'),
            description: String(s.description || ''),
            content: String(s.content || ''),
          }));
        }
      }
    } catch {
      console.warn('[ai-revise] JSON parse failed, returning error to user');
    }

    // 解析失败时返回明确错误（而非伪装成功）
    if (schemes.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'AI 生成失败，请重试或换个修改要求',
        schemes: [],
      }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      schemes,
      requirement,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'AI辅助修改失败';
    console.error('[ai-revise] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

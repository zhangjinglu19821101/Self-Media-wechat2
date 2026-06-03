/**
 * AI 辅助修改 API
 * POST /api/agents/ai-revise
 *
 * 接收：段落内容/选中文本 + 文章上下文 + 修改要求
 * 返回：2+ 个修改方案（含素材辅助改写）
 * 
 * V2 增强：
 * - 支持选中片段改写（selectedText 参数）
 * - 集成素材库查找（查找与选中内容相关的素材辅助改写）
 */
import { NextRequest, NextResponse } from 'next/server';
import { getPlatformLLM, createUserLLMClient } from '@/lib/llm/factory';
import { getWorkspaceId } from '@/lib/auth/context';
import { db } from '@/lib/db';
import { materialLibrary } from '@/lib/db/schema/material-library';
import { eq, or, and, sql } from 'drizzle-orm';

const AI_REVISE_SYSTEM_PROMPT = `你是一位资深的内容编辑专家，擅长保险领域的文章润色和改写。你将与作者协作，帮助作者提升文章质量。

用户会给你一段文章段落（或选中的片段）、文章上下文和修改方向。你可能还会收到相关素材，请参考素材中的真实案例、数据或引用来丰富改写内容。

## 输出格式（严格JSON）
{
  "schemes": [
    {
      "label": "方案名称（4字以内）",
      "description": "一句话说明改写思路",
      "content": "改写后的完整段落内容"
    },
    {
      "label": "方案名称",
      "description": "一句话说明改写思路",
      "content": "改写后的完整段落内容"
    }
  ]
}

## 2个方案的设计原则
- 方案1「保守优化」：贴近原意，仅优化措辞和表达节奏，保持原有结构和信息不变。如果有素材，融入最贴切的一个案例或数据
- 方案2「创新表达」：在原意基础上换角度/换表达方式，增加画面感或感染力。如果有素材，尝试用素材中的案例/数据替换原文中的泛泛表述

## 修改规则
1. 严格遵守用户的修改方向/要求
2. 保险相关内容必须合规，不得包含承诺收益、夸大保障等违规表述
3. HTML标签保持与原文一致（如果原文有HTML标签）
4. 改写后的段落长度与原文相近（不超过原文2倍，不低于原文50%）
5. 每个方案必须是完整的段落内容，可以直接替换原文
6. 只输出JSON，不要输出其他内容
7. 如果原文中有具体的保险产品名称、法规条文、数据数字，保持不变
8. 如果提供了相关素材，优先使用素材中的真实数据/案例替代原文中的模糊表述
9. 素材引用要自然融入，不要生硬插入`;

const AI_REVISE_USER_PROMPT = `## 文章标题
{articleTitle}

## 文章上下文（前后各1段，供参考）
{context}

## {contentLabel}
{content}

## 用户的修改要求
{requirement}

{materialsSection}

请提供2个改写方案。`;

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
      selectedText, // V2: 选中片段（可选，如果提供则只改写选中部分）
      articleTitle,
      contextBefore,
      contextAfter,
      requirement,
      workspaceId: bodyWorkspaceId,
    } = body;

    // V2: 支持选中片段或整段改写
    const contentToRevise = selectedText || paragraph;
    const contentLabel = selectedText ? '选中的片段（需要修改的部分）' : '当前段落（需要修改的段落）';

    if (!contentToRevise || typeof contentToRevise !== 'string' || contentToRevise.trim().length < 5) {
      return NextResponse.json({ error: '内容不能为空且至少5个字' }, { status: 400 });
    }
    if (!requirement || typeof requirement !== 'string' || requirement.trim().length < 2) {
      return NextResponse.json({ error: '修改要求不能为空且至少2个字' }, { status: 400 });
    }

    const workspaceId = bodyWorkspaceId || getWorkspaceId(request);

    // V2: 查找相关素材
    let materialsSection = '';
    try {
      const materials = await findRelatedMaterials(contentToRevise, workspaceId);
      if (materials.length > 0) {
        const materialTexts = materials.slice(0, 3).map((m, i) => 
          `### 素材${i + 1}: ${m.title}\n类型: ${m.type} | 标签: ${m.tags || '无'}\n内容: ${m.content?.substring(0, 300) || '无详细内容'}`
        ).join('\n\n');
        materialsSection = `## 相关素材（参考这些素材来丰富改写内容）\n${materialTexts}`;
      }
    } catch (e) {
      console.warn('[ai-revise] 素材查找失败（非阻塞）:', e instanceof Error ? e.message : String(e));
    }

    // 构建上下文
    const contextParts: string[] = [];
    if (contextBefore) contextParts.push(`【前文】\n${contextBefore}`);
    if (contextAfter) contextParts.push(`【后文】\n${contextAfter}`);
    const contextStr = contextParts.length > 0 ? contextParts.join('\n\n') : '（无上下文）';

    const userPrompt = AI_REVISE_USER_PROMPT
      .replace('{articleTitle}', articleTitle || '（无标题）')
      .replace('{context}', contextStr)
      .replace('{contentLabel}', contentLabel)
      .replace('{content}', contentToRevise)
      .replace('{requirement}', requirement)
      .replace('{materialsSection}', materialsSection);

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
      hasMaterials: materialsSection.length > 0,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'AI辅助修改失败';
    console.error('[ai-revise] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * V2: 查找与改写内容相关的素材
 * 从素材库中搜索与选中内容关键词匹配的素材
 */
async function findRelatedMaterials(
  text: string, 
  workspaceId: string,
  limit = 5
): Promise<Array<{ id: number; title: string; type: string; content: string | null; tags: string | null }>> {
  try {
    // 从文本中提取关键词（简单分词：取2-4字的词组）
    const keywords = extractKeywords(text);
    if (keywords.length === 0) return [];

    // 构建搜索条件：标题或内容包含任一关键词
    const conditions = keywords.slice(0, 5).map(kw => 
      or(
        sql`${materialLibrary.title} ILIKE ${'%' + kw + '%'}`,
        sql`${materialLibrary.content} ILIKE ${'%' + kw + '%'}`
      )
    );

    const results = await db
      .select({
        id: materialLibrary.id,
        title: materialLibrary.title,
        type: materialLibrary.type,
        content: materialLibrary.content,
      tags: sql<string | null>`${materialLibrary.topicTags}::text`,
      })
      .from(materialLibrary)
      .where(
        and(
          or(
            eq(materialLibrary.ownerType, 'system' as any),
            eq(materialLibrary.workspaceId, workspaceId)
          ),
          or(...conditions)
        )
      )
      .limit(limit);

    return results.map(r => ({ id: Number(r.id), title: r.title ?? '', type: r.type ?? '', content: r.content ?? '', tags: r.tags ?? '' }));
  } catch (e) {
    console.warn('[ai-revise] 素材查找异常:', e instanceof Error ? e.message : String(e));
    return [];
  }
}

/**
 * 简单中文关键词提取
 * 从文本中提取2-4字的词组，用于素材搜索
 */
function extractKeywords(text: string): string[] {
  // 移除HTML标签和标点
  const cleanText = text
    .replace(/<[^>]+>/g, '')
    .replace(/[，。！？、；：""''（）【】《》\s\d]/g, ' ')
    .trim();
  
  // 按空格和常见分隔符分割
  const segments = cleanText.split(/\s+/).filter(s => s.length >= 2 && s.length <= 8);
  
  // 提取2-4字的子串（模拟中文分词）
  const keywords = new Set<string>();
  for (const seg of segments) {
    if (seg.length >= 2 && seg.length <= 4) {
      keywords.add(seg);
    } else if (seg.length > 4) {
      // 长词拆分为2字和3字子串
      for (let i = 0; i < seg.length - 1; i++) {
        keywords.add(seg.substring(i, i + 2));
      }
    }
  }

  // 过滤停用词
  const stopWords = new Set(['的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这', '他', '她', '它', '们', '那', '被', '从', '把', '让', '对', '为', '与', '但', '而', '如果', '因为', '所以', '可以', '这个', '那个', '什么', '怎么', '如何']);
  
  return Array.from(keywords).filter(k => !stopWords.has(k)).slice(0, 8);
}

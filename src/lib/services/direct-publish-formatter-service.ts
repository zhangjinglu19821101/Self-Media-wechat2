/**
 * 直接发文格式化服务
 *
 * 使用 LLM 将用户提供的纯文本文章转换为平台渲染数据：
 * 1. 微信：应用 insurance-d HTML 样式模板排版（橙色开头、青绿小标题、红色警示等）
 * 2. 小红书：LLM 智能提取封面标题、核心要点、结尾金句
 * 3. 知乎/头条：LLM 提取精炼标题
 *
 * 失败时降级到 text-to-render.ts 的简单文本处理逻辑
 */

import type {
  PlatformType,
  PlatformRenderData,
  XhsPlatformRenderData,
  XhsCardCountMode,
  XhsCoverCard,
  XhsPointCard,
  XhsEndingCard,
  WechatPlatformRenderData,
} from '@/lib/platform-render/types';
import { XHS_CARD_MODE_POINT_COUNT } from '@/lib/platform-render/types';
import { generatePlatformRenderDataFromText } from '@/lib/platform-render/text-to-render';
import { createUserLLMClient, getPlatformLLM } from '@/lib/llm/factory';

// ============ 类型定义 ============

export interface DirectPublishFormatOptions {
  /** 用户提供的纯文本文章 */
  textContent: string;
  /** 目标平台 */
  platform: PlatformType | string;
  /** 文章标题（可选，LLM 会自动提取） */
  articleTitle?: string;
  /** 小红书卡片数量模式 */
  cardCountMode?: XhsCardCountMode;
  /** workspaceId（用于 BYOK 用户 API Key） */
  workspaceId?: string;
  /** 取消信号 */
  signal?: AbortSignal;
}

// ============ 主入口 ============

/**
 * 使用 LLM 格式化直接发文文章
 *
 * 优先使用 LLM 进行智能排版/摘要，失败时降级到简单文本处理
 */
export async function formatDirectPublishArticle(
  options: DirectPublishFormatOptions
): Promise<PlatformRenderData | null> {
  const { textContent, platform } = options;

  if (!textContent || !textContent.trim()) return null;

  // 知乎/头条不需要 LLM 格式化，直接使用简单文本处理
  if (platform === 'zhihu' || platform === 'douyin' || platform === 'weibo') {
    return generatePlatformRenderDataFromText(
      textContent,
      platform,
      options.articleTitle
    );
  }

  // 微信/小红书使用 LLM 格式化
  try {
    const result = await formatWithLLM(options);
    if (result) return result;
  } catch (error) {
    console.warn('[DirectPublishFormatter] LLM格式化失败，降级到简单文本处理', error);
  }

  // 降级：使用简单文本处理
  return generatePlatformRenderDataFromText(
    textContent,
    platform,
    options.articleTitle,
    options.cardCountMode
  );
}

// ============ LLM 格式化核心 ============

/**
 * 根据平台调用不同的 LLM 格式化方法
 */
async function formatWithLLM(
  options: DirectPublishFormatOptions
): Promise<PlatformRenderData | null> {
  const { platform, workspaceId, signal } = options;

  // 获取 LLM Client
  const llmClient = await getLLMClient(workspaceId);
  const model = 'doubao-seed-2-0-mini-260215'; // 轻量模型，格式化任务足够

  switch (platform) {
    case 'wechat_official':
      return formatWechatWithLLM(llmClient, model, options, signal);
    case 'xiaohongshu':
      return formatXhsWithLLM(llmClient, model, options, signal);
    default:
      return null;
  }
}

// ============ 微信公众号 LLM 格式化 ============

/**
 * 微信公众号 HTML 样式模板
 * 与 insurance-d-v3.md 第四部分 HTML 输出格式完全对齐
 */
const WECHAT_HTML_TEMPLATE_SPEC = `
<section style="background:#ffffff; padding:0 12px; font-size:14px; line-height:1.6;">
  <!-- 开头引导语（橙色 #E67E22、加粗、居左） -->
  <p style="color:#E67E22; font-weight:bold; margin:0 0 1em; text-align:left;">开头引导语</p>

  <!-- 一级标题（黑色 #000000、加粗、居中）+ 分割线 -->
  <h2 style="color:#000000; font-weight:bold; text-align:center; margin:1em 0; font-size:14px;">一级标题</h2>
  <hr style="border:none; border-top:1px solid #eee; width:90%; margin:0.5em auto;">

  <!-- 二级标题（青绿色 #1A8A6F、加粗、居左） -->
  <h3 style="color:#1A8A6F; font-weight:bold; text-align:left; margin:1em 0; font-size:14px; line-height:1.75;">二级标题</h3>
  <!-- 正文（深灰 #3E3E3E、居左） -->
  <p style="color:#3E3E3E; text-align:left; margin:0 0 1em;">正文内容</p>

  <!-- 重要提醒（红色 #FF0000、加粗、居左） -->
  <p style="color:#FF0000; font-weight:bold; text-align:left; margin:0 0 1em;">⚠️ 重要提醒</p>

  <!-- 互动提问（深灰、居左） -->
  <p style="color:#3E3E3E; text-align:left; margin:2em 0 1em;">【互动提问】...</p>
  <!-- 免责声明（小号12px、浅灰 #666666、居左） -->
  <p style="font-size:12px; color:#666666; text-align:left; line-height:1.5; margin:1em 0;">【免责声明】本文仅为知识科普，不构成投资/购买建议。</p>
</section>
`;

const WECHAT_FORMAT_SYSTEM_PROMPT = `你是一个微信公众号文章排版专家。你的任务是将用户提供的纯文本文章转换为公众号标准HTML排版格式。

核心规则：
1. **保持原文内容完全不变** — 不改写、不删减、不增加任何段落
2. **仅做排版格式化** — 添加HTML标签和内联样式，调整排版结构
3. **使用以下样式模板**（每个元素的内联样式必须严格一致）：

${WECHAT_HTML_TEMPLATE_SPEC}

排版识别规则：
- 开头第一段话 → 橙色加粗引导语（color:#E67E22）
- 带有"一、""二、""三、"等序号的大标题 → 黑色居中h2 + 分割线hr
- 带有"1.""2.""3."等小标题 → 青绿色左对齐h3（color:#1A8A6F）
- 含有"注意""提醒""警示""小心"等关键词 → 红色加粗提醒（color:#FF0000）
- 含有"⚠️""❗""❌"等符号 → 红色加粗提醒
- 正文段落 → 深灰正文（color:#3E3E3E）
- 结尾提问或互动 → 深灰互动提问（margin:2em 0 1em）
- 如果原文没有免责声明，末尾自动添加标准免责声明（小号浅灰）

输出要求：
- 仅输出HTML代码，不要输出任何解释文字
- 使用完整的 <section> 包裹
- 一级标题用 <h2> + <hr> 分隔线
- 二级标题用 <h3>
- 所有样式必须使用内联style，不要使用class
- 文章末尾必须有免责声明`;

async function formatWechatWithLLM(
  llmClient: any,
  model: string,
  options: DirectPublishFormatOptions,
  signal?: AbortSignal
): Promise<WechatPlatformRenderData | null> {
  const { textContent, articleTitle } = options;

  const userPrompt = `请将以下纯文本文章格式化为公众号标准HTML排版：

${textContent}`;

  try {
    const response = await llmClient.invoke([
      { role: 'system', content: WECHAT_FORMAT_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ], {
      model,
      temperature: 0.1, // 低温度，保持忠实于原文
      signal,
    });

    const htmlContent = extractHtmlFromResponse(response.content || '');

    if (!htmlContent || htmlContent.length < 50) {
      console.warn('[DirectPublishFormatter] LLM返回的HTML内容过短，可能格式化失败');
      return null;
    }

    // 从 HTML 或原文提取标题
    const title = articleTitle || extractTitleFromHtml(htmlContent) || extractTitleFromText(textContent) || '文章预览';

    return {
      platform: 'wechat_official',
      htmlContent,
      articleTitle: title,
    };
  } catch (error: any) {
    if (error.name === 'AbortError') return null;
    console.error('[DirectPublishFormatter] 微信格式化LLM调用失败:', error?.message);
    return null;
  }
}

// ============ 小红书 LLM 格式化 ============

const XHS_FORMAT_SYSTEM_PROMPT = `你是一个小红书内容策划专家。你的任务是从用户提供的文章中提取关键信息，用于生成小红书图文卡片的展示内容。

核心要求：
1. **概括而非截取** — 标题和要点必须是你对内容的理解和概括，不是简单截取原文
2. **封面标题**：15字以内，吸引眼球但不标题党，有悬念或反差感
3. **要点标题**：15字以内，简洁有力、引发好奇
4. **要点内容**：50字以内，概括核心信息，像朋友分享的口吻
5. **结尾金句**：20字以内，有温度有共鸣
6. **语气风格**：有温度、接地气、像朋友在分享，不要AI感

注意：
- 不要照搬原文句子作为标题
- 封面标题要有"小红书味"（如用"揭秘""避坑""真相"等词）
- 每个要点聚焦一个核心观点
- 如果原文有数据/案例，要点中优先体现

输出严格JSON格式（不要任何其他文字）：
{
  "coverTitle": "封面标题（≤15字）",
  "coverSubtitle": "封面副标题（≤30字，可选）",
  "points": [
    { "title": "要点1标题（≤15字）", "content": "要点1概括（≤50字）" }
  ],
  "endingConclusion": "结尾金句（≤20字）",
  "articleTitle": "文章简短标题（≤15字，用于任务列表）",
  "tags": ["标签1", "标签2", "标签3"]
}`;

async function formatXhsWithLLM(
  llmClient: any,
  model: string,
  options: DirectPublishFormatOptions,
  signal?: AbortSignal
): Promise<XhsPlatformRenderData | null> {
  const { textContent, cardCountMode } = options;

  // 计算需要的要点数量
  const effectiveCardCountMode = cardCountMode || '5-card';
  const pointCount = XHS_CARD_MODE_POINT_COUNT[effectiveCardCountMode] || 3;

  const userPrompt = `请从以下文章中提取${pointCount}个核心要点，用于小红书图文卡片展示：

${textContent}

要求：提取${pointCount}个要点，每个要点有标题（≤15字）和概括内容（≤50字）。`;

  try {
    const response = await llmClient.invoke([
      { role: 'system', content: XHS_FORMAT_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ], {
      model,
      temperature: 0.7, // 适中温度，生成更有创意的标题
      signal,
    });

    const content = response.content || '';
    const parsed = parseXhsJsonResponse(content);

    if (!parsed || !parsed.coverTitle) {
      console.warn('[DirectPublishFormatter] 小红书LLM返回格式异常');
      return null;
    }

    // 构建 cards 数组
    const cards: Array<XhsCoverCard | XhsPointCard | XhsEndingCard> = [];

    // 封面卡
    const coverCard: XhsCoverCard = {
      type: 'cover',
      title: parsed.coverTitle.substring(0, 20),
    };
    if (parsed.coverSubtitle) {
      coverCard.subtitle = parsed.coverSubtitle.substring(0, 30);
    }
    cards.push(coverCard);

    // 要点卡（按 cardCountMode 限制数量）
    const maxPoints = XHS_CARD_MODE_POINT_COUNT[effectiveCardCountMode] || 3;
    const points = (parsed.points || []).slice(0, maxPoints);

    for (const point of points) {
      cards.push({
        type: 'point',
        title: (point.title || '').substring(0, 15) || '要点',
        content: (point.content || '').substring(0, 80) || '',
      });
    }

    // 如果要点不足，补齐
    while (cards.length < maxPoints + 1) {
      cards.push({
        type: 'point',
        title: `要点${cards.length}`,
        content: '',
      });
    }

    // 结尾卡
    cards.push({
      type: 'ending',
      conclusion: (parsed.endingConclusion || '感谢阅读').substring(0, 50),
      tags: (parsed.tags || []).slice(0, 5),
    });

    return {
      platform: 'xiaohongshu',
      cardCountMode: effectiveCardCountMode,
      cards,
      textContent,
      articleTitle: (parsed.articleTitle || parsed.coverTitle || '文章预览').substring(0, 15),
    };
  } catch (error: any) {
    if (error.name === 'AbortError') return null;
    console.error('[DirectPublishFormatter] 小红书格式化LLM调用失败:', error?.message);
    return null;
  }
}

// ============ 工具函数 ============

/**
 * 获取 LLM Client（优先使用用户 BYOK Key）
 */
async function getLLMClient(workspaceId?: string): Promise<any> {
  if (workspaceId) {
    try {
      const { client } = await createUserLLMClient(workspaceId, { timeout: 60000 });
      return client;
    } catch {
      // BYOK 失败，降级到平台 Key
    }
  }
  return getPlatformLLM();
}

/**
 * 从 LLM 响应中提取 HTML 内容
 *
 * 处理多种返回格式：
 * 1. 纯 HTML（以 <section 或 <div 开头）
 * 2. Markdown 代码块包裹的 HTML
 * 3. 带 ```html 标记的
 */
function extractHtmlFromResponse(content: string): string {
  if (!content) return '';

  const trimmed = content.trim();

  // 1. 尝试提取 markdown 代码块中的 HTML
  const codeBlockMatch = trimmed.match(/```html?\s*\n([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // 2. 如果以 <section 开头，直接返回
  if (trimmed.startsWith('<section')) {
    return trimmed;
  }

  // 3. 如果包含 <section 标签，提取从 <section 到 </section> 的内容
  const sectionMatch = trimmed.match(/<section[\s\S]*<\/section>/);
  if (sectionMatch) {
    return sectionMatch[0];
  }

  // 4. 兜底：返回原内容（可能就是 HTML）
  return trimmed;
}

/**
 * 从 HTML 内容中提取标题
 *
 * 优先级：h1 > h2 > 第一个有意义的文本
 */
function extractTitleFromHtml(html: string): string {
  // 尝试从 h1 提取
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  if (h1Match) {
    return stripHtmlTags(h1Match[1]).substring(0, 15).trim();
  }

  // 尝试从 h2 提取（取第一个）
  const h2Match = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
  if (h2Match) {
    return stripHtmlTags(h2Match[1]).substring(0, 15).trim();
  }

  return '';
}

/**
 * 从纯文本中提取标题
 */
function extractTitleFromText(text: string): string {
  if (!text) return '';
  const firstLine = text.split('\n')[0].trim();
  return firstLine.substring(0, 15).replace(/[，。！？；：、\s]+$/, '').trim();
}

/**
 * 去除 HTML 标签
 */
function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

/**
 * 解析小红书 LLM 返回的 JSON
 *
 * 多层兜底策略：
 * 1. 直接 JSON.parse
 * 2. 提取 markdown 代码块中的 JSON
 * 3. 大括号定位提取
 */
function parseXhsJsonResponse(content: string): XhsLlmResult | null {
  if (!content) return null;

  const trimmed = content.trim();

  // 1. 直接解析
  try {
    return JSON.parse(trimmed);
  } catch {}

  // 2. 提取 markdown 代码块
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {}
  }

  // 3. 大括号定位
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.substring(firstBrace, lastBrace + 1));
    } catch {}
  }

  console.warn('[DirectPublishFormatter] 小红书LLM返回内容无法解析为JSON:', trimmed.substring(0, 200));
  return null;
}

interface XhsLlmResult {
  coverTitle?: string;
  coverSubtitle?: string;
  points?: Array<{ title?: string; content?: string }>;
  endingConclusion?: string;
  articleTitle?: string;
  tags?: string[];
}

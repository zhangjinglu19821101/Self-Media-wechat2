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

import type { LLMClient } from 'coze-coding-dev-sdk';

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
  const { platform, workspaceId } = options;

  // 获取 LLM Client
  const llmClient = await getLLMClient(workspaceId);
  // 🔴 使用与 insurance-d 相同的高质量模型，确保 HTML 格式化效果一致
  // doubao-seed-2-0-pro-260215 能更好地遵循公众号标准 HTML 格式规范
  const model = 'doubao-seed-2-0-pro-260215';

  switch (platform) {
    case 'wechat_official':
      return formatWechatWithLLM(llmClient, model, options);
    case 'xiaohongshu':
      return formatXhsWithLLM(llmClient, model, options);
    default:
      return null;
  }
}

// ============ 微信公众号 LLM 格式化 ============

/**
 * 微信公众号 HTML 样式模板
 * 与 insurance-d-v3.md v3.3 第四部分 HTML 输出格式完全对齐
 * 公众号API上传专用最终版 - 2026年5月更新
 *
 * 【强制规则 - 必须100%遵守，否则API上传样式会丢失】
 * 1. 所有单位必须使用px，禁止使用em/rem
 * 2. 所有样式必须写在style属性内，禁止使用<style>标签
 * 3. 禁止使用任何不在白名单内的CSS属性
 * 4. 所有内容必须使用<p>标签，包括标题、正文、提示、引用等
 * 5. 绝对禁止使用<h1>-<h6>、<div>、<section>、<hr>标签
 * 6. 绝对禁止使用!important
 * 7. 所有元素必须有自己的font-size、line-height和color，不依赖任何继承
 */
const WECHAT_HTML_TEMPLATE_SPEC = `
<!-- 公众号API上传专用最终版 - 核心原则：只用<p>标签，所有样式内联，不依赖继承 -->

<!-- 开篇引导语（橙色、加粗） -->
<p style="margin:0 0 16px 0; padding:0 12px; color:#E67E22; font-weight:bold; font-size:14px; line-height:1.6;">{引导语内容}</p>

<!-- 一级标题（黑色、居中加粗）+ 分割线 -->
<p style="margin:30px 0 10px 0; padding:0 12px; color:#000000; font-weight:bold; text-align:center; font-size:16px; line-height:1.7;">{一级标题内容}</p>
<p style="text-align:center; margin:0 0 16px 0; padding:0;">
<span style="display:inline-block; width:60px; height:2px; background-color:#eee;"></span>
</p>

<!-- 二级标题（青绿色、加粗） -->
<p style="margin:25px 0 15px 0; padding:0 12px; color:#1A8A6F; font-weight:bold; font-size:14px; line-height:1.75;">{二级标题内容}</p>

<!-- 正文 -->
<p style="margin:0 0 16px 0; padding:0 12px; color:#3E3E3E; font-size:14px; line-height:1.6;">{正文内容}</p>

<!-- 黄色背景强调框 -->
<p style="margin:0 0 16px 0; padding:12px; background-color:#FFF9E6; border-left:4px solid #FFE082; color:#3E3E3E; font-size:14px; line-height:1.6;">{强调内容}</p>

<!-- 红色高危提醒 -->
<p style="margin:0 0 16px 0; padding:0 12px; color:#FF0000; font-weight:bold; font-size:14px; line-height:1.6;">⚠️ {提醒内容}</p>

<!-- 蓝色辅助提示 -->
<p style="margin:0 0 16px 0; padding:0 12px; color:#3498db; font-size:14px; line-height:1.6;">💡 {提示内容}</p>

<!-- 引用区块（左侧灰色边框） -->
<p style="margin:0 0 16px 0; padding:0 12px 0 22px; border-left:2px solid #eee; color:#3E3E3E; font-size:14px; line-height:1.6;">{引用内容}</p>

<!-- 小字备注 -->
<p style="margin:0 0 16px 0; padding:0 12px; color:#666666; font-size:12px; line-height:1.5;">备注：{备注内容}</p>

<!-- 互动提问 -->
<p style="margin:30px 0 16px 0; padding:0 12px; color:#3E3E3E; font-size:14px; line-height:1.6;">【互动提问】{提问内容}</p>

<!-- 免责声明 -->
<p style="margin:30px 0 0 0; padding:15px 12px; border-top:1px solid #eee; color:#666666; font-size:12px; line-height:1.5;">【免责声明】本文仅为金融保险科普分享，不构成任何投保、投资建议。所有保险产品请仔细阅读保险合同条款，结合自身风险承受能力理性选择。</p>
`;

const WECHAT_FORMAT_SYSTEM_PROMPT = `你是一个微信公众号文章排版专家。你的任务是将用户提供的纯文本文章转换为公众号标准HTML排版格式。

【强制规则 - 必须100%遵守，否则API上传样式会丢失】
1. 所有单位必须使用px，禁止使用em/rem
2. 所有样式必须写在style属性内，禁止使用<style>标签
3. 禁止使用任何不在白名单内的CSS属性
4. 所有内容必须使用<p>标签，包括标题、正文、提示、引用等
5. 绝对禁止使用<h1>-<h6>、<div>、<section>、<hr>标签
6. 绝对禁止使用!important
7. 所有元素必须有自己的font-size、line-height和color，不依赖任何继承

【各元素标准格式 - 必须严格按照以下代码生成】

${WECHAT_HTML_TEMPLATE_SPEC}

排版识别规则：
- 开头第一段话 → 橙色加粗引导语（color:#E67E22）
- 带有"一、""二、""三、"等序号的大标题 → 黑色居中一级标题 + 分割线
- 带有"1.""2.""3."等小标题 → 青绿色左对齐二级标题（color:#1A8A6F）
- 含有"注意""提醒""警示""小心"等关键词 → 红色加粗提醒（color:#FF0000）
- 含有"⚠️""❗""❌"等符号 → 红色加粗提醒
- 含有"建议""提示""可以选择"等 → 蓝色辅助提示（color:#3498db）
- 含有"综上""总结""概括"等 + 需要突出的内容 → 黄色背景强调框（background:#FFF9E6）
- 引用内容/数据来源 → 引用区块（左侧灰色边框）
- 正文段落 → 深灰正文（color:#3E3E3E）
- 结尾提问或互动 → 互动提问
- 如果原文没有免责声明，末尾自动添加标准免责声明（小号浅灰）

输出要求：
1. 严格按照上面的HTML模板生成文章，不要做任何修改
2. 所有内容必须包裹在对应的<p>标签中
3. 每个<p>标签的style属性必须与模板完全一致，包括所有数值
4. 文章末尾必须包含互动提问和免责声明
5. 正文强调使用<strong>标签，不要使用其他方式
6. 🔴 绝对禁止使用<section>、<div>、<h1>-<h6>、<hr>标签！只用<p>标签！
7. 🔴 所有元素必须有自己的font-size、line-height和color，不依赖任何继承！`;

async function formatWechatWithLLM(
  llmClient: LLMClient,
  model: string,
  options: DirectPublishFormatOptions,
): Promise<WechatPlatformRenderData | null> {
  const { textContent, articleTitle } = options;
  const textLength = textContent.length;

  // 🔴 长文章分段格式化：超过 2000 字时，按章节分段调用 LLM，避免输出截断
  // dubao-seed-2-0-pro 默认 max_output_tokens=4096，约能输出 3000-4000 中文字符
  // 长文章的 HTML（含内联样式）通常是原文 2-3 倍，容易超出模型输出上限
  const CHUNK_THRESHOLD = 2000;

  let htmlContent: string | null = null;

  if (textLength > CHUNK_THRESHOLD) {
    console.log(`[DirectPublishFormatter] 文章较长(${textLength}字)，启用分段格式化`);
    htmlContent = await formatWechatChunked(llmClient, model, textContent);
  }

  // 短文章或分段格式化失败时，尝试整体格式化
  if (!htmlContent) {
    htmlContent = await formatWechatWhole(llmClient, model, textContent);
  }

  // 🔴 截断检测：检查 HTML 是否包含原文的关键段落
  if (htmlContent && !isHtmlContentComplete(htmlContent, textContent)) {
    console.warn(`[DirectPublishFormatter] ⚠️ HTML内容疑似截断，原文${textLength}字，HTML正文${stripHtmlTags(htmlContent).length}字`);
  }

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
}

// ============ 微信公众号分段格式化 ============

/**
 * 整体格式化（短文章）
 */
async function formatWechatWhole(
  llmClient: LLMClient,
  model: string,
  textContent: string,
): Promise<string | null> {
  const userPrompt = `请将以下纯文本文章格式化为公众号标准HTML排版：

${textContent}`;

  try {
    const response = await llmClient.invoke([
      { role: 'system', content: WECHAT_FORMAT_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ], {
      model,
      temperature: 0.1,
    });

    const html = extractHtmlFromResponse(response.content || '');
    if (html && html.length >= 50 && isHtmlContentComplete(html, textContent)) {
      return html;
    }
    console.warn('[DirectPublishFormatter] 整体格式化结果不完整，将尝试分段格式化');
    return null;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') return null;
    console.error('[DirectPublishFormatter] 整体格式化LLM调用失败:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * 分段格式化（长文章）
 * 按章节标题（一、二、三、...）切分，逐段调用 LLM，最后拼接
 */
async function formatWechatChunked(
  llmClient: LLMClient,
  model: string,
  textContent: string,
): Promise<string | null> {
  // 按一级标题（如 "一、"、"二、"、"1."、"2." 等）切分
  const sections = splitArticleByHeadings(textContent);
  if (sections.length <= 1) {
    // 无法有效分段，回退整体格式化
    console.log('[DirectPublishFormatter] 无法有效分段（仅1段），回退整体格式化');
    return null;
  }

  console.log(`[DirectPublishFormatter] 文章分为 ${sections.length} 段进行格式化`);

  const formattedParts: string[] = [];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    console.log(`[DirectPublishFormatter] 格式化第 ${i + 1}/${sections.length} 段（${section.length}字）`);

    const partPrompt = `请将以下纯文本${sections.length > 1 ? '片段' : '文章'}格式化为公众号标准HTML排版。
${i > 0 ? '注意：这是文章的第' + (i + 1) + '部分，不需要添加开头引导语，只输出本段的HTML内容。' : ''}
${i < sections.length - 1 ? '注意：这是文章的中间部分，不需要添加免责声明。' : ''}

${section}`;

    try {
      const response = await llmClient.invoke([
        { role: 'system', content: WECHAT_FORMAT_SYSTEM_PROMPT },
        { role: 'user', content: partPrompt },
      ], {
        model,
        temperature: 0.1,
      });

      const partHtml = extractHtmlFromResponse(response.content || '');
      if (partHtml && partHtml.length >= 20) {
        formattedParts.push(partHtml);
      } else {
        console.warn(`[DirectPublishFormatter] 第 ${i + 1} 段格式化失败，使用原文兜底`);
        formattedParts.push(`<p style="margin:0 0 16px 0; padding:0 12px; color:#3E3E3E; font-size:14px; line-height:1.6;">${escapeHtml(section)}</p>`);
      }
    } catch (error: unknown) {
      console.error(`[DirectPublishFormatter] 第 ${i + 1} 段格式化失败:`, error instanceof Error ? error.message : String(error));
      formattedParts.push(`<p style="margin:0 0 16px 0; padding:0 12px; color:#3E3E3E; font-size:14px; line-height:1.6;">${escapeHtml(section)}</p>`);
    }
  }

  // 拼接各段 HTML（新版：所有内容均使用 <p> 标签，无需 <section>/<div> 包裹）
  if (formattedParts.length === 0) return null;

  const mergedHtml = mergeChunkedHtml(formattedParts);
  return mergedHtml;
}

/**
 * 按章节标题切分文章
 * 识别 "一、" "二、" "1." "2." 等标题作为分隔点
 */
function splitArticleByHeadings(text: string): string[] {
  // 匹配中文序号标题（一、二、三、...九、十）
  // 或数字序号标题（1. 2. 3. 等），必须出现在行首
  const headingRegex = /^(?:[一二三四五六七八九十]+、|\d+\.)\s*.+/gm;

  const matches: { index: number; length: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(text)) !== null) {
    matches.push({ index: match.index, length: match[0].length });
  }

  if (matches.length === 0) return [text];

  const sections: string[] = [];

  // 第0段：第一个标题之前的内容（如果有）
  if (matches[0].index > 0) {
    sections.push(text.substring(0, matches[0].index).trim());
  }

  // 每个标题到下一个标题之间的内容
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const section = text.substring(start, end).trim();
    if (section.length > 0) {
      sections.push(section);
    }
  }

  return sections.filter(s => s.length > 0);
}

/**
 * 合并分段 HTML
 * 新版只使用 <p> 标签，无需 <section>/<div> 包裹，直接拼接各段内容
 */
function mergeChunkedHtml(parts: string[]): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];

  // 新版格式不使用 <section>/<div> 包裹，各段直接拼接
  const innerParts: string[] = [];

  for (const part of parts) {
    let inner = part.trim();
    // 兼容旧版：移除可能残留的 <section> 和 <div> 包裹标签
    inner = inner.replace(/^\s*<section[^>]*>\s*/i, '');
    inner = inner.replace(/^\s*<div[^>]*>\s*/i, '');
    inner = inner.replace(/\s*<\/div>\s*$/i, '');
    inner = inner.replace(/\s*<\/section>\s*$/i, '');
    innerParts.push(inner.trim());
  }

  // 新版：直接拼接所有 <p> 标签，无需包裹
  return innerParts.join('\n');
}

/**
 * 截断检测：比较 HTML 去标签后的纯文本与原文的覆盖率
 * 覆盖率 < 80% 说明 LLM 输出可能被截断
 */
function isHtmlContentComplete(htmlContent: string, originalText: string): boolean {
  const htmlPlainText = stripHtmlTags(htmlContent).trim();
  const originalPlainText = originalText.trim();

  if (!htmlPlainText || !originalPlainText) return true; // 空内容无法判断，默认通过

  // 检查原文中是否有关键段落完全丢失
  // 将原文按段落分割，检查每段是否在 HTML 中有对应内容
  const originalParagraphs = originalPlainText
    .split(/\n+/)
    .map(p => p.trim())
    .filter(p => p.length >= 20); // 只检查长度 >= 20 的段落（排除短标题等）

  if (originalParagraphs.length === 0) return true;

  let matchedCount = 0;
  for (const para of originalParagraphs) {
    // 取段落的前 30 字符作为匹配关键词
    const key = para.substring(0, 30).replace(/[，。、；：""''！？\s]/g, '');
    if (key.length >= 5 && htmlPlainText.includes(key)) {
      matchedCount++;
    }
  }

  const coverage = matchedCount / originalParagraphs.length;
  if (coverage < 0.8) {
    console.warn(`[DirectPublishFormatter] 截断检测: 覆盖率=${(coverage * 100).toFixed(1)}%, 匹配${matchedCount}/${originalParagraphs.length}段`);
    return false;
  }
  return true;
}

/**
 * HTML 转义（用于兜底场景）
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>\n');
}

// ============ 小红书 LLM 格式化 ============

const XHS_FORMAT_SYSTEM_PROMPT = `你是一个小红书内容策划专家。你的任务是从用户提供的文章中提取关键信息，用于生成小红书图文卡片的展示内容。

核心要求：
1. **概括而非截取** — 标题和要点必须是你对内容的理解和概括，不是简单截取原文
2. **封面标题**：15字以内，吸引眼球但不标题党，有悬念或反差感
3. **要点标题**：15字以内，简洁有力、引发好奇
4. **要点内容**：70-100字，详细概括核心信息，像朋友分享的口吻，信息量要充足
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
    { "title": "要点1标题（≤15字）", "content": "要点1概括（70-100字）" }
  ],
  "endingConclusion": "结尾金句（≤20字）",
  "articleTitle": "文章简短标题（≤15字，用于任务列表）",
  "tags": ["标签1", "标签2", "标签3"]
}`;

async function formatXhsWithLLM(
  llmClient: LLMClient,
  model: string,
  options: DirectPublishFormatOptions,
): Promise<XhsPlatformRenderData | null> {
  const { textContent, cardCountMode } = options;

  // 计算需要的要点数量
  const effectiveCardCountMode = cardCountMode || '5-card';
  const pointCount = XHS_CARD_MODE_POINT_COUNT[effectiveCardCountMode] || 3;

  const userPrompt = `请从以下文章中提取${pointCount}个核心要点，用于小红书图文卡片展示：

${textContent}

要求：提取${pointCount}个要点，每个要点有标题（≤15字）和概括内容（70-100字）。`;

  try {
    const response = await llmClient.invoke([
      { role: 'system', content: XHS_FORMAT_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ], {
      model,
      temperature: 0.7, // 适中温度，生成更有创意的标题
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

    // 如果要点不足，从原文中提取补充内容填充（避免空白卡片）
    while (points.length < maxPoints) {
      const remainingText = textContent
        .replace(/[#*`]/g, '')
        .split(/[。\n！？]/)
        .filter(s => s.trim().length > 10);
      const supplementIdx = points.length;
      const sourceLine = remainingText[supplementIdx] || remainingText[0] || '';
      points.push({
        title: `要点${supplementIdx + 1}`,
        content: sourceLine.trim().substring(0, 100) || '详见正文',
      });
    }

    for (const point of points) {
      cards.push({
        type: 'point',
        title: (point.title || '').substring(0, 15) || '要点',
        content: (point.content || '').substring(0, 100) || '',
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
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') return null;
    console.error('[DirectPublishFormatter] 小红书格式化LLM调用失败:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

// ============ 工具函数 ============

/**
 * 获取 LLM Client（优先使用用户 BYOK Key）
 */
async function getLLMClient(workspaceId?: string): Promise<LLMClient> {
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

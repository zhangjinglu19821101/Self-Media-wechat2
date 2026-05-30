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
  // 🔴 使用与 insurance-d 相同的高质量模型，确保 HTML 格式化效果一致
  // doubao-seed-2-0-pro-260215 能更好地遵循公众号标准 HTML 格式规范
  const model = 'doubao-seed-2-0-pro-260215';

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
 * 微信公众号 HTML 样式模板（完整版）
 *
 * 14 种元素类型，覆盖公众号文章所有常见排版需求。
 * 与 insurance-d-v3.md 第四部分 HTML 输出格式完全对齐。
 */

const WECHAT_HTML_TEMPLATE_SPEC = `
<!-- 【公众号API上传专用模板 - 2026年5月更新】
使用说明：
1. 所有单位必须使用px，禁止使用em/rem
2. 所有样式必须写在style属性内，禁止使用<style>标签
3. 禁止使用任何不在白名单内的CSS属性
4. 所有段落使用<p>标签，标题也使用<p>标签，不要使用<h1>-<h6>
5. 分割线使用<div>标签，不要使用<hr>
6. 背景框使用<div>标签包裹<p>标签
-->

<section style="margin:0; padding:0; border:0; outline:0; font-size:14px; line-height:1.6; color:#3E3E3E; background:#ffffff;">
  <div style="padding:0 12px;">

    <!-- 开篇引导语（橙色、加粗） -->
    <p style="margin:0 0 16px 0; padding:0; color:#E67E22; font-weight:bold; line-height:1.6;">如果你买了百万医疗险，这篇文章一定要看完，因为 DRG 改革正悄悄改变它的理赔规则。多数人未遇到问题，基本没有意识去关注它。正因如此，我希望通过这篇文章帮你了解 DRG 改革对老百姓的影响。</p>

    <!-- 一级标题（黑色、居中加粗）+ 分割线 -->
    <p style="margin:16px 0; padding:0; color:#000000; font-weight:bold; text-align:center; font-size:16px; line-height:1.7;">一、DRG 改革：看病省钱了，同时也带来了你不知道的看病难题</p>
    <div style="width:90%; height:1px; background:#eee; margin:0 auto 16px auto;"></div>

    <!-- 二级标题（青绿色、加粗） -->
    <p style="margin:16px 0 8px 0; padding:0; color:#1A8A6F; font-weight:bold; line-height:1.75;">1.1 DRG 改革的核心逻辑：治疗超支，医院买单，让医生不敢过度医疗</p>

    <!-- 正文 -->
    <p style="margin:0 0 16px 0; padding:0; line-height:1.6;">先说说大家都能看到的好处：老百姓到医院看病，医生都会主动替我们省钱了，老百姓担心花费昂贵、过度医疗的心可以暂时放下了。</p>
    <p style="margin:0 0 16px 0; padding:0; line-height:1.6;">医生为啥会帮我们省钱？因为 DRG 改革的一项核心措施就是：医保局给每个具体疾病设定了报销金额的上限，超过上限的部分医院要自行承担；</p>
    <p style="margin:0 0 16px 0; padding:0; line-height:1.6;">而医院会把这个压力传导到每个科室和医生个人，并且与医生的绩效工资直接挂钩。所以医生为了满足考核要求，避免绩效工资受损，不会过度医疗。</p>

    <!-- 黄色背景强调框 -->
    <div style="background:#FFF9E6; padding:12px; margin:0 0 16px 0;">
      <p style="margin:0; padding:0; line-height:1.6;">综上概括一下：医保能报销的药，医院不一定有；医院没有的药，百万医疗险不一定能报。 这就是 DRG 改革下，你购买的百万医疗险所面临的处境，也是大多数人没有意识到的保障隐患。</p>
    </div>

    <!-- 红色高危提醒 -->
    <p style="margin:0 0 16px 0; padding:0; color:#FF0000; font-weight:bold; line-height:1.6;">⚠️ 特别提醒：即使购买了不限清单院外购药责任，也不是随便买药都能报，务必关注保险公司对院外购药的报销要求（提前向保险公司申请最稳妥）</p>

    <!-- 蓝色辅助提示 -->
    <p style="margin:0 0 16px 0; padding:0; color:#3498db; line-height:1.6;">💡 预算有限的朋友，可以选择 "含不限清单院外购药的普通百万医疗险 + 公立医院特需门诊开处方" 的组合方案，性价比最高。</p>

    <!-- 引用区块（左侧灰色边框） -->
    <div style="padding-left:10px; border-left:2px solid #eee; margin:0 0 16px 0;">
      <p style="margin:0; padding:0; line-height:1.6;">"对于基本医保以外的医疗服务，可不纳入报量范围。例如不纳入基本医保报销范围的特需医疗、国际医疗的用药。"<br>—— 国家医保局《关于报送第十一批国家组织药品集中采购品种需求量的通知》（医保办发〔2025〕22 号）</p>
    </div>

    <!-- 小字备注 -->
    <p style="margin:0 0 16px 0; padding:0; font-size:12px; color:#666666; line-height:1.5;">备注：以上规则适用于市面上绝大多数主流百万医疗险，具体以保单合同为准。</p>

    <!-- 互动提问 -->
    <p style="margin:16px 0; padding:0; line-height:1.6;">【互动提问】你买的百万医疗险包含不限清单院外购药责任吗？欢迎在评论区留言咨询</p>

    <!-- 免责声明 -->
    <p style="margin:16px 0 0 0; padding:0; font-size:12px; color:#666666; line-height:1.5;">【免责声明】本文仅为金融保险科普分享，不构成任何投保、投资建议。所有保险产品请仔细阅读保险合同条款，结合自身风险承受能力理性选择。</p>

  </div>
</section>
`;

const WECHAT_FORMAT_SYSTEM_PROMPT = `你是一个微信公众号文章排版专家。你的任务是将用户提供的纯文本文章转换为公众号标准HTML排版格式。

⚠️【公众号样式铁律】⚠️
1. **所有样式必须加 !important** — 防止被公众号编辑器覆盖
2. **所有字体大小使用 px 单位** — 禁止使用 em/rem
3. **所有间距使用 px 单位** — 禁止使用 em/rem，用 padding 替代 margin
4. **每个元素必须有 font-size 和 line-height** — 不依赖继承
5. **正文默认：14px / line-height:1.6**
6. **小字备注：12px / line-height:1.5**
7. **h2 一级标题：16px / line-height:1.7**
8. **h3/h4 标题：14px / line-height:1.75**

核心规则：
1. **保持原文内容完全不变** — 不改写、不删减、不增加任何段落
2. **仅做排版格式化** — 添加HTML标签和内联样式
3. **所有正文段落必须包裹在 <p> 标签里**
4. **使用以下样式模板**（每个元素的内联样式必须严格一致）：

${WECHAT_HTML_TEMPLATE_SPEC}

排版识别规则（按优先级从高到低）：
- 开头第一段话 → 橙色加粗引导语（组件1）
- "一、""二、""三、"等大标题 → 黑色居中h2 + div分割线（组件2）
- "1.""2.""3."等子标题 → 青绿色加粗h3（组件3）
- "真相一""要点二"等细分标题 → 青绿色常规h4（组件4）
- 普通正文 → 深灰正文p（组件5）
- 含"注意""警示""务必""100%" → 红色加粗提醒（组件6）
- 含"⚠️""❗""❌" → 红色加粗提醒（组件6）
- 含"提示""建议""💡" → 蓝色辅助提示（组件7）
- 核心结论、重点强调 → 黄色强调框div（组件8）
- 数据展示、案例背景 → 灰色背景块div（组件9）
- 罗列并列要点 → 无序列表ul/li（组件10）
- 步骤流程 → 有序列表ol/li（组件11）
- 条款引用 → 左边框引用区块（组件12）
- 补充说明/数据来源 → 小字备注（组件13）
- 结尾互动 → 互动提问（组件14）
- 法律免责 → 免责声明（组件15）

✅【生成后验证清单】✅
1. □ 所有样式都有 !important
2. □ 所有字体大小是 px 单位（14px或12px）
3. □ 所有间距是 px 单位（16px/8px等）
4. □ 正文 line-height 是 1.6
5. □ h3/h4 line-height 是 1.75
6. □ 小字备注 line-height 是 1.5
7. □ h2 字号是 16px（不是14px）
8. □ 分割线用 <div> 不是 <hr>
9. □ 只有 HTML 代码，没有解释文字

输出要求：
- 仅输出HTML代码
- 使用完整 <section> 包裹
- 一级标题用 <h2> + <div> 分割线
- 二级标题用 <h3>（加粗）
- 三级标题用 <h4>（不加粗）
- 所有样式必须使用内联style + !important
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
  // 🔴 使用 180 秒超时，与写作 Agent 一致
  // 高质量模型 doubao-seed-2-0-pro-260215 响应时间通常需要 65-80 秒
  // 60 秒超时会导致超时触发降级逻辑，用户看到的文章格式不美观
  const FORMAT_TIMEOUT = 180000;

  if (workspaceId) {
    try {
      const { client } = await createUserLLMClient(workspaceId, { timeout: FORMAT_TIMEOUT });
      return client;
    } catch {
      // BYOK 失败，降级到平台 Key
    }
  }
  return getPlatformLLM({ timeout: FORMAT_TIMEOUT });
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

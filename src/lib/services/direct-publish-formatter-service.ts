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
<!-- 
【公众号通用排版模板 - 给LLM的样式规范】
1. 所有字体大小统一使用px单位，禁止使用em/rem
2. 所有间距统一使用px单位，禁止使用em/rem
3. 关键样式必须加!important，防止被公众号编辑器覆盖
4. 严格按照以下组件样式生成，不要添加任何额外的CSS
5. 正文默认字号14px，行高1.6；小字12px，行高1.5
6. 所有颜色严格使用下方指定的十六进制值
-->

<section style="background:#ffffff; padding:0 12px; font-size:14px; line-height:1.6 !important; color:#3E3E3E;">
  <!-- 组件1：开篇引导语（橙色、加粗、居左）
       用途：文章开头的吸引性语句
       颜色：#E67E22 | 字号：14px | 字重：bold | 行高：1.6
       下边距：16px -->
  <p style="color:#E67E22; font-weight:bold; margin:0; padding:0 0 16px; line-height:1.6 !important;">今天跟大家聊聊买保险最容易踩的坑</p>

  <!-- 组件2：一级标题（黑色、居中加粗）+ 分割线
       用途：文章大章节标题
       颜色：#000000 | 字号：16px | 字重：bold | 行高：1.7
       上下边距：16px | 分割线：#eee 1px 宽度90% -->
  <h2 style="color:#000000; font-weight:bold; text-align:center; margin:0; padding:16px 0; font-size:16px; line-height:1.7 !important;">一、为什么很多人买了重疾险却理赔难？</h2>
  <div style="width:90%; height:1px; background:#eee; margin:0 auto 16px;"></div>
  
  <!-- 组件3：二级标题（青绿色、居左加粗）
       用途：大章节下的子标题
       颜色：#1A8A6F | 字号：14px | 字重：bold | 行高：1.75
       上边距：16px | 下边距：8px -->
  <h3 style="color:#1A8A6F; font-weight:bold; margin:0; padding:16px 0 8px; font-size:14px; line-height:1.75 !important;">保险公司不告诉你的3个拒赔真相</h3>

  <!-- 组件4：三级标题（青绿色、居左常规字重）
       用途：子标题下的细分标题
       颜色：#1A8A6F | 字号：14px | 字重：normal | 行高：1.75
       上边距：16px | 下边距：8px -->
  <h4 style="color:#1A8A6F; margin:0; padding:16px 0 8px; font-size:14px; line-height:1.75 !important;">真相一：健康告知是第一道门槛</h4>

  <!-- 组件5：正文（深灰色、居左）
       用途：普通正文内容
       颜色：#3E3E3E | 字号：14px | 字重：normal | 行高：1.6
       下边距：16px
       支持内联样式：<strong>加粗</strong>、<em>斜体</em>、<u>下划线</u>、<s>删除线</s> -->
  <p style="margin:0; padding:0 0 16px; line-height:1.6 !important;">很多人以为买了重疾险就万事大吉，<strong>如实做健康告知是理赔的核心前提</strong>。<em>（业内惯例：投保问询必须全部如实回答）</em> 像<u>既往病史、体检异常</u>这类信息绝对不能隐瞒，网传<s>"小毛病不用告知"</s>的说法完全是误区。</p>

  <!-- 组件6：红色高危提醒（红色、加粗、居左）
       用途：重要风险提示、警告信息
       颜色：#FF0000 | 字号：14px | 字重：bold | 行高：1.6
       下边距：16px -->
  <p style="color:#FF0000; font-weight:bold; margin:0; padding:0 0 16px; line-height:1.6 !important;">⚠️ 健康告知没填对，理赔100%被拒！</p>

  <!-- 组件7：蓝色辅助提示（浅蓝色、常规字重、居左）
       用途：温和提示、小技巧、注意事项
       颜色：#3498db | 字号：14px | 字重：normal | 行高：1.6
       下边距：16px -->
  <p style="color:#3498db; margin:0; padding:0 0 16px; line-height:1.6 !important;">💡 小提示：投保前建议整理近3年体检报告，避免遗漏异常记录。</p>

  <!-- 组件8：黄色强调框（黄色背景、深灰色文字、居左）
       用途：重点内容强调、核心结论
       背景色：#FFF9E6 | 边框色：#FFE082 | 内边距：12px
       下边距：16px -->
  <div style="background:#FFF9E6; border-left:4px solid #FFE082; padding:12px; margin:0 0 16px; line-height:1.6 !important;">
    <p style="margin:0; padding:0; line-height:1.6 !important;">核心结论：买保险不是看保额高低，而是看条款是否符合自己的需求。</p>
  </div>

  <!-- 组件9：灰色背景块（浅灰色背景、深灰色文字、居左）
       用途：数据展示、案例背景、补充说明
       背景色：#F5F5F5 | 内边距：12px
       下边距：16px -->
  <div style="background:#F5F5F5; padding:12px; margin:0 0 16px; line-height:1.6 !important;">
    <p style="margin:0; padding:0; line-height:1.6 !important;">2025年行业数据：重疾险拒赔案件中，60%以上是因为未如实告知健康状况。</p>
  </div>

  <!-- 组件10：无序列表（深灰色、居左）
       用途：罗列风险、特点、注意事项
       缩进：20px | 列表项下边距：8px
       支持内联样式：<strong>加粗</strong>、<u>下划线</u> -->
  <p style="margin:0; padding:0 0 8px; line-height:1.6 !important;">百万医疗险理赔有明确限制：</p>
  <ul style="margin:0; padding:0 0 16px 20px; line-height:1.6 !important;">
    <li style="margin:0; padding:0 0 8px; line-height:1.6 !important;">仅限<strong>合理且必要的住院医疗费用</strong>报销</li>
    <li style="margin:0; padding:0 0 8px; line-height:1.6 !important;">存在<u>免赔额、就医范围</u>等约束条件</li>
    <li style="margin:0; padding:0; line-height:1.6 !important;">外购药、特药报销需符合产品规则</li>
  </ul>

  <!-- 组件11：有序列表（深灰色、居左）
       用途：步骤说明、逐条解读
       缩进：20px | 列表项下边距：8px -->
  <p style="margin:0; padding:0 0 8px; line-height:1.6 !important;">正确理赔流程分为3步：</p>
  <ol style="margin:0; padding:0 0 16px 20px; line-height:1.6 !important;">
    <li style="margin:0; padding:0 0 8px; line-height:1.6 !important;">及时报案，保留完整医疗单据</li>
    <li style="margin:0; padding:0 0 8px; line-height:1.6 !important;">线上/线下提交理赔材料</li>
    <li style="margin:0; padding:0; line-height:1.6 !important;">等待保险公司审核结算</li>
  </ol>

  <!-- 组件12：引用区块（深灰色、左侧灰色边框、居左）
       用途：条款引用、官方文件、专家观点
       左边框：#eee 2px | 左内边距：10px
       下边距：16px -->
  <p style="margin:0; padding:0 0 16px 10px; border-left:2px solid #eee; line-height:1.6 !important;">【条款引用】医疗险仅对<em>住院、特殊门诊、住院前后门急诊</em>相关费用进行赔付。</p>

  <!-- 组件13：小字备注（浅灰色、小号字体、居左）
       用途：补充说明、数据来源、注意事项
       颜色：#666666 | 字号：12px | 行高：1.5
       下边距：16px -->
  <p style="font-size:12px; color:#666666; margin:0; padding:0 0 16px; line-height:1.5 !important;">备注：以上规则适用于市面上绝大多数主流百万医疗险，具体以保单合同为准。</p>

  <!-- 组件14：互动提问（深灰色、居左）
       用途：引导用户评论、互动
       颜色：#3E3E3E | 字号：14px | 行高：1.6
       上下边距：16px -->
  <p style="margin:0; padding:16px 0; line-height:1.6 !important;">【互动提问】你买保险时踩过坑吗？欢迎在评论区留言分享</p>

  <!-- 组件15：免责声明（浅灰色、小号字体、居左）
       用途：文章末尾的法律免责声明
       颜色：#666666 | 字号：12px | 行高：1.5
       上边距：16px -->
  <p style="font-size:12px; color:#666666; margin:0; padding:16px 0 0; line-height:1.5 !important;">【免责声明】本文仅为知识科普，不构成投资/购买建议。</p>
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

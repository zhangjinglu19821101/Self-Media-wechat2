/**
 * 平台渲染数据提取器
 * 
 * 职责：从执行 Agent 的 resultData 中提取平台专属的渲染数据
 * 
 * 设计原则：
 * 1. result_text 是通用纯文本，不与任何平台渲染耦合
 * 2. 平台渲染数据（platformRenderData）独立提取，供前端渲染使用
 * 3. 每个平台有独立的提取逻辑，互不干扰
 * 4. 提取失败不影响主流程（try-catch 降级）
 * 
 * 数据流：
 *   执行 Agent 输出信封格式 → extractPlatformRenderData() 提取 → 前端按结构渲染
 */

import {
  PlatformType,
  PlatformRenderData,
  XhsPlatformRenderData,
  XhsCardCountMode,
  WechatPlatformRenderData,
  ZhihuPlatformRenderData,
  ToutiaoPlatformRenderData,
  XhsCoverCard,
  XhsPointCard,
  XhsEndingCard,
  inferXhsCardCountMode,
} from './types';

// ============ 公共类型 ============

/** resultData 的安全解析结果 */
type ParsedResultData = Record<string, unknown> | null;

// ============ 核心提取入口 ============

/**
 * 从执行 Agent 的 resultData 中提取平台专属渲染数据
 * 
 * @param platform 平台类型
 * @param resultData 原始 resultData（可能是 JSON 字符串或对象）
 * @param metadata 任务 metadata（包含 contentTemplateId、imageCountMode 等）
 * @returns 平台渲染数据对象，提取失败返回 null
 */
export function extractPlatformRenderData(
  platform: PlatformType,
  resultData: unknown,
  metadata?: Record<string, unknown> | null
): PlatformRenderData | null {
  const parsed = safeParseResultData(resultData);
  if (!parsed) return null;

  switch (platform) {
    case 'xiaohongshu':
      return extractXhsRenderData(parsed, metadata);
    case 'wechat_official':
      return extractWechatRenderData(parsed);
    case 'zhihu':
      return extractZhihuRenderData(parsed);
    case 'douyin':
    case 'weibo':
      return extractToutiaoRenderData(parsed);
    default:
      console.warn(`[PlatformRender] 未知平台: ${platform}`);
      return null;
  }
}

// ============ 小红书渲染数据提取 ============

/**
 * 从 resultData 提取小红书渲染数据
 * 
 * 数据来源优先级：
 * 1. 信封格式: resultData.result.platformData（标准路径）
 * 2. 旧格式1: resultData.result（result 本身包含小红书字段）
 * 3. 旧格式2: 顶层直接包含小红书字段
 * 4. executorOutput 嵌套: resultData.executorOutput.structuredResult.resultContent
 */
function extractXhsRenderData(
  parsed: ParsedResultData,
  metadata?: Record<string, unknown> | null
): XhsPlatformRenderData | null {
  if (!parsed) return null;

  try {
    let platformData: Record<string, unknown> | null = null;
    let content = '';
    let articleTitle = '';

    // 路径1: 信封格式 { result: { content, articleTitle, platformData: {...} } }
    const result = parsed.result as Record<string, unknown> | undefined;
    if (result && typeof result === 'object') {
      // 优先从 result.platformData 提取
      if (result.platformData && typeof result.platformData === 'object') {
        platformData = result.platformData as Record<string, unknown>;
        content = typeof result.content === 'string' ? result.content : '';
        articleTitle = typeof result.articleTitle === 'string' ? result.articleTitle : '';
      }
    }

    // 路径2: executorOutput.structuredResult.resultContent
    if (!platformData) {
      const executorOutput = parsed.executorOutput as Record<string, unknown> | undefined;
      if (executorOutput && typeof executorOutput === 'object') {
        const structuredResult = executorOutput.structuredResult as Record<string, unknown> | undefined;
        if (structuredResult && typeof structuredResult === 'object') {
          const resultContent = structuredResult.resultContent as Record<string, unknown> | undefined;
          if (resultContent && typeof resultContent === 'object') {
            if (resultContent.platformData && typeof resultContent.platformData === 'object') {
              platformData = resultContent.platformData as Record<string, unknown>;
              content = typeof resultContent.content === 'string' ? resultContent.content : '';
              articleTitle = typeof resultContent.articleTitle === 'string' ? resultContent.articleTitle : '';
            }
          }
        }
      }
    }

    // 路径3: 旧格式 - 顶层直接包含小红书字段
    if (!platformData && (parsed.title || parsed.points)) {
      platformData = parsed;
      content = typeof parsed.fullText === 'string' ? parsed.fullText : 
                typeof parsed.content === 'string' ? parsed.content : '';
      articleTitle = typeof parsed.articleTitle === 'string' ? parsed.articleTitle : '';
    }

    if (!platformData) return null;

    // 提取小红书字段
    const title = typeof platformData.title === 'string' ? platformData.title : '';
    const intro = typeof platformData.intro === 'string' ? platformData.intro : undefined;
    
    // 安全提取 points 数组
    let points: Array<{ title: string; content: string }> = [];
    if (Array.isArray(platformData.points)) {
      points = platformData.points
        .filter((p: unknown) => 
          typeof p === 'object' && p !== null && 
          typeof (p as Record<string, unknown>).title === 'string'
        )
        .map((p: unknown) => ({
          title: (p as Record<string, unknown>).title as string,
          content: typeof (p as Record<string, unknown>).content === 'string' 
            ? (p as Record<string, unknown>).content as string 
            : '',
        }));
    }

    const conclusion = typeof platformData.conclusion === 'string' ? platformData.conclusion : undefined;
    const tags = Array.isArray(platformData.tags)
      ? platformData.tags.filter((t: unknown) => typeof t === 'string') as string[]
      : [];

    // 推导 cardCountMode
    // 优先级: metadata.contentTemplateId → metadata.imageCountMode → 从 points 数量推导
    let cardCountMode: XhsCardCountMode = inferXhsCardCountMode(points.length);
    
    if (metadata) {
      // 如果有 imageCountMode（来自前端或内容模板推导），优先使用
      const imageCountMode = metadata.imageCountMode as XhsCardCountMode | undefined;
      if (imageCountMode && ['3-card', '5-card', '7-card'].includes(imageCountMode)) {
        cardCountMode = imageCountMode;
      }
    }

    // 构建卡片数组
    const cards = buildXhsCards(title, intro, points, conclusion, tags);

    return {
      platform: 'xiaohongshu',
      cardCountMode,
      cards,
      textContent: content,
      articleTitle: articleTitle || title,
    };
  } catch (err) {
    console.warn('[PlatformRender] 提取小红书渲染数据失败:', err);
    return null;
  }
}

/**
 * 构建小红书卡片数组
 * 
 * 按顺序：封面卡 → 要点卡1 → 要点卡2 → ... → 结尾卡
 */
function buildXhsCards(
  title: string,
  intro: string | undefined,
  points: Array<{ title: string; content: string }>,
  conclusion: string | undefined,
  tags: string[]
): Array<XhsCoverCard | XhsPointCard | XhsEndingCard> {
  const cards: Array<XhsCoverCard | XhsPointCard | XhsEndingCard> = [];

  // 封面卡
  if (title) {
    const coverCard: XhsCoverCard = {
      type: 'cover',
      title,
    };
    if (intro) {
      coverCard.subtitle = intro;
    }
    cards.push(coverCard);
  }

  // 要点卡
  for (const point of points) {
    cards.push({
      type: 'point',
      title: point.title,
      content: point.content,
    });
  }

  // 结尾卡
  if (conclusion || tags.length > 0) {
    const endingCard: XhsEndingCard = {
      type: 'ending',
      conclusion: conclusion || '',
    };
    if (tags.length > 0) {
      endingCard.tags = tags;
    }
    cards.push(endingCard);
  }

  return cards;
}

// ============ 公众号渲染数据提取 ============

function extractWechatRenderData(
  parsed: ParsedResultData
): WechatPlatformRenderData | null {
  if (!parsed) return null;

  try {
    let htmlContent = '';
    let articleTitle = '';

    // 路径1: 信封格式
    const result = parsed.result as Record<string, unknown> | undefined;
    if (result && typeof result === 'object') {
      htmlContent = typeof result.content === 'string' ? result.content : '';
      articleTitle = typeof result.articleTitle === 'string' ? result.articleTitle : '';
    }

    // 路径2: executorOutput.structuredResult
    if (!htmlContent) {
      const executorOutput = parsed.executorOutput as Record<string, unknown> | undefined;
      if (executorOutput && typeof executorOutput === 'object') {
        const structuredResult = executorOutput.structuredResult as Record<string, unknown> | undefined;
        if (structuredResult && typeof structuredResult === 'object') {
          const resultContent = structuredResult.resultContent as Record<string, unknown> | undefined;
          if (resultContent && typeof resultContent === 'object') {
            htmlContent = typeof resultContent.htmlContent === 'string' ? resultContent.htmlContent :
                          typeof resultContent.content === 'string' ? resultContent.content : '';
            articleTitle = typeof resultContent.articleTitle === 'string' ? resultContent.articleTitle : '';
          }
        }
      }
    }

    if (!htmlContent) return null;

    return {
      platform: 'wechat_official',
      htmlContent,
      articleTitle,
    };
  } catch (err) {
    console.warn('[PlatformRender] 提取公众号渲染数据失败:', err);
    return null;
  }
}

// ============ 知乎渲染数据提取 ============

function extractZhihuRenderData(
  parsed: ParsedResultData
): ZhihuPlatformRenderData | null {
  if (!parsed) return null;

  try {
    let textContent = '';
    let articleTitle = '';

    // 路径1: 信封格式
    const result = parsed.result as Record<string, unknown> | undefined;
    if (result && typeof result === 'object') {
      textContent = typeof result.content === 'string' ? result.content : '';
      articleTitle = typeof result.articleTitle === 'string' ? result.articleTitle : '';
    }

    if (!textContent) return null;

    return {
      platform: 'zhihu',
      textContent,
      articleTitle,
    };
  } catch (err) {
    console.warn('[PlatformRender] 提取知乎渲染数据失败:', err);
    return null;
  }
}

// ============ 头条/抖音渲染数据提取 ============

function extractToutiaoRenderData(
  parsed: ParsedResultData
): ToutiaoPlatformRenderData | null {
  if (!parsed) return null;

  try {
    let textContent = '';
    let articleTitle = '';

    // 路径1: 信封格式
    const result = parsed.result as Record<string, unknown> | undefined;
    if (result && typeof result === 'object') {
      textContent = typeof result.content === 'string' ? result.content : '';
      articleTitle = typeof result.articleTitle === 'string' ? result.articleTitle : '';
    }

    if (!textContent) return null;

    return {
      platform: 'douyin',
      textContent,
      articleTitle,
    };
  } catch (err) {
    console.warn('[PlatformRender] 提取头条渲染数据失败:', err);
    return null;
  }
}

// ============ 工具函数 ============

/**
 * 安全解析 resultData
 * 支持字符串 JSON 和对象两种输入
 */
function safeParseResultData(resultData: unknown): ParsedResultData {
  if (!resultData) return null;

  if (typeof resultData === 'object') {
    return resultData as Record<string, unknown>;
  }

  if (typeof resultData === 'string') {
    try {
      return JSON.parse(resultData);
    } catch {
      return null;
    }
  }

  return null;
}

// ============ 前端辅助函数 ============

/**
 * 从 platformRenderData 中获取小红书卡片列表
 * 供前端组件使用
 */
export function getXhsCardsFromRenderData(
  renderData: Record<string, unknown> | null | undefined
): Array<XhsCoverCard | XhsPointCard | XhsEndingCard> | null {
  if (!renderData) return null;

  try {
    // 如果已经是标准格式（含 cards 数组）
    if (Array.isArray(renderData.cards)) {
      return renderData.cards as Array<XhsCoverCard | XhsPointCard | XhsEndingCard>;
    }

    // 如果是小红书 platformData 格式（从 API 传递的）
    if (renderData.platform === 'xiaohongshu') {
      const title = typeof renderData.title === 'string' ? renderData.title : '';
      const intro = typeof renderData.intro === 'string' ? renderData.intro : undefined;
      const points = Array.isArray(renderData.points) 
        ? renderData.points.filter((p: unknown) => 
            typeof p === 'object' && p !== null && typeof (p as Record<string, unknown>).title === 'string'
          ).map((p: unknown) => ({
            title: (p as Record<string, unknown>).title as string,
            content: typeof (p as Record<string, unknown>).content === 'string' ? (p as Record<string, unknown>).content as string : '',
          }))
        : [];
      const conclusion = typeof renderData.conclusion === 'string' ? renderData.conclusion : undefined;
      const tags = Array.isArray(renderData.tags) ? renderData.tags.filter((t: unknown) => typeof t === 'string') as string[] : [];

      return buildXhsCards(title, intro, points, conclusion, tags);
    }

    return null;
  } catch (err) {
    console.warn('[PlatformRender] 解析小红书卡片数据失败:', err);
    return null;
  }
}

/**
 * 从 platformRenderData 中获取小红书卡片数量模式
 */
export function getXhsCardCountMode(
  renderData: Record<string, unknown> | null | undefined
): XhsCardCountMode | null {
  if (!renderData) return null;

  const mode = renderData.cardCountMode as XhsCardCountMode | undefined;
  if (mode && ['3-card', '5-card', '7-card'].includes(mode)) {
    return mode;
  }

  // 从卡片数量推导
  const cards = getXhsCardsFromRenderData(renderData);
  if (cards) {
    const pointCards = cards.filter(c => c.type === 'point');
    return inferXhsCardCountMode(pointCards.length);
  }

  return null;
}

/**
 * 从 platformRenderData 中获取小红书正文
 */
export function getXhsTextContent(
  renderData: Record<string, unknown> | null | undefined
): string {
  if (!renderData) return '';
  return typeof renderData.textContent === 'string' ? renderData.textContent : '';
}

/**
 * 从 platformRenderData 中获取小红书文章标题
 */
export function getXhsArticleTitle(
  renderData: Record<string, unknown> | null | undefined
): string {
  if (!renderData) return '';
  return typeof renderData.articleTitle === 'string' ? renderData.articleTitle : '';
}

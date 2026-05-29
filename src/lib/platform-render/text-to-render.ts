/**
 * 纯文本 → 平台渲染数据转换
 * 
 * 用于直接发文模式：用户提供的纯文本文章需要转换为平台渲染数据，
 * 使预览节点与 AI 创作模式展示一致。
 * 
 * 设计原则：
 * 1. 微信：纯文本 → 简单 HTML（段落分隔、标题）
 * 2. 小红书：纯文本 → 卡片数据（封面 + 要点 + 结尾）
 * 3. 知乎/头条：纯文本直接传递
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
  ZhihuPlatformRenderData,
  ToutiaoPlatformRenderData,
} from './types';
import { inferXhsCardCountMode } from './types';

/**
 * 将纯文本文章转换为平台渲染数据
 * 
 * @param textContent 用户提供的纯文本文章
 * @param platform 目标平台
 * @param articleTitle 文章标题（可选）
 * @param cardCountMode 小红书卡片数量模式（可选，默认从内容推导）
 */
export function generatePlatformRenderDataFromText(
  textContent: string,
  platform: PlatformType | string,
  articleTitle?: string,
  cardCountMode?: XhsCardCountMode
): PlatformRenderData | null {
  if (!textContent || !textContent.trim()) return null;

  switch (platform) {
    case 'wechat_official':
      return generateWechatRenderData(textContent, articleTitle);
    case 'xiaohongshu':
      return generateXhsRenderData(textContent, articleTitle, cardCountMode);
    case 'zhihu':
      return generateZhihuRenderData(textContent, articleTitle);
    case 'douyin':
    case 'weibo':
      return generateToutiaoRenderData(textContent, articleTitle);
    default:
      console.warn(`[TextToRender] 未知平台: ${platform}，使用通用渲染`);
      return generateWechatRenderData(textContent, articleTitle);
  }
}

// ============ 微信公众号 ============

/**
 * 纯文本 → 微信 HTML 渲染数据
 * 
 * 将纯文本转换为简单的 HTML 格式：
 * - 第一行作为标题（如果有空行分隔）
 * - 段落用 <p> 包裹
 * - 保留换行
 */
function generateWechatRenderData(
  textContent: string,
  articleTitle?: string
): WechatPlatformRenderData {
  const htmlContent = plainTextToHtml(textContent);
  const title = articleTitle || extractTitleFromText(textContent) || '文章预览';

  return {
    platform: 'wechat_official',
    htmlContent,
    articleTitle: title,
  };
}

/**
 * 纯文本 → HTML
 * 
 * 转换规则：
 * 1. 连续空行分段 → <p>
 * 2. 段落内换行 → <br>
 * 3. 保留原文结构
 */
function plainTextToHtml(text: string): string {
  const paragraphs = text
    .split(/\n\s*\n/)  // 连续空行分段
    .map(p => p.trim())
    .filter(p => p.length > 0);

  const htmlParts = paragraphs.map(p => {
    // 段落内换行转 <br>
    const content = p
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
    return `<p style="margin: 1em 0; line-height: 1.8; font-size: 15px; color: #333;">${content}</p>`;
  });

  return htmlParts.join('\n');
}

// ============ 小红书 ============

/**
 * 纯文本 → 小红书卡片渲染数据
 * 
 * 解析策略：
 * 1. 第一段作为封面标题/副标题
 * 2. 中间段落按要点拆分（每段一个要点卡）
 * 3. 最后一段作为结尾总结
 * 4. 如果段落数不足，补齐最小结构（封面 + 结尾）
 */
function generateXhsRenderData(
  textContent: string,
  articleTitle?: string,
  cardCountMode?: XhsCardCountMode
): XhsPlatformRenderData {
  const title = articleTitle || extractTitleFromText(textContent) || '文章预览';
  
  // 拆分段落
  const paragraphs = textContent
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  // 解析要点
  const points = parseXhsPoints(paragraphs);
  
  // 推导卡片数量模式
  const effectiveCardCountMode = cardCountMode || inferXhsCardCountMode(points.length);

  // 构建卡片
  const cards = buildXhsCardsFromText(title, paragraphs, points, effectiveCardCountMode);

  return {
    platform: 'xiaohongshu',
    cardCountMode: effectiveCardCountMode,
    cards,
    textContent,
    articleTitle: title,
  };
}

/**
 * 从段落中解析小红书要点
 * 
 * 规则：
 * 1. 第一段是封面/引言，跳过
 * 2. 带有数字编号（1. / 一、/ 第X点）的段落作为要点标题
 * 3. 其余段落作为要点内容
 * 4. 最后一段作为结尾总结
 */
function parseXhsPoints(paragraphs: string[]): Array<{ title: string; content: string }> {
  if (paragraphs.length <= 2) {
    // 太短，只有一个要点
    const content = paragraphs.length === 2 ? paragraphs[1] : paragraphs[0] || '';
    return content ? [{ title: '核心要点', content: content.substring(0, 80) }] : [];
  }

  const points: Array<{ title: string; content: string }> = [];
  // 跳过第一段（封面/引言），跳过最后一段（结尾）
  const middleParagraphs = paragraphs.slice(1, -1);

  for (let i = 0; i < middleParagraphs.length; i++) {
    const para = middleParagraphs[i];
    
    // 尝试识别编号模式
    const numberedMatch = para.match(/^(?:\d+[.、)\s]|第[一二三四五六七八九十]+[点方面]|一[、.)\s]|二[、.)\s]|三[、.)\s]|四[、.)\s]|五[、.)\s])\s*(.+)/);
    
    if (numberedMatch) {
      // 有编号的段落：编号后的文本作为标题，整段作为内容
      const titleText = numberedMatch[1].substring(0, 15).trim();
      points.push({
        title: titleText || `要点${i + 1}`,
        content: para.substring(0, 80),
      });
    } else {
      // 无编号段落：取前15字作为标题
      const titleText = para.substring(0, 15).replace(/[，。！？；：、\s]+$/, '').trim();
      points.push({
        title: titleText || `要点${i + 1}`,
        content: para.substring(0, 80),
      });
    }
  }

  return points;
}

/**
 * 从纯文本构建小红书卡片数组
 */
function buildXhsCardsFromText(
  title: string,
  paragraphs: string[],
  points: Array<{ title: string; content: string }>,
  cardCountMode: XhsCardCountMode
): Array<XhsCoverCard | XhsPointCard | XhsEndingCard> {
  const cards: Array<XhsCoverCard | XhsPointCard | XhsEndingCard> = [];

  // 封面卡
  const coverCard: XhsCoverCard = {
    type: 'cover',
    title,
  };
  // 如果有第二段，作为副标题
  if (paragraphs.length > 1) {
    coverCard.subtitle = paragraphs[1].substring(0, 30);
  }
  cards.push(coverCard);

  // 要点卡（根据 cardCountMode 限制数量）
  const maxPoints = cardCountMode === '3-card' ? 1 : cardCountMode === '5-card' ? 3 : 5;
  const displayPoints = points.slice(0, maxPoints);
  
  for (const point of displayPoints) {
    cards.push({
      type: 'point',
      title: point.title,
      content: point.content,
    });
  }

  // 结尾卡
  const conclusion = paragraphs.length > 1 
    ? paragraphs[paragraphs.length - 1].substring(0, 50) 
    : '';
  cards.push({
    type: 'ending',
    conclusion: conclusion || '感谢阅读',
  });

  return cards;
}

// ============ 知乎 ============

function generateZhihuRenderData(
  textContent: string,
  articleTitle?: string
): ZhihuPlatformRenderData {
  return {
    platform: 'zhihu',
    textContent,
    articleTitle: articleTitle || extractTitleFromText(textContent) || '文章预览',
  };
}

// ============ 头条/抖音 ============

function generateToutiaoRenderData(
  textContent: string,
  articleTitle?: string
): ToutiaoPlatformRenderData {
  return {
    platform: 'douyin',
    textContent,
    articleTitle: articleTitle || extractTitleFromText(textContent) || '文章预览',
  };
}

// ============ 通用工具 ============

/**
 * 从纯文本中提取标题
 * 
 * 规则：取第一行的前15个字，去掉标点
 */
function extractTitleFromText(text: string): string {
  if (!text) return '';
  const firstLine = text.split('\n')[0].trim();
  return firstLine.substring(0, 15).replace(/[，。！？；：、\s]+$/, '').trim();
}

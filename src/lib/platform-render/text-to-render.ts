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
 * 纯文本 → HTML（微信公众号标准样式）
 *
 * 转换规则（14种元素，降级路径，LLM格式化失败时使用）：
 */

/**
 * 纯文本 → 微信公众号 HTML（API上传专用模板）
 * 
 * 样式规范（2026年5月更新）：
 * 1. 所有单位使用px，禁止em/rem
 * 2. 所有样式写在style属性内
 * 3. 标题使用<p>标签，禁止<h1>-<h6>
 * 4. 分割线使用<div>，禁止<hr>
 * 5. 不使用!important
 */
export function plainTextToHtml(text: string): string {
  const paragraphs = text
    .split(/\n\s*\n/)  // 连续空行分段
    .map(p => p.trim())
    .filter(p => p.length > 0);

  const htmlParts = paragraphs.map((p, index) => {
    // 段落内换行转 <br>（先做HTML转义）
    const content = p
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');

    // 1. 第一段作为开头引导语（橙色加粗）
    if (index === 0) {
      return `<p style="margin:0 0 16px 0; padding:0; color:#E67E22; font-weight:bold; line-height:1.6;">${content}</p>`;
    }

    // 2. 一级标题（一、二、三、等）→ 黑色居中p + div分割线
    if (/^[一二三四五六七八九十]+[、.)\s]/.test(p)) {
      return `<p style="margin:16px 0; padding:0; color:#000000; font-weight:bold; text-align:center; font-size:16px; line-height:1.7;">${content}</p>\n<div style="width:90%; height:1px; background:#eee; margin:0 auto 16px auto;"></div>`;
    }

    // 4. 三级标题（1.1 2.1 等，或"真相一""要点二"等细分标题）→ 青绿色p常规字重
    if (/^\d+\.\d+[.、)\s]/.test(p) || /^(真相|要点|重点|核心|关键)[一二三四五六七八九十]/.test(p)) {
      return `<p style="margin:16px 0 8px 0; padding:0; color:#1A8A6F; line-height:1.75;">${content}</p>`;
    }

    // 3. 二级标题（1. 2. 3. 等）→ 青绿色加粗p
    if (/^\d+[.、)\s]/.test(p)) {
      return `<p style="margin:16px 0 8px 0; padding:0; color:#1A8A6F; font-weight:bold; line-height:1.75;">${content}</p>`;
    }

    // 6. 红色高危提醒
    if (/注意|提醒|警示|小心|务必|绝对不能|危险|⚠️|❗|❌|🚫|100%/.test(p)) {
      return `<p style="margin:0 0 16px 0; padding:0; color:#FF0000; font-weight:bold; line-height:1.6;">${content}</p>`;
    }

    // 7. 蓝色辅助提示（温和提示）
    if (/小提示|提示：|建议|💡|注意看/.test(p)) {
      return `<p style="margin:0 0 16px 0; padding:0; color:#3498db; line-height:1.6;">${content}</p>`;
    }

    // 11. 引用区块（条款引用）→ div包裹p
    if (/^【条款引用】|条款引用|根据.*条款|依据.*规定/.test(p)) {
      return `<div style="padding-left:10px; border-left:2px solid #eee; margin:0 0 16px 0;"><p style="margin:0; padding:0; line-height:1.6;">${content}</p></div>`;
    }

    // 12. 小字备注/数据来源
    if (/^备注|^数据来源|^注：/.test(p)) {
      return `<p style="margin:0 0 16px 0; padding:0; font-size:12px; color:#666666; line-height:1.5;">${content}</p>`;
    }

    // 13. 互动提问
    if (/互动提问|提问|欢迎在评论/.test(p)) {
      return `<p style="margin:16px 0; padding:0; line-height:1.6;">${content}</p>`;
    }

    // 14. 免责声明
    if (/免责声明|声明|不构成/.test(p)) {
      return `<p style="margin:16px 0 0 0; padding:0; font-size:12px; color:#666666; line-height:1.5;">${content}</p>`;
    }

    // 5. 正文段落（深灰、居左）
    return `<p style="margin:0 0 16px 0; padding:0; line-height:1.6;">${content}</p>`;
  });

  // 使用 API 上传专用 section + div 包裹
  const innerHtml = htmlParts.join('\n');

  // 自动补充互动提问（如果没有）
  const hasInteraction = /互动提问|提问|欢迎在评论/.test(text);
  const interaction = hasInteraction ? '' : '\n<p style="margin:16px 0; padding:0; line-height:1.6;">【互动提问】你买保险时踩过坑吗？欢迎在评论区留言分享</p>';

  // 自动补充免责声明（如果没有）
  const hasDisclaimer = /免责声明|声明|不构成/.test(text);
  const disclaimer = hasDisclaimer ? '' : '\n<p style="margin:16px 0 0 0; padding:0; font-size:12px; color:#666666; line-height:1.5;">【免责声明】本文仅为知识科普，不构成投资/购买建议。</p>';

  return `<section style="margin:0; padding:0; border:0; outline:0; font-size:14px; line-height:1.6; color:#3E3E3E; background:#ffffff;"><div style="padding:0 12px;">\n${innerHtml}${interaction}${disclaimer}\n</div></section>`;
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

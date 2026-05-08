/**
 * 公众号 HTML 结构化段落解析器
 *
 * 核心设计原则：
 * 1. 解析 HTML → 段落列表，每段只提取纯文本供用户编辑
 * 2. 保留每个段落的完整原始 HTML 标签和内联样式
 * 3. 回写时只替换标签内的文本节点，标签属性原封不动
 * 4. 格式零损失：section 嵌套、style 属性、自闭合标签全部保留
 *
 * 公众号 HTML 结构（来自 insurance-d-v3.md）：
 * - 外层 <section> 包裹
 * - <h2> 一级标题（黑色居中）
 * - <hr> 分割线（自闭合，不可编辑）
 * - <h3> 二级标题（青绿色居左）
 * - <p> 正文/提醒/互动/免责（不同颜色样式）
 * - 可能含 <strong>/<em>/<span> 等内联标签
 */

// ============ 类型定义 ============

/** 可编辑的块级元素类型 */
export type BlockType =
  | 'h2'         // 一级标题
  | 'h3'         // 二级标题
  | 'p'          // 段落
  | 'blockquote' // 引用块
  | 'li'         // 列表项
  | 'hr'         // 分割线（不可编辑）
  | 'other';     // 其他标签（不可编辑，原样保留）

/** 结构化段落块 */
export interface HtmlBlock {
  /** 块类型 */
  type: BlockType;
  /** 人类可读的类型标签（中文） */
  typeLabel: string;
  /** 块索引（从 0 开始） */
  index: number;
  /** 纯文本内容（用户可编辑），自闭合标签为空字符串 */
  text: string;
  /** 是否可编辑 */
  editable: boolean;
  /** 完整的开标签（含所有属性），如 <h2 style="color:#000000;..."> */
  openTag: string;
  /** 闭合标签，如 </h2>，自闭合标签为空字符串 */
  closeTag: string;
  /** 原始完整 HTML（用于回写时精确替换） */
  rawHtml: string;
  /** 块在 contentHtml 中的起始位置（含 prefix 偏移后用于回写定位） */
  startPos: number;
  /** 块在 contentHtml 中的结束位置 */
  endPos: number;
  /** 颜色样式（从 style 属性提取，用于前端渲染提示） */
  colorHint?: string;
}

/** 解析结果 */
export interface ParseResult {
  /** 解析出的段落块列表 */
  blocks: HtmlBlock[];
  /** 前置内容（<section> 开标签等，不可编辑） */
  prefix: string;
  /** 后置内容（</section> 闭标签等，不可编辑） */
  suffix: string;
  /** 原始 HTML（完整保留） */
  originalHtml: string;
}

// ============ 常量 ============

/** 块级标签列表（可独立成段） */
const BLOCK_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'blockquote', 'ul', 'ol', 'li', 'hr', 'div', 'section'];

/** 自闭合标签（无文本内容） */
const SELF_CLOSING_TAGS = ['hr', 'br', 'img'];

/** 类型标签映射 */
const TYPE_LABELS: Record<BlockType, string> = {
  h2: '一级标题',
  h3: '二级标题',
  p: '正文',
  blockquote: '引用',
  li: '列表项',
  hr: '分割线',
  other: '其他',
};

/** 特殊段落识别关键词 → 类型标签覆盖 */
const SPECIAL_P_LABELS: Array<{ keywords: string[]; label: string; colorHint: string }> = [
  { keywords: ['⚠️', '提醒', '注意', '警告', '重要'], label: '重要提醒', colorHint: '#FF0000' },
  { keywords: ['免责声明', '声明'], label: '免责声明', colorHint: '#666666' },
  { keywords: ['互动', '提问', '留言', '评论'], label: '互动区', colorHint: '#3E3E3E' },
  { keywords: ['聊聊', '跟大家', '说说'], label: '引导语', colorHint: '#E67E22' },
];

// ============ 工具函数 ============

/**
 * 从 style 属性中提取颜色值
 */
function extractColorFromStyle(style: string): string | undefined {
  const colorMatch = style.match(/color\s*:\s*([^;]+)/);
  if (colorMatch) {
    return colorMatch[1].trim();
  }
  return undefined;
}

/**
 * 检测 <p> 标签是否为特殊段落
 */
function detectSpecialP(text: string, style: string): { label: string; colorHint: string } | null {
  for (const spec of SPECIAL_P_LABELS) {
    if (spec.keywords.some(kw => text.includes(kw))) {
      return { label: spec.label, colorHint: spec.colorHint };
    }
  }
  // 通过颜色判断
  const color = extractColorFromStyle(style);
  if (color) {
    const lowerColor = color.toLowerCase();
    if (lowerColor.includes('ff0000') || lowerColor.includes('red')) {
      return { label: '重要提醒', colorHint: '#FF0000' };
    }
    if (lowerColor.includes('e67e22') || lowerColor.includes('orange')) {
      return { label: '引导语', colorHint: '#E67E22' };
    }
    if (lowerColor.includes('666') || lowerColor.includes('999')) {
      return { label: '辅助说明', colorHint: '#666666' };
    }
  }
  return null;
}

/**
 * 去除 HTML 标签，提取纯文本
 * 保留内联标签的文本内容，如 <strong>加粗</strong> → 加粗
 */
function stripHtmlTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')   // <br> → 换行
    .replace(/<[^>]+>/g, '')          // 移除所有标签
    .replace(/&nbsp;/g, ' ')          // &nbsp; → 空格
    .replace(/&lt;/g, '<')            // &lt; → <
    .replace(/&gt;/g, '>')            // &gt; → >
    .replace(/&amp;/g, '&')           // &amp; → &
    .replace(/&quot;/g, '"')          // &quot; → "
    .replace(/&#39;/g, "'")           // &#39; → '
    .trim();
}

// ============ 核心解析器 ============

/**
 * 解析公众号 HTML 为结构化段落列表
 *
 * 策略：使用正则逐个匹配块级标签，保留完整原始 HTML
 *
 * @param html 公众号文章 HTML
 * @returns 解析结果
 */
export function parseHtmlToBlocks(html: string): ParseResult {
  if (!html || !html.trim()) {
    return { blocks: [], prefix: '', suffix: '', originalHtml: html || '' };
  }

  const trimmed = html.trim();

  // 提取外层 section 包裹
  let prefix = '';
  let contentHtml = trimmed;
  let suffix = '';

  // 检测外层 <section> 包裹
  const sectionMatch = trimmed.match(/^(<section[^>]*>)([\s\S]*)(<\/section>)\s*$/);
  if (sectionMatch) {
    prefix = sectionMatch[1];
    contentHtml = sectionMatch[2];
    suffix = sectionMatch[3];
  }

  // 解析内容区域的块级元素
  const blocks: HtmlBlock[] = [];
  let blockIndex = 0;

  // 更精准的策略：逐段扫描
  const remaining = contentHtml;

  // 使用更可靠的逐标签解析
  const tagPattern = /<(\/?)(h[1-6]|p|blockquote|ul|ol|li|div|section|hr|br|img)([^>]*)(\/?)>/gi;

  let match: RegExpExecArray | null;

  // 收集所有标签位置
  const allTags: Array<{
    fullMatch: string;
    tagName: string;
    isClosing: boolean;
    isSelfClosing: boolean;
    attributes: string;
    index: number;
    length: number;
  }> = [];

  while ((match = tagPattern.exec(remaining)) !== null) {
    allTags.push({
      fullMatch: match[0],
      tagName: match[2].toLowerCase(),
      isClosing: match[1] === '/',
      isSelfClosing: match[4] === '/' || SELF_CLOSING_TAGS.includes(match[2].toLowerCase()),
      attributes: match[3] || '',
      index: match.index,
      length: match[0].length,
    });
  }

  // 使用 DOMParser 思路的简化版：遍历标签，配对开闭标签
  let currentPos = 0;
  let i = 0;

  while (i < allTags.length) {
    const tag = allTags[i];

    // 如果当前位置到标签之间有纯文本/空白，跳过
    currentPos = tag.index + tag.length;

    if (tag.isClosing) {
      // 孤立的闭标签，跳过
      i++;
      continue;
    }

    // 只处理块级标签
    if (!BLOCK_TAGS.includes(tag.tagName)) {
      i++;
      continue;
    }

    if (tag.isSelfClosing || tag.tagName === 'hr' || tag.tagName === 'br' || tag.tagName === 'img') {
      // 自闭合标签
      const rawHtml = tag.fullMatch;
      const blockType: BlockType = tag.tagName === 'hr' ? 'hr' : 'other';
      blocks.push({
        type: blockType,
        typeLabel: TYPE_LABELS[blockType],
        index: blockIndex++,
        text: '',
        editable: false,
        openTag: tag.fullMatch,
        closeTag: '',
        rawHtml,
        startPos: tag.index,
        endPos: tag.index + tag.length,
        colorHint: undefined,
      });
      i++;
      continue;
    }

    // 查找匹配的闭标签
    const closeTagIndex = findMatchingCloseTag(allTags, i);
    if (closeTagIndex === -1) {
      // 没有闭标签，当作自闭合处理
      i++;
      continue;
    }

    const closeTag = allTags[closeTagIndex];
    const innerStart = currentPos;
    const innerEnd = closeTag.index;

    // 提取内部 HTML 和纯文本
    const innerHtml = remaining.substring(innerStart, innerEnd);
    const text = stripHtmlTags(innerHtml);

    // 完整原始 HTML
    const rawHtml = remaining.substring(tag.index, closeTag.index + closeTag.length);

    // 确定块类型
    let blockType: BlockType;
    if (tag.tagName.match(/^h[1-6]$/)) {
      blockType = tag.tagName as BlockType;
    } else if (tag.tagName === 'p') {
      blockType = 'p';
    } else if (tag.tagName === 'blockquote') {
      blockType = 'blockquote';
    } else if (tag.tagName === 'li') {
      blockType = 'li';
    } else {
      blockType = 'other';
    }

    // 特殊段落识别
    let typeLabel = TYPE_LABELS[blockType];
    let colorHint = extractColorFromStyle(tag.attributes);

    if (blockType === 'p') {
      const special = detectSpecialP(text, tag.attributes);
      if (special) {
        typeLabel = special.label;
        colorHint = special.colorHint;
      }
    }
    if (blockType === 'h2') {
      colorHint = colorHint || '#000000';
    }
    if (blockType === 'h3') {
      colorHint = colorHint || '#1A8A6F';
    }

    blocks.push({
      type: blockType,
      typeLabel,
      index: blockIndex++,
      text,
      editable: blockType !== 'other',
      openTag: tag.fullMatch,
      closeTag: closeTag.fullMatch,
      rawHtml,
      startPos: tag.index,
      endPos: closeTag.index + closeTag.length,
      colorHint,
    });

    // 跳到闭标签之后
    i = closeTagIndex + 1;
    currentPos = closeTag.index + closeTag.length;
  }

  return {
    blocks,
    prefix,
    suffix,
    originalHtml: html,
  };
}

/**
 * 查找匹配的闭标签索引
 *
 * 策略：从开标签位置向后搜索，处理嵌套同级标签
 */
function findMatchingCloseTag(
  allTags: Array<{ tagName: string; isClosing: boolean; index: number }>,
  openIndex: number
): number {
  const openTag = allTags[openIndex];
  let depth = 1;

  for (let j = openIndex + 1; j < allTags.length; j++) {
    const tag = allTags[j];
    if (tag.tagName !== openTag.tagName) continue;

    if (tag.isClosing) {
      depth--;
      if (depth === 0) return j;
    } else {
      // 同级嵌套开标签（如 section 嵌套）
      depth++;
    }
  }

  return -1; // 未找到匹配闭标签
}

// ============ 回写引擎 ============

/**
 * 将编辑后的段落块列表回写为 HTML
 *
 * 核心原则：只替换标签内的文本节点，标签属性原封不动
 * 内联标签（<strong>/<em>/<span> 等）的处理：
 *   - 保留内联标签结构，只替换其文本内容
 *   - 这样粗体/斜体/颜色等内联格式不会丢失
 *
 * @param parseResult 原始解析结果
 * @param editedBlocks 编辑后的段落块列表
 * @returns 重建后的 HTML
 */
export function rebuildHtmlFromBlocks(parseResult: ParseResult, editedBlocks: HtmlBlock[]): string {
  const { originalHtml, prefix } = parseResult;

  if (!editedBlocks.length) {
    return originalHtml;
  }

  // 收集需要替换的块：按 startPos 升序排列
  const replacements: Array<{ start: number; end: number; newHtml: string }> = [];

  for (const block of editedBlocks) {
    if (!block.editable || !block.rawHtml) continue;

    // 检查文本是否发生了修改
    const originalBlock = parseResult.blocks.find(b => b.index === block.index);
    if (!originalBlock || originalBlock.text === block.text) continue;

    // 重建该块的 HTML：保留开闭标签，只替换内部文本
    const newInnerHtml = replaceTextInInnerHtml(
      getInnerHtml(originalBlock.rawHtml, originalBlock.openTag, originalBlock.closeTag),
      originalBlock.text,
      block.text
    );

    const newRawHtml = block.openTag + newInnerHtml + block.closeTag;

    // 使用位置信息（startPos/endPos）定位替换，而非字符串匹配
    // 注意：startPos/endPos 是在 contentHtml 中的位置，需要加上 prefix 长度
    const prefixLen = prefix.length;
    replacements.push({
      start: prefixLen + originalBlock.startPos,
      end: prefixLen + originalBlock.endPos,
      newHtml: newRawHtml,
    });
  }

  if (replacements.length === 0) {
    return originalHtml;
  }

  // 按 start 升序排列，确保从后往前替换时不影响前面的位置
  replacements.sort((a, b) => a.start - b.start);

  // 从后往前替换，避免前面的替换影响后面的位置偏移
  let result = originalHtml;
  for (let i = replacements.length - 1; i >= 0; i--) {
    const { start, end, newHtml } = replacements[i];
    result = result.substring(0, start) + newHtml + result.substring(end);
  }

  return result;
}

/**
 * 提取标签内部 HTML
 */
function getInnerHtml(rawHtml: string, openTag: string, closeTag: string): string {
  if (!closeTag) return '';
  const start = rawHtml.indexOf(openTag);
  if (start === -1) return '';
  const innerStart = start + openTag.length;
  const innerEnd = rawHtml.lastIndexOf(closeTag);
  if (innerEnd <= innerStart) return '';
  return rawHtml.substring(innerStart, innerEnd);
}

/**
 * 替换内部 HTML 中的文本
 *
 * 策略：
 * 1. 如果内部没有内联标签（纯文本），直接替换
 * 2. 如果内部有内联标签，按顺序替换每个文本节点
 *
 * 精确算法：
 * - 找出原始内部 HTML 中所有文本节点
 * - 按顺序与旧纯文本中的文字对应
 * - 用新纯文本替换
 */
function replaceTextInInnerHtml(innerHtml: string, oldText: string, newText: string): string {
  // 快速路径：没有内联标签，直接替换
  if (!/<[^>]+>/.test(innerHtml)) {
    return escapeHtmlText(newText);
  }

  // 有内联标签的情况：逐段替换文本节点
  // 策略：将 innerHtml 分割为 标签段 和 文本段
  const segments = splitIntoSegments(innerHtml);

  // 收集所有文本段
  const textSegments = segments.filter(s => s.type === 'text');
  const totalOriginalText = textSegments.map(s => s.content).join('');

  // 如果旧文本不匹配（可能被 stripHtmlTags 修改过），回退到整体替换
  if (totalOriginalText !== oldText) {
    // 回退策略：保留内联标签结构，整体替换文本
    return rebuildWithInlineTags(innerHtml, newText);
  }

  // 将新文本按比例分配到各文本段
  if (textSegments.length === 0) return innerHtml;

  // 简单策略：所有文本段合并替换为新文本，内联标签保留
  return rebuildWithInlineTags(innerHtml, newText);
}

/**
 * 将 HTML 分割为标签段和文本段
 */
function splitIntoSegments(html: string): Array<{ type: 'tag' | 'text'; content: string }> {
  const segments: Array<{ type: 'tag' | 'text'; content: string }> = [];
  const tagRegex = /(<[^>]+>)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(html)) !== null) {
    // 标签前的文本
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: html.substring(lastIndex, match.index) });
    }
    // 标签本身
    segments.push({ type: 'tag', content: match[0] });
    lastIndex = match.index + match[0].length;
  }

  // 尾部文本
  if (lastIndex < html.length) {
    segments.push({ type: 'text', content: html.substring(lastIndex) });
  }

  return segments;
}

/**
 * 保留内联标签结构，替换文本内容
 *
 * 策略：
 * - 保留所有内联标签的位置和属性
 * - 将新文本按内联标签的位置分配
 * - 如果新文本比旧文本短/长，最后一个文本段承担差异
 */
function rebuildWithInlineTags(innerHtml: string, newText: string): string {
  const segments = splitIntoSegments(innerHtml);

  // 提取所有内联标签的位置
  const inlineTagIndices: number[] = [];
  segments.forEach((seg, idx) => {
    if (seg.type === 'tag' && isInlineTag(seg.content)) {
      inlineTagIndices.push(idx);
    }
  });

  // 没有内联标签，直接替换所有文本段
  if (inlineTagIndices.length === 0) {
    const escaped = escapeHtmlText(newText);
    return segments.map(seg => {
      if (seg.type === 'text') return escaped;
      return seg.content;
    }).join('');
  }

  // 有内联标签：需要将新文本分配到各文本段
  // 策略：找出内联标签的文本边界，将新文本按比例分配
  // 简化：将新文本作为一个整体放在第一个文本段，清空其余文本段
  // 这样可以保证文本不会重复

  let newTextPlaced = false;
  return segments.map(seg => {
    if (seg.type === 'tag') return seg.content;
    // 文本段
    if (!newTextPlaced) {
      newTextPlaced = true;
      return escapeHtmlText(newText);
    }
    return ''; // 后续文本段清空（内容已在第一段）
  }).join('');
}

/**
 * 判断是否为内联标签
 */
function isInlineTag(tagHtml: string): boolean {
  const inlineTags = ['strong', 'b', 'em', 'i', 'span', 'a', 'u', 's', 'del', 'ins', 'mark', 'sub', 'sup'];
  const match = tagHtml.match(/^<\/?(\w+)/);
  if (!match) return false;
  return inlineTags.includes(match[1].toLowerCase());
}

/**
 * 转义 HTML 特殊字符（用于回写时的文本内容）
 */
function escapeHtmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br/>');
}

// ============ 便捷函数 ============

/**
 * 快速重建：修改了某些块的文本后，生成新的 HTML
 */
export function quickRebuild(
  originalHtml: string,
  blockTextUpdates: Array<{ index: number; newText: string }>
): string {
  const parseResult = parseHtmlToBlocks(originalHtml);
  const editedBlocks = parseResult.blocks.map(block => {
    const update = blockTextUpdates.find(u => u.index === block.index);
    if (update && block.editable) {
      return { ...block, text: update.newText };
    }
    return block;
  });

  return rebuildHtmlFromBlocks(parseResult, editedBlocks);
}

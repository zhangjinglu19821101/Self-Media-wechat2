/**
 * 小红书卡片生成服务
 *
 * 使用 @napi-rs/canvas 将文字渲染成小红书风格的图片卡片
 *
 * 卡片类型：
 * 1. 封面卡：渐变背景 + 大标题 + 副标题
 * 2. 要点卡：渐变背景 + 数字编号 + 标题 + 内容（标准模式）
 * 3. 极简要点卡：渐变背景 + 大号标题（无内容，极简模式专用）
 * 4. 结尾卡：渐变背景 + 总结 + 话题标签
 *
 * 图片尺寸：1080 x 1440 (3:4 竖版，小红书标准)
 *
 * 图片数量模式：
 * - 3-card (极简)：封面 + 1个核心要点(仅标题) + 结尾 = 快速扫读
 * - 5-card (标准)：封面 + 3个要点(标题+1行) + 结尾 = 信息适中
 * - 7-card (详细)：封面 + 5个要点(标题+详细内容) + 结尾 = 深度阅读
 */

import { createCanvas, loadImage, type CanvasRenderingContext2D } from '@napi-rs/canvas';
import * as fs from 'fs';
import * as path from 'path';

// 中文字体（使用系统已安装的字体）
// WenQuanYi Micro Hei 是 Linux 系统常见的中文字体
const CHINESE_FONT_FAMILY = '"WenQuanYi Micro Hei", "WenQuanYi Zen Hei", "Noto Sans CJK SC", sans-serif';

// 小红书卡片尺寸
const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1440;

// 渐变色方案
const GRADIENT_SCHEMES = {
  // 粉橙渐变（热门）
  pinkOrange: ['#FF6B6B', '#FF8E53', '#FFA07A'],
  // 蓝紫渐变（专业）
  bluePurple: ['#667eea', '#764ba2', '#f093fb'],
  // 青绿渐变（清新）
  tealGreen: ['#11998e', '#38ef7d', '#56ab2f'],
  // 橙黄渐变（温暖）
  orangeYellow: ['#FFB347', '#FFCC33', '#FF8C00'],
  // 深蓝渐变（稳重）
  deepBlue: ['#1a1a2e', '#16213e', '#0f3460'],
  // 珊瑚粉（女性向）
  coralPink: ['#FF9A9E', '#FECFEF', '#FECFEF'],
};

export type GradientScheme = keyof typeof GRADIENT_SCHEMES;

/** 图片数量模式 */
export type ImageCountMode = '3-card' | '5-card' | '7-card';

/** 🔥 自定义配色方案（从 color_scheme 规则读取，替代硬编码 GradientScheme） */
export interface CustomColorScheme {
  primaryColor: string;       // 渐变起始色 e.g. '#FF6B6B'
  secondaryColor: string;     // 渐变终止色 e.g. '#FF8E53'
  backgroundColor: string;    // 卡片底色 e.g. '#FFF5F5'
  accentColor: string;        // 强调色（数字/标签）e.g. '#FF4757'
  textPrimaryColor: string;   // 主文字色 e.g. '#FFFFFF'
  textSecondaryColor: string; // 副文字色 e.g. '#FFE0E0'
}

/** 解析后的配色（Canvas 直接使用） */
export interface ResolvedColorScheme {
  gradientColors: string[];     // 渐变色组 [primary, secondary]
  backgroundColor: string;      // 背景色
  accentColor: string;          // 强调色
  textPrimaryColor: string;     // 主文字色
  textSecondaryColor: string;   // 副文字色
  /** 是否为自定义配色（影响绘制细节） */
  isCustom: boolean;
}

/** 卡片文字密度 */
export type CardTextDensity = 'minimal' | 'concise' | 'standard';

// 内容长度限制（防止超长文本溢出卡片）
const LIMITS = {
  title: 20,       // 封面标题最大字数
  subtitle: 40,    // 副标题最大字数
  pointTitle: 15,  // 要点标题最大字数
  pointContent: 100, // 要点内容最大字数
  summary: 50,     // 总结语最大字数
  callToAction: 30, // 行动召唤最大字数
  author: 20,      // 作者名最大字数
} as const;

/**
 * 安全截断字符串，超长时添加省略号
 */
function truncate(str: string, maxLen: number): string {
  if (!str) return str;
  // 中文字符算1个长度单位
  return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
}

// 卡片内容接口
export interface CoverCardContent {
  type: 'cover';
  title: string;           // 主标题（≤20字）
  subtitle?: string;       // 副标题
  author?: string;         // 作者名
  gradientScheme?: GradientScheme;
  colorScheme?: CustomColorScheme;  // 🔥 优先级高于 gradientScheme
}

export interface PointCardContent {
  type: 'point';
  number: number;          // 序号 1-9
  title: string;           // 要点标题（≤15字）
  content: string;         // 要点内容（≤100字）
  gradientScheme?: GradientScheme;
  colorScheme?: CustomColorScheme;  // 🔥 优先级高于 gradientScheme
}

export interface EndingCardContent {
  type: 'ending';
  summary: string;         // 总结语（≤50字）
  tags: string[];          // 话题标签
  callToAction?: string;   // 行动召唤
  gradientScheme?: GradientScheme;
  colorScheme?: CustomColorScheme;  // 🔥 优先级高于 gradientScheme
}

/** 极简要点卡（3-card 模式专用：仅标题，无内容文字） */
export interface MinimalPointCardContent {
  type: 'minimal-point';
  number: number;          // 序号 1-9
  title: string;           // 要点标题（≤20字，大字号展示）
  subtitle?: string;       // 可选副文案（≤15字）
  gradientScheme?: GradientScheme;
  colorScheme?: CustomColorScheme;  // 🔥 优先级高于 gradientScheme
}

export type CardContent = CoverCardContent | PointCardContent | MinimalPointCardContent | EndingCardContent;

// 生成结果
export interface GeneratedCard {
  imageBuffer: Buffer;
  base64: string;
  width: number;
  height: number;
  title?: string;  // 卡片标题（用于文件名）
}

/**
 * 🔥 解析配色方案：优先使用自定义配色（来自多模态分析），降级到 GradientScheme
 */
function resolveColorScheme(
  customScheme?: CustomColorScheme,
  gradientScheme: GradientScheme = 'pinkOrange'
): ResolvedColorScheme {
  if (customScheme) {
    return {
      gradientColors: [customScheme.primaryColor, customScheme.secondaryColor],
      backgroundColor: customScheme.backgroundColor,
      accentColor: customScheme.accentColor,
      textPrimaryColor: customScheme.textPrimaryColor,
      textSecondaryColor: customScheme.textSecondaryColor,
      isCustom: true,
    };
  }
  // 降级到预定义方案
  const colors = GRADIENT_SCHEMES[gradientScheme];
  return {
    gradientColors: colors,
    backgroundColor: '#FFFFFF',
    accentColor: colors[0],
    textPrimaryColor: '#FFFFFF',
    textSecondaryColor: 'rgba(255,255,255,0.8)',
    isCustom: false,
  };
}

/**
 * 绘制渐变背景
 */
function drawGradientBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scheme: GradientScheme = 'pinkOrange',
  customScheme?: CustomColorScheme
): void {
  const resolved = resolveColorScheme(customScheme, scheme);
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  
  resolved.gradientColors.forEach((color, index) => {
    gradient.addColorStop(index / (resolved.gradientColors.length - 1), color);
  });
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  // 添加轻微纹理（噪点效果）
  ctx.globalAlpha = 0.03;
  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    ctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#000000';
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 1;
}

/**
 * 自动换行绘制文字
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const chars = text.split('');
  let line = '';
  let currentY = y;
  
  for (let i = 0; i < chars.length; i++) {
    const testLine = line + chars[i];
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > maxWidth && i > 0) {
      ctx.fillText(line, x, currentY);
      line = chars[i];
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, currentY);
  
  return currentY + lineHeight;
}

/**
 * 绘制装饰元素
 */
function drawDecorations(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  // 左上角圆形装饰
  ctx.globalAlpha = 0.1;
  ctx.beginPath();
  ctx.arc(-50, -50, 200, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  
  // 右下角圆形装饰
  ctx.beginPath();
  ctx.arc(width + 100, height + 100, 300, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.globalAlpha = 1;
}

/**
 * 生成封面卡
 */
async function generateCoverCard(content: CoverCardContent): Promise<GeneratedCard> {
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext('2d');
  const colors = resolveColorScheme(content.colorScheme, content.gradientScheme || 'pinkOrange');
  
  // 背景
  drawGradientBackground(ctx, CARD_WIDTH, CARD_HEIGHT, content.gradientScheme || 'pinkOrange', content.colorScheme);
  drawDecorations(ctx, CARD_WIDTH, CARD_HEIGHT);
  
  // 标题背景框
  const boxY = CARD_HEIGHT / 2 - 150;
  const boxHeight = 300;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.beginPath();
  ctx.roundRect(60, boxY, CARD_WIDTH - 120, boxHeight, 30);
  ctx.fill();
  
  // 主标题
  ctx.fillStyle = colors.textPrimaryColor;
  ctx.font = 'bold 72px WenQuanYi, Arial';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 5;
  
  const titleY = boxY + 120;
  wrapText(ctx, content.title, CARD_WIDTH / 2, titleY, CARD_WIDTH - 180, 90);
  
  // 副标题
  if (content.subtitle) {
    ctx.font = '32px WenQuanYi, Arial';
    ctx.shadowBlur = 5;
    ctx.fillStyle = colors.textSecondaryColor;
    wrapText(ctx, content.subtitle, CARD_WIDTH / 2, titleY + 120, CARD_WIDTH - 180, 45);
  }
  
  // 作者
  if (content.author) {
    ctx.font = '28px WenQuanYi, Arial';
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = colors.textSecondaryColor;
    ctx.fillText(`@${content.author}`, CARD_WIDTH / 2, CARD_HEIGHT - 100);
    ctx.globalAlpha = 1;
  }
  
  // 重置阴影
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  
  const buffer = canvas.toBuffer('image/png');
  return {
    imageBuffer: buffer,
    base64: buffer.toString('base64'),
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    title: content.title,  // 封面标题
  };
}

/**
 * 生成要点卡
 */
async function generatePointCard(content: PointCardContent): Promise<GeneratedCard> {
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext('2d');
  const colors = resolveColorScheme(content.colorScheme, content.gradientScheme || 'bluePurple');
  
  // 背景
  drawGradientBackground(ctx, CARD_WIDTH, CARD_HEIGHT, content.gradientScheme || 'bluePurple', content.colorScheme);
  drawDecorations(ctx, CARD_WIDTH, CARD_HEIGHT);
  
  // 序号圆圈
  const circleY = 180;
  ctx.beginPath();
  ctx.arc(CARD_WIDTH / 2, circleY, 80, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.fill();
  
  // 序号数字
  ctx.fillStyle = colors.accentColor;
  ctx.font = 'bold 80px WenQuanYi, Arial';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 8;
  ctx.fillText(content.number.toString(), CARD_WIDTH / 2, circleY + 30);
  
  // 要点标题
  ctx.fillStyle = colors.textPrimaryColor;
  ctx.font = 'bold 52px WenQuanYi, Arial';
  const titleY = circleY + 160;
  wrapText(ctx, content.title, CARD_WIDTH / 2, titleY, CARD_WIDTH - 120, 65);
  
  // 分隔线
  const lineY = titleY + 100;
  ctx.beginPath();
  ctx.moveTo(200, lineY);
  ctx.lineTo(CARD_WIDTH - 200, lineY);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // 要点内容
  ctx.fillStyle = colors.textSecondaryColor;
  ctx.font = '38px WenQuanYi, Arial';
  ctx.shadowBlur = 5;
  const contentY = lineY + 80;
  wrapText(ctx, content.content, CARD_WIDTH / 2, contentY, CARD_WIDTH - 120, 55);
  
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  
  const buffer = canvas.toBuffer('image/png');
  return {
    imageBuffer: buffer,
    base64: buffer.toString('base64'),
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    title: content.title,  // 要点标题
  };
}

/**
 * 生成极简要点卡（3-card 模式专用）
 *
 * 设计原则：一张图只传递一个核心信息，大字号+留白
 * 读者 1 秒扫完就能获取要点
 */
async function generateMinimalPointCard(content: MinimalPointCardContent): Promise<GeneratedCard> {
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext('2d');
  const colors = resolveColorScheme(content.colorScheme, content.gradientScheme || 'deepBlue');

  // 背景（使用更干净的渐变）
  drawGradientBackground(ctx, CARD_WIDTH, CARD_HEIGHT, content.gradientScheme || 'deepBlue', content.colorScheme);
  // 极简模式不画装饰元素，保持干净

  // 大号序号（左上角，半透明）
  ctx.fillStyle = colors.isCustom
    ? `${colors.accentColor}1F`  // 12% opacity of accent color
    : 'rgba(255, 255, 255, 0.12)';
  ctx.font = 'bold 280px WenQuanYi, Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(content.number.toString(), 40, 20);

  // 核心标题（居中，超大字号）
  ctx.fillStyle = colors.textPrimaryColor;
  ctx.font = 'bold 68px WenQuanYi, Arial';  // 比标准模式的 52px 更大
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 15;
  ctx.shadowOffsetY = 8;

  const titleY = CARD_HEIGHT / 2 - (content.subtitle ? 40 : 0);
  wrapText(ctx, content.title, CARD_WIDTH / 2, titleY, CARD_WIDTH - 160, 85);

  // 可选副文案（小字，次要信息）
  if (content.subtitle) {
    ctx.font = '36px WenQuanYi, Arial';
    ctx.fillStyle = colors.textSecondaryColor;
    ctx.shadowBlur = 6;
    ctx.globalAlpha = 0.85;
    wrapText(ctx, content.subtitle, CARD_WIDTH / 2, titleY + 100, CARD_WIDTH - 160, 50);
    ctx.globalAlpha = 1;
  }

  // 底部装饰线
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.strokeStyle = colors.isCustom
    ? `${colors.accentColor}4D`  // 30% opacity
    : 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(CARD_WIDTH / 2 - 80, CARD_HEIGHT - 180);
  ctx.lineTo(CARD_WIDTH / 2 + 80, CARD_HEIGHT - 180);
  ctx.stroke();

  // 页码指示
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.font = '24px WenQuanYi, Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`${content.number} / 3`, CARD_WIDTH / 2, CARD_HEIGHT - 120);

  const buffer = canvas.toBuffer('image/png');
  return {
    imageBuffer: buffer,
    base64: buffer.toString('base64'),
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    title: content.title,  // 极简要点标题
  };
}

/**
 * 生成结尾卡
 */
async function generateEndingCard(content: EndingCardContent): Promise<GeneratedCard> {
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext('2d');
  const colors = resolveColorScheme(content.colorScheme, content.gradientScheme || 'tealGreen');

  // 背景
  drawGradientBackground(ctx, CARD_WIDTH, CARD_HEIGHT, content.gradientScheme || 'tealGreen', content.colorScheme);
  drawDecorations(ctx, CARD_WIDTH, CARD_HEIGHT);

  // 总结语
  ctx.fillStyle = colors.textPrimaryColor;
  ctx.font = 'bold 48px WenQuanYi, Arial';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 8;

  const summaryY = CARD_HEIGHT / 3;
  wrapText(ctx, content.summary, CARD_WIDTH / 2, summaryY, CARD_WIDTH - 120, 65);

  // 行动召唤
  if (content.callToAction) {
    ctx.font = '36px WenQuanYi, Arial';
    ctx.fillStyle = colors.textSecondaryColor;
    ctx.shadowBlur = 5;
    wrapText(ctx, content.callToAction, CARD_WIDTH / 2, summaryY + 180, CARD_WIDTH - 120, 50);
  }

  // 话题标签
  ctx.font = '32px WenQuanYi, Arial';
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.9;

  const tagsY = CARD_HEIGHT - 200;
  const tagSpacing = 45;

  content.tags.forEach((tag, index) => {
    const tagText = tag.startsWith('#') ? tag : `#${tag}`;
    ctx.fillText(tagText, CARD_WIDTH / 2, tagsY + index * tagSpacing);
  });

  ctx.globalAlpha = 1;
  ctx.shadowColor = 'transparent';
  
  const buffer = canvas.toBuffer('image/png');
  return {
    imageBuffer: buffer,
    base64: buffer.toString('base64'),
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    title: content.summary,  // 结尾总结语
  };
}

/**
 * 生成小红书卡片（统一入口）
 */
export async function generateXiaohongshuCard(content: CardContent): Promise<GeneratedCard> {
  switch (content.type) {
    case 'cover':
      return generateCoverCard(content);
    case 'point':
      return generatePointCard(content);
    case 'minimal-point':
      return generateMinimalPointCard(content);
    case 'ending':
      return generateEndingCard(content);
    default:
      throw new Error(`Unknown card type: ${(content as CardContent).type}`);
  }
}

/**
 * 批量生成一组小红书卡片（支持标准要点卡 + 极简要点卡）
 */
export async function generateXiaohongshuCardSet(
  cover: CoverCardContent,
  points: PointCardContent[],
  ending: EndingCardContent,
  minimalPoints?: MinimalPointCardContent[]   // 极简模式专用
): Promise<GeneratedCard[]> {
  const cards: GeneratedCard[] = [];

  // 封面
  cards.push(await generateXiaohongshuCard(cover));

  // 标准要点卡片
  for (const point of points) {
    cards.push(await generateXiaohongshuCard(point));
  }

  // 极简要点卡片（3-card 模式）
  if (minimalPoints) {
    for (const point of minimalPoints) {
      cards.push(await generateXiaohongshuCard(point));
    }
  }

  // 结尾
  cards.push(await generateXiaohongshuCard(ending));

  return cards;
}

/**
 * 从文章内容智能生成卡片组（支持 3/5/7 张图模式）
 *
 * @param article 文章内容
 * @param gradientSchemeOrSchemes 渐变配色方案（单个或数组，数组时每张卡片不同颜色）
 * @param imageCountMode 图片数量模式
 *   - '3-card' (极简)：封面 + 1个核心要点(仅标题) + 结尾 = 快速扫读
 *   - '5-card' (标准)：封面 + 3个要点(标题+1行) + 结尾 = 信息适中
 *   - '7-card' (详细)：封面 + 5个要点(完整) + 结尾 = 深度阅读
 * @param colorScheme 自定义配色（来自多模态分析）
 * @param contentPromptInstruction 内容模板精简指令（影响卡片文字内容取舍）
 */
export async function generateCardsFromArticle(
  article: {
    title: string;
    intro?: string;
    points: Array<{ title: string; content: string }>;
    conclusion: string;
    tags: string[];
    author?: string;
  },
  gradientSchemeOrSchemes: GradientScheme | GradientScheme[] = 'pinkOrange',
  imageCountMode: ImageCountMode = '5-card',
  colorScheme?: CustomColorScheme,  // 🔥 自定义配色（来自多模态分析）
  contentPromptInstruction?: string  // 🔥 内容模板精简指令（影响卡片文字内容取舍）
): Promise<GeneratedCard[]> {
  // 统一转换为数组形式
  const gradientSchemes = Array.isArray(gradientSchemeOrSchemes) 
    ? gradientSchemeOrSchemes 
    : [gradientSchemeOrSchemes];
  
  // 辅助函数：根据卡片索引获取颜色方案
  const getSchemeForIndex = (index: number): GradientScheme => {
    return gradientSchemes[index % gradientSchemes.length];
  };
  // 根据模式裁剪要点并选择卡片类型
  // 🔥 根据内容模板精简指令决定要点卡内容量（所有模式通用）
  const shouldStripPointContent = contentPromptInstruction?.includes('要点仅标题无内容');

  if (imageCountMode === '3-card') {
    // ===== 3张极简模式：封面 + 1个最核心要点(仅标题) + 结尾 =====
    // 索引：封面=0, 要点=1, 结尾=2
    const cover: CoverCardContent = {
      type: 'cover',
      title: truncate(article.title, LIMITS.title),
      subtitle: article.intro ? truncate(article.intro, LIMITS.subtitle) : undefined,
      author: article.author ? truncate(article.author, LIMITS.author) : undefined,
      gradientScheme: getSchemeForIndex(0),
      colorScheme,
    };
    
    const topPoint = article.points[0] || { title: article.title, content: '' };
    const minimalPoint: MinimalPointCardContent = {
      type: 'minimal-point',
      number: 1,
      title: truncate(topPoint.title, 20),
      subtitle: shouldStripPointContent ? undefined : (topPoint.content ? truncate(topPoint.content, 15) : undefined),
      gradientScheme: getSchemeForIndex(1),
      colorScheme,
    };
    
    const ending: EndingCardContent = {
      type: 'ending',
      summary: truncate(article.conclusion, LIMITS.summary),
      tags: article.tags,
      callToAction: '关注我，获取更多干货',
      gradientScheme: getSchemeForIndex(2),
      colorScheme,
    };
    
    return generateXiaohongshuCardSet(cover, [], ending, [minimalPoint]);
  }

  if (imageCountMode === '5-card') {
    // ===== 5张标准模式：封面 + 3个要点(标题+精简内容) + 结尾 =====
    // 索引：封面=0, 要点1=1, 要点2=2, 要点3=3, 结尾=4
    const cover: CoverCardContent = {
      type: 'cover',
      title: truncate(article.title, LIMITS.title),
      subtitle: article.intro ? truncate(article.intro, LIMITS.subtitle) : undefined,
      author: article.author ? truncate(article.author, LIMITS.author) : undefined,
      gradientScheme: getSchemeForIndex(0),
      colorScheme,
    };
    
    const selectedPoints = article.points.slice(0, 3);
    const concisePoints: PointCardContent[] = selectedPoints.map((p, i) => ({
      type: 'point' as const,
      number: i + 1,
      title: truncate(p.title, LIMITS.pointTitle),
      content: shouldStripPointContent ? '' : truncate(p.content, 50),
      gradientScheme: getSchemeForIndex(i + 1),  // 要点从索引1开始
      colorScheme,
    }));
    
    const ending: EndingCardContent = {
      type: 'ending',
      summary: truncate(article.conclusion, LIMITS.summary),
      tags: article.tags,
      callToAction: '关注我，获取更多干货',
      gradientScheme: getSchemeForIndex(4),  // 结尾是第5张（索引4）
      colorScheme,
    };
    
    return generateXiaohongshuCardSet(cover, concisePoints, ending);
  }

  // ===== 7张详细模式（默认）：封面 + 5个要点(完整内容) + 结尾 =====
  // 索引：封面=0, 要点1~5=1~5, 结尾=6
  const cover: CoverCardContent = {
    type: 'cover',
    title: truncate(article.title, LIMITS.title),
    subtitle: article.intro ? truncate(article.intro, LIMITS.subtitle) : undefined,
    author: article.author ? truncate(article.author, LIMITS.author) : undefined,
    gradientScheme: getSchemeForIndex(0),
    colorScheme,
  };
  
  const pointContentLimit = contentPromptInstruction?.includes('简短说明')
    ? 30  // 短内容模式
    : contentPromptInstruction?.includes('详细内容')
      ? 100 // 详尽模式
      : LIMITS.pointContent; // 默认

  const standardPoints: PointCardContent[] = article.points.slice(0, 5).map((p, i) => ({
    type: 'point' as const,
    number: i + 1,
    title: truncate(p.title, LIMITS.pointTitle),
    content: shouldStripPointContent ? '' : truncate(p.content, pointContentLimit),
    gradientScheme: getSchemeForIndex(i + 1),  // 要点从索引1开始
    colorScheme,
  }));
  
  const ending: EndingCardContent = {
    type: 'ending',
    summary: truncate(article.conclusion, LIMITS.summary),
    tags: article.tags,
    callToAction: '关注我，获取更多干货',
    gradientScheme: getSchemeForIndex(6),  // 结尾是第7张（索引6）
    colorScheme,
  };
  
  return generateXiaohongshuCardSet(cover, standardPoints, ending);
}

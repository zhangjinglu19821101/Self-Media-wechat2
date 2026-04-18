/**
 * 小红书内容解析工具模块
 * 
 * 提供统一的小红书内容解析、类型定义和样式常量
 * 被 article-preview-editor.tsx 和 xiaohongshu-preview.tsx 共用
 */

// ============ 样式常量 ============

/**
 * 卡片渐变色方案（与小红书卡片生成器一致）
 */
export const GRADIENT_SCHEMES = [
  { from: '#FF6B6B', to: '#FFA07A' },  // 粉橙
  { from: '#667eea', to: '#764ba2' },   // 蓝紫
  { from: '#2dd4bf', to: '#34d399' },   // 青绿
  { from: '#1e3a5f', to: '#4a90d9' },   // 深蓝
  { from: '#f472b6', to: '#fb923c' },    // 珊瑚粉
] as const;

// ============ 类型定义 ============

/**
 * 小红书内容结构（解析后的展示格式）
 */
export interface XiaohongshuContent {
  title: string;
  intro?: string;
  points: Array<{ title: string; content: string }>;
  conclusion?: string;
  tags: string[];
  fullText: string;   // 完整正文
  content?: string;   // 新信封格式：正文
  articleTitle?: string; // 文章核心标题
}

/**
 * 小红书渲染数据结构（后端提取器生成）
 */
export interface XhsRenderData {
  platform?: string;
  cardCountMode?: string;
  cards?: Array<{
    type: 'cover' | 'point' | 'ending';
    title?: string;
    subtitle?: string;
    content?: string;
    conclusion?: string;
    tags?: string[];
  }>;
  textContent?: string;
  articleTitle?: string;
  title?: string;
  intro?: string;
  points?: Array<{ title: string; content: string }>;
  conclusion?: string;
  tags?: string[];
}

/**
 * 解析后的展示格式
 */
export interface XhsParsedContent {
  articleTitle?: string;  // 文章核心标题（15字以内）
  title: string;          // 封面标题
  intro?: string;         // 副标题/引言
  points: Array<{ title: string; content: string }>;
  conclusion?: string;   // 总结语
  tags: string[];
  fullText: string;       // 完整正文
}

// ============ 解析函数 ============

const defaultParsedContent: XhsParsedContent = {
  title: '',
  points: [],
  tags: [],
  fullText: '',
};

/**
 * 解析小红书渲染数据（platformRenderData 格式）
 * 
 * platformRenderData 格式（来自后端 extractors）：
 * {
 *   platform: 'xiaohongshu',
 *   cardCountMode: '5-card',
 *   cards: [{ type: 'cover', title, subtitle }, { type: 'point', title, content }, ...],
 *   textContent: '正文',
 *   articleTitle: '标题'
 * }
 */
export function parseXhsRenderData(
  renderData: Record<string, unknown>,
  fallbackText: string
): XhsParsedContent {
  const result: XhsParsedContent = { title: '', points: [], tags: [], fullText: '' };

  // 从 cards 数组提取结构化数据
  const cards = renderData.cards;
  if (Array.isArray(cards)) {
    for (const card of cards) {
      if (typeof card !== 'object' || card === null) continue;
      const c = card as Record<string, unknown>;
      
      if (c.type === 'cover') {
        result.title = typeof c.title === 'string' ? c.title : '';
        result.intro = typeof c.subtitle === 'string' ? c.subtitle : undefined;
      } else if (c.type === 'point') {
        result.points.push({
          title: typeof c.title === 'string' ? c.title : '',
          content: typeof c.content === 'string' ? c.content : '',
        });
      } else if (c.type === 'ending') {
        result.conclusion = typeof c.conclusion === 'string' ? c.conclusion : undefined;
        if (Array.isArray(c.tags)) {
          result.tags = c.tags.filter((t: unknown) => typeof t === 'string') as string[];
        }
      }
    }
  } else {
    // 兜底：platformRenderData 可能是 platformData 格式（旧路径）
    if (renderData.platform === 'xiaohongshu') {
      result.title = typeof renderData.title === 'string' ? renderData.title : '';
      result.intro = typeof renderData.intro === 'string' ? renderData.intro : undefined;
      if (Array.isArray(renderData.points)) {
        result.points = renderData.points
          .filter((p: unknown) => typeof p === 'object' && p !== null && typeof (p as Record<string, unknown>).title === 'string')
          .map((p: unknown) => ({
            title: (p as Record<string, unknown>).title as string,
            content: typeof (p as Record<string, unknown>).content === 'string' 
              ? (p as Record<string, unknown>).content as string 
              : '',
          }));
      }
      result.conclusion = typeof renderData.conclusion === 'string' ? renderData.conclusion : undefined;
      if (Array.isArray(renderData.tags)) {
        result.tags = renderData.tags.filter((t: unknown) => typeof t === 'string') as string[];
      }
    }
  }

  // 正文：优先从 platformRenderData.textContent，兜底用 fallbackText
  result.fullText = typeof renderData.textContent === 'string' && renderData.textContent.length > 0
    ? renderData.textContent
    : fallbackText;
  
  // 标题
  result.articleTitle = typeof renderData.articleTitle === 'string' ? renderData.articleTitle : '';

  return result;
}

/**
 * 解析小红书 JSON 内容（原始 JSON 字符串或对象）
 * 
 * 支持多种数据格式：
 * 1. 新信封格式：{ isCompleted, result: { content, articleTitle, platformData: { title, points, ... } } }
 * 2. 旧格式1：{ isCompleted, result: { fullText, title, points, ... } }
 * 3. 旧格式2：直接的 JSON 对象
 * 4. 从文本中提取的 JSON 片段
 */
export function parseXhsContent(raw: string | object | null | undefined): XhsParsedContent {
  if (!raw) return { ...defaultParsedContent };

  try {
    // 如果是字符串，先尝试解析为对象
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    
    // 信封格式: { isCompleted, result: { content, articleTitle, platformData: {...} } }
    if (data?.result?.platformData) {
      const pd = data.result.platformData;
      return {
        articleTitle: data.result.articleTitle || '',
        title: pd.title || '',
        intro: pd.intro || '',
        points: normalizePoints(pd.points),
        conclusion: pd.conclusion || '',
        tags: normalizeTags(pd.tags),
        fullText: data.result.content || pd.fullText || '',
      };
    }

    // 旧格式: { result: { content, title, points, ... } }
    if (data?.result?.content) {
      return {
        articleTitle: data.articleTitle || data.result.articleTitle || '',
        title: data.result.title || '',
        intro: data.result.intro || '',
        points: normalizePoints(data.result.points),
        conclusion: data.result.conclusion || '',
        tags: normalizeTags(data.result.tags),
        fullText: data.result.content,
      };
    }

    // 直接格式: { title, points, fullText, ... }
    if (data?.title || data?.fullText || data?.content) {
      return {
        articleTitle: data.articleTitle || '',
        title: data.title || '',
        intro: data.intro || '',
        points: normalizePoints(data.points),
        conclusion: data.conclusion || '',
        tags: normalizeTags(data.tags),
        fullText: data.fullText || data.content || '',
      };
    }

    // 纯文本：作为 fullText 返回
    return { 
      ...defaultParsedContent, 
      fullText: typeof raw === 'string' ? raw : JSON.stringify(raw) 
    };
  } catch {
    // JSON 解析失败，当作纯文本处理
    return { 
      ...defaultParsedContent, 
      fullText: typeof raw === 'string' ? raw : String(raw) 
    };
  }
}

/**
 * 标准化 points 数组
 */
function normalizePoints(points: unknown): Array<{ title: string; content: string }> {
  if (!Array.isArray(points)) return [];
  
  return points
    .filter((p: unknown) => typeof p === 'object' && p !== null)
    .filter((p: unknown) => {
      const obj = p as Record<string, unknown>;
      return typeof obj.title === 'string' || typeof obj.content === 'string';
    })
    .map((p: unknown) => {
      const obj = p as Record<string, unknown>;
      return {
        title: typeof obj.title === 'string' ? obj.title : '',
        content: typeof obj.content === 'string' ? obj.content : '',
      };
    });
}

/**
 * 标准化 tags 数组
 */
function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags.filter((t: unknown) => typeof t === 'string') as string[];
}

/**
 * 获取渐变色方案（根据索引）
 */
export function getGradientScheme(index: number) {
  return GRADIENT_SCHEMES[index % GRADIENT_SCHEMES.length];
}

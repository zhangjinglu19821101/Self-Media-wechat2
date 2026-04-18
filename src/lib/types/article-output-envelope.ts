/**
 * 统一文章输出信封格式（Article Output Envelope）
 * 
 * 设计原则：
 * 1. 所有写作 Agent（insurance-d / insurance-xiaohongshu / 未来新平台）输出格式统一
 * 2. 下游消费端（合规校验、文章保存、前序步骤传递）只需解析一种格式
 * 3. 新增平台时，下游零改动
 * 
 * 变更记录：
 * - v1.0: 初始版本，统一 insurance-d（HTML纯文本）和 insurance-xiaohongshu（JSON对象）的输出
 */

// ============ 核心信封格式 ============

/**
 * 写作 Agent 统一输出信封
 * 
 * 所有写作 Agent 的 result 字段必须是此格式。
 * 之前 insurance-d 返回纯字符串，insurance-xiaohongshu 返回 JSON 对象，
 * 现在统一为 ArticleOutputEnvelope。
 */
export interface ArticleOutputEnvelope {
  /** 文章正文内容（纯文本或HTML，用于合规校验、前序步骤传递） */
  content: string;
  /** 文章标题（≤20字） */
  articleTitle: string;
  /** 平台特定扩展数据（每个平台可以有自己的结构） */
  platformData?: PlatformSpecificData;
}

/**
 * 平台特定扩展数据
 * 
 * 不同平台独有的字段放在这里，下游按需读取
 */
export interface PlatformSpecificData {
  /** 平台标识 */
  platform: 'wechat_official' | 'xiaohongshu' | 'zhihu' | 'douyin' | 'weibo';
  
  // ---- 小红书专属字段 ----
  /** 小红书副标题/引言 */
  intro?: string;
  /** 小红书要点卡片（渲染到图片上） */
  points?: Array<{ title: string; content: string }>;
  /** 小红书总结语 */
  conclusion?: string;
  /** 小红书标签 */
  tags?: string[];
  
  // ---- 未来其他平台字段 ----
  // 知乎、抖音、微博等平台扩展在这里添加
  [key: string]: unknown;
}

// ============ Executor Output 标准格式 ============

/**
 * Executor Output 标准格式
 * 
 * 所有写作 Agent 的完整输出格式
 * isCompleted + result（ArticleOutputEnvelope）+ articleTitle
 */
export interface ExecutorOutput {
  /** 是否完成 */
  isCompleted: boolean;
  /** 结果（必须是 ArticleOutputEnvelope 格式） */
  result: ArticleOutputEnvelope | string;
  /** 文章标题（冗余字段，兼容旧代码） */
  articleTitle?: string;
}

// ============ 工具函数 ============

/**
 * 从 Executor Output 中提取文章正文内容
 * 
 * 兼容三种格式：
 * 1. 新格式：result 是 ArticleOutputEnvelope 对象
 * 2. 旧格式 insurance-d：result 是纯字符串（HTML）
 * 3. 旧格式 insurance-xiaohongshu：result 是 JSON 对象但不是 ArticleOutputEnvelope
 */
export function extractArticleContent(result: unknown): string {
  if (typeof result === 'string') {
    return result;
  }
  
  if (result && typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    
    // 新格式：ArticleOutputEnvelope
    if (typeof obj.content === 'string') {
      return obj.content;
    }
    
    // 旧格式兼容：insurance-xiaohongshu 的 fullText
    if (typeof obj.fullText === 'string') {
      return obj.fullText;
    }
    
    // 旧格式兼容：其他可能的字段
    if (typeof obj.articleContent === 'string') {
      return obj.articleContent;
    }
    
    // 兜底：尝试 JSON.stringify
    try {
      return JSON.stringify(obj);
    } catch {
      return String(obj);
    }
  }
  
  return '';
}

/**
 * 从 Executor Output 中提取文章标题
 * 
 * 兼容多种格式
 */
export function extractArticleTitle(output: unknown): string {
  if (!output || typeof output !== 'object') return '';
  
  const obj = output as Record<string, unknown>;
  
  // 优先从顶层 articleTitle 取
  if (typeof obj.articleTitle === 'string' && obj.articleTitle.trim()) {
    return obj.articleTitle.trim();
  }
  
  // 从 result 对象中取
  const result = obj.result;
  if (result && typeof result === 'object') {
    const resultObj = result as Record<string, unknown>;
    if (typeof resultObj.articleTitle === 'string' && resultObj.articleTitle.trim()) {
      return resultObj.articleTitle.trim();
    }
    // 旧格式兼容：小红书的 title
    if (typeof resultObj.title === 'string' && resultObj.title.trim()) {
      return resultObj.title.trim();
    }
  }
  
  return '';
}

/**
 * 从 Executor Output 中提取平台特定数据
 */
export function extractPlatformData(result: unknown): PlatformSpecificData | null {
  if (!result || typeof result !== 'object') return null;
  
  const obj = result as Record<string, unknown>;
  
  // 新格式：ArticleOutputEnvelope.platformData
  if (obj.platformData && typeof obj.platformData === 'object') {
    return obj.platformData as PlatformSpecificData;
  }
  
  // 旧格式兼容：小红书的 JSON 输出本身就是平台数据
  if (obj.points || obj.tags || obj.intro) {
    return {
      platform: 'xiaohongshu',
      intro: typeof obj.intro === 'string' ? obj.intro : undefined,
      points: Array.isArray(obj.points) ? obj.points as Array<{ title: string; content: string }> : undefined,
      conclusion: typeof obj.conclusion === 'string' ? obj.conclusion : undefined,
      tags: Array.isArray(obj.tags) ? obj.tags as string[] : undefined,
    };
  }
  
  return null;
}

/**
 * 判断 result 是否为新格式（ArticleOutputEnvelope）
 */
export function isNewEnvelopeFormat(result: unknown): boolean {
  if (!result || typeof result !== 'object') return false;
  const obj = result as Record<string, unknown>;
  return typeof obj.content === 'string' && typeof obj.articleTitle === 'string';
}

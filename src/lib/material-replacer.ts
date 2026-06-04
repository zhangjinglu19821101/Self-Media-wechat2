/**
 * 素材替换公共方法
 * 
 * 在预览修改环节，用户可以：
 * 1. 选中文章中的案例、槽点、核心观点等素材
 * 2. 从素材库搜索/推荐替换素材
 * 3. 一键替换选中内容
 * 
 * 设计原则：
 * - 公共封装，后续可不断迭代优化
 * - 复用现有素材库搜索/推荐 API
 * - 支持多种平台格式（HTML/纯文本/JSON）
 * 
 * @module material-replacer
 */

'use client';

import { apiGet } from '@/lib/api/client';

// ============ 类型定义 ============

/** 素材类型 */
export type MaterialType = 'case' | 'data' | 'story' | 'quote' | 'opening' | 'ending';

/** 素材项目 */
export interface MaterialItem {
  id: string;
  title: string;
  content: string;
  type: MaterialType;
  topicTags: string[];
  sceneTags: string[];
  emotionTags: string[];
  sourceType?: string;
  ownerType?: string;
}

/** 替换选项 */
export interface ReplaceOptions {
  /** 被替换的原始文本 */
  originalText: string;
  /** 替换后的素材内容 */
  replacementText: string;
  /** 文章全文（用于上下文感知替换） */
  fullContent: string;
  /** 平台类型 */
  platform: 'wechat_official' | 'xiaohongshu' | 'zhihu' | 'douyin' | 'weibo';
  /** 替换模式 */
  mode: 'exact' | 'semantic';
}

/** 替换结果 */
export interface ReplaceResult {
  /** 替换后的文章全文 */
  newContent: string;
  /** 是否成功替换 */
  success: boolean;
  /** 替换次数 */
  replaceCount: number;
  /** 替换说明 */
  description: string;
}

/** 搜索参数 */
export interface MaterialSearchParams {
  /** 搜索关键词 */
  query: string;
  /** 素材类型过滤 */
  type?: MaterialType;
  /** 话题标签过滤 */
  topicTags?: string[];
  /** 限制返回数量 */
  limit?: number;
}

// ============ 素材搜索/推荐 ============

/**
 * 搜索素材库
 * 复用现有 /api/materials 接口
 */
export async function searchMaterials(params: MaterialSearchParams): Promise<MaterialItem[]> {
  try {
    const queryParams = new URLSearchParams();
    queryParams.set('search', params.query);
    if (params.type) queryParams.set('type', params.type);
    if (params.limit) queryParams.set('limit', String(params.limit));
    queryParams.set('owner', 'all');

    const resp = await apiGet(`/api/materials?${queryParams.toString()}`) as Record<string, any>;
    const list = resp?.data?.list || resp?.data || resp?.list || [];
    return list.map((item: any) => ({
      id: item.id,
      title: item.title || '',
      content: item.content || '',
      type: item.type || 'case',
      topicTags: item.topicTags || [],
      sceneTags: item.sceneTags || [],
      emotionTags: item.emotionTags || [],
      sourceType: item.sourceType,
      ownerType: item.ownerType,
    }));
  } catch (error) {
    console.error('[MaterialReplacer] 搜索素材失败:', error);
    return [];
  }
}

/**
 * AI推荐素材
 * 复用现有 /api/materials/recommend 接口
 */
export async function recommendMaterials(
  instruction: string,
  options?: { limit?: number; type?: MaterialType }
): Promise<MaterialItem[]> {
  try {
    const queryParams = new URLSearchParams();
    queryParams.set('instruction', instruction);
    if (options?.limit) queryParams.set('limit', String(options.limit));
    if (options?.type) queryParams.set('type', options.type);

    const resp = await apiGet(`/api/materials/recommend?${queryParams.toString()}`) as Record<string, any>;
    return (resp?.data || resp?.materials || []).map((item: any) => ({
      id: item.id,
      title: item.title || '',
      content: item.content || '',
      type: item.type || 'case',
      topicTags: item.topicTags || [],
      sceneTags: item.sceneTags || [],
      emotionTags: item.emotionTags || [],
      sourceType: item.sourceType,
      ownerType: item.ownerType,
    }));
  } catch (error) {
    console.error('[MaterialReplacer] 推荐素材失败:', error);
    return [];
  }
}

// ============ 素材替换核心方法 ============

/**
 * 精确替换：在文章中查找原始文本并替换
 * 
 * 适用于：用户选中具体文本 → 选择素材 → 一键替换
 */
export function replaceExact(options: ReplaceOptions): ReplaceResult {
  const { originalText, replacementText, fullContent } = options;
  
  if (!originalText.trim()) {
    return {
      newContent: fullContent,
      success: false,
      replaceCount: 0,
      description: '未选中需要替换的内容',
    };
  }

  if (!replacementText.trim()) {
    return {
      newContent: fullContent,
      success: false,
      replaceCount: 0,
      description: '替换内容为空',
    };
  }

  // 精确匹配替换
  const index = fullContent.indexOf(originalText);
  if (index === -1) {
    // 尝试忽略空白匹配
    const normalizedContent = fullContent.replace(/\s+/g, ' ');
    const normalizedOriginal = originalText.replace(/\s+/g, ' ');
    const normalizedIndex = normalizedContent.indexOf(normalizedOriginal);
    
    if (normalizedIndex === -1) {
      return {
        newContent: fullContent,
        success: false,
        replaceCount: 0,
        description: '未在文章中找到选中的内容，可能已被修改',
      };
    }
    
    // 找到模糊匹配位置，在原文中定位
    // 简化处理：直接返回失败，提示用户重新选中
    return {
      newContent: fullContent,
      success: false,
      replaceCount: 0,
      description: '选中的内容与文章不完全匹配，请重新选中后替换',
    };
  }

  const newContent = fullContent.substring(0, index) + replacementText + fullContent.substring(index + originalText.length);
  
  return {
    newContent,
    success: true,
    replaceCount: 1,
    description: `已将选中文本替换为素材内容`,
  };
}

/**
 * HTML 内容中的素材替换
 * 
 * 专门处理微信公众号 HTML 格式
 * 在替换时保留原始 HTML 标签结构
 */
export function replaceInHtml(htmlContent: string, originalText: string, replacementText: string): ReplaceResult {
  // 清理 HTML 标签后进行匹配
  const plainText = stripHtmlTags(htmlContent);
  
  if (!plainText.includes(originalText)) {
    return {
      newContent: htmlContent,
      success: false,
      replaceCount: 0,
      description: '未在文章中找到选中的内容',
    };
  }

  // 在 HTML 中定位原始文本并替换
  // 策略：直接在 HTML 字符串中查找纯文本片段并替换
  const htmlIndex = htmlContent.indexOf(originalText);
  if (htmlIndex !== -1) {
    const newContent = htmlContent.substring(0, htmlIndex) + replacementText + htmlContent.substring(htmlIndex + originalText.length);
    return {
      newContent,
      success: true,
      replaceCount: 1,
      description: '已在HTML中替换选中内容',
    };
  }

  // 如果纯文本在 HTML 标签之间被分割，使用更智能的替换
  return replaceInSplitHtmlTags(htmlContent, originalText, replacementText);
}

/**
 * 处理 HTML 标签分割的文本替换
 * 当选中的纯文本在 HTML 中被标签分割时（如 "案例<span>内容</span>"），
 * 需要找到对应的 HTML 片段并整体替换
 */
function replaceInSplitHtmlTags(htmlContent: string, originalText: string, replacementText: string): ReplaceResult {
  // 将原始文本和HTML内容都去除标签后进行模糊匹配
  const cleanOriginal = originalText.replace(/\s+/g, ' ').trim();
  const cleanHtml = stripHtmlTags(htmlContent).replace(/\s+/g, ' ').trim();
  
  const matchIndex = cleanHtml.indexOf(cleanOriginal);
  if (matchIndex === -1) {
    return {
      newContent: htmlContent,
      success: false,
      replaceCount: 0,
      description: '选中的内容与文章不匹配',
    };
  }

  // 找到匹配位置，尝试在原始HTML中定位
  // 简化处理：将整个段落替换
  // 后续迭代可以优化为更精确的替换
  return {
    newContent: htmlContent,
    success: false,
    replaceCount: 0,
    description: '选中内容跨越了多个格式段落，请直接在编辑模式中手动替换',
  };
}

/**
 * 小红书 JSON 内容中的素材替换
 * 
 * 处理小红书的结构化数据（points数组等）
 */
export function replaceInXhsContent(
  xhsData: { points?: Array<{ title: string; content: string }>; conclusion?: string; fullText?: string },
  originalText: string,
  replacementText: string
): { data: typeof xhsData; result: ReplaceResult } {
  let replaceCount = 0;
  const newData = { ...xhsData };

  // 替换 points 中的内容
  if (newData.points) {
    newData.points = newData.points.map(point => {
      let newTitle = point.title;
      let newContent = point.content;
      
      if (point.title.includes(originalText)) {
        newTitle = point.title.replace(originalText, replacementText);
        replaceCount++;
      }
      if (point.content.includes(originalText)) {
        newContent = point.content.replace(originalText, replacementText);
        replaceCount++;
      }
      
      return { ...point, title: newTitle, content: newContent };
    });
  }

  // 替换结论
  if (newData.conclusion?.includes(originalText)) {
    newData.conclusion = newData.conclusion!.replace(originalText, replacementText);
    replaceCount++;
  }

  // 替换全文
  if (newData.fullText?.includes(originalText)) {
    newData.fullText = newData.fullText!.replace(originalText, replacementText);
    replaceCount++;
  }

  return {
    data: newData,
    result: {
      newContent: JSON.stringify(newData),
      success: replaceCount > 0,
      replaceCount,
      description: replaceCount > 0 ? `已替换 ${replaceCount} 处内容` : '未找到匹配内容',
    },
  };
}

// ============ 工具方法 ============

/**
 * 去除 HTML 标签，获取纯文本
 */
export function stripHtmlTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * 根据平台类型自动选择替换方法
 * 这是推荐的统一入口方法
 */
export function replaceMaterial(options: ReplaceOptions): ReplaceResult {
  const { platform, fullContent, originalText, replacementText } = options;

  // 公众号 HTML 格式
  if (platform === 'wechat_official' && fullContent.includes('<')) {
    return replaceInHtml(fullContent, originalText, replacementText);
  }

  // 其他平台使用精确替换
  return replaceExact(options);
}

/**
 * 从选中文本智能推断素材类型
 * 用于自动推荐对应类型的素材
 */
export function inferMaterialTypeFromSelection(selectedText: string): MaterialType {
  const lower = selectedText.toLowerCase();
  
  // 包含数据/统计/百分比 → 数据素材
  if (/[\d.]+%|万人|亿元|统计|数据|报告|调研/.test(lower)) {
    return 'data';
  }
  
  // 包含引用/名言/金句 → 引用素材
  if (/.{0,10}说过|名言|金句|俗语|古语/.test(lower)) {
    return 'quote';
  }
  
  // 包含故事/经历/亲身 → 故事素材
  if (/故事|经历|亲身|回忆|那时候|以前我/.test(lower)) {
    return 'story';
  }
  
  // 默认推荐案例素材
  return 'case';
}

/**
 * 获取素材类型的中文标签
 */
export function getMaterialTypeLabel(type: MaterialType): string {
  const labels: Record<MaterialType, string> = {
    case: '案例',
    data: '数据',
    story: '故事',
    quote: '引用',
    opening: '开头',
    ending: '结尾',
  };
  return labels[type] || '素材';
}

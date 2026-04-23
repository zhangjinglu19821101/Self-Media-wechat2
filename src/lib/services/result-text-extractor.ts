/**
 * Result Text Extractor Service
 * 
 * 设计原则：每个指令的 result_text 都应该是该指令的执行结果
 * 
 * 🔥🔥🔥 【架构升级】平台内容字段映射驱动 + 动态发现兜底
 * 
 * 新增平台时：
 * 1. 在 agent-registry.ts 的 PLATFORM_CONTENT_FIELDS 中添加一行配置
 * 2. 本文件零改动，自动适配
 * 
 * 提取策略：
 * 1. 平台优先：根据 executor 类型，先提取该平台的主内容字段
 * 2. 通用扫描：遍历所有已知内容字段，取最长的有效文本
 * 3. 动态发现：遍历对象的所有字符串字段，取最长的有效文本
 * 4. 最终兜底：序列化为可读文本
 */

import { getPlatformContentField } from '@/lib/agents/agent-registry';

/**
 * 检查文本是否有效
 * @param text 待检查的文本
 * @param minLength 最小长度要求（默认 10，写作类内容默认 100）
 */
export function isValidContentText(text: string | undefined | null, minLength: number = 10): boolean {
  if (!text || typeof text !== 'string') return false;
  return text.trim().length >= minLength;
}

/**
 * 将大纲 JSON 结构序列化为可读文本
 * 格式：{ title: "...", sections: [{ id, name, wordCount, coreContent }] }
 */
export function serializeOutlineToText(outline: any): string | null {
  if (!outline || typeof outline !== 'object') return null;

  const parts: string[] = [];

  // 标题
  if (outline.title) {
    parts.push(`# ${outline.title}`);
  }

  // 各段落
  if (Array.isArray(outline.sections)) {
    for (const section of outline.sections) {
      const name = section.name || section.id || '';
      const coreContent = section.coreContent || section.content || '';
      const wordCount = section.wordCount ? `（${section.wordCount}字）` : '';

      if (name) {
        parts.push(`\n## ${name}${wordCount}`);
      }
      if (coreContent) {
        parts.push(coreContent);
      }
    }
  }

  // 如果没有 sections 但有其他字段，直接序列化
  if (parts.length === 0) {
    try {
      const text = JSON.stringify(outline, null, 2);
      if (text.length > 20) return text;
    } catch {
      // ignore
    }
    return null;
  }

  return parts.join('\n');
}

/**
 * 最终兜底：将 result 对象序列化为可读文本
 * 设计原则：确保每个任务的 result_text 都有值
 * 策略：提取所有字符串类型的叶子节点，拼接为可读文本
 */
export function serializeResultToFallbackText(data: any, depth: number = 0): string {
  if (depth > 3) return ''; // 防止递归过深
  if (!data || typeof data !== 'object') return '';

  const parts: string[] = [];

  // 优先提取有意义的字段
  const meaningfulFields = [
    'briefResponse', 'executionSummary', 'reasoning', 'output', 'result',
    'summary', 'response', 'description', 'message', 'content', 'text',
    'suggestions', 'briefRequest', 'taskInstruction'
  ];

  for (const field of meaningfulFields) {
    const value = data[field];
    if (!value) continue;
    
    if (typeof value === 'string' && value.trim().length > 10) {
      parts.push(`【${field}】${value.trim()}`);
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      const objText = extractFromObjectField(value);
      if (objText) {
        parts.push(`【${field}】${objText}`);
      }
    }
  }

  if (parts.length > 0) {
    return parts.join('\n\n');
  }

  // 如果有嵌套对象，递归提取
  for (const key of Object.keys(data)) {
    if (data[key] && typeof data[key] === 'object' && !Array.isArray(data[key])) {
      const nested = serializeResultToFallbackText(data[key], depth + 1);
      if (nested) {
        parts.push(nested);
      }
    }
  }

  return parts.join('\n\n');
}

/**
 * 从对象字段中提取文本（处理 executionSummary 等对象类型）
 */
function extractFromObjectField(obj: Record<string, any>): string | null {
  if (Array.isArray(obj.actionsTaken) && obj.actionsTaken.length > 0) {
    return obj.actionsTaken.filter((a: any) => typeof a === 'string').join('\n');
  }
  
  for (const key of ['items', 'list', 'steps', 'actions']) {
    if (Array.isArray(obj[key]) && obj[key].length > 0) {
      const items = obj[key].filter((a: any) => typeof a === 'string');
      if (items.length > 0) return items.join('\n');
    }
  }
  
  return null;
}

// ==================== 核心重构：平台配置驱动提取 ====================

/**
 * 🔥🔥🔥 核心重构：从 resultContent 对象中提取文本
 * 
 * 提取策略（三层）：
 * 1. 平台优先：根据 executor 类型，先提取该平台的主内容字段
 * 2. 通用扫描：遍历所有已知内容字段，取最长的有效文本
 * 3. 动态发现：遍历对象的所有字符串字段，取最长的有效文本
 * 
 * @param obj resultContent 对象
 * @param executor Agent executor ID（用于平台优先提取）
 */
export function extractFromResultContentObject(
  obj: Record<string, any>,
  executor?: string
): string | null {
  if (!obj || typeof obj !== 'object') return null;

  // 🔥 P0修复：统一最小长度阈值为 10，与 isValidContentText 保持一致
  const MIN_CONTENT_LENGTH = 10;

  // ===== 第一层：平台优先提取 =====
  if (executor) {
    const platformConfig = getPlatformContentField(executor);
    const primaryField = platformConfig.contentField;
    
    // 1a. 直接字段（P0修复：添加最小长度检查）
    if (typeof obj[primaryField] === 'string' && obj[primaryField].trim().length >= MIN_CONTENT_LENGTH) {
      return obj[primaryField];
    }
    
    // 1b. 信封格式：obj.result.contentField（P0修复：添加最小长度检查）
    if (obj.result && typeof obj.result === 'object') {
      if (typeof obj.result[primaryField] === 'string' && obj.result[primaryField].trim().length >= MIN_CONTENT_LENGTH) {
        return obj.result[primaryField];
      }
    }
  }

  // ===== 第二层：通用扫描 - 所有已知内容字段 =====
  // 按优先级排列（长内容优先于短内容）
  const knownContentFields = [
    'articleHtml',     // 公众号 HTML
    'htmlContent',     // 通用 HTML
    'content',         // 通用正文
    'fullText',        // 完整文本
    'outlineText',     // 大纲文本
    'markdownContent', // Markdown
    'rawContent',      // 原始内容
  ];
  
  // P0修复：添加最小长度检查
  for (const field of knownContentFields) {
    if (typeof obj[field] === 'string' && obj[field].trim().length >= MIN_CONTENT_LENGTH) {
      return obj[field];
    }
  }

  // 大纲 JSON 结构
  if (obj.outline && typeof obj.outline === 'object') {
    return serializeOutlineToText(obj.outline);
  }
  if (obj.sections && Array.isArray(obj.sections)) {
    return serializeOutlineToText(obj);
  }

  // ===== 第三层：动态发现 - 遍历所有字符串字段，取最长的 =====
  // P0修复：使用统一的最小长度阈值
  const dynamicResult = discoverLongestText(obj, MIN_CONTENT_LENGTH);
  if (dynamicResult) {
    return dynamicResult;
  }

  return null;
}

/**
 * 🔥🔥🔥 动态发现最长文本字段
 * 
 * 设计意图：新增平台时，即使忘记在 PLATFORM_CONTENT_FIELDS 注册，
 * 也能自动发现最长的字符串字段作为正文内容。
 * 
 * 规则：
 * 1. 遍历对象的所有直接字段
 * 2. 过滤掉已知非内容字段（metadata / articleTitle / platformData 等）
 * 3. 在剩余字符串字段中，取长度最长的
 * 4. 最低长度要求：与第一二层一致（默认 10 字）
 */
function discoverLongestText(obj: Record<string, any>, minLength: number = 10): string | null {
  // 已知的非内容字段（不参与正文提取）
  const EXCLUDED_FIELDS = new Set([
    'articleTitle',   // 文章标题（短文本）
    'platformData',   // 平台结构化数据（JSON 对象）
    'platform',       // 平台标识
    'isCompleted',    // 完成标记
    'outline',        // 大纲对象
    'sections',       // 段落数组
    'tags',           // 标签数组
    'points',         // 要点数组
    'metadata',       // 元数据
    'status',         // 状态
    'type',           // 类型
    'version',        // 版本
  ]);

  let longestText: string | null = null;
  let longestLength = 0;

  for (const [key, value] of Object.entries(obj)) {
    // 跳过排除字段
    if (EXCLUDED_FIELDS.has(key)) continue;
    
    // 只处理字符串
    if (typeof value !== 'string') continue;
    
    const trimmed = value.trim();
    if (trimmed.length >= minLength && trimmed.length > longestLength) {
      longestText = trimmed;
      longestLength = trimmed.length;
    }
  }

  return longestText;
}

// ==================== 核心入口方法 ====================

/**
 * 🔴🔴🔴 核心方法：从 resultData 中提取文本结果
 * 
 * 提取策略（10 层路径 + 平台配置驱动 + 动态发现兜底）
 * 
 * @param resultData - 任务执行结果数据
 * @param options - 配置选项
 * @param options.executor - Agent executor ID（用于平台优先提取）
 * @param options.debug - 是否输出调试日志
 * @param options.debugPrefix - 调试日志前缀
 * @returns 提取的文本结果，或空字符串
 */
export function extractResultTextFromResultData(
  resultData: any,
  options: { executor?: string; debug?: boolean; debugPrefix?: string } = {}
): string {
  const { executor, debug = false, debugPrefix = '[ResultExtractor]' } = options;
  const log = (msg: string) => debug && console.log(`${debugPrefix} ${msg}`);

  if (!resultData) return '';

  // 确保是对象
  let data: any;
  if (typeof resultData === 'string') {
    try {
      data = JSON.parse(resultData);
    } catch {
      return resultData; // 字符串且无法解析 JSON，直接返回
    }
  } else {
    data = resultData;
  }

  if (!data || typeof data !== 'object') {
    return String(data || '');
  }

  // ===== 路径 0：特殊处理 - 预览修改节点优先使用 platformRenderData.htmlContent =====
  // 🔴 关键修复：预览修改节点中，用户修改的是 platformRenderData.htmlContent
  // 必须优先从这个字段提取，而不是从 executorOutput.output 提取纯文本
  if (data.interactionType === 'preview_edit_article' || data.platformRenderData) {
    // 公众号：优先使用 platformRenderData.htmlContent
    if (data.platformRenderData && 
        typeof data.platformRenderData === 'object' && 
        'htmlContent' in data.platformRenderData &&
        isValidContentText((data.platformRenderData as any).htmlContent, 10)) {
      log(`路径0 platformRenderData.htmlContent（预览修改节点），长度: ${(data.platformRenderData as any).htmlContent.length}`);
      return (data.platformRenderData as any).htmlContent;
    }
    // 小红书：优先使用 platformRenderData（完整JSON结构）中的内容
    if (data.platformRenderData && 
        typeof data.platformRenderData === 'object') {
      const prd = data.platformRenderData as any;
      // 尝试从 platformRenderData 中提取内容
      if (isValidContentText(prd.content, 10)) {
        log(`路径0 platformRenderData.content（预览修改节点），长度: ${prd.content.length}`);
        return prd.content;
      }
      if (isValidContentText(prd.fullText, 10)) {
        log(`路径0 platformRenderData.fullText（预览修改节点），长度: ${prd.fullText.length}`);
        return prd.fullText;
      }
    }
  }

  // ===== 路径 1：executorOutput.output =====
  if (isValidContentText(data.executorOutput?.output, 10)) {
    log(`路径1 executorOutput.output，长度: ${data.executorOutput.output.length}`);
    return data.executorOutput.output;
  }

  // ===== 路径 2：executorOutput.result（信封格式） =====
  if (data.executorOutput?.result && typeof data.executorOutput.result === 'object') {
    const envelope = data.executorOutput.result;
    const extracted = extractFromResultContentObject(envelope, executor);
    if (extracted) {
      log(`路径2 executorOutput.result，长度: ${extracted.length}`);
      return extracted;
    }
  }
  if (isValidContentText(data.executorOutput?.result, 100)) {
    log(`路径2 executorOutput.result（字符串），长度: ${data.executorOutput.result.length}`);
    return data.executorOutput.result;
  }

  // ===== 路径 3：structuredResult.resultContent（🔥 传入 executor 做平台优先提取） =====
  const rcPaths = [
    { path: 'executorOutput.structuredResult.resultContent', value: data.executorOutput?.structuredResult?.resultContent },
    { path: 'structuredResult.resultContent', value: data.structuredResult?.resultContent },
    { path: 'structuredResult.executionSummary.resultContent', value: data.structuredResult?.executionSummary?.resultContent },
  ];
  
  for (const { path, value } of rcPaths) {
    if (!value) continue;
    
    if (typeof value === 'object') {
      const extracted = extractFromResultContentObject(value, executor);
      if (extracted) {
        log(`路径3 ${path}，长度: ${extracted.length}`);
        return extracted;
      }
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          const first = parsed.find((item: any) => item?.content || item?.htmlContent || item?.articleHtml || item?.outlineText);
          if (first) {
            const text = first.content || first.htmlContent || first.articleHtml || first.outlineText || '';
            log(`路径3 ${path}[?] 长度: ${text.length}`);
            return text;
          }
        } else if (parsed && typeof parsed === 'object') {
          const extracted = extractFromResultContentObject(parsed, executor);
          if (extracted) {
            log(`路径3 ${path}（JSON解析后），长度: ${extracted.length}`);
            return extracted;
          }
        }
      } catch {
        if (isValidContentText(value)) {
          log(`路径3 ${path}（纯文本），长度: ${value.length}`);
          return value;
        }
      }
    }
  }

  // ===== 路径 4：顶层 result（信封格式兼容） =====
  if (data.result) {
    if (typeof data.result === 'object' && data.result !== null) {
      const extracted = extractFromResultContentObject(data.result, executor);
      if (extracted) {
        log(`路径4 result（顶层信封），长度: ${extracted.length}`);
        return extracted;
      }
    }
    if (isValidContentText(data.result, 100)) {
      log(`路径4 result（字符串），长度: ${data.result.length}`);
      return data.result;
    }
  }

  // ===== 路径 5：顶层 output =====
  if (isValidContentText(data.output)) {
    log(`路径5 output，长度: ${data.output.length}`);
    return data.output;
  }

  // ===== 路径 6：executorOutput.structuredResult.briefResponse =====
  if (isValidContentText(data.executorOutput?.structuredResult?.briefResponse, 100)) {
    log(`路径6 briefResponse，长度: ${data.executorOutput.structuredResult.briefResponse.length}`);
    return data.executorOutput.structuredResult.briefResponse;
  }

  // ===== 路径 7：executorOutput.structuredResult.executionSummary =====
  const executionSummary = data.executorOutput?.structuredResult?.executionSummary;
  if (executionSummary) {
    if (typeof executionSummary === 'string' && isValidContentText(executionSummary)) {
      log(`路径7 executionSummary（字符串），长度: ${executionSummary.length}`);
      return executionSummary;
    }
    if (typeof executionSummary === 'object') {
      if (Array.isArray(executionSummary.actionsTaken) && executionSummary.actionsTaken.length > 0) {
        const actions = executionSummary.actionsTaken
          .filter((a: any) => typeof a === 'string')
          .join('\n');
        if (actions) {
          log(`路径7 executionSummary.actionsTaken，长度: ${actions.length}`);
          return actions;
        }
      }
    }
  }

  // ===== 路径 8：executorOutput.reasoning =====
  if (isValidContentText(data.executorOutput?.reasoning, 20)) {
    log(`路径8 reasoning，长度: ${data.executorOutput.reasoning.length}`);
    return data.executorOutput.reasoning;
  }

  // ===== 路径 9：structuredResult 其他文本字段 =====
  if (data.executorOutput?.structuredResult) {
    const sr = data.executorOutput.structuredResult;
    const textFields = ['result', 'summary', 'response', 'description', 'output', 'message', 'content', 'text'];
    for (const field of textFields) {
      if (isValidContentText(sr[field], 20)) {
        log(`路径9 structuredResult.${field}，长度: ${sr[field].length}`);
        return sr[field];
      }
    }
  }

  // ===== 路径 10：最终兜底 - 序列化为可读文本 =====
  try {
    const fallbackText = serializeResultToFallbackText(data);
    if (fallbackText) {
      log(`路径10 最终兜底序列化，长度: ${fallbackText.length}`);
      return fallbackText;
    }
  } catch (fallbackError) {
    console.error(`${debugPrefix} 最终兜底序列化失败:`, fallbackError);
  }

  log('所有路径均未提取到有效内容');
  return '';
}

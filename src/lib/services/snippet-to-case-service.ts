/**
 * 速记转案例提取服务
 * 
 * 流程（两步拆分，降低用户感知延迟）：
 * Step 1 (extractCaseFromSnippet): 仅 LLM 提取结构化字段，立即返回给前端展示
 * Step 2 (searchAndSupplementEventStory): 异步 Web 搜索 + LLM 概括，补充 eventFullStory
 * 
 * 前端调用时序：
 * 1. POST /extract-case → 返回提取结果（searchPending=true 表示搜索补充中）
 * 2. POST /extract-case/search-supplement → 返回搜索补充后的 eventFullStory
 */

import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { SearchClient } from 'coze-coding-dev-sdk';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * 案例提取结果
 */
export interface CaseExtractionResult {
  // 展示字段（6个）
  title: string;               // 展示标题 = 速记原始标题
  eventFullStory: string;
  background: string;
  insuranceAction: string;
  result: string;
  productTags: string[];
  // 后台字段（不展示）
  llmExtractedTitle: string;   // LLM 提炼的标题（用于搜索关键词构造，比速记标题更精准）
  searchKeywords: string;      // LLM 从原文提取的搜索关键词（基于原始内容，不受匿名化影响）
  protagonist: string;
  crowdTags: string[];
  emotionTags: string[];
  caseType: 'positive' | 'warning' | 'milestone';
  industry: string;
  // 元信息
  searchPerformed: boolean;
  searchPending: boolean;      // 搜索补充是否仍在进行中（前端据此轮询）
  searchSummary: string | null;
}

/**
 * 搜索补充结果（Step 2 返回）
 */
export interface SearchSupplementResult {
  supplemented: boolean;       // 是否成功补充
  eventFullStory: string;      // 补充后的事件经过（若未补充则原样返回）
  searchSummary: string | null;
}

/**
 * 提示词缓存
 * 开发环境禁用缓存，支持热更新；生产环境启用缓存，提升性能
 */
let cachedPrompt: string | null = null;
let cachedSearchPrompt: string | null = null;
let promptLoadTime: number = 0;              // 上次加载时间（用于检测文件变更）
let searchPromptLoadTime: number = 0;        // 搜索概括提示词加载时间
const PROMPT_CACHE_TTL = 60000;              // 缓存有效期 60 秒（开发环境用）

/**
 * 清除提示词缓存（可用于手动刷新）
 */
export function clearPromptCache(): void {
  cachedPrompt = null;
  cachedSearchPrompt = null;
  promptLoadTime = 0;
  searchPromptLoadTime = 0;
}

/**
 * 加载速记转案例提取提示词
 */
function loadPrompt(): string {
  const isDev = process.env.NODE_ENV === 'development';
  const now = Date.now();

  // 生产环境：使用缓存
  if (!isDev && cachedPrompt) {
    return cachedPrompt;
  }

  // 开发环境：检查缓存是否过期（支持热更新）
  if (isDev && cachedPrompt && (now - promptLoadTime) < PROMPT_CACHE_TTL) {
    return cachedPrompt;
  }

  const promptPath = join(process.cwd(), 'src', 'lib', 'agents', 'prompts', 'snippet-to-case.md');

  if (!existsSync(promptPath)) {
    throw new Error('提示词文件不存在: ' + promptPath);
  }

  cachedPrompt = readFileSync(promptPath, 'utf-8');
  promptLoadTime = now;

  if (isDev) {
    console.log(`✅ [snippet-to-case.md] 开发环境热更新提示词，长度: ${cachedPrompt.length} 字符`);
  } else {
    console.log(`✅ [snippet-to-case.md] 加载提示词文件，长度: ${cachedPrompt.length} 字符`);
  }

  return cachedPrompt;
}

/**
 * 加载搜索概括提示词
 */
function loadSearchSummarizePrompt(): string {
  const isDev = process.env.NODE_ENV === 'development';
  const now = Date.now();

  // 生产环境：使用缓存
  if (!isDev && cachedSearchPrompt) {
    return cachedSearchPrompt;
  }

  // 开发环境：检查缓存是否过期（支持热更新）
  if (isDev && cachedSearchPrompt && (now - searchPromptLoadTime) < PROMPT_CACHE_TTL) {
    return cachedSearchPrompt;
  }

  const promptPath = join(process.cwd(), 'src', 'lib', 'agents', 'prompts', 'search-summarize-event.md');

  if (!existsSync(promptPath)) {
    throw new Error('提示词文件不存在: ' + promptPath);
  }

  cachedSearchPrompt = readFileSync(promptPath, 'utf-8');
  searchPromptLoadTime = now;

  if (isDev) {
    console.log(`✅ [search-summarize-event.md] 开发环境热更新提示词，长度: ${cachedSearchPrompt.length} 字符`);
  } else {
    console.log(`✅ [search-summarize-event.md] 加载提示词文件，长度: ${cachedSearchPrompt.length} 字符`);
  }

  return cachedSearchPrompt;
}

/**
 * Step 1: 使用 LLM 从速记内容提取案例结构化信息（不含搜索补充）
 * 仅做一次 LLM 调用，尽快返回给前端展示
 */
export async function extractCaseFromSnippet(
  rawContent: string,
  snippetTitle: string,
  customHeaders?: Record<string, string>
): Promise<CaseExtractionResult> {
  const config = new Config();
  const client = new LLMClient(config, customHeaders);

  const systemPrompt = loadPrompt();

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: rawContent },
  ];

  try {
    const response = await client.invoke(messages, {
      model: 'doubao-seed-2-0-lite-260215',
      temperature: 0.1,
    });

    const result = parseCaseExtractionResponse(response.content);

    // 保存 LLM 提炼的标题（用于搜索关键词构造），再用速记标题覆盖展示标题
    result.llmExtractedTitle = result.title;
    result.title = snippetTitle;

    // 标记是否需要搜索补充（前端据此决定是否调用 Step 2）
    const needsSearch = shouldSearchForMoreInfo(rawContent, result);
    result.searchPerformed = false;
    result.searchPending = needsSearch;

    return result;
  } catch (error) {
    console.error('[extractCaseFromSnippet] LLM 调用失败:', error);
    return buildFallbackCaseExtraction(rawContent, snippetTitle);
  }
}

/**
 * Step 2: Web 搜索 + LLM 概括，补充 eventFullStory
 * 前端在收到 Step 1 结果后异步调用，不阻塞用户编辑
 */
export async function searchAndSupplementEventStory(
  rawContent: string,
  extractionResult: CaseExtractionResult,
  customHeaders?: Record<string, string>
): Promise<SearchSupplementResult> {
  // 如果已经足够完整，直接跳过搜索
  if (!shouldSearchForMoreInfo(rawContent, extractionResult)) {
    return {
      supplemented: false,
      eventFullStory: extractionResult.eventFullStory,
      searchSummary: null,
    };
  }

  try {
    const searchResult = await searchAndSummarizeEvent(
      rawContent,
      extractionResult,
      customHeaders
    );

    if (searchResult && searchResult.fullStory.length > extractionResult.eventFullStory.length) {
      return {
        supplemented: true,
        eventFullStory: searchResult.fullStory,
        searchSummary: searchResult.summary,
      };
    }

    return {
      supplemented: false,
      eventFullStory: extractionResult.eventFullStory,
      searchSummary: searchResult?.summary || null,
    };
  } catch (error) {
    console.error('[searchAndSupplementEventStory] 搜索补充失败:', error);
    return {
      supplemented: false,
      eventFullStory: extractionResult.eventFullStory,
      searchSummary: null,
    };
  }
}

/**
 * 判断是否需要 Web 搜索补充信息
 * 条件：提取的事件经过较短 + 原始内容包含可搜索线索
 * 
 * 优化点：
 * 1. 城市名使用常量列表，覆盖更全面
 * 2. 事件关键词使用常量列表，便于维护
 * 3. 新增人名模式识别
 */
function shouldSearchForMoreInfo(rawContent: string, result: CaseExtractionResult): boolean {
  // 如果事件经过已经比较完整（≥260字），不需要搜索
  if (result.eventFullStory.length >= 260) {
    return false;
  }

  // 检查是否包含可搜索的线索
  const searchIndicators = [
    // 行政区划地名（如"某某市"、"某某省"）
    /[\u4e00-\u9fa5]{2,}(市|省|区|县)/,
    // 常见城市名（使用常量列表）
    new RegExp(`(${SEARCHABLE_CITIES})`),
    // 年份（如"2024年"）
    /\d{4}年/,
    // 事件关键词（使用常量列表）
    new RegExp(`(${SEARCHABLE_EVENT_KEYWORDS})`),
    // 人名模式（如"张先生"、"李女士"等）
    PERSON_NAME_PATTERN,
  ];

  return searchIndicators.some(pattern => pattern.test(rawContent));
}

/**
 * 构造搜索关键词
 * 优先使用 LLM 从原文提取的 searchKeywords（基于原始内容、不受匿名化影响）
 * 逐步降级：searchKeywords → llmExtractedTitle → 原文核心句
 */
function buildSearchQuery(extractionResult: CaseExtractionResult, rawContent: string): string {
  // 1. 最优：LLM 从原文提取的搜索关键词（基于原始实名信息，不受合规匿名化影响）
  if (extractionResult.searchKeywords && extractionResult.searchKeywords.trim().length >= 4) {
    const keywords = extractionResult.searchKeywords.trim();
    console.log(`[buildSearchQuery] 使用 LLM 搜索关键词: "${keywords}"`);
    return keywords;
  }

  // 2. 次优：LLM 提炼的标题（虽可能被部分匿名化，但通常仍包含关键事件信息）
  const searchTitle = extractionResult.llmExtractedTitle || extractionResult.title;
  if (searchTitle && searchTitle.trim().length >= 4) {
    console.log(`[buildSearchQuery] 降级使用 LLM 提炼标题: "${searchTitle}"`);
    return searchTitle.trim();
  }

  // 3. 兜底：提取原文中第一个完整句子的核心部分（去掉口语化前缀）
  const cleanContent = rawContent
    .replace(/^(听说|据说|今天|刚才|刚才看到|刚刚|有人|有个|网上|朋友圈|群里)\S{0,4}[，,：:]?\s*/,'')
    .replace(/\n/g, ' ')
    .trim();
  const firstSentence = cleanContent.match(/[^。！？]+[。！？]/)?.[0] || cleanContent.slice(0, 50);
  console.log(`[buildSearchQuery] 兜底使用原文核心句: "${firstSentence}"`);
  return firstSentence;
}


/**
 * Web 搜索并概括事件
 */
async function searchAndSummarizeEvent(
  rawContent: string,
  extractionResult: CaseExtractionResult,
  customHeaders?: Record<string, string>
): Promise<{ summary: string; fullStory: string } | null> {
  const config = new Config();
  const searchClient = new SearchClient(config, customHeaders);

  // 从 LLM 提取结果构造精准搜索关键词（C1 修复：不再截取原文前80字）
  const searchQuery = buildSearchQuery(extractionResult, rawContent);

  console.log(`[searchAndSummarizeEvent] ========== 搜索调试开始 ==========`);
  console.log(`[searchAndSummarizeEvent] 原始信息: "${rawContent.slice(0, 100)}${rawContent.length > 100 ? '...' : ''}"`);
  console.log(`[searchAndSummarizeEvent] 提取结果: title="${extractionResult.title}", llmExtractedTitle="${extractionResult.llmExtractedTitle}", searchKeywords="${extractionResult.searchKeywords}", protagonist="${extractionResult.protagonist}"`);
  console.log(`[searchAndSummarizeEvent] 搜索关键词: "${searchQuery}"`);

  try {
    const searchResponse = await searchClient.webSearch(searchQuery, 5, true);

    console.log(`[searchAndSummarizeEvent] 搜索结果数量: ${searchResponse.web_items?.length || 0}`);
    if (searchResponse.web_items && searchResponse.web_items.length > 0) {
      console.log(`[searchAndSummarizeEvent] 前3条搜索结果标题:`);
      searchResponse.web_items.slice(0, 3).forEach((item: any, i: number) => {
        console.log(`  [${i + 1}] ${item.title}`);
      });
    }

    if (!searchResponse.web_items || searchResponse.web_items.length === 0) {
      console.log(`[searchAndSummarizeEvent] ❌ 无搜索结果，跳过补充`);
      return null;
    }

    console.log(`[searchAndSummarizeEvent] ✅ 有搜索结果，开始概括`);

    // 使用搜索摘要作为补充
    const summary = searchResponse.summary || null;

    // 让 LLM 基于搜索结果概括完整事件经过，同时判断相关性（shouldUse）
    if (summary || searchResponse.web_items.length > 0) {
      const systemPrompt = loadSearchSummarizePrompt();
      const llmClient = new LLMClient(config, customHeaders);

      const searchContext = searchResponse.web_items
        .slice(0, 3)
        .map((item: any, i: number) => `[${i + 1}] ${item.title}: ${item.snippet}`)
        .join('\n');

      const llmMessages = [
        {
          role: 'system' as const,
          content: systemPrompt,
        },
        {
          role: 'user' as const,
          content: `原始信息：${rawContent}\n\n搜索结果：\n${searchContext}\n\nAI搜索摘要：${summary || '无'}\n\n请概括事件完整经过：`,
        },
      ];

      const llmResponse = await llmClient.invoke(llmMessages, {
        model: 'doubao-seed-2-0-lite-260215',
        temperature: 0.1,
      });

      const rawContent2 = llmResponse.content.trim();
      console.log(`[searchAndSummarizeEvent] LLM 原始返回: ${rawContent2.slice(0, 300)}${rawContent2.length > 300 ? '...' : ''}`);

      // 解析 LLM 返回的 JSON（提示词要求返回 { eventFullStory, shouldUse }）
      const parsed = parseSearchSummarizeResponse(rawContent2);

      if (!parsed) {
        console.log(`[searchAndSummarizeEvent] ❌ LLM 返回解析失败或为空，跳过补充`);
        console.log(`[searchAndSummarizeEvent] ========== 搜索调试结束 ==========`);
        return null;
      }

      if (!parsed.shouldUse) {
        console.log(`[searchAndSummarizeEvent] ⚠️ LLM 判断搜索结果与原始信息不相关（shouldUse=false），跳过补充`);
        console.log(`[searchAndSummarizeEvent] ========== 搜索调试结束 ==========`);
        return null;
      }

      const fullStory = parsed.eventFullStory;
      console.log(`[searchAndSummarizeEvent] ✅ 概括完成，长度: ${fullStory.length} 字符`);
      console.log(`[searchAndSummarizeEvent] ========== 搜索调试结束 ==========`);

      if (!fullStory) {
        return null;
      }

      return {
        summary: summary || null,
        fullStory,
      };
    }

    console.log(`[searchAndSummarizeEvent] ⚠️ 搜索结果无内容，跳过补充`);
    console.log(`[searchAndSummarizeEvent] ========== 搜索调试结束 ==========`);
    return null;
  } catch (error) {
    console.error('[searchAndSummarizeEvent] ❌ 搜索失败:', error);
    console.log(`[searchAndSummarizeEvent] ========== 搜索调试结束 ==========`);
    return null;
  }
}

/**
 * 安全地将值转为非空字符串
 * - null/undefined → 空字符串
 * - "null"/"undefined"/"None"（LLM 幻觉值）→ 空字符串
 * - 非字符串类型先 String() 再 trim
 */
function safeString(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  // LLM 偶尔返回字面量 "null"/"undefined"/"None" 作为空值表达
  if (str === 'null' || str === 'undefined' || str === 'None') return '';
  return str;
}

/**
 * 解析搜索概括 LLM 返回的 JSON 响应
 * 提示词要求返回 { eventFullStory: string, shouldUse: boolean }
 * 
 * 返回 null 表示解析失败或不应使用
 */
function parseSearchSummarizeResponse(content: string): { eventFullStory: string; shouldUse: boolean } | null {
  try {
    let jsonStr = content.trim();

    // 去除 markdown 代码块标记
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    const parsed = JSON.parse(jsonStr);

    const shouldUse = parsed.shouldUse === true;
    const eventFullStory = safeString(parsed.eventFullStory);

    // shouldUse=false 时，eventFullStory 应为空（提示词要求）
    if (!shouldUse) {
      return { eventFullStory: '', shouldUse: false };
    }

    // shouldUse=true 但 eventFullStory 为空，视为异常
    if (!eventFullStory) {
      console.warn('[parseSearchSummarizeResponse] shouldUse=true 但 eventFullStory 为空，视为无效');
      return null;
    }

    return { eventFullStory, shouldUse: true };
  } catch (error) {
    // JSON 解析失败，尝试作为纯文本处理（兼容 LLM 未返回 JSON 的情况）
    const trimmed = content.trim();
    if (trimmed && trimmed.length > 50) {
      console.warn('[parseSearchSummarizeResponse] JSON 解析失败，回退为纯文本使用');
      return { eventFullStory: trimmed, shouldUse: true };
    }
    return null;
  }
}

/**
 * 安全地将值转为字符串数组
 * - 非数组 → 空数组
 * - 数组中非字符串元素 → String() 后过滤
 * - 空字符串 / "null" / LLM 幻觉值 → 过滤掉
 * - 每个元素限制 10 字以内（prompt 要求 6 字，留 4 字余量）
 */
function safeStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val
    .map((t: unknown) => safeString(t))
    .filter((t: string) => t.length > 0 && t.length <= 10);
}

/**
 * 合法的 caseType 枚举
 */
const VALID_CASE_TYPES = ['positive', 'warning', 'milestone'] as const;

/**
 * 合法的 industry 枚举（与 schema IndustryType 对齐）
 */
const VALID_INDUSTRIES = ['insurance', 'banking', 'securities', 'fund', 'trust', 'fintech'] as const;

/**
 * 可搜索的城市名列表（直辖市 + 省会 + 热门城市）
 * 用于判断是否需要搜索补充
 */
const SEARCHABLE_CITIES = [
  // 直辖市
  '北京', '上海', '天津', '重庆',
  // 省会城市
  '广州', '杭州', '南京', '武汉', '成都', '西安', '郑州', '长沙', '济南', '青岛',
  '福州', '厦门', '合肥', '南昌', '昆明', '贵阳', '南宁', '海口', '石家庄', '太原',
  '沈阳', '长春', '哈尔滨', '兰州', '银川', '西宁', '乌鲁木齐', '拉萨', '呼和浩特',
  // 热门城市
  '深圳', '苏州', '无锡', '宁波', '东莞', '佛山', '珠海', '中山', '惠州', '温州',
  '烟台', '潍坊', '常州', '南通', '扬州', '镇江', '嘉兴', '绍兴', '金华', '台州',
  '泉州', '漳州', '三亚', '大理', '丽江', '桂林', '大连', '秦皇岛', '唐山',
].join('|');

/**
 * 可搜索的事件关键词
 * 用于判断内容是否涉及可搜索的新闻事件
 */
const SEARCHABLE_EVENT_KEYWORDS = [
  // 事故类
  '车祸', '交通事故', '意外', '坠楼', '溺水', '火灾', '爆炸', '塌方',
  // 健康类
  '重疾', '癌症', '肿瘤', '猝死', '疾病', '去世', '身故', '伤残', '残疾', '脑梗', '心梗', '尿毒症',
  // 理赔类
  '理赔', '拒赔', '赔付', '保险金', '赔偿', '诉讼', '判决', '起诉', '上诉', '仲裁',
  // 行业事件
  '暴雷', '破产', '倒闭', '跑路', '诈骗', '非法集资', '传销',
].join('|');

/**
 * 人名模式（用于识别可搜索的人物线索）
 * 如"张先生"、"李女士"、"王某"、"赵某某"等
 */
const PERSON_NAME_PATTERN = /[\u4e00-\u9fa5]{1,2}(先生|女士|总|董|局|处长|科长|经理|律师|医生|护士|老师)/;

/**
 * 解析 LLM 返回的案例提取结果
 */
function parseCaseExtractionResponse(content: string): CaseExtractionResult {
  try {
    // 尝试直接解析
    let jsonStr = content.trim();

    // 去除 markdown 代码块标记
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    const parsed = JSON.parse(jsonStr);

    // 必填字段：title 为空时给出兜底值
    const title = safeString(parsed.title);
    const background = safeString(parsed.background);
    const result = safeString(parsed.result);

    return {
      title: title || '待补充标题',
      eventFullStory: safeString(parsed.eventFullStory),
      background,
      insuranceAction: safeString(parsed.insuranceAction),
      result: result || '暂无结果信息',
      productTags: safeStringArray(parsed.productTags),
      protagonist: safeString(parsed.protagonist),
      crowdTags: safeStringArray(parsed.crowdTags),
      emotionTags: safeStringArray(parsed.emotionTags),
      caseType: VALID_CASE_TYPES.includes(parsed.caseType) ? parsed.caseType : 'positive',
      industry: VALID_INDUSTRIES.includes(parsed.industry) ? parsed.industry : 'insurance',
      llmExtractedTitle: '',  // 将在 extractCaseFromSnippet 中赋值
      searchKeywords: safeString(parsed.searchKeywords),  // LLM 从原文提取的搜索关键词
      searchPerformed: false,
      searchPending: false,
      searchSummary: null,
    };
  } catch (error) {
    console.error('[parseCaseExtractionResponse] JSON 解析失败:', error);
    console.error('[parseCaseExtractionResponse] 原始内容:', content.slice(0, 500));
    return buildFallbackCaseExtraction(content);
  }
}

/**
 * 兜底：LLM 调用失败时使用基础提取
 * eventFullStory 保留完整原文，background 留空让用户自行填写
 * 标题使用速记原始标题（与正常流程保持一致）
 */
function buildFallbackCaseExtraction(rawContent: string, snippetTitle?: string): CaseExtractionResult {
  return {
    title: snippetTitle || rawContent.slice(0, 30) + (rawContent.length > 30 ? '...' : ''),
    eventFullStory: rawContent,
    background: '',
    insuranceAction: '',
    result: '暂无结果信息',
    productTags: [],
    llmExtractedTitle: '',
    searchKeywords: '',  // 兜底时无 LLM 生成的搜索关键词
    protagonist: '',
    crowdTags: [],
    emotionTags: [],
    caseType: 'positive',
    industry: 'insurance',
    searchPerformed: false,
    searchPending: false,
    searchSummary: null,
  };
}

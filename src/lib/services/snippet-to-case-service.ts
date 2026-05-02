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
  title: string;
  eventFullStory: string;
  background: string;
  insuranceAction: string;
  result: string;
  productTags: string[];
  // 后台字段（不展示）
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
let promptLoadTime: number = 0;  // 上次加载时间（用于检测文件变更）
const PROMPT_CACHE_TTL = 60000;  // 缓存有效期 60 秒（开发环境用）

/**
 * 清除提示词缓存（可用于手动刷新）
 */
export function clearPromptCache(): void {
  cachedPrompt = null;
  promptLoadTime = 0;
}

/**
 * 加载提示词文件
 * - 生产环境：使用缓存，仅首次加载
 * - 开发环境：检查 TTL，超时后重新加载（支持热更新）
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
    console.log(`✅ [snippet-to-case] 开发环境热更新提示词，长度: ${cachedPrompt.length} 字符`);
  } else {
    console.log(`✅ [snippet-to-case] 加载提示词文件，长度: ${cachedPrompt.length} 字符`);
  }

  return cachedPrompt;
}

/**
 * Step 1: 使用 LLM 从速记内容提取案例结构化信息（不含搜索补充）
 * 仅做一次 LLM 调用，尽快返回给前端展示
 */
export async function extractCaseFromSnippet(
  rawContent: string,
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

    // 标记是否需要搜索补充（前端据此决定是否调用 Step 2）
    const needsSearch = shouldSearchForMoreInfo(rawContent, result);
    result.searchPerformed = false;
    result.searchPending = needsSearch;

    return result;
  } catch (error) {
    console.error('[extractCaseFromSnippet] LLM 调用失败:', error);
    return buildFallbackCaseExtraction(rawContent);
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
  // 如果事件经过已经比较完整（>200字），不需要搜索
  if (result.eventFullStory.length > 200) {
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
 * 从 LLM 提取结果构造精准的搜索关键词
 * 
 * 策略：优先使用 title（最精炼的概括），辅以 protagonist 提供主体线索，
 * 避免使用口语化原文导致搜索结果偏离
 */
function buildSearchQuery(extractionResult: CaseExtractionResult, rawContent: string): string {
  const parts: string[] = [];

  // 1. 标题是最精炼的概括，优先使用
  if (extractionResult.title) {
    parts.push(extractionResult.title);
  }

  // 2. 主人公提供主体线索（注意：已被匿名化处理，如"某企业主张先生"）
  if (extractionResult.protagonist) {
    parts.push(extractionResult.protagonist);
  }

  // 3. 如果标题+主人公还不够具体，从原文提取年份和地名
  if (parts.join(' ').length < 15) {
    const yearMatch = rawContent.match(/\d{4}年/);
    if (yearMatch) parts.push(yearMatch[0]);

    // 使用常量城市列表匹配
    const cityMatch = rawContent.match(new RegExp(`(${SEARCHABLE_CITIES})`));
    if (cityMatch) parts.push(cityMatch[0]);
  }

  const query = parts.join(' ').replace(/\s+/g, ' ').trim();
  // 兜底：如果构造的 query 仍为空，使用原文前40字
  return query || rawContent.slice(0, 40).replace(/\n/g, ' ').trim();
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

  console.log(`[searchAndSummarizeEvent] 搜索关键词: "${searchQuery}"`);

  try {
    const searchResponse = await searchClient.webSearch(searchQuery, 5, true);

    if (!searchResponse.web_items || searchResponse.web_items.length === 0) {
      return null;
    }

    // 使用搜索摘要作为补充
    const summary = searchResponse.summary || null;

    // 让 LLM 基于搜索结果概括完整事件经过
    if (summary || searchResponse.web_items.length > 0) {
      const llmClient = new LLMClient(config, customHeaders);

      const searchContext = searchResponse.web_items
        .slice(0, 3)
        .map((item, i) => `[${i + 1}] ${item.title}: ${item.snippet}`)
        .join('\n');

      const llmMessages = [
        {
          role: 'system' as const,
          content: '你是一个专业的事件概括助手。基于提供的搜索结果，用客观中立的叙事体概括事件完整经过。要求：1) 100-300字；2) 保留关键数据和事实；3) 不编造信息；4) 如果搜索结果信息不足，基于已有信息合理概括。直接输出概括文本，不要有任何格式标记。',
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

      return {
        summary: summary || null,
        fullStory: llmResponse.content.trim(),
      };
    }

    return null;
  } catch (error) {
    console.error('[searchAndSummarizeEvent] 搜索失败:', error);
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
 */
function buildFallbackCaseExtraction(rawContent: string): CaseExtractionResult {
  return {
    title: rawContent.slice(0, 30) + (rawContent.length > 30 ? '...' : ''),
    eventFullStory: rawContent,
    background: '',
    insuranceAction: '',
    result: '暂无结果信息',
    productTags: [],
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

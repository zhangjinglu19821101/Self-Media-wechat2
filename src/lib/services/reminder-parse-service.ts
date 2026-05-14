/**
 * 提醒智能解析服务
 * 从自然语言中提取提醒关键信息
 *
 * 设计说明：
 * - 本服务是工具性 LLM 调用，不走 callLLM 的 Agent 体系
 * - 直接使用 createUserLLMClient / getPlatformLLM（参考 llm-assisted-rule-service 模式）
 * - 避免 Agent 记忆加载、身份提示词注入等不必要的开销
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { LLMClient } from 'coze-coding-dev-sdk';
import { createUserLLMClient, getPlatformLLM } from '@/lib/llm/factory';
import { getCurrentBeijingTime } from '@/lib/utils/date-time';
import { JsonParserEnhancer } from '@/lib/utils/json-parser-enhancer';

// ================================================================
// 类型定义
// ================================================================

/**
 * 解析结果
 */
export interface ReminderParseResult {
  requester: string;           // 要求人名称
  requesterType: string;       // 要求人类型（内部人员/外部客户/合作伙伴/其他）
  executor: string;            // 执行人名称
  executorType: string;        // 执行人类型（我自己/团队同事/其他人）
  taskContent: string;         // 任务内容
  deadline: string;            // 截止时间（ISO格式）
  deadlineOriginal: string;    // 原始时间表达
  priority: 'high' | 'medium' | 'low';  // 优先级
  confidence: 'high' | 'medium' | 'low'; // 置信度
  extractionNotes: string;     // 解析备注
}

/**
 * LLM 返回的完整结构
 */
interface LLMStructuredResult {
  resultContent: ReminderParseResult;
  executionSummary?: {
    actionsTaken?: string[];
  };
}

interface LLMResponse {
  isCompleted: boolean;
  result: string;
  structuredResult: LLMStructuredResult;
}

// ================================================================
// P0-2 修复：提示词缓存（模块级单例，只读一次磁盘）
// ================================================================

let _cachedPrompt: string | null = null;

/**
 * 加载提示词（带缓存）
 * - 首次调用读磁盘并缓存
 * - 后续调用直接返回缓存
 * - 使用同步 readFileSync（与 prompt-loader.ts 保持一致）
 */
function loadReminderParsePrompt(): string {
  if (_cachedPrompt) return _cachedPrompt;

  const promptPath = join(process.cwd(), 'src/lib/agents/prompts/reminder-parse.md');

  if (!existsSync(promptPath)) {
    throw new Error(`提示词文件不存在: ${promptPath}`);
  }

  _cachedPrompt = readFileSync(promptPath, 'utf-8');
  console.log(`[ReminderParse] 提示词已加载并缓存，长度: ${_cachedPrompt.length} 字符`);
  return _cachedPrompt;
}

// ================================================================
// LLM 客户端获取（BYOK 优先，平台 Key 兜底）
// ================================================================

/**
 * 获取 LLM 客户端
 * - 有 workspaceId → 尝试用户 Key（BYOK）
 * - 无 workspaceId 或用户未配 Key → 平台 Key 兜底
 */
async function getClient(workspaceId?: string): Promise<LLMClient> {
  if (workspaceId) {
    try {
      const { client } = await createUserLLMClient(workspaceId, { timeout: 30000 });
      return client;
    } catch {
      // 用户未配 Key 或 Key 无效，降级到平台 Key
      console.log('[ReminderParse] 用户 Key 不可用，降级到平台 Key');
    }
  }
  return getPlatformLLM();
}

// ================================================================
// 相对时间计算
// ================================================================

/**
 * 计算相对时间
 * 根据用户输入的相对时间表达计算具体日期
 *
 * 仅作为 LLM 时间解析的补充：
 * - LLM 可能返回原始表达但未计算 deadline
 * - 此时用本地正则二次计算
 */
function calculateRelativeTime(timeExpression: string): string | null {
  const now = getCurrentBeijingTime();
  const today = new Date(now);

  // 规范化输入
  const normalized = timeExpression.toLowerCase().trim();

  // 匹配常见模式
  const patterns: Array<{ pattern: RegExp; handler: (match: RegExpMatchArray) => Date }> = [
    // 今天
    {
      pattern: /^今天(\D*)?$/,
      handler: () => {
        const d = new Date(today);
        d.setHours(18, 0, 0, 0);
        return d;
      }
    },
    // 明天
    {
      pattern: /^明天(\D*)?$/,
      handler: (match) => {
        const d = new Date(today);
        d.setDate(d.getDate() + 1);
        const suffix = match[1] || '';
        if (suffix.includes('早') || suffix.includes('上午')) {
          d.setHours(9, 0, 0, 0);
        } else if (suffix.includes('下午')) {
          d.setHours(15, 0, 0, 0);
        } else if (suffix.includes('晚')) {
          d.setHours(20, 0, 0, 0);
        } else {
          d.setHours(18, 0, 0, 0);
        }
        return d;
      }
    },
    // 后天
    {
      pattern: /^后天$/,
      handler: () => {
        const d = new Date(today);
        d.setDate(d.getDate() + 2);
        d.setHours(18, 0, 0, 0);
        return d;
      }
    },
    // 大后天
    {
      pattern: /^大后天$/,
      handler: () => {
        const d = new Date(today);
        d.setDate(d.getDate() + 3);
        d.setHours(18, 0, 0, 0);
        return d;
      }
    },
    // 这周几
    {
      pattern: /^这周([一二三四五六日天])$/,
      handler: (match) => {
        const dayMap: Record<string, number> = {
          '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0
        };
        const targetDay = dayMap[match[1]];
        const d = new Date(today);
        const currentDay = d.getDay();
        const diff = targetDay - currentDay;
        d.setDate(d.getDate() + (diff >= 0 ? diff : diff + 7));
        d.setHours(18, 0, 0, 0);
        return d;
      }
    },
    // 下周几
    {
      pattern: /^下周([一二三四五六日天])$/,
      handler: (match) => {
        const dayMap: Record<string, number> = {
          '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0
        };
        const targetDay = dayMap[match[1]];
        const d = new Date(today);
        const currentDay = d.getDay();
        const daysUntilNextMonday = 7 - currentDay + 1;
        d.setDate(d.getDate() + daysUntilNextMonday + targetDay - 1);
        d.setHours(18, 0, 0, 0);
        return d;
      }
    },
    // X天后
    {
      pattern: /^(\d+)天后$/,
      handler: (match) => {
        const d = new Date(today);
        d.setDate(d.getDate() + parseInt(match[1]));
        d.setHours(18, 0, 0, 0);
        return d;
      }
    },
    // 月日
    {
      pattern: /^(\d{1,2})月(\d{1,2})[日号]$/,
      handler: (match) => {
        const month = parseInt(match[1]) - 1;
        const day = parseInt(match[2]);
        const d = new Date(today.getFullYear(), month, day, 18, 0, 0);
        if (d < today) {
          d.setFullYear(d.getFullYear() + 1);
        }
        return d;
      }
    },
  ];

  for (const { pattern, handler } of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      const result = handler(match);
      return result.toISOString().replace(/\.\d{3}Z$/, '');
    }
  }

  return null;
}

// ================================================================
// 核心解析方法
// ================================================================

/**
 * 将 ISO 时间转换为 datetime-local 格式（本地时间，无时区偏移）
 *
 * 问题背景：
 * - 服务端返回 ISO 格式（如 2024-01-16T15:00:00）
 * - 前端 datetime-local 需要本地时间格式（2024-01-16T15:00）
 * - 直接使用 toISOString() 会导致时区偏移问题
 *
 * 解决方案：
 * - 使用本地时间组件直接格式化，避免时区转换
 */
function isoToLocalDatetime(isoString: string): string {
  if (!isoString) return '';

  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return '';
  }
}

/**
 * 解析提醒信息
 * @param input 用户输入的自然语言
 * @param workspaceId 工作区ID
 * @returns 解析结果
 */
export async function parseReminderInput(
  input: string,
  workspaceId: string
): Promise<ReminderParseResult> {
  // 加载提示词（带缓存）
  const systemPrompt = loadReminderParsePrompt();

  // 获取当前时间信息
  const now = getCurrentBeijingTime();
  const today = new Date(now);
  const dateInfo = `当前日期：${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日，${['日', '一', '二', '三', '四', '五', '六'][today.getDay()]}，当前时间：${today.getHours()}:${String(today.getMinutes()).padStart(2, '0')}`;

  // 构建用户消息
  const userMessage = `${dateInfo}

用户输入：${input}

请根据上述信息解析提醒内容，并按照标准格式输出 JSON。`;

  // 获取 LLM 客户端（BYOK 优先，平台 Key 兜底）
  const client = await getClient(workspaceId);

  const startTime = Date.now();
  console.log(`[ReminderParse] 开始解析，输入长度: ${input.length}`);

  try {
    // 调用 LLM（使用轻量模型，低温度保证稳定）
    const response = await client.invoke(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      {
        model: 'doubao-seed-2-0-mini-260215',
        temperature: 0.3,
      }
    );

    const elapsed = Date.now() - startTime;
    console.log(`[ReminderParse] LLM 响应成功 (${elapsed}ms)，响应长度: ${response.content.length}`);

    // P1-1 修复：使用项目统一的 JsonParserEnhancer 解析 JSON
    // 支持多种格式：代码块、栈匹配、自动修复常见错误
    const parseResult = JsonParserEnhancer.smartParse(response.content);

    if (!parseResult.success || !parseResult.data) {
      const errorMsg = parseResult.error || '响应中未找到有效 JSON 对象';
      console.warn(`[ReminderParse] JSON 解析失败: ${errorMsg}`, parseResult.warnings);
      throw new Error(errorMsg);
    }

    if (parseResult.warnings && parseResult.warnings.length > 0) {
      console.log(`[ReminderParse] JSON 解析警告: ${parseResult.warnings.join(', ')}`);
    }

    const parsed: LLMResponse = parseResult.data;

    if (!parsed.structuredResult?.resultContent) {
      throw new Error('响应格式不正确：缺少 structuredResult.resultContent');
    }

    const result = parsed.structuredResult.resultContent;

    // 如果 LLM 没有计算出 deadline，尝试本地二次计算
    if (!result.deadline && result.deadlineOriginal) {
      const calculated = calculateRelativeTime(result.deadlineOriginal);
      if (calculated) {
        result.deadline = calculated;
        console.log(`[ReminderParse] 本地补充计算 deadline: ${result.deadlineOriginal} → ${calculated}`);
      }
    }

    return result;
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[ReminderParse] 解析失败 (${elapsed}ms):`, error instanceof Error ? error.message : String(error));

    // 降级：返回原始输入作为任务内容
    return {
      requester: '',
      requesterType: '',
      executor: '我',
      executorType: '我自己',
      taskContent: input,
      deadline: '',
      deadlineOriginal: '',
      priority: 'medium',
      confidence: 'low',
      extractionNotes: 'LLM 解析失败，使用原始输入作为任务内容',
    };
  }
}

/**
 * 批量解析提醒信息
 * @param inputs 用户输入数组
 * @param workspaceId 工作区ID
 * @returns 解析结果数组
 */
export async function parseReminderInputs(
  inputs: string[],
  workspaceId: string
): Promise<ReminderParseResult[]> {
  return Promise.all(inputs.map(input => parseReminderInput(input, workspaceId)));
}

// 导出时间格式转换函数供 API 层使用
export { isoToLocalDatetime };

// ================================================================
// 常量定义
// ================================================================

/**
 * 输入长度限制
 */
export const INPUT_CONSTRAINTS = {
  MAX_INPUT_LENGTH: 500,      // 最大输入长度（字符）
  MIN_INPUT_LENGTH: 2,        // 最小输入长度（字符）
} as const;

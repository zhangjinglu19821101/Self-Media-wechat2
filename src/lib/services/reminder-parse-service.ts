/**
 * 提醒智能解析服务
 * 从自然语言中提取提醒关键信息
 */

import { callLLM } from '@/lib/agent-llm';
import { getCurrentBeijingTime } from '@/lib/utils/date-time';

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

/**
 * 提示词加载器
 */
async function loadReminderParsePrompt(): Promise<string> {
  const fs = await import('fs/promises');
  const path = await import('path');
  
  const promptPath = path.join(process.cwd(), 'src/lib/agents/prompts/reminder-parse.md');
  return fs.readFile(promptPath, 'utf-8');
}

/**
 * 计算相对时间
 * 根据用户输入的相对时间表达计算具体日期
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
        // 检查是否有时间修饰
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
        // 先跳到下周一，再加目标天数
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
        // 如果日期已过，则为明年
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
  // 加载提示词
  const systemPrompt = await loadReminderParsePrompt();
  
  // 获取当前时间信息
  const now = getCurrentBeijingTime();
  const today = new Date(now);
  const dateInfo = `当前日期：${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日，${['日', '一', '二', '三', '四', '五', '六'][today.getDay()]}，当前时间：${today.getHours()}:${String(today.getMinutes()).padStart(2, '0')}`;
  
  // 构建用户消息
  const userMessage = `${dateInfo}

用户输入：${input}

请根据上述信息解析提醒内容，并按照标准格式输出 JSON。`;
  
  // 调用 LLM
  const response = await callLLM(
    'reminder-parse',         // agentId
    '提醒智能解析',            // context
    systemPrompt,             // systemPrompt
    userMessage,              // userPrompt
    {
      temperature: 0.3,
      workspaceId,
    }
  );
  
  // 解析响应
  try {
    // 尝试解析 JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('响应中未找到 JSON 对象');
    }
    
    const parsed: LLMResponse = JSON.parse(jsonMatch[0]);
    
    if (!parsed.structuredResult?.resultContent) {
      throw new Error('响应格式不正确：缺少 resultContent');
    }
    
    const result = parsed.structuredResult.resultContent;
    
    // 如果 LLM 没有计算出 deadline，尝试本地计算
    if (!result.deadline && result.deadlineOriginal) {
      const calculated = calculateRelativeTime(result.deadlineOriginal);
      if (calculated) {
        result.deadline = calculated;
      }
    }
    
    return result;
  } catch (error) {
    console.error('[ReminderParseService] 解析 LLM 响应失败:', error);
    
    // 返回降级结果
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

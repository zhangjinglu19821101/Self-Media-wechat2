/**
 * 指令格式配置
 * 
 * ⚠️ 重要提示：
 * - 正则表达式已稳定，禁止修改！
 * - 添加新格式：在 COMMAND_FORMATS 中添加配置
 * - 添加新 Agent：在 EXECUTOR_MAP 中添加映射
 * 
 * 说明：
 * - 所有支持的指令格式都在这里定义
 * - 添加新格式时，只需在这里添加一条配置
 * - 系统会自动识别所有格式
 */

export interface CommandFormat {
  /** 格式名称，用于调试 */
  name: string;
  /** 执行主体的正则表达式（从文本中提取） */
  executorRegex: RegExp;
  /** 是否支持多指令块（多个执行主体） */
  supportsMultiBlock: boolean;
  /** 指令块分隔符（用于多指令块） */
  blockSeparator?: RegExp;
  /** 说明 */
  description?: string;
}

/**
 * 指令格式集合
 * 
 * 使用方式：
 * 1. 添加新格式：在这里添加一条配置
 * 2. 系统会自动识别所有格式
 * 3. 不需要修改其他代码
 */
export const COMMAND_FORMATS: CommandFormat[] = [
  {
    name: '标准格式：执行主体为「xxx」',
    executorRegex: /执行主体[\s:：]*[为]?\s*(?:「([^\」]+)」|([^\n]+))(?:\s*[\n$,.;:：]*)?/gi,
    supportsMultiBlock: true,
    blockSeparator: /【指令\s*\d+】/g,
    description: '标准格式，支持引号和无引号两种写法',
  },
  {
    name: '连续格式：####执行主体',
    executorRegex: /####\s*执行主体[\s:：]*[为]?\s*(?:「([^\」]+)」|([^\n]+))\s*\n/gi,
    supportsMultiBlock: true,
    blockSeparator: null,
    description: '使用####执行主体标记，连续排列多个指令',
  },
];

/**
 * 执行主体ID映射
 * 
 * 将文本中的执行主体名称映射到系统中的Agent ID
 */
export const EXECUTOR_MAP: Record<string, string> = {
  // Agent B 的各种写法
  'agent b': 'B',
  'agent-b': 'B',
  'agentb': 'B',
  'b': 'B',
  
  // Agent C 的各种写法
  'agent c': 'C',
  'agent-c': 'C',
  'agentc': 'C',
  'c': 'C',
  
  // Agent D 的各种写法
  'agent d': 'D',
  'agent-d': 'D',
  'agentd': 'D',
  'd': 'D',
  
  // Insurance Agent 的各种写法
  'insurance-c': 'insurance-c',
  'insurance-c ': 'insurance-c',
  ' insurance-c': 'insurance-c',
  'insurancec': 'insurance-c',
  
  'insurance-d': 'insurance-d',
  'insurance-d ': 'insurance-d',
  ' insurance-d': 'insurance-d',
  'insuranced': 'insurance-d',
  
  // 其他可能的写法
  '架构师b': 'B',
  '架构师B': 'B',
  '技术负责人': 'B',
  '技术负责人b': 'B',
  
  '运营总监': 'insurance-c',
  '运营总监c': 'insurance-c',
  '保险运营': 'insurance-c',
  
  '内容负责人': 'insurance-d',
  '内容负责人d': 'insurance-d',
  '保险内容': 'insurance-d',
};

/**
 * 解析执行主体ID
 * 
 * @param executorText 执行主体文本（如 "Agent B"、"insurance-c"）
 * @returns Agent ID（如 "B"、"insurance-c"），如果无法识别返回 null
 */
export function parseExecutorId(executorText: string | null | undefined): string | null {
  if (!executorText) return null;
  
  // 统一转换：去除前后空格，转小写
  const normalized = executorText.trim().toLowerCase();
  
  // 直接映射
  if (EXECUTOR_MAP[normalized]) {
    return EXECUTOR_MAP[normalized];
  }
  
  // 尝试移除空格和横杠
  const noSpace = normalized.replace(/[\s-]/g, '');
  if (EXECUTOR_MAP[noSpace]) {
    return EXECUTOR_MAP[noSpace];
  }
  
  // 尝试精确匹配（不区分大小写）
  for (const [key, value] of Object.entries(EXECUTOR_MAP)) {
    if (key.toLowerCase() === normalized) {
      return value;
    }
  }
  
  return null;
}

/**
 * 检测文本中包含的所有执行主体
 * 
 * @param text 要检测的文本
 * @returns 执行主体列表 { id, text, index }
 */
export function detectExecutors(text: string): Array<{ id: string; text: string; index: number }> {
  const results: Array<{ id: string; text: string; index: number }> = [];
  const seenPositions = new Set<number>();
  
  // 遍历所有格式
  for (const format of COMMAND_FORMATS) {
    // 查找所有匹配
    const matches = text.matchAll(format.executorRegex);
    
    for (const match of matches) {
      // 支持两种捕获组：
      // - match[1]: 引号格式 「xxx」
      // - match[2]: 无引号格式 xxx（到换行符或标点符号）
      const executorText = match[1] || match[2];
      
      if (!executorText) continue;
      
      // 清理：去除首尾标点符号
      const cleanedText = executorText.trim().replace(/[，。、；：,.;:：]+$/, '');
      
      const executorId = parseExecutorId(cleanedText);
      
      if (executorId) {
        // 去重：如果位置太接近（<10个字符），视为重复
        const position = match.index!;
        const isDuplicate = Array.from(seenPositions).some(pos => Math.abs(pos - position) < 10);
        
        if (!isDuplicate) {
          seenPositions.add(position);
          results.push({
            id: executorId,
            text: cleanedText,
            index: position,
          });
        }
      }
    }
  }
  
  // 按位置排序
  return results.sort((a, b) => a.index - b.index);
}

/**
 * 提取执行主体的指令内容
 * 
 * @param text 完整文本
 * @param executor 执行主体信息
 * @param nextExecutor 下一个执行主体（用于确定内容边界）
 * @returns 指令内容
 */
export function extractExecutorContent(
  text: string,
  executor: { id: string; text: string; index: number },
  nextExecutor?: { id: string; text: string; index: number }
): string {
  const startIndex = executor.index;
  const endIndex = nextExecutor ? nextExecutor.index : text.length;
  
  return text.slice(startIndex, endIndex).trim();
}

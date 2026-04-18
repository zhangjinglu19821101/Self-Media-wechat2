/**
 * Agent 记忆辅助工具
 * 在 LLM 调用时加载 Agent 的相关记忆
 */

import { AgentMemoryService } from './services/agent-memory';
import { eq, and, sql } from 'drizzle-orm';
import { getDatabase, schema } from '../db';

const agentMemory = new AgentMemoryService();

/**
 * 获取 Agent 的记忆上下文
 * 在调用 LLM 之前，检索相关的记忆并格式化为 prompt
 *
 * @param agentId Agent ID
 * @param currentTask 当前任务内容（用于检索相关记忆）
 * @param options 可选配置
 * @returns 格式化后的记忆上下文字符串
 */
export async function getMemoryContext(
  agentId: string,
  currentTask?: string,
  options?: {
    maxMemories?: number;
    minImportance?: number;
    memoryTypes?: string[];
  }
): Promise<string> {
  try {
    const maxMemories = options?.maxMemories || 10;
    const minImportance = options?.minImportance || 5; // 只检索重要性 >= 5 的记忆
    const memoryTypes = options?.memoryTypes || ['strategy', 'experience', 'knowledge'];

    // 1. 检索 Agent 的记忆
    const memories = await agentMemory.searchMemories({
      agentId,
      memoryType: undefined, // 不过滤类型，由代码过滤
      minImportance,
      limit: 50, // 先获取 50 条，再筛选
    });

    // 2. 按类型和重要性筛选
    const filteredMemories = memories.filter(m => {
      // 过滤类型
      if (!memoryTypes.includes(m.memoryType)) {
        return false;
      }

      // 过滤重要性
      if (m.importance < minImportance) {
        return false;
      }

      return true;
    });

    // 3. 按重要性排序，取前 N 条
    const topMemories = filteredMemories
      .sort((a, b) => b.importance - a.importance)
      .slice(0, maxMemories);

    // 4. 如果有当前任务，计算相关性并重新排序
    if (currentTask && topMemories.length > 0) {
      const taskKeywords = extractKeywords(currentTask);
      const scoredMemories = topMemories.map(memory => ({
        memory,
        score: calculateRelevanceScore(memory, taskKeywords),
      }));

      // 按相关性分数排序
      scoredMemories.sort((a, b) => b.score - a.score);
      topMemories.length = 0;
      topMemories.push(...scoredMemories.map(m => m.memory));
    }

    // 5. 如果没有记忆，返回空字符串
    if (topMemories.length === 0) {
      console.log(`💭 Agent ${agentId} 没有相关记忆`);
      return '';
    }

    // 6. 格式化记忆为 prompt
    const memoryContext = formatMemoriesToPrompt(topMemories);

    console.log(`💭 Agent ${agentId} 加载了 ${topMemories.length} 条记忆`);
    return memoryContext;
  } catch (error) {
    console.error(`❌ 加载 Agent ${agentId} 记忆失败:`, error);
    return ''; // 出错时返回空，不影响 LLM 调用
  }
}

/**
 * 提取关键词（简单的中文分词）
 */
function extractKeywords(text: string): string[] {
  // 简单的关键词提取：提取长度 >= 2 的连续汉字
  const keywords: string[] = [];
  const chineseRegex = /[\u4e00-\u9fa5]{2,}/g;
  let match;
  while ((match = chineseRegex.exec(text)) !== null) {
    keywords.push(match[0]);
  }
  return keywords;
}

/**
 * 计算记忆与关键词的相关性分数
 */
function calculateRelevanceScore(memory: any, keywords: string[]): number {
  let score = memory.importance * 0.5; // 基础分数 = 重要性的一半

  const memoryText = (memory.title + ' ' + memory.content).toLowerCase();

  // 计算关键词匹配分数
  for (const keyword of keywords) {
    if (memoryText.includes(keyword.toLowerCase())) {
      score += 2; // 每个匹配的关键词加 2 分
    }
  }

  // 标签匹配加分
  if (memory.tags && memory.tags.length > 0) {
    for (const tag of memory.tags) {
      if (keywords.includes(tag)) {
        score += 3; // 标签匹配加 3 分
      }
    }
  }

  return score;
}

/**
 * 格式化记忆为 prompt 字符串
 */
function formatMemoriesToPrompt(memories: any[]): string {
  if (memories.length === 0) {
    return '';
  }

  // 按类型分组
  const grouped = memories.reduce((acc, memory) => {
    if (!acc[memory.memoryType]) {
      acc[memory.memoryType] = [];
    }
    acc[memory.memoryType].push(memory);
    return acc;
  }, {} as Record<string, any[]>);

  // 类型中文映射
  const typeLabels: Record<string, string> = {
    decision: '决策经验',
    strategy: '策略经验',
    experience: '执行经验',
    rule: '规则知识',
    knowledge: '领域知识',
  };

  let prompt = '\n\n# 💾 你的记忆库\n\n';

  // 按类型输出
  for (const [type, typeMemories] of Object.entries(grouped)) {
    const label = typeLabels[type] || type;
    prompt += `## ${label}\n\n`;

    for (const memory of typeMemories) {
      prompt += `### ${memory.title}\n`;
      prompt += `**重要性**: ${memory.importance}/10\n`;
      prompt += `**内容**: ${memory.content}\n`;

      if (memory.tags && memory.tags.length > 0) {
        prompt += `**标签**: ${memory.tags.join(', ')}\n`;
      }

      prompt += '\n';
    }

    prompt += '\n';
  }

  prompt += '---\n\n';
  prompt += '**提示**: 请基于以上记忆经验，结合当前任务进行决策和执行。\n';

  return prompt;
}

/**
 * 自动保存 Agent 的经验到记忆
 * 在任务完成后，自动提取并保存重要的经验
 *
 * @param agentId Agent ID
 * @param task 任务内容
 * @param result 执行结果
 * @param metadata 额外元数据
 */
export async function saveAgentExperience(
  agentId: string,
  task: string,
  result: string,
  metadata?: {
    success?: boolean;
    lessons?: string[];
    tags?: string[];
  }
): Promise<void> {
  try {
    // 1. 提取关键经验
    const lessons = metadata?.lessons || extractLessonsFromResult(result);

    if (lessons.length === 0) {
      console.log(`💭 Agent ${agentId} 没有可保存的经验`);
      return;
    }

    // 2. 保存为记忆
    for (const lesson of lessons) {
      await agentMemory.createMemory({
        agentId,
        memoryType: 'experience',
        title: extractTitleFromTask(task),
        content: lesson,
        tags: metadata?.tags || ['auto'],
        importance: metadata?.success ? 7 : 5,
        source: 'auto',
        metadata: {
          task: task.substring(0, 200),
          result: result.substring(0, 200),
          savedAt: new Date().toISOString(),
        },
      });
    }

    console.log(`💭 Agent ${agentId} 保存了 ${lessons.length} 条经验到记忆库`);
  } catch (error) {
    console.error(`❌ 保存 Agent ${agentId} 经验失败:`, error);
  }
}

/**
 * 从执行结果中提取经验教训
 */
function extractLessonsFromResult(result: string): string[] {
  const lessons: string[] = [];

  // 简单的经验提取逻辑
  // TODO: 可以使用 LLM 进行更智能的提取

  // 提取包含"经验"、"教训"、"注意"、"要点"等关键词的句子
  const patterns = [
    /经验[^。]*：([^。]+)。\s*/g,
    /教训[^。]*：([^。]+)。\s*/g,
    /注意[^。]*：([^。]+)。\s*/g,
    /要点[^。]*：([^。]+)。\s*/g,
    /关键[^。]*：([^。]+)。\s*/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(result)) !== null) {
      lessons.push(match[1].trim());
    }
  }

  return lessons;
}

/**
 * 从任务内容中提取标题
 */
function extractTitleFromTask(task: string): string {
  // 取前 50 个字符作为标题
  return task.substring(0, 50).replace(/\n/g, ' ') + '...';
}

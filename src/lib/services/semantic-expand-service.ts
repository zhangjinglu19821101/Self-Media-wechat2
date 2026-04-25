/**
 * LLM 语义扩展服务
 * 
 * 当关键词+同义词都搜不到素材时，使用 LLM 从用户指令中提取语义相关的搜索词
 * 
 * 设计原则：
 * 1. 轻量级：使用最快最便宜的模型（doubao-seed-1-6-lite）
 * 2. 超时短：5秒超时，不阻塞主流程
 * 3. 降级安全：LLM 失败不影响基础搜索
 * 4. 缓存结果：相同指令5分钟内不重复调用
 */

import { getPlatformLLM } from '@/lib/llm/factory';
import type { Message } from 'coze-coding-dev-sdk';

// 简单内存缓存（5分钟TTL）
const semanticCache = new Map<string, { keywords: string[]; createdAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * 使用 LLM 从用户指令中提取语义相关的搜索关键词
 * 
 * @param instruction 用户原始指令
 * @param existingKeywords 已有的关键词（避免重复提取）
 * @returns LLM 扩展的关键词列表
 */
export async function expandWithLLM(
  instruction: string,
  existingKeywords: string[] = []
): Promise<string[]> {
  // 缓存键：指令前100字符
  const cacheKey = instruction.slice(0, 100);
  
  // 检查缓存
  const cached = semanticCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
    // 过滤掉已有的关键词
    return cached.keywords.filter(k => !existingKeywords.includes(k));
  }

  try {
    const llm = getPlatformLLM();
    
    const messages: Message[] = [
      { role: 'system', content: '你是保险领域的关键词提取专家。只输出关键词，用逗号分隔，不要解释。' },
      { role: 'user', content: `从以下用户指令中，提取5-8个最适合搜索保险素材库的关键词。

要求：
1. 提取用户真正想查找的主题词（不一定是字面词）
2. 转化为素材库中可能使用的标准表述
3. 包含同义替换（如"人死了"→"身故/理赔"，"钱拿不回来"→"退保/现金价值"）
4. 每个词2-6个字
5. 只输出关键词，用逗号分隔，不要解释

已有关键词（不要重复）: ${existingKeywords.join('、')}

用户指令：
${instruction.slice(0, 500)}` }
    ];

    // 5秒超时，不阻塞主流程
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('LLM timeout')), 5000)
    );

    const result = await Promise.race([
      llm.invoke(messages, { model: 'doubao-seed-1-6-lite', temperature: 0.3 }),
      timeoutPromise
    ]);
    
    // LLMResponse = { content: string }
    const text = result.content || '';
    const keywords = text
      .split(/[,，、\s\n]+/)
      .map((s: string) => s.trim())
      .filter((s: string) => s.length >= 2 && s.length <= 10 && !existingKeywords.includes(s));

    // 去重
    const unique: string[] = Array.from(new Set(keywords)).slice(0, 8);

    // 写入缓存
    semanticCache.set(cacheKey, { keywords: unique, createdAt: Date.now() });

    // 清理过期缓存
    if (semanticCache.size > 100) {
      const now = Date.now();
      for (const [key, val] of semanticCache.entries()) {
        if (now - val.createdAt > CACHE_TTL_MS) semanticCache.delete(key);
      }
    }

    return unique;
  } catch (error) {
    // LLM 失败不影响主流程
    console.warn('[SemanticExpand] LLM 语义扩展失败:', error instanceof Error ? error.message : String(error));
    return [];
  }
}

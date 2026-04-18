// Agent 工具 - 让 Agent 可以调用 RAG 知识库

import { createVectorRetriever } from './retriever';

export interface RAGToolOptions {
  collectionName?: string;
  topK?: number;
  minScore?: number;
}

export interface RAGToolResult {
  context: string;
  results: Array<{
    text: string;
    score: number;
    metadata: Record<string, any>;
  }>;
  count: number;
}

/**
 * Agent 工具：检索相关知识
 *
 * 使用方式：
 * 1. Agent 在执行任务时，如果需要检索知识库，调用此函数
 * 2. 将检索到的上下文添加到 prompt 中
 * 3. 基于上下文生成回答
 */
export async function retrieveKnowledge(
  query: string,
  options: RAGToolOptions = {}
): Promise<RAGToolResult> {
  const collectionName = options.collectionName || 'knowledge_base';
  const topK = options.topK || 5;
  const minScore = options.minScore || 0.6;

  try {
    const retriever = createVectorRetriever(collectionName);
    const result = await retriever.retrieve(query, {
      topK,
      minScore,
    });

    const results = result.results.map(r => ({
      text: r.chunk.text,
      score: r.score,
      metadata: r.chunk.metadata,
    }));

    const context = results
      .map((r, i) => `[知识片段 ${i + 1} (相似度: ${r.score.toFixed(4)})]\n${r.text}\n`)
      .join('\n');

    return {
      context,
      results,
      count: results.length,
    };
  } catch (error: any) {
    console.error('Error retrieving knowledge:', error);
    return {
      context: '',
      results: [],
      count: 0,
    };
  }
}

/**
 * Agent 工具：构建带上下文的 Prompt
 *
 * 使用方式：
 * 1. 先调用 retrieveKnowledge 获取相关上下文
 * 2. 调用此函数构建包含上下文的 prompt
 */
export function buildContextPrompt(
  originalPrompt: string,
  context: string,
  options: {
    maxContextLength?: number;
  } = {}
): string {
  const maxContextLength = options.maxContextLength || 3000;

  // 如果上下文太长，截断
  let truncatedContext = context;
  if (context.length > maxContextLength) {
    truncatedContext = context.substring(0, maxContextLength) + '\n...[上下文已截断]';
  }

  // 构建新的 prompt
  if (!truncatedContext) {
    return originalPrompt;
  }

  return `[相关知识库内容]\n${truncatedContext}\n\n[任务要求]\n${originalPrompt}`;
}

/**
 * Agent 工具：检索并增强 Prompt
 *
 * 一步完成：检索知识 + 构建 prompt
 */
export async function retrieveAndEnhancePrompt(
  query: string,
  originalPrompt: string,
  options: RAGToolOptions & { maxContextLength?: number } = {}
): Promise<string> {
  const ragResult = await retrieveKnowledge(query, options);

  if (ragResult.count === 0) {
    console.warn('No relevant knowledge found, using original prompt');
    return originalPrompt;
  }

  return buildContextPrompt(originalPrompt, ragResult.context, {
    maxContextLength: options.maxContextLength,
  });
}

/**
 * Agent 工具：批量检索（用于复杂任务）
 */
export async function retrieveMultipleKnowledge(
  queries: string[],
  options: RAGToolOptions = {}
): Promise<RAGToolResult[]> {
  const results: RAGToolResult[] = [];

  for (const query of queries) {
    const result = await retrieveKnowledge(query, options);
    results.push(result);
  }

  return results;
}

/**
 * Agent 工具：智能上下文推荐
 *
 * 基于当前任务描述，自动推荐最相关的知识
 */
export async function recommendContext(
  taskDescription: string,
  collectionName: string = 'knowledge_base'
): Promise<string> {
  const ragResult = await retrieveKnowledge(taskDescription, {
    collectionName,
    topK: 3,
    minScore: 0.7,
  });

  if (ragResult.count === 0) {
    return '';
  }

  return ragResult.context;
}

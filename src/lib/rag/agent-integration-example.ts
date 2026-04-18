// Agent 集成示例 - 展示如何在 Agent 中使用 RAG 知识库

import {
  retrieveKnowledge,
  retrieveAndEnhancePrompt,
  recommendContext,
} from './agent-tools';
import { EmbeddingClient, HeaderUtils } from 'coze-coding-dev-sdk';
import { isWritingAgent } from '@/lib/agents/agent-registry';

/**
 * 示例 1：Agent insurance-d 在创作文章时检索保险知识
 */
export async function insuranceDCreateArticle(
  topic: string,
  llmClient: EmbeddingClient
): Promise<string> {
  // 1. 检索相关知识
  const ragResult = await retrieveKnowledge(topic, {
    collectionName: 'insurance_knowledge',
    topK: 3,
    minScore: 0.6,
  });

  // 2. 构建增强的 prompt
  const systemPrompt = `你是一个保险内容主编，负责创作保险相关的文章。
请基于以下知识库内容，创作一篇关于 "${topic}" 的文章。

要求：
1. 文章要真实、实用，避免虚假宣传
2. 遵循保险行业合规要求
3. 字数控制在 1500-1600 字`;

  const enhancedPrompt = buildContextPrompt(
    systemPrompt,
    ragResult.context,
    { maxContextLength: 3000 }
  );

  // 3. 调用 LLM 生成文章
  const response = await llmClient.embedText(enhancedPrompt);
  // 注意：这里应该使用 LLM 生成文本，而不是 Embedding
  // 实际使用时，应该使用 LLM 的 chat/generate 接口

  return '生成的文章内容';
}

/**
 * 示例 2：使用检索和增强的一步式方法
 */
export async function agentWithRAG(
  task: string,
  promptTemplate: string
): Promise<string> {
  // 一步完成：检索知识 + 增强 prompt
  const enhancedPrompt = await retrieveAndEnhancePrompt(
    task,
    promptTemplate,
    {
      collectionName: 'knowledge_base',
      topK: 5,
      minScore: 0.6,
      maxContextLength: 3000,
    }
  );

  // 调用 LLM 生成响应
  // const response = await llmClient.generate(enhancedPrompt);
  return enhancedPrompt;
}

/**
 * 示例 3：Agent 在执行任务前自动获取上下文
 */
export async function agentTaskWithAutoContext(
  agentId: string,
  taskDescription: string,
  taskType: 'creation' | 'analysis' | 'review'
): Promise<string> {
  // 1. 根据任务类型选择知识库
  let collectionName = 'knowledge_base';
  if (isWritingAgent(agentId)) {
    collectionName = 'insurance_knowledge';
  } else if (agentId === 'ai-d') {
    collectionName = 'ai_knowledge';
  }

  // 2. 智能推荐上下文
  const recommendedContext = await recommendContext(
    taskDescription,
    collectionName
  );

  // 3. 构建任务 prompt
  const taskPrompt = `你是一个 ${taskType === 'creation' ? '内容创作者' : taskType === 'analysis' ? '分析师' : '审核员'}。

任务：${taskDescription}

${recommendedContext ? `相关知识：\n${recommendedContext}\n` : ''}
`;

  return taskPrompt;
}

/**
 * 示例 4：在 API 路由中使用 Agent 工具
 */
export async function apiRouteWithRAG(request: Request) {
  const body = await request.json();
  const { query, prompt } = body;

  // 1. 提取 headers（重要！）
  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

  // 2. 检索知识
  const ragResult = await retrieveKnowledge(query, {
    collectionName: 'knowledge_base',
  });

  // 3. 增强 prompt
  const enhancedPrompt = buildContextPrompt(prompt, ragResult.context);

  // 4. 调用 LLM（注意：这里应该使用LLM生成API，而不是Embedding）
  // const response = await llmClient.generate(enhancedPrompt);

  return {
    context: ragResult.context,
    enhancedPrompt,
    resultsCount: ragResult.count,
  };
}

/**
 * 辅助函数：构建带上下文的 Prompt
 */
function buildContextPrompt(
  originalPrompt: string,
  context: string,
  options: { maxContextLength?: number } = {}
): string {
  const maxContextLength = options.maxContextLength || 3000;

  if (!context) {
    return originalPrompt;
  }

  let truncatedContext = context;
  if (context.length > maxContextLength) {
    truncatedContext = context.substring(0, maxContextLength) + '\n...[上下文已截断]';
  }

  return `[相关知识库内容]\n${truncatedContext}\n\n[任务要求]\n${originalPrompt}`;
}

// ============================================================================
// 在 Agent 提示词中的使用示例
// ============================================================================

/**
 * 在 insurance-d.md 中的使用示例
 *
 * 在提示词中添加以下内容：
 *
 * ## 知识库检索工具
 *
 * 当执行以下任务时，优先检索知识库：
 *
 * 1. **创作保险文章时**：
 *    - 使用 `retrieveAndEnhancePrompt` 检索相关保险知识
 *    - 将检索到的真实案例、合规要求融入文章内容
 *
 * 2. **回答用户问题时**：
 *    - 使用 `retrieveKnowledge` 检索相关知识
 *    - 基于知识库内容提供准确答案
 *
 * 3. **合规校验时**：
 *    - 使用 `retrieveKnowledge` 检索合规规则
 *    - 确保内容符合监管要求
 *
 * 使用方式：
 * ```typescript
 * const enhancedPrompt = await retrieveAndEnhancePrompt(
 *   topic,
 *   originalPrompt,
 *   {
 *     collectionName: 'insurance_knowledge',
 *     topK: 3,
 *     minScore: 0.7,
 *     maxContextLength: 3000,
 *   }
 * );
 * ```
 */

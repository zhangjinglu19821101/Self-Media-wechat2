/**
 * MCP 结果文本化生成器
 * 采用：JSON + Schema → LLM → 自然语言 方案
 * 支持缓存和降级策略
 */

import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { createUserLLMClient } from '@/lib/llm/factory';

// ============================================
// 类型定义
// ============================================

export interface McpToolSchema {
  toolName: string;
  description: string;
  jsonSchema: string;
}

export interface McpResultTextGenerationRequest {
  toolName: string;
  actionName: string;
  resultStatus: string;
  resultData: any;
  attemptId?: string;
}

export interface McpResultTextGenerationResult {
  success: boolean;
  text: string;
  fromCache?: boolean;
  cachedAt?: Date;
  llmLatencyMs?: number;
  error?: string;
}

// ============================================
// 工具 Schema 定义
// ============================================

const MCP_TOOL_SCHEMAS: Record<string, McpToolSchema> = {
  'wechat_compliance_auditor': {
    toolName: 'wechat_compliance_auditor',
    description: '微信文章合规审核工具，用于检查文章内容是否符合平台规范',
    jsonSchema: `{
  "approved": boolean,      // 审核是否通过
  "riskLevel": string,      // 风险等级：high/medium/low
  "issues": string[],       // 发现的问题列表
  "suggestions": string[],  // 优化建议
  "auditId": string,        // 审核唯一标识
  "formattedSummary": string // 预格式化的摘要（可选）
}`
  },
  'web_search': {
    toolName: 'web_search',
    description: '网络搜索工具，用于获取最新的网络信息',
    jsonSchema: `{
  "query": string,              // 搜索关键词
  "totalResults": number,       // 总结果数
  "results": [                  // 搜索结果列表
    {
      "title": string,          // 结果标题
      "snippet": string,        // 摘要片段
      "source": string,         // 来源
      "date": string,           // 日期
      "relevance": number       // 相关性评分 0-100
    }
  ],
  "summary": string             // 总体摘要（可选）
}`
  },
  'data_fetcher': {
    toolName: 'data_fetcher',
    description: '数据获取工具，用于获取各类统计数据和指标',
    jsonSchema: `{
  "dataset": string,            // 数据集名称
  "metrics": object,            // 关键指标
  "keyFindings": string[],      // 主要发现
  "timestamp": string           // 数据时间戳
}`
  }
};

// ============================================
// 缓存实现（内存缓存）
// ============================================

interface CacheEntry {
  text: string;
  createdAt: Date;
  hitCount: number;
}

class McpResultTextCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly MAX_CACHE_AGE = 24 * 60 * 60 * 1000; // 24小时
  private readonly MAX_CACHE_SIZE = 1000; // 最多缓存1000条

  /**
   * 生成缓存键
   */
  generateCacheKey(request: McpResultTextGenerationRequest): string {
    const dataStr = JSON.stringify(request.resultData);
    return `${request.toolName}:${request.actionName}:${request.resultStatus}:${hashString(dataStr)}`;
  }

  /**
   * 获取缓存
   */
  get(key: string): CacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // 检查是否过期
    if (Date.now() - entry.createdAt.getTime() > this.MAX_CACHE_AGE) {
      this.cache.delete(key);
      return null;
    }

    // 更新命中计数
    entry.hitCount++;
    return entry;
  }

  /**
   * 设置缓存
   */
  set(key: string, text: string): void {
    // 如果超过最大大小，删除最旧的条目
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.findOldestKey();
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      text,
      createdAt: new Date(),
      hitCount: 0
    });
  }

  /**
   * 找到最旧的缓存条目
   */
  private findOldestKey(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.createdAt.getTime() < oldestTime) {
        oldestTime = entry.createdAt.getTime();
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  /**
   * 获取缓存统计
   */
  getStats(): { size: number; hitRate: number } {
    let totalHits = 0;
    for (const entry of this.cache.values()) {
      totalHits += entry.hitCount;
    }
    return {
      size: this.cache.size,
      hitRate: this.cache.size > 0 ? totalHits / this.cache.size : 0
    };
  }

  /**
   * 清理过期缓存
   */
  cleanup(): number {
    let cleaned = 0;
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.createdAt.getTime() > this.MAX_CACHE_AGE) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    return cleaned;
  }
}

// ============================================
// 主生成器类
// ============================================

export class McpResultTextGenerator {
  private llmClient: LLMClient | null = null;
  private cache: McpResultTextCache = new McpResultTextCache();
  
  // 统计信息
  private stats = {
    totalRequests: 0,
    cacheHits: 0,
    llmCalls: 0,
    fallbackToJson: 0,
    totalLlmLatencyMs: 0
  };

  constructor() {
    console.log('🚀 McpResultTextGenerator 初始化');
  }

  /**
   * 获取 LLM 客户端（BYOK: 支持 workspaceId）
   */
  private async getLLMClientWithBYOK(workspaceId?: string): Promise<LLMClient> {
    if (workspaceId) {
      const { client } = await createUserLLMClient(workspaceId);
      return client;
    }
    // 降级使用缓存的平台客户端
    if (!this.llmClient) {
      this.llmClient = new LLMClient(new Config());
    }
    return this.llmClient;
  }

  /**
   * 生成 MCP 结果文本
   */
  async generate(request: McpResultTextGenerationRequest): Promise<McpResultTextGenerationResult> {
    this.stats.totalRequests++;
    const startTime = Date.now();

    try {
      // 1. 检查是否有 pre-formattedSummary（合规工具等）
      if (request.resultData?.formattedSummary) 
      {
        console.log(`[MCP Generator] 使用 pre-formattedSummary: ${request.toolName}`);
        return {
          success: true,
          text: this.wrapWithHeader(request, request.resultData.formattedSummary)
        };
      }

      // 2. 检查缓存
      const cacheKey = this.cache.generateCacheKey(request);
      const cached = this.cache.get(cacheKey);
      
      if (cached) 
      {
        console.log(`[MCP Generator] 缓存命中: ${request.toolName}`);
        this.stats.cacheHits++;
        return {
          success: true,
          text: cached.text,
          fromCache: true,
          cachedAt: cached.createdAt
        };
      }

      // 3. 检查是否有对应的 Schema
      const schema = MCP_TOOL_SCHEMAS[request.toolName];
      
      if (!schema) {
        console.log(`[MCP Generator] 无 Schema，降级到 JSON 格式: ${request.toolName}`);
        return this.fallbackToJson(request);
      }

      // 4. 调用 LLM 生成
      console.log(`[MCP Generator] 调用 LLM 生成: ${request.toolName}`);
      this.stats.llmCalls++;
      
      const llmStartTime = Date.now();
      const llmResult = await this.callLLM(request, schema);
      const llmLatency = Date.now() - llmStartTime;
      
      this.stats.totalLlmLatencyMs += llmLatency;

      // 5. 缓存结果
      const finalText = this.wrapWithHeader(request, llmResult);
      this.cache.set(cacheKey, finalText);

      console.log(`[MCP Generator] LLM 生成完成，耗时: ${llmLatency}ms`);

      return {
        success: true,
        text: finalText,
        llmLatencyMs: llmLatency
      };

    } catch (error) {
      console.error(`[MCP Generator] 生成失败，降级到 JSON:`, error);
      return this.fallbackToJson(request);
    }
  }

  /**
   * 调用 LLM
   */
  private async callLLM(
    request: McpResultTextGenerationRequest,
    schema: McpToolSchema,
    workspaceId?: string
  ): Promise<string> {
    const llm = await this.getLLMClientWithBYOK(workspaceId);

    const systemPrompt = `你是一个专业的数据解释专家。请将 MCP 工具执行结果转换为流畅、自然、易于理解的自然语言描述。

要求：
1. 用自然语言流畅描述，不要使用 JSON 格式
2. 包含所有关键信息，不要遗漏重要数据
3. 语言简洁明了，适合 AI 助手理解
4. 输出格式：一段连贯的文字，200-400字
5. 不要使用任何 Markdown 格式，纯文本即可`;

    const userPrompt = `【工具名称】
${request.toolName}

【工具说明】
${schema.description}

【JSON Schema 说明】
${schema.jsonSchema}

【实际 JSON 数据】
${JSON.stringify(request.resultData, null, 2)}

请用自然语言描述上述结果。`;

    // 🔥 完整打印发送给 LLM 的提示词
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('📤 【MCP结果转换】发送给 LLM 的完整提示词');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('🔧 调用参数:');
    console.log(`   温度: 0.3`);
    console.log('');
    
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];
    
    messages.forEach((msg, index) => {
      console.log(`📋 消息 ${index + 1} [${msg.role.toUpperCase()}]:`);
      console.log('───────────────────────────────────────────────────────────────────────────────');
      console.log(msg.content);
      console.log('───────────────────────────────────────────────────────────────────────────────');
      console.log('');
    });

    console.log('📊 提示词统计:');
    console.log(`   - 消息数量: ${messages.length}`);
    console.log(`   - System 长度: ${systemPrompt.length} 字符`);
    console.log(`   - User 长度: ${userPrompt.length} 字符`);
    console.log(`   - 总字符数: ${systemPrompt.length + userPrompt.length}`);
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('');
    
    console.log(`🤖 正在调用 LLM 转换 MCP 结果...`);

    const startTime = Date.now();
    const response = await llm.invoke(messages, {
      temperature: 0.3
    });
    const latency = Date.now() - startTime;

    // 🔥 完整打印 LLM 的返回结果
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('📥 【MCP结果转换】LLM 返回的完整结果');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('⏱️  性能数据:');
    console.log(`   响应时间: ${latency}ms`);
    console.log('');

    // 记录 token 使用情况
    if (response.usage) {
      console.log('🔢 Token 使用情况:');
      console.log(`   输入: ${response.usage.input_tokens}`);
      console.log(`   输出: ${response.usage.output_tokens}`);
      console.log(`   总计: ${response.usage.total_tokens}`);
      console.log('');
    }

    console.log('📝 返回内容:');
    console.log('───────────────────────────────────────────────────────────────────────────────');
    console.log(response.content);
    console.log('───────────────────────────────────────────────────────────────────────────────');
    console.log('');

    console.log('📊 响应统计:');
    console.log(`   内容长度: ${response.content?.length || 0} 字符`);
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('');

    console.log(`✅ LLM 响应成功 (${latency}ms)`);

    return response.content || '';
  }

  /**
   * 降级到 JSON 格式
   */
  private fallbackToJson(request: McpResultTextGenerationRequest): McpResultTextGenerationResult {
    this.stats.fallbackToJson++;
    
    let text = `【MCP 执行结果】
工具：${request.toolName || 'unknown'}
动作：${request.actionName || 'unknown'}
状态：${request.resultStatus || 'unknown'}
`;
    
    if (request.resultData) {
      if (typeof request.resultData === 'string') {
        text += `\n结果：\n${request.resultData}`;
      } else {
        text += `\n结果：\n${JSON.stringify(request.resultData, null, 2)}`;
      }
    }

    return {
      success: true,
      text
    };
  }

  /**
   * 包装头部信息
   */
  private wrapWithHeader(request: McpResultTextGenerationRequest, content: string): string {
    return `【MCP 执行结果】
工具：${request.toolName || 'unknown'}
动作：${request.actionName || 'unknown'}
状态：${request.resultStatus || 'unknown'}

${content}`;
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const avgLlmLatency = this.stats.llmCalls > 0 
      ? Math.round(this.stats.totalLlmLatencyMs / this.stats.llmCalls)
      : 0;
    
    const cacheHitRate = this.stats.totalRequests > 0
      ? Math.round((this.stats.cacheHits / this.stats.totalRequests) * 100)
      : 0;

    return {
      ...this.stats,
      cacheStats: this.cache.getStats(),
      avgLlmLatencyMs: avgLlmLatency,
      cacheHitRate: `${cacheHitRate}%`
    };
  }

  /**
   * 手动清理缓存
   */
  cleanupCache(): number {
    return this.cache.cleanup();
  }
}

// ============================================
// 辅助函数
// ============================================

/**
 * 简单的字符串哈希函数
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为32位整数
  }
  return Math.abs(hash).toString(16);
}

// ============================================
// 单例导出
// ============================================

let generatorInstance: McpResultTextGenerator | null = null;

export function getMcpResultTextGenerator(): McpResultTextGenerator {
  if (!generatorInstance) {
    generatorInstance = new McpResultTextGenerator();
  }
  return generatorInstance;
}

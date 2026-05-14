/**
 * LLM 概括 + 素材化处理服务
 *
 * 将互联网搜索结果通过 LLM 加工为：
 * 1. 概括性内容（summarizedContent）
 * 2. 可直接入库的素材格式（materialFormat）
 *
 * 设计原则：
 * 1. 轻量模型：doubao-seed-1-6-lite（快+便宜）
 * 2. 超时短：15s 超时 + AbortController 真正中断请求
 * 3. 降级安全：LLM 失败返回原始 snippet
 * 4. 最多处理 3 条：控制成本
 * 5. BYOK 合规：传入 workspaceId 走工厂方法
 */

import { createUserLLMClient } from '@/lib/llm/factory';
import type { Message } from 'coze-coding-dev-sdk';
import type { WebSearchResultItem, MaterialFormat } from './types';

// ==================== 类型映射 ====================

/** 搜索内容 → 素材类型的映射提示 */
const TYPE_HINT = {
  case_hint: '如果内容涉及真实事件、人物案例、纠纷案例 → type: "case"',
  data_hint: '如果内容涉及统计数据、法规条文、对比表格 → type: "data"',
  story_hint: '如果内容是叙述性故事、经历分享 → type: "story"',
  quote_hint: '如果内容是权威观点、专家言论、名人名言 → type: "quote"',
};

// ==================== LLM 处理 ====================

export class LLMProcessor {
  /**
   * 批量处理互联网搜索结果 → 生成素材化格式
   *
   * @param items 互联网搜索结果（最多取前3条）
   * @param query 原始搜索词
   * @param workspaceId workspace ID（BYOK: 按工作空间选择 LLM Key）
   * @returns 每条结果对应一个 materialFormat
   */
  async processWebResults(
    items: WebSearchResultItem[],
    query: string,
    workspaceId: string
  ): Promise<{ materialFormats: MaterialFormat[]; summary: string }> {
    // 最多处理 3 条
    const batch = items.slice(0, 3);

    if (batch.length === 0) {
      return { materialFormats: [], summary: '' };
    }

    // P0-4: 使用 AbortController 真正中断超时请求
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
      console.warn('[LLMProcessor] LLM 调用超时 15s，已中断请求');
    }, 15000);

    try {
      // P0-2: 传入 workspaceId，遵守 BYOK 原则
      const { client: llm } = await createUserLLMClient(workspaceId, { timeout: 15000 });

      const messages: Message[] = [
        {
          role: 'system',
          content: `你是保险行业素材提炼专家。根据互联网搜索结果，提炼为可直接入库的素材。
输出严格的JSON格式，不要输出其他内容。

${Object.values(TYPE_HINT).join('\n')}

输出格式：
{
  "items": [
    {
      "title": "素材标题（15字以内）",
      "type": "case|data|story|quote",
      "content": "提炼后的核心内容（300字以内，保留关键数据和结论）",
      "sourceDesc": "来源描述（如：新华网）",
      "sourceUrl": "原文链接",
      "topicTags": ["标签1", "标签2"]
    }
  ],
  "summary": "综合概括（100字以内，汇总所有结果的核心要点）"
}`,
        },
        {
          role: 'user',
          content: `搜索词：${query}

搜索结果：
${batch.map((item, i) => `${i + 1}. [${item.siteName}] ${item.title}
   ${item.snippet}
   链接：${item.url}`).join('\n\n')}`,
        },
      ];

      // P0-4: 传递 signal 给 llm.invoke()，超时后真正中断 HTTP 请求
      // 使用 Record<string, unknown> 绕过 LLMConfig 类型限制（SDK 底层 fetch 支持 signal）
      const llmConfig: Record<string, unknown> = {
        model: 'doubao-seed-2-0-mini-260215',
        temperature: 0.2,
        signal: abortController.signal,
      };

      const result = await llm.invoke(messages, llmConfig as any);

      const text = result.content || '';
      return this.parseResponse(text, batch);
    } catch (error) {
      // AbortError 是我们主动中断，静默处理
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('[LLMProcessor] LLM 调用被超时中断，使用降级模式');
      } else {
        console.warn('[LLMProcessor] LLM 概括失败，使用降级模式:', error instanceof Error ? error.message : String(error));
      }
      return this.fallbackProcess(batch);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 解析 LLM 返回的 JSON（P2-2: 增强健壮性）
   *
   * 支持场景：
   * 1. 纯 JSON 对象
   * 2. ```json\n{...}\n``` 代码块
   * 3. 前导/后导解释文字 + JSON
   * 4. 嵌套在文本中的 JSON
   */
  private parseResponse(text: string, batch: WebSearchResultItem[]): { materialFormats: MaterialFormat[]; summary: string } {
    try {
      const jsonStr = this.extractJsonFromText(text);
      if (!jsonStr) {
        console.warn('[LLMProcessor] 未能从响应中提取 JSON，使用降级模式');
        return this.fallbackProcess(batch);
      }

      const parsed = JSON.parse(jsonStr);

      const items = Array.isArray(parsed.items) ? parsed.items : [];
      const summary = typeof parsed.summary === 'string' ? parsed.summary : '';

      const materialFormats: MaterialFormat[] = items.slice(0, batch.length).map((item: Record<string, unknown>, index: number) => ({
        title: String(item.title || batch[index]?.title || ''),
        type: this.normalizeType(String(item.type || 'data')),
        content: String(item.content || batch[index]?.snippet || ''),
        sourceDesc: String(item.sourceDesc || batch[index]?.siteName || ''),
        sourceUrl: String(item.sourceUrl || batch[index]?.url || ''),
        topicTags: Array.isArray(item.topicTags) ? item.topicTags.map(String) : [],
        sceneTags: Array.isArray(item.sceneTags) ? item.sceneTags.map(String) : [],
      }));

      return { materialFormats, summary };
    } catch {
      // JSON 解析失败，降级
      console.warn('[LLMProcessor] JSON 解析失败，使用降级模式');
      return this.fallbackProcess(batch);
    }
  }

  /**
   * 降级处理：直接用 snippet 作为 content
   */
  private fallbackProcess(batch: WebSearchResultItem[]): { materialFormats: MaterialFormat[]; summary: string } {
    const materialFormats: MaterialFormat[] = batch.map(item => ({
      title: item.title.slice(0, 30),
      type: 'data' as const,
      content: item.snippet,
      sourceDesc: item.siteName,
      sourceUrl: item.url,
      topicTags: [],
    }));

    const summary = batch.map(item => `${item.siteName}: ${item.snippet.slice(0, 50)}`).join('；');

    return { materialFormats, summary };
  }

  /**
   * 从 LLM 响应文本中提取 JSON 字符串（P2-2: 增强健壮性）
   *
   * 提取策略（按优先级）：
   * 1. 查找 ```json\n{...}\n``` 代码块
   * 2. 查找 ```\n{...}\n``` 简单代码块
   * 3. 使用栈匹配精确提取 JSON 对象
   * 4. 直接定位首尾大括号
   */
  private extractJsonFromText(text: string): string | null {
    const trimmed = text.trim();

    // 1. 查找 markdown 代码块（支持前导/后导文字）
    const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      const captured = codeBlockMatch[1].trim();
      if (captured.length > 10) {
        // 代码块内可能还有首尾大括号定位
        const firstBrace = captured.indexOf('{');
        const lastBrace = captured.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          return captured.slice(firstBrace, lastBrace + 1);
        }
        return captured;
      }
    }

    // 2. 栈匹配精确提取 JSON 对象（避免贪婪匹配问题）
    const stackResult = this.extractJsonWithStackMatching(trimmed);
    if (stackResult) return stackResult;

    // 3. 兜底：直接定位首尾大括号
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return trimmed.slice(firstBrace, lastBrace + 1);
    }

    return null;
  }

  /**
   * 栈匹配精确提取 JSON 对象（防止贪婪正则误匹配）
   */
  private extractJsonWithStackMatching(text: string): string | null {
    let startIndex = -1;
    let depth = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"' && !inString) {
        inString = true;
        continue;
      }

      if (char === '"' && inString) {
        inString = false;
        continue;
      }

      if (inString) continue;

      if (char === '{') {
        if (depth === 0) startIndex = i;
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0 && startIndex !== -1) {
          return text.slice(startIndex, i + 1);
        }
      }
    }

    return null;
  }

  /**
   * 标准化素材类型
   */
  private normalizeType(type: string): string {
    const validTypes = ['case', 'data', 'story', 'quote', 'opening', 'ending'];
    return validTypes.includes(type) ? type : 'data';
  }
}

/** 单例导出 */
export const llmProcessor = new LLMProcessor();

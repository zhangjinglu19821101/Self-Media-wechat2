/**
 * LLM 概括 + 素材化处理服务
 *
 * 将互联网搜索结果通过 LLM 加工为：
 * 1. 概括性内容（summarizedContent）
 * 2. 可直接入库的素材格式（materialFormat）
 *
 * 设计原则：
 * 1. 轻量模型：doubao-seed-1-6-lite（快+便宜）
 * 2. 超时短：15s 超时，不阻塞
 * 3. 降级安全：LLM 失败返回原始 snippet
 * 4. 最多处理 3 条：控制成本
 */

import { getPlatformLLM } from '@/lib/llm/factory';
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
   * @returns 每条结果对应一个 materialFormat
   */
  async processWebResults(
    items: WebSearchResultItem[],
    query: string
  ): Promise<{ materialFormats: MaterialFormat[]; summary: string }> {
    // 最多处理 3 条
    const batch = items.slice(0, 3);

    if (batch.length === 0) {
      return { materialFormats: [], summary: '' };
    }

    try {
      const llm = getPlatformLLM();

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

      // 15s 超时
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('LLM process timeout')), 15000)
      );

      const result = await Promise.race([
        llm.invoke(messages, { model: 'doubao-seed-1-6-lite', temperature: 0.2 }),
        timeoutPromise,
      ]);

      const text = result.content || '';
      return this.parseResponse(text, batch);
    } catch (error) {
      console.warn('[LLMProcessor] LLM 概括失败，使用降级模式:', error instanceof Error ? error.message : String(error));
      return this.fallbackProcess(batch);
    }
  }

  /**
   * 解析 LLM 返回的 JSON
   */
  private parseResponse(text: string, batch: WebSearchResultItem[]): { materialFormats: MaterialFormat[]; summary: string } {
    try {
      // 尝试从文本中提取 JSON
      let jsonStr = text.trim();

      // 去掉 markdown 代码块
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      // 尝试定位 JSON 对象的起止
      const firstBrace = jsonStr.indexOf('{');
      const lastBrace = jsonStr.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
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
   * 标准化素材类型
   */
  private normalizeType(type: string): string {
    const validTypes = ['case', 'data', 'story', 'quote', 'opening', 'ending'];
    return validTypes.includes(type) ? type : 'data';
  }
}

/** 单例导出 */
export const llmProcessor = new LLMProcessor();

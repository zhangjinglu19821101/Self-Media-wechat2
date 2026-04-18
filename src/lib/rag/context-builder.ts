// 上下文构建器
// 将检索到的文档构建成适合 LLM 理解的上下文格式

export interface BuildOptions {
  maxTokens?: number;
  format?: 'detailed' | 'concise' | 'summary';
  includeMetadata?: boolean;
}

export interface ContextDocument {
  text: string;
  metadata: any;
  score?: number;
}

/**
 * 上下文构建器
 */
export class ContextBuilder {
  /**
   * 构建上下文字符串
   */
  build(documents: any[], options: BuildOptions = {}): string {
    const {
      maxTokens = 2000,
      format = 'detailed',
      includeMetadata = true,
    } = options;

    if (!documents || documents.length === 0) {
      return '';
    }

    let context = '';
    let usedTokens = 0;

    console.log(`[ContextBuilder] 开始构建上下文，文档数量: ${documents.length}, 格式: ${format}`);

    // 根据格式构建上下文
    switch (format) {
      case 'detailed':
        context = this.buildDetailedContext(documents, includeMetadata);
        break;
      case 'concise':
        context = this.buildConciseContext(documents);
        break;
      case 'summary':
        context = this.buildSummaryContext(documents);
        break;
    }

    console.log(`[ContextBuilder] 上下文构建完成，长度: ${context.length} 字符`);

    // 如果超出长度限制，进行截断
    if (context.length > maxTokens) {
      console.log(`[ContextBuilder] 上下文超限，截断至 ${maxTokens} 字符`);
      context = this.truncateContext(context, maxTokens);
    }

    return context;
  }

  /**
   * 详细格式
   */
  private buildDetailedContext(documents: any[], includeMetadata: boolean): string {
    const sections = documents.map((doc, index) => {
      const score = doc.score ? `(相似度: ${(doc.score * 100).toFixed(1)}%)` : '';

      let metadataSection = '';
      if (includeMetadata && doc.metadata) {
        const source = doc.metadata.source || '未知';
        const title = doc.metadata.title || '无标题';
        metadataSection = `\n📋 来源: ${source}\n📄 标题: ${title}\n`;
      }

      return `【文档片段 ${index + 1}${score}】\n${metadataSection}\n${doc.text}\n`;
    });

    return sections.join('\n---\n');
  }

  /**
   * 简洁格式
   */
  private buildConciseContext(documents: any[]): string {
    const sections = documents.map((doc, index) => {
      // 提取关键信息
      const keyPoints = this.extractKeyPoints(doc.text);
      return `${index + 1}. ${keyPoints}`;
    });

    return sections.join('\n');
  }

  /**
   * 摘要格式
   */
  private buildSummaryContext(documents: any[]): string {
    return `基于 ${documents.length} 个相关文档片段的综合信息。\n\n` +
           `核心要点：\n${this.buildConciseContext(documents)}`;
  }

  /**
   * 提取关键点
   */
  private extractKeyPoints(text: string): string {
    // 简单实现：提取第一句话或前 100 个字符
    const firstSentence = text.split(/[。！？\n]/)[0];
    if (firstSentence.length <= 100) {
      return firstSentence;
    }
    return firstSentence.substring(0, 100) + '...';
  }

  /**
   * 截断上下文
   */
  private truncateContext(context: string, maxLength: number): string {
    if (context.length <= maxLength) {
      return context;
    }

    // 保留开头和结尾
    const keepStart = Math.floor(maxLength * 0.6);
    const keepEnd = Math.floor(maxLength * 0.4);

    const start = context.substring(0, keepStart);
    const end = context.substring(context.length - keepEnd);

    return `${start}\n\n...（内容已截断）...\n\n${end}`;
  }

  /**
   * 预估 token 数量（简单估算：中文 ≈ 1.5 字符/token）
   */
  estimateTokenCount(text: string): number {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  }
}

export const contextBuilder = new ContextBuilder();

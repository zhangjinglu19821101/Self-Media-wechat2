/**
 * 内容适配器
 * 
 * 将 insurance-d 输出的 HTML 文章适配为各平台的格式要求
 */

// ==================== 类型定义 ====================

export interface ArticleSource {
  title: string;
  content: string;           // HTML（insurance-d 输出格式）
  plainText: string;         // 纯文本
  images: Array<{ url: string; alt?: string }>;
  tags?: string[];
  wordCount: number;
}

export interface AdaptedContent {
  platform: string;
  title: string;
  body: string;              // 平台原生格式
  media: { urls: string[]; coverUrl?: string };
  extra: Record<string, any>;
}

// ==================== 适配器实现 ====================

export class ContentAdapter {
  /**
   * 主适配入口：根据目标平台列表批量适配
   */
  adaptAll(source: ArticleSource, platforms: string[]): Record<string, AdaptedContent> {
    const result: Record<string, AdaptedContent> = {};

    for (const platform of platforms) {
      switch (platform) {
        case 'wechat_official':
          result[platform] = this.adaptToWechat(source);
          break;
        case 'xiaohongshu':
          result[platform] = this.adaptToXiaohongshu(source);
          break;
        case 'zhihu':
          result[platform] = this.adaptToZhihu(source);
          break;
        default:
          console.warn(`[ContentAdapter] 不支持的平台: ${platform}`);
      }
    }

    return result;
  }

  /** 微信公众号：HTML 格式，标题 ≤64 字符 */
  adaptToWechat(source: ArticleSource): AdaptedContent {
    return {
      platform: 'wechat_official',
      title: this.truncate(source.title, 64),
      body: source.content,  // insurance-d 输出的 HTML 直接可用
      media: {
        urls: source.images.map(img => img.url),
        coverUrl: source.images[0]?.url,
      },
      extra: {
        digest: this.extractDigest(source.plainText, 120),
      },
    };
  }

  /** 小红书：纯文本 + 图片，标题 ≤20 字符，正文 ≤1000 字 */
  adaptToXiaohongshu(source: ArticleSource): AdaptedContent {
    const cleanText = this.htmlToPlainText(source.content);
    const segments = this.segmentText(cleanText, 200);
    const body = segments.join('\n\n');

    return {
      platform: 'xiaohongshu',
      title: this.truncate(source.title, 20),
      body: this.truncate(body, 1000),
      media: {
        urls: source.images.slice(0, 9).map(img => img.url),
        coverUrl: source.images[0]?.url,
      },
      extra: {
        topics: (source.tags || []).slice(0, 20),
      },
    };
  }

  /** 知乎：Markdown 格式，标题 ≤100 字符 */
  adaptToZhihu(source: ArticleSource): AdaptedContent {
    return {
      platform: 'zhihu',
      title: this.truncate(source.title, 100),
      body: this.htmlToMarkdown(source.content),
      media: {
        urls: source.images.slice(0, 9).map(img => img.url),
        coverUrl: source.images[0]?.url,
      },
      extra: {
        topics: (source.tags || []).slice(0, 5),
      },
    };
  }

  // ==================== 工具方法 ====================

  private truncate(text: string, maxLen: number): string {
    return text.length > maxLen ? text.slice(0, maxLen) : text;
  }

  private extractDigest(text: string, maxLen: number): string {
    const firstSentence = text.split(/[。！？\n]/)[0];
    return firstSentence.length > maxLen ? firstSentence.slice(0, maxLen) + '...' : firstSentence;
  }

  private htmlToPlainText(html: string): string {
    return html
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private htmlToMarkdown(html: string): string {
    return html
      .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, (_, p) => `\n## ${p}\n`)
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      .replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, '![]($1)')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n');
  }

  private segmentText(text: string, maxSegmentLen: number): string[] {
    const sentences = text.split(/[。！？]/);
    const segments: string[] = [];
    let current = '';

    for (const sentence of sentences) {
      if ((current + sentence).length > maxSegmentLen && current) {
        segments.push(current.trim());
        current = sentence;
      } else {
        current += sentence + '。';
      }
    }
    if (current) segments.push(current.trim());

    return segments;
  }
}

export const contentAdapter = new ContentAdapter();

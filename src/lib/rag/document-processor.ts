// 文档处理和分块

import { RAG_CONFIG } from './config';
import type { DocumentChunk } from './types';

export interface DocumentMetadata {
  source: string;
  title?: string;
  division?: string;
  platform?: string;
  category?: string;
  [key: string]: any;
}

export class DocumentProcessor {
  private maxChunkSize: number;
  private chunkOverlap: number;

  constructor({
    maxChunkSize = RAG_CONFIG.chunking.maxChunkSize,
    chunkOverlap = RAG_CONFIG.chunking.chunkOverlap,
  } = {}) {
    this.maxChunkSize = maxChunkSize;
    this.chunkOverlap = chunkOverlap;
  }

  /**
   * 将文档分割成多个 chunks
   */
  splitIntoChunks(
    text: string,
    metadata: DocumentMetadata
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];

    // 清理文本
    const cleanedText = this.cleanText(text);

    // 如果文本太短，直接作为一个chunk
    if (cleanedText.length <= this.maxChunkSize) {
      chunks.push({
        id: this.generateChunkId(),
        text: cleanedText,
        metadata,
      });
      return chunks;
    }

    // 按段落分割
    const paragraphs = cleanedText.split(/\n\n+/);
    let currentChunk = '';
    let currentChunks: string[] = [];

    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim();

      // 如果当前段落本身太长，按句子分割
      if (trimmedParagraph.length > this.maxChunkSize) {
        // 先保存之前的 chunk
        if (currentChunk.trim()) {
          currentChunks.push(currentChunk.trim());
          currentChunk = '';
        }

        // 分割长段落
        const sentences = trimmedParagraph.split(/(?<=[。！？.!?])/);
        for (const sentence of sentences) {
          const trimmedSentence = sentence.trim();
          if (!trimmedSentence) continue;

          if (currentChunk.length + trimmedSentence.length <= this.maxChunkSize) {
            currentChunk += trimmedSentence + ' ';
          } else {
            if (currentChunk.trim()) {
              currentChunks.push(currentChunk.trim());
            }
            currentChunk = trimmedSentence + ' ';
          }
        }
      } else {
        // 段落长度合适
        if (currentChunk.length + trimmedParagraph.length <= this.maxChunkSize) {
          currentChunk += trimmedParagraph + '\n\n';
        } else {
          // 当前chunk已满，保存并开始新的
          if (currentChunk.trim()) {
            currentChunks.push(currentChunk.trim());
          }
          currentChunk = trimmedParagraph + '\n\n';
        }
      }
    }

    // 保存最后一个 chunk
    if (currentChunk.trim()) {
      currentChunks.push(currentChunk.trim());
    }

    // 添加重叠（overlap）
    const overlappedChunks = this.addOverlap(currentChunks);

    // 创建 DocumentChunk 对象
    for (let i = 0; i < overlappedChunks.length; i++) {
      chunks.push({
        id: this.generateChunkId(),
        text: overlappedChunks[i],
        metadata: {
          ...metadata,
          chunkIndex: i,
          totalChunks: overlappedChunks.length,
        },
      });
    }

    return chunks;
  }

  /**
   * 批量处理文档
   */
  processBatch(
    documents: Array<{ text: string; metadata: DocumentMetadata }>
  ): DocumentChunk[] {
    const allChunks: DocumentChunk[] = [];

    for (const doc of documents) {
      const chunks = this.splitIntoChunks(doc.text, doc.metadata);
      allChunks.push(...chunks);
    }

    return allChunks;
  }

  /**
   * 清理文本
   */
  private cleanText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 添加重叠内容
   */
  private addOverlap(chunks: string[]): string[] {
    if (chunks.length <= 1 || this.chunkOverlap <= 0) {
      return chunks;
    }

    const overlapped: string[] = [chunks[0]];

    for (let i = 1; i < chunks.length; i++) {
      const prevChunk = chunks[i - 1];
      const currentChunk = chunks[i];

      // 获取前一个chunk的最后几个字符
      const overlapText = prevChunk.slice(-this.chunkOverlap);

      // 将overlap添加到当前chunk前面
      overlapped.push(overlapText + ' ' + currentChunk);
    }

    return overlapped;
  }

  /**
   * 生成 chunk ID
   */
  private generateChunkId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `chunk_${timestamp}_${random}`;
  }
}

/**
 * 创建默认的文档处理器
 */
export function createDocumentProcessor(): DocumentProcessor {
  return new DocumentProcessor();
}

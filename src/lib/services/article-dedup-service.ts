/**
 * 文章去重检测服务
 * 
 * 使用两层零成本方案：
 * 1. SHA-256 哈希 - 检测完全相同的文章
 * 2. SimHash 海明距离 - 检测近似相同的文章
 */

import { db } from '@/lib/db';
import { articleHashes } from '@/lib/db/schema/article-hashes';
import { eq, and, sql } from 'drizzle-orm';
import crypto from 'crypto';

// ================================================================
// 类型定义
// ================================================================

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateType: 'exact' | 'similar' | 'none';
  cachedAnalysis?: any;       // 缓存的分析结果
  existingRecord?: {
    id: string;
    articleTitle?: string;
    createdAt: Date;
    templateId?: string;
  };
  similarity?: number;        // 相似度（0-1）
}

export interface ArticleHashInput {
  articleText: string;
  articleTitle?: string;
  userId?: string;
  templateId?: string;
}

export interface ArticleHashRecord {
  sha256: string;
  simHash: string;  // 🔥 修复：改为 string 类型，避免 BIGINT 溢出
  contentLength: number;
}

// ================================================================
// 常量定义
// ================================================================

/** 第2层查询的最大文章数量（性能保护） */
const MAX_ARTICLES_TO_COMPARE = 500;

/** 最小文章长度（输入校验） */
const MIN_ARTICLE_LENGTH = 50;

/** 最大文章长度（输入校验） */
const MAX_ARTICLE_LENGTH = 100000;

/** 海明距离阈值（≤3 认为是近似重复） */
const HAMMING_DISTANCE_THRESHOLD = 3;

// ================================================================
// 文本规范化
// ================================================================

/**
 * 文本规范化
 * 
 * 用于计算"格式无关"的哈希值：
 * - 去除所有空白字符（空格、换行、制表符）
 * - 统一转小写
 * - 只保留中文、英文、数字
 * 
 * 这样即使文章格式调整（加换行、改空格），只要核心内容相同，
 * 规范化后的哈希值仍然相同，能被第1层拦截。
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()                          // 统一小写
    .replace(/<[^>]+>/g, '')                // 移除 HTML 标签
    .replace(/[\s\n\r\t]+/g, '')            // 移除所有空白字符
    .replace(/[^\w\u4e00-\u9fa5]/g, '')     // 只保留字母数字和中文
    .trim();
}

// ================================================================
// 哈希计算函数
// ================================================================

/**
 * 计算 SHA-256 哈希
 */
export function calculateSHA256(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * 简单的分词函数（中英文混合）
 */
function tokenize(text: string): string[] {
  const tokens: string[] = [];
  
  // 移除 HTML 标签
  const cleanText = text.replace(/<[^>]+>/g, ' ');
  
  // 中文分词（按字符，每2-4个字符作为一个token）
  const chineseChars = cleanText.match(/[\u4e00-\u9fa5]+/g) || [];
  for (const segment of chineseChars) {
    // 滑动窗口提取 2-gram 和 3-gram
    for (let i = 0; i < segment.length - 1; i++) {
      tokens.push(segment.slice(i, i + 2));
    }
    for (let i = 0; i < segment.length - 2; i++) {
      tokens.push(segment.slice(i, i + 3));
    }
  }
  
  // 英文分词（按空格和标点）
  const englishWords = cleanText.match(/[a-zA-Z]+/g) || [];
  tokens.push(...englishWords.filter((w: string) => w.length > 2));
  
  // 数字
  const numbers = cleanText.match(/\d+/g) || [];
  tokens.push(...numbers);
  
  return tokens;
}

/**
 * MurmurHash3 (32位) - 用于 SimHash
 */
function murmurHash3(str: string, seed: number = 0): number {
  let h = seed >>> 0;
  const c1 = 0xcc9e2d51;
  const c2 = 0x1b873593;
  
  for (let i = 0; i < str.length; i++) {
    let k = str.charCodeAt(i);
    k = Math.imul(k, c1);
    k = (k << 15) | (k >>> 17);
    k = Math.imul(k, c2);
    h ^= k;
    h = (h << 13) | (h >>> 19);
    h = Math.imul(h, 5) + 0xe6546b64;
  }
  
  h ^= str.length;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  
  return h >>> 0;
}

/**
 * 计算 SimHash 指纹（64位）
 * 返回 bigint 类型的 64 位指纹
 */
export function calculateSimHash(text: string): bigint {
  const tokens = tokenize(text);
  
  if (tokens.length === 0) {
    return BigInt(0);
  }
  
  // 64 位权重数组
  const weights = new Array(64).fill(0);
  
  // 统计每个 token 对每一位的贡献
  for (const token of tokens) {
    // 使用两个 32 位哈希组成 64 位
    const hash1 = murmurHash3(token, 0);
    const hash2 = murmurHash3(token, hash1);
    
    // 高 32 位
    for (let i = 0; i < 32; i++) {
      const bit = (hash1 >>> i) & 1;
      weights[i] += bit ? 1 : -1;
    }
    
    // 低 32 位
    for (let i = 0; i < 32; i++) {
      const bit = (hash2 >>> i) & 1;
      weights[32 + i] += bit ? 1 : -1;
    }
  }
  
  // 生成最终指纹
  let fingerprint = BigInt(0);
  for (let i = 0; i < 64; i++) {
    if (weights[i] > 0) {
      fingerprint = fingerprint | (BigInt(1) << BigInt(i));
    }
  }
  
  return fingerprint;
}

/**
 * 计算海明距离（两个 SimHash 指纹的不同位数）
 */
export function hammingDistance(a: bigint, b: bigint): number {
  // 异或后统计 1 的个数
  const xor = a ^ b;
  
  // 使用 Brian Kernighan 算法计数
  let count = 0;
  let n = xor;
  while (n > BigInt(0)) {
    n = n & (n - BigInt(1));
    count++;
  }
  
  return count;
}

/**
 * 计算相似度（基于海明距离）
 * 相似度 = 1 - (海明距离 / 64)
 */
export function calculateSimilarity(distance: number): number {
  return 1 - distance / 64;
}

// ================================================================
// 数据库操作
// ================================================================

/**
 * 输入校验
 */
function validateArticleText(articleText: string): { valid: boolean; error?: string } {
  if (!articleText || typeof articleText !== 'string') {
    return { valid: false, error: '文章内容不能为空' };
  }
  
  const trimmed = articleText.trim();
  if (trimmed.length < MIN_ARTICLE_LENGTH) {
    return { valid: false, error: `文章内容至少需要 ${MIN_ARTICLE_LENGTH} 个字符` };
  }
  
  if (trimmed.length > MAX_ARTICLE_LENGTH) {
    return { valid: false, error: `文章内容不能超过 ${MAX_ARTICLE_LENGTH} 个字符` };
  }
  
  return { valid: true };
}

/**
 * 检查文章是否重复
 * 
 * 三层检测机制：
 * 1. 规范化 SHA-256 - 检测格式不同但内容相同的文章（加换行、改空格等）
 * 2. 原始 SHA-256 - 检测完全相同的文章
 * 3. SimHash 海明距离 - 检测内容相近的文章
 * 
 * @param articleText 文章内容
 * @param userId 用户ID（用于用户隔离）
 * @returns DuplicateCheckResult 检测结果
 */
export async function checkArticleDuplicate(
  articleText: string,
  userId?: string
): Promise<DuplicateCheckResult> {
  // 🔥 P2 修复：输入校验
  const validation = validateArticleText(articleText);
  if (!validation.valid) {
    console.warn('[ArticleDedup] 输入校验失败:', validation.error);
    return {
      isDuplicate: false,
      duplicateType: 'none',
    };
  }
  
  // 计算三个哈希值
  const sha256 = calculateSHA256(articleText);
  const normalizedText = normalizeText(articleText);
  const normalizedSha256 = calculateSHA256(normalizedText);
  const simHash = calculateSimHash(articleText);
  const contentLength = articleText.length;
  
  console.log('[ArticleDedup] 检查文章去重:', {
    sha256: sha256.slice(0, 16) + '...',
    normalizedSha256: normalizedSha256.slice(0, 16) + '...',
    normalizedLength: normalizedText.length,
    simHash: simHash.toString(),
    contentLength,
    userId: userId || '未指定',
  });
  
  // 🔥 第1层：检查规范化 SHA-256 匹配（格式无关匹配）
  // 这能拦截"加几个换行符、格式调整一下"的文章
  const normalizedWhereClause = userId
    ? and(eq(articleHashes.normalizedSha256, normalizedSha256), eq(articleHashes.workspaceId, userId))
    : eq(articleHashes.normalizedSha256, normalizedSha256);
  
  const normalizedMatch = await db
    .select()
    .from(articleHashes)
    .where(normalizedWhereClause)
    .limit(1);
  
  if (normalizedMatch.length > 0) {
    const record = normalizedMatch[0];
    console.log('[ArticleDedup] 发现规范化匹配的文章（格式不同，内容相同）:', record.articleTitle);
    
    return {
      isDuplicate: true,
      duplicateType: 'exact',  // 内容完全相同，算精确匹配
      cachedAnalysis: record.cachedAnalysis,
      existingRecord: {
        id: record.id,
        articleTitle: record.articleTitle || undefined,
        createdAt: record.createdAt,
        templateId: record.templateId || undefined,
      },
      similarity: 1.0,
    };
  }
  
  // 🔥 第2层：检查原始 SHA-256 完全匹配（保留兼容）
  const sha256WhereClause = userId
    ? and(eq(articleHashes.sha256, sha256), eq(articleHashes.workspaceId, userId))
    : eq(articleHashes.sha256, sha256);
  
  const exactMatch = await db
    .select()
    .from(articleHashes)
    .where(sha256WhereClause)
    .limit(1);
  
  if (exactMatch.length > 0) {
    const record = exactMatch[0];
    console.log('[ArticleDedup] 发现完全匹配的文章:', record.articleTitle);
    
    return {
      isDuplicate: true,
      duplicateType: 'exact',
      cachedAnalysis: record.cachedAnalysis,
      existingRecord: {
        id: record.id,
        articleTitle: record.articleTitle || undefined,
        createdAt: record.createdAt,
        templateId: record.templateId || undefined,
      },
      similarity: 1.0,
    };
  }
  
  // 🔥 第3层：检查 SimHash 近似匹配
  // 🔥 P1 修复：限制查询数量，避免 O(N) 性能问题
  const simHashWhereClause = userId
    ? eq(articleHashes.workspaceId, userId)
    : undefined;
  
  const allHashes = simHashWhereClause
    ? await db.select()
        .from(articleHashes)
        .where(simHashWhereClause)
        .limit(MAX_ARTICLES_TO_COMPARE)
    : await db.select()
        .from(articleHashes)
        .limit(MAX_ARTICLES_TO_COMPARE);
  
  // 🔥 P1 修复：记录查询数量，便于监控
  console.log(`[ArticleDedup] 第3层比较: 查询到 ${allHashes.length} 篇文章`);
  
  for (const record of allHashes) {
    // 🔥 修复：将字符串转回 bigint 进行比较
    const recordSimHash = typeof record.simHash === 'string' 
      ? BigInt(record.simHash) 
      : record.simHash;
    const distance = hammingDistance(simHash, recordSimHash);
    const similarity = calculateSimilarity(distance);
    
    // 海明距离 ≤ 阈值 认为是近似重复
    if (distance <= HAMMING_DISTANCE_THRESHOLD) {
      console.log('[ArticleDedup] 发现近似匹配的文章:', {
        existingTitle: record.articleTitle,
        distance,
        similarity: (similarity * 100).toFixed(1) + '%',
      });
      
      return {
        isDuplicate: true,
        duplicateType: 'similar',
        cachedAnalysis: record.cachedAnalysis,
        existingRecord: {
          id: record.id,
          articleTitle: record.articleTitle || undefined,
          createdAt: record.createdAt,
          templateId: record.templateId || undefined,
        },
        similarity,
      };
    }
  }
  
  console.log('[ArticleDedup] 未发现重复文章');
  return {
    isDuplicate: false,
    duplicateType: 'none',
  };
}

/**
 * 保存文章哈希记录
 * 
 * @param input 文章哈希输入参数
 * @throws 输入校验失败时抛出错误
 */
export async function saveArticleHash(
  input: ArticleHashInput & { analysis?: any }
): Promise<void> {
  const { articleText, articleTitle, userId, templateId, analysis } = input;
  
  // 🔥 P2 修复：输入校验
  const validation = validateArticleText(articleText);
  if (!validation.valid) {
    throw new Error(`[ArticleDedup] 输入校验失败: ${validation.error}`);
  }
  
  // 计算三个哈希值
  const sha256 = calculateSHA256(articleText);
  const normalizedText = normalizeText(articleText);
  const normalizedSha256 = calculateSHA256(normalizedText);
  const simHash = calculateSimHash(articleText);
  const contentLength = articleText.length;
  
  console.log('[ArticleDedup] 保存文章哈希:', {
    sha256: sha256.slice(0, 16) + '...',
    normalizedSha256: normalizedSha256.slice(0, 16) + '...',
    articleTitle,
    templateId,
    userId: userId || '未指定',
  });
  
  // 检查是否已存在（先检查规范化哈希，再检查原始哈希）
  const existing = await db
    .select()
    .from(articleHashes)
    .where(eq(articleHashes.normalizedSha256, normalizedSha256))
    .limit(1);
  
  if (existing.length > 0) {
    console.log('[ArticleDedup] 文章哈希已存在（规范化匹配），更新缓存');
    await db
      .update(articleHashes)
      .set({
        cachedAnalysis: analysis || null,
        templateId: templateId || null,
        updatedAt: new Date(),
      })
      .where(eq(articleHashes.id, existing[0].id));
    return;
  }
  
  await db.insert(articleHashes).values({
    workspaceId: userId || null,  // userId 语义上即 workspaceId
    articleTitle: articleTitle || null,
    sha256,
    normalizedSha256,  // 🔥 新增：存储规范化哈希
    simHash: simHash.toString(),  // 🔥 修复：转换为字符串存储，避免 BIGINT 溢出
    contentLength,
    templateId: templateId || null,
    cachedAnalysis: analysis || null,
  });
}

/**
 * 更新文章哈希记录的缓存分析结果
 */
export async function updateArticleHashAnalysis(
  sha256: string,
  analysis: any
): Promise<void> {
  await db
    .update(articleHashes)
    .set({
      cachedAnalysis: analysis,
      updatedAt: new Date(),
    })
    .where(eq(articleHashes.sha256, sha256));
}

// ================================================================
// 导出服务实例
// ================================================================

export const articleDedupService = {
  checkArticleDuplicate,
  saveArticleHash,
  updateArticleHashAnalysis,
  calculateSHA256,
  calculateSimHash,
  hammingDistance,
  calculateSimilarity,
};

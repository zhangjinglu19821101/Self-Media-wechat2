/**
 * 小红书卡片对象存储服务
 * 
 * 负责将小红书卡片图片上传到对象存储（S3 兼容）
 * 
 * 设计原则：
 * 1. 持久化存储 key，而非 URL（避免 URL 过期问题）
 * 2. 使用时动态生成签名 URL
 * 3. 文件名规范：xhs-cards/{subTaskId}/{cardIndex}.png
 */

import { S3Storage } from 'coze-coding-dev-sdk';
import { db } from '@/lib/db';
import { xhsCards, xhsCardGroups } from '@/lib/db/schema/xhs-cards';
import { eq, and, inArray } from 'drizzle-orm';
import type { XhsCard, NewXhsCard, XhsCardGroup, NewXhsCardGroup } from '@/lib/db/schema/xhs-cards';

// S3 存储客户端（单例）
let storageInstance: S3Storage | null = null;

/**
 * 获取 S3 存储客户端实例
 */
function getStorage(): S3Storage {
  if (!storageInstance) {
    storageInstance = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: '',
      secretKey: '',
      bucketName: process.env.COZE_BUCKET_NAME,
      region: 'cn-beijing',
    });
  }
  return storageInstance;
}

/**
 * 卡片上传结果
 */
export interface CardUploadResult {
  cardId: string;       // 数据库记录 ID
  storageKey: string;   // 对象存储 key
  signedUrl: string;    // 签名 URL（有效期 7 天）
  width: number;
  height: number;
}

/**
 * 卡片组上传结果
 */
export interface CardGroupUploadResult {
  groupId: string;      // 卡片组 ID
  totalCards: number;   // 总卡片数
  cards: CardUploadResult[];
}

/**
 * 上传单张卡片图片到对象存储
 * 
 * @param base64Data - Base64 编码的图片数据（不含 data:image/png;base64, 前缀）
 * @param subTaskId - 子任务 ID
 * @param cardIndex - 卡片序号（0=封面，1/2/3=要点，最后=结尾）
 * @param options - 可选参数
 */
export async function uploadXhsCard(
  base64Data: string,
  subTaskId: string,
  cardIndex: number,
  options: {
    cardType?: 'cover' | 'point' | 'ending';
    titleSnapshot?: string;
    contentSnapshot?: string;
    gradientScheme?: string;
    workspaceId?: string;
    commandResultId?: string;
  } = {}
): Promise<CardUploadResult> {
  const storage = getStorage();
  
  // 生成对象存储 key
  const fileName = `xhs-cards/${subTaskId}/${cardIndex}.png`;
  
  // Base64 → Buffer
  const buffer = Buffer.from(base64Data, 'base64');
  
  // 上传到对象存储
  const storageKey = await storage.uploadFile({
    fileContent: buffer,
    fileName,
    contentType: 'image/png',
  });
  
  console.log(`[XhsStorage] 上传卡片成功: ${storageKey}, 大小: ${buffer.length} bytes`);
  
  // 生成签名 URL（有效期 7 天 = 604800 秒）
  const signedUrl = await storage.generatePresignedUrl({
    key: storageKey,
    expireTime: 604800,
  });
  
  // 写入数据库
  const [cardRecord] = await db.insert(xhsCards).values({
    subTaskId,
    commandResultId: options.commandResultId,
    cardIndex,
    cardType: options.cardType || 'point',
    storageKey,
    fileFormat: 'png',
    titleSnapshot: options.titleSnapshot?.slice(0, 100),
    contentSnapshot: options.contentSnapshot?.slice(0, 500),
    width: 1080,
    height: 1440,
    fileSize: buffer.length,
    gradientScheme: options.gradientScheme,
    status: 'active',
    isPublic: true,
    workspaceId: options.workspaceId,
  }).returning();
  
  return {
    cardId: cardRecord.id,
    storageKey,
    signedUrl,
    width: 1080,
    height: 1440,
  };
}

/**
 * 批量上传卡片组
 * 
 * @param cards - 卡片数据数组（Base64）
 * @param subTaskId - 子任务 ID
 * @param options - 可选参数
 */
export async function uploadXhsCardGroup(
  cards: Array<{
    base64: string;
    cardType: 'cover' | 'point' | 'ending';
    title?: string;
    content?: string;
  }>,
  subTaskId: string,
  options: {
    cardCountMode?: '3-card' | '5-card' | '7-card';
    gradientScheme?: string;
    articleTitle?: string;
    articleIntro?: string;
    workspaceId?: string;
    commandResultId?: string;
  } = {}
): Promise<CardGroupUploadResult> {
  const uploadResults: CardUploadResult[] = [];
  
  // 逐张上传卡片
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const result = await uploadXhsCard(
      card.base64,
      subTaskId,
      i,
      {
        cardType: card.cardType,
        titleSnapshot: card.title,
        contentSnapshot: card.content,
        gradientScheme: options.gradientScheme,
        workspaceId: options.workspaceId,
        commandResultId: options.commandResultId,
      }
    );
    uploadResults.push(result);
  }
  
  // 创建卡片组记录
  const [groupRecord] = await db.insert(xhsCardGroups).values({
    subTaskId,
    commandResultId: options.commandResultId,
    totalCards: cards.length,
    cardCountMode: options.cardCountMode || '5-card',
    gradientScheme: options.gradientScheme,
    articleTitle: options.articleTitle,
    articleIntro: options.articleIntro,
    cardIds: JSON.stringify(uploadResults.map(r => r.cardId)),
    status: 'active',
    workspaceId: options.workspaceId,
  }).returning();
  
  return {
    groupId: groupRecord.id,
    totalCards: cards.length,
    cards: uploadResults,
  };
}

/**
 * 获取卡片的签名 URL
 * 
 * @param cardId - 卡片记录 ID
 * @param expireTime - 有效期（秒），默认 7 天
 */
export async function getCardSignedUrl(
  cardId: string,
  expireTime: number = 604800
): Promise<string | null> {
  // 查询卡片记录
  const [card] = await db.select().from(xhsCards).where(eq(xhsCards.id, cardId)).limit(1);
  
  if (!card || card.status !== 'active') {
    return null;
  }
  
  // 生成签名 URL
  const storage = getStorage();
  return storage.generatePresignedUrl({
    key: card.storageKey,
    expireTime,
  });
}

/**
 * 批量获取卡片的签名 URL
 * 
 * @param cardIds - 卡片记录 ID 数组
 * @param expireTime - 有效期（秒），默认 7 天
 */
export async function getCardSignedUrls(
  cardIds: string[],
  expireTime: number = 604800
): Promise<Record<string, string>> {
  if (cardIds.length === 0) return {};
  
  // 查询卡片记录
  const cards = await db.select().from(xhsCards).where(
    and(
      inArray(xhsCards.id, cardIds),
      eq(xhsCards.status, 'active')
    )
  );
  
  const storage = getStorage();
  const result: Record<string, string> = {};
  
  for (const card of cards) {
    const signedUrl = await storage.generatePresignedUrl({
      key: card.storageKey,
      expireTime,
    });
    result[card.id] = signedUrl;
  }
  
  return result;
}

/**
 * 根据 subTaskId 获取卡片组的所有卡片 URL
 * 
 * @param subTaskId - 子任务 ID
 * @param expireTime - 有效期（秒），默认 7 天
 */
export async function getCardGroupUrlsBySubTaskId(
  subTaskId: string,
  expireTime: number = 604800
): Promise<Array<{
  cardId: string;
  cardIndex: number;
  cardType: string;
  signedUrl: string;
  titleSnapshot: string | null;
}>> {
  // 查询卡片组
  const [group] = await db.select().from(xhsCardGroups).where(
    eq(xhsCardGroups.subTaskId, subTaskId)
  ).limit(1);
  
  if (!group) {
    return [];
  }
  
  // 解析卡片 ID 列表
  const cardIds: string[] = JSON.parse(group.cardIds || '[]');
  
  if (cardIds.length === 0) {
    return [];
  }
  
  // 查询卡片记录
  const cards = await db.select().from(xhsCards).where(
    and(
      inArray(xhsCards.id, cardIds),
      eq(xhsCards.status, 'active')
    )
  );
  
  const storage = getStorage();
  const result: Array<{
    cardId: string;
    cardIndex: number;
    cardType: string;
    signedUrl: string;
    titleSnapshot: string | null;
  }> = [];
  
  // 按 cardIndex 排序
  cards.sort((a, b) => a.cardIndex - b.cardIndex);
  
  for (const card of cards) {
    const signedUrl = await storage.generatePresignedUrl({
      key: card.storageKey,
      expireTime,
    });
    result.push({
      cardId: card.id,
      cardIndex: card.cardIndex,
      cardType: card.cardType,
      signedUrl,
      titleSnapshot: card.titleSnapshot,
    });
  }
  
  return result;
}

/**
 * 删除卡片（软删除：标记状态为 expired）
 * 
 * @param cardId - 卡片记录 ID
 */
export async function deleteCard(cardId: string): Promise<boolean> {
  const [updated] = await db.update(xhsCards)
    .set({ status: 'expired', updatedAt: new Date() })
    .where(eq(xhsCards.id, cardId))
    .returning();
  
  return !!updated;
}

/**
 * 清理过期卡片（物理删除对象存储文件 + 数据库记录）
 * 
 * @param beforeDate - 过期时间阈值
 */
export async function cleanupExpiredCards(beforeDate: Date): Promise<number> {
  const storage = getStorage();
  
  // 查询过期卡片
  const expiredCards = await db.select().from(xhsCards).where(
    and(
      eq(xhsCards.status, 'expired'),
      // @ts-ignore - Drizzle 类型推断问题
      sql`${xhsCards.expiresAt} < ${beforeDate}`
    )
  );
  
  let deletedCount = 0;
  
  for (const card of expiredCards) {
    try {
      // 删除对象存储文件
      await storage.deleteFile({ fileKey: card.storageKey });
      
      // 删除数据库记录
      await db.delete(xhsCards).where(eq(xhsCards.id, card.id));
      
      deletedCount++;
    } catch (error) {
      console.error(`[XhsStorage] 删除卡片失败: ${card.id}`, error);
    }
  }
  
  return deletedCount;
}

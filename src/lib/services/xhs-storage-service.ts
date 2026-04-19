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
import { eq, and, inArray, sql } from 'drizzle-orm';
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
  const signedUrl: string = await storage.generatePresignedUrl({
    key: storageKey,
    expireTime: 604800,
  }) as string;
  
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
 * P1 修复：增加错误处理和部分失败支持
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
  const failedIndices: number[] = [];
  const storage = getStorage();
  
  console.log(`[XhsStorage] 开始上传卡片组, 共 ${cards.length} 张卡片, subTaskId: ${subTaskId}`);
  
  // 逐张上传卡片，捕获单张失败不影响整体
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    console.log(`[XhsStorage] 上传卡片 ${i}: cardType=${card.cardType}, base64长度=${card.base64?.length || 0}`);
    try {
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
      console.log(`[XhsStorage] 卡片 ${i} 上传成功, storageKey: ${result.storageKey}`);
    } catch (error) {
      console.error(`[XhsStorage] 上传卡片 ${i} 失败:`, error);
      failedIndices.push(i);
    }
  }
  
  console.log(`[XhsStorage] 上传完成: 成功 ${uploadResults.length} 张, 失败 ${failedIndices.length} 张`);
  
  // 检查 storageKey 是否唯一
  const storageKeys = uploadResults.map(r => r.storageKey);
  const uniqueKeys = new Set(storageKeys);
  if (uniqueKeys.size !== storageKeys.length) {
    console.error(`[XhsStorage] ❌ 错误：storageKey 不唯一！keys: ${storageKeys.join(', ')}`);
  } else {
    console.log(`[XhsStorage] ✅ 所有 storageKey 唯一`);
  }
  
  // P1 修复：如果全部失败，抛出错误
  if (uploadResults.length === 0) {
    throw new Error('所有卡片上传失败');
  }
  
  // 🔥 P0 修复：创建新卡片组前，将同 subTaskId 的旧卡片组标记为 superseded
  // 同时将旧卡片组关联的卡片标记为 inactive，避免数据累积和读取混乱
  try {
    const oldGroups = await db.select({
      id: xhsCardGroups.id,
      cardIds: xhsCardGroups.cardIds,
    }).from(xhsCardGroups).where(
      and(
        eq(xhsCardGroups.subTaskId, subTaskId),
        eq(xhsCardGroups.status, 'active')
      )
    );
    
    if (oldGroups.length > 0) {
      const now = new Date();
      
      // 1. 收集旧卡片 ID
      const oldGroupIds = oldGroups.map(g => g.id);
      const oldCardIds: string[] = [];
      for (const g of oldGroups) {
        try {
          const ids: string[] = JSON.parse(g.cardIds || '[]');
          oldCardIds.push(...ids);
        } catch { /* 忽略 JSON 解析失败 */ }
      }
      
      // 🔥 P1 修复：使用数据库事务保证组和卡片状态更新的原子性
      await db.transaction(async (tx) => {
        // 标记旧卡片组为 superseded
        await tx.update(xhsCardGroups)
          .set({ status: 'superseded', updatedAt: now })
          .where(inArray(xhsCardGroups.id, oldGroupIds));
        
        // 标记旧卡片为 inactive
        if (oldCardIds.length > 0) {
          await tx.update(xhsCards)
            .set({ status: 'inactive', updatedAt: now })
            .where(inArray(xhsCards.id, oldCardIds));
        }
      });
      
      console.log(`[XhsStorage] 已标记 ${oldGroupIds.length} 个旧卡片组为 superseded, ${oldCardIds.length} 张旧卡片为 inactive`);
    }
  } catch (error) {
    // 旧组标记失败不阻塞新组创建，仅记录警告
    console.warn(`[XhsStorage] 标记旧卡片组为 superseded 失败（不阻塞新组创建）:`, error);
  }
  
  // 确定状态：全部成功=active，部分失败=partial
  const groupStatus = failedIndices.length === 0 ? 'active' : 'partial';
  
  // 创建卡片组记录
  const [groupRecord] = await db.insert(xhsCardGroups).values({
    subTaskId,
    commandResultId: options.commandResultId,
    totalCards: uploadResults.length,  // 实际成功的卡片数
    cardCountMode: options.cardCountMode || '5-card',
    gradientScheme: options.gradientScheme,
    articleTitle: options.articleTitle,
    articleIntro: options.articleIntro,
    cardIds: JSON.stringify(uploadResults.map(r => r.cardId)),
    status: groupStatus,
    workspaceId: options.workspaceId,
  }).returning();
  
  // 如果有失败的，记录警告日志
  if (failedIndices.length > 0) {
    console.warn(`[XhsStorage] 卡片组 ${groupRecord.id} 部分上传失败，失败索引: ${failedIndices.join(', ')}`);
  }
  
  return {
    groupId: groupRecord.id,
    totalCards: uploadResults.length,
    cards: uploadResults,
  };
}

/**
 * 获取卡片的签名 URL
 * 
 * @param cardId - 卡片记录 ID
 * @param expireTime - 有效期（秒），默认 7 天
 * @param workspaceId - 工作空间 ID（可选，用于权限验证）
 */
export async function getCardSignedUrl(
  cardId: string,
  expireTime: number = 604800,
  workspaceId?: string
): Promise<string | null> {
  // 构建查询条件（P2-3 修复：支持 workspaceId 验证）
  const whereCondition = workspaceId
    ? and(eq(xhsCards.id, cardId), eq(xhsCards.workspaceId, workspaceId))
    : eq(xhsCards.id, cardId);
  
  // 查询卡片记录
  const [card] = await db.select().from(xhsCards).where(whereCondition).limit(1);
  
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
 * @param workspaceId - 工作空间 ID（可选，用于权限验证）
 */
export async function getCardSignedUrls(
  cardIds: string[],
  expireTime: number = 604800,
  workspaceId?: string
): Promise<Record<string, string>> {
  if (cardIds.length === 0) return {};
  
  // 构建查询条件（P2-3 修复：支持 workspaceId 验证）
  const whereCondition = workspaceId
    ? and(
        inArray(xhsCards.id, cardIds),
        eq(xhsCards.status, 'active'),
        eq(xhsCards.workspaceId, workspaceId)
      )
    : and(
        inArray(xhsCards.id, cardIds),
        eq(xhsCards.status, 'active')
      );
  
  // 查询卡片记录
  const cards = await db.select().from(xhsCards).where(whereCondition);
  
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
 * @param workspaceId - 工作空间 ID（可选，用于权限验证）
 */
export async function getCardGroupUrlsBySubTaskId(
  subTaskId: string,
  expireTime: number = 604800,
  workspaceId?: string
): Promise<Array<{
  cardId: string;
  cardIndex: number;
  cardType: string;
  signedUrl: string;
  titleSnapshot: string | null;
}>> {
  // 构建查询条件
  // 🔥 P0 修复：增加 status='active' 过滤，只获取有效的卡片组（排除 superseded/partial/failed）
  const baseConditions = workspaceId
    ? and(eq(xhsCardGroups.subTaskId, subTaskId), eq(xhsCardGroups.workspaceId, workspaceId))
    : eq(xhsCardGroups.subTaskId, subTaskId);
  const whereConditions = and(baseConditions, eq(xhsCardGroups.status, 'active'));
  
  // 按创建时间倒序获取最新的有效卡片组
  // 🔥 P2 修复：统一使用解构语法
  const [group] = await db.select().from(xhsCardGroups)
    .where(whereConditions)
    .orderBy(sql`${xhsCardGroups.createdAt} DESC`)
    .limit(1);
  
  if (!group) {
    return [];
  }
  
  // 解析卡片 ID 列表
  const cardIds: string[] = JSON.parse(group.cardIds || '[]');
  
  if (cardIds.length === 0) {
    return [];
  }
  
  // 查询卡片记录
  // 🔥 P1 修复：防御性查询 - 卡片组是 active 时，关联卡片应该可用
  // 同时接受 active 和 inactive 状态（inactive 可能是历史数据残留）
  // 但排除 expired（文件已删除）和 failed（上传失败）
  const cards = await db.select().from(xhsCards).where(
    and(
      inArray(xhsCards.id, cardIds),
      sql`${xhsCards.status} IN ('active', 'inactive')`
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
  
  // 查询过期卡片（状态为 expired 且过期时间早于阈值）
  const expiredCards = await db.select().from(xhsCards).where(
    and(
      eq(xhsCards.status, 'expired'),
      sql`${xhsCards.expiresAt} IS NOT NULL AND ${xhsCards.expiresAt} < ${beforeDate}`
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

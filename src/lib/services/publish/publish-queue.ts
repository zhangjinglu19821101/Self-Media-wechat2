/**
 * 发布队列服务
 * 
 * 使用数据库作为持久化存储，支持失败重试和定时发布
 */

import { db } from '@/lib/db';
import { publishRecords, PUBLISH_STATUS } from '@/lib/db/schema/publish-records';
import { eq, and, lte, or } from 'drizzle-orm';

class PublishQueueService {
  /**
   * 提交发布任务
   */
  async submit(params: {
    workspaceId: string;
    subTaskId?: string;
    platforms: Array<{ platform: string; accountId?: string }>;
    adaptedContents: Record<string, any>;
    scheduledAt?: Date;
    submittedBy: string;
  }): Promise<string[]> {
    const recordIds: string[] = [];

    for (const { platform, accountId } of params.platforms) {
      const adapted = params.adaptedContents[platform];
      if (!adapted) continue;

      const [record] = await db.insert(publishRecords).values({
        workspaceId: params.workspaceId,
        createdBy: params.submittedBy,
        subTaskId: params.subTaskId || null,
        platform,
        accountId: accountId || null,
        title: adapted.title || '',
        contentPreview: (adapted.body || '').substring(0, 500),
        adaptedContent: adapted,
        status: params.scheduledAt ? 'scheduled' : 'pending',
        scheduledAt: params.scheduledAt || null,
      }).returning();

      if (record) {
        recordIds.push(record.id);
      }
    }

    return recordIds;
  }

  /**
   * 处理单个发布记录
   * 当前版本：标记为 published（实际平台对接需要 Provider）
   */
  async processRecord(recordId: string): Promise<void> {
    const [record] = await db.select()
      .from(publishRecords)
      .where(eq(publishRecords.id, recordId));

    if (!record || (record.status !== 'pending' && record.status !== 'scheduled')) return;

    // 更新为 publishing
    await db.update(publishRecords)
      .set({ status: PUBLISH_STATUS.PUBLISHING, updatedAt: new Date() })
      .where(eq(publishRecords.id, recordId));

    try {
      // TODO: 实际发布逻辑 - 调用对应平台的 Provider
      // 当前版本：直接标记为 published（模拟成功）
      await db.update(publishRecords)
        .set({
          status: PUBLISH_STATUS.PUBLISHED,
          publishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(publishRecords.id, recordId));

      console.log(`[PublishQueue] 发布成功: ${recordId} (${record.platform})`);
    } catch (error: any) {
      const retryCount = (record.retryCount || 0) + 1;
      const maxRetries = 3;

      if (retryCount <= maxRetries) {
        await db.update(publishRecords)
          .set({
            status: PUBLISH_STATUS.PENDING,
            retryCount,
            errorMessage: error.message,
            updatedAt: new Date(),
          })
          .where(eq(publishRecords.id, recordId));
      } else {
        await db.update(publishRecords)
          .set({
            status: PUBLISH_STATUS.FAILED,
            errorMessage: error.message,
            retryCount,
            updatedAt: new Date(),
          })
          .where(eq(publishRecords.id, recordId));
      }
    }
  }

  /**
   * 取消发布
   */
  async cancel(recordId: string, workspaceId: string): Promise<boolean> {
    const [record] = await db.select()
      .from(publishRecords)
      .where(
        and(
          eq(publishRecords.id, recordId),
          eq(publishRecords.workspaceId, workspaceId),
        )
      );

    if (!record || (record.status !== 'pending' && record.status !== 'scheduled')) {
      return false;
    }

    await db.update(publishRecords)
      .set({ status: PUBLISH_STATUS.CANCELLED, updatedAt: new Date() })
      .where(eq(publishRecords.id, recordId));

    return true;
  }

  /**
   * 获取发布历史
   */
  async getHistory(workspaceId: string, filters?: {
    status?: string;
    platform?: string;
    limit?: number;
    offset?: number;
  }) {
    const conditions = [eq(publishRecords.workspaceId, workspaceId)];

    if (filters?.status) {
      conditions.push(eq(publishRecords.status, filters.status));
    }
    if (filters?.platform) {
      conditions.push(eq(publishRecords.platform, filters.platform));
    }

    const records = await db.select()
      .from(publishRecords)
      .where(and(...conditions))
      .orderBy(publishRecords.createdAt)
      .limit(filters?.limit || 20)
      .offset(filters?.offset || 0);

    return records;
  }

  /**
   * 获取待处理的发布记录（Worker 调用）
   */
  async getPendingRecords(limit: number = 10) {
    const now = new Date();

    return db.select()
      .from(publishRecords)
      .where(
        and(
          or(
            eq(publishRecords.status, PUBLISH_STATUS.PENDING),
            and(
              eq(publishRecords.status, 'scheduled'),
              lte(publishRecords.scheduledAt, now),
            )
          )
        )
      )
      .limit(limit);
  }
}

export const publishQueue = new PublishQueueService();

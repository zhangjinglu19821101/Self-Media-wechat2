/**
 * 对话历史管理器
 * 负责管理 Agent 对话历史的持久化
 */

import { eq, desc, and, sql } from "drizzle-orm";
import { getDb } from "coze-coding-dev-sdk";
import {
  conversationHistories,
  insertConversationHistorySchema,
} from "./shared/schema";
import type {
  ConversationHistory,
  InsertConversationHistory,
} from "./shared/schema";

export class ConversationHistoryManager {
  /**
   * 保存单条对话消息
   */
  async saveMessage(data: InsertConversationHistory): Promise<ConversationHistory> {
    const db = await getDb();
    const validated = insertConversationHistorySchema.parse(data);
    const [message] = await db
      .insert(conversationHistories)
      .values(validated)
      .returning();
    return message;
  }

  /**
   * 批量保存对话消息（用于导入历史）
   */
  async saveMessages(
    messages: InsertConversationHistory[]
  ): Promise<ConversationHistory[]> {
    const db = await getDb();
    const validated = messages.map((m) => insertConversationHistorySchema.parse(m));
    const results = await db
      .insert(conversationHistories)
      .values(validated)
      .returning();
    return results;
  }

  /**
   * 获取指定 Agent 的对话历史
   */
  async getAgentHistory(
    agentId: string,
    options: {
      sessionId?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<ConversationHistory[]> {
    const { sessionId, limit = 100, offset = 0 } = options;
    const db = await getDb();

    const conditions = [eq(conversationHistories.agentId, agentId)];

    if (sessionId) {
      conditions.push(eq(conversationHistories.sessionId, sessionId));
    }

    return db
      .select()
      .from(conversationHistories)
      .where(and(...conditions))
      .orderBy(desc(conversationHistories.timestamp))
      .limit(limit)
      .offset(offset);
  }

  /**
   * 获取指定会话的对话历史
   */
  async getSessionHistory(
    agentId: string,
    sessionId: string,
    options: { limit?: number } = {}
  ): Promise<ConversationHistory[]> {
    const { limit = 100 } = options;
    const db = await getDb();

    return db
      .select()
      .from(conversationHistories)
      .where(
        and(
          eq(conversationHistories.agentId, agentId),
          eq(conversationHistories.sessionId, sessionId)
        )
      )
      .orderBy(desc(conversationHistories.timestamp))
      .limit(limit);
  }

  /**
   * 获取最近的对话历史（用于 LLM 上下文）
   */
  async getRecentHistory(
    agentId: string,
    sessionId: string,
    maxMessages: number = 20
  ): Promise<{ role: string; content: string }[]> {
    const history = await this.getSessionHistory(agentId, sessionId, {
      limit: maxMessages,
    });

    // 按时间升序排列（最早的在前）
    return history
      .reverse()
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));
  }

  /**
   * 删除指定会话的历史
   */
  async deleteSessionHistory(
    agentId: string,
    sessionId: string
  ): Promise<number> {
    const db = await getDb();
    const result = await db
      .delete(conversationHistories)
      .where(
        and(
          eq(conversationHistories.agentId, agentId),
          eq(conversationHistories.sessionId, sessionId)
        )
      );
    return result.rowCount ?? 0;
  }

  /**
   * 删除指定 Agent 的所有历史
   */
  async deleteAgentHistory(agentId: string): Promise<number> {
    const db = await getDb();
    const result = await db
      .delete(conversationHistories)
      .where(eq(conversationHistories.agentId, agentId));
    return result.rowCount ?? 0;
  }

  /**
   * 清理旧的历史记录（保留最近的 N 条）
   */
  async cleanupOldHistory(
    agentId: string,
    sessionId: string,
    keepRecent: number = 100
  ): Promise<number> {
    const db = await getDb();

    // 先获取所有记录的 ID
    const allHistory = await this.getSessionHistory(agentId, sessionId, {
      limit: 10000,
    });

    if (allHistory.length <= keepRecent) {
      return 0;
    }

    // 保留最近的 keepRecent 条，删除其余的
    const toDelete = allHistory.slice(keepRecent);
    const idsToDelete = toDelete.map((h) => h.id);

    if (idsToDelete.length === 0) {
      return 0;
    }

    const result = await db
      .delete(conversationHistories)
      .where(sql`${conversationHistories.id} = ANY(${idsToDelete})`);

    return result.rowCount ?? 0;
  }

  /**
   * 获取会话列表
   */
  async getSessions(agentId: string): Promise<{ sessionId: string; lastMessageAt: Date; messageCount: number }[]> {
    const db = await getDb();

    const sessions = await db
      .select({
        sessionId: conversationHistories.sessionId,
        lastMessageAt: sql<string>`MAX(${conversationHistories.timestamp})`.as(
          "last_message_at"
        ),
        messageCount: sql<string>`COUNT(*)`.as("message_count"),
      })
      .from(conversationHistories)
      .where(eq(conversationHistories.agentId, agentId))
      .groupBy(conversationHistories.sessionId)
      .orderBy(
        desc(sql`MAX(${conversationHistories.timestamp})`)
      );

    return sessions.map((s) => ({
      sessionId: s.sessionId,
      lastMessageAt: new Date(s.lastMessageAt),
      messageCount: parseInt(s.messageCount),
    }));
  }
}

export const conversationHistoryManager = new ConversationHistoryManager();

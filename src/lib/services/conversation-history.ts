/**
 * 对话历史管理服务
 * 负责对话历史的持久化存储和检索
 */

import { eq, and, desc } from 'drizzle-orm';
import { getDatabase, getDatabaseWithRetry, schema } from '../db';

export class ConversationHistoryService {
  /**
   * 创建对话会话
   */
  async createConversation(params: {
    sessionId: string;
    userId?: string;
    agentId: string;
    variables?: Record<string, any>;
    context?: Record<string, any>;
    metadata?: Record<string, any>;
  }) {
    const db = getDatabase();

    const [conversation] = await db
      .insert(schema.conversations)
      .values({
        sessionId: params.sessionId,
        userId: params.userId,
        agentId: params.agentId,
        state: 'active',
        variables: params.variables || {},
        context: params.context || {},
        metadata: params.metadata || {},
      })
      .returning();

    return conversation;
  }

  /**
   * 获取对话会话
   */
  async getConversation(conversationId: string) {
    const db = getDatabase();

    const [conversation] = await db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.id, conversationId));

    return conversation;
  }

  /**
   * 根据 sessionId 获取对话会话
   */
  async getConversationBySessionId(sessionId: string) {
    const db = getDatabase();

    const [conversation] = await db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.sessionId, sessionId));

    return conversation;
  }

  /**
   * 获取用户的所有对话会话
   */
  async getUserConversations(userId: string, limit = 20, offset = 0) {
    const db = getDatabase();

    const conversations = await db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.userId, userId))
      .orderBy(desc(schema.conversations.lastActiveAt))
      .limit(limit)
      .offset(offset);

    return conversations;
  }

  /**
   * 获取 Agent 的所有对话会话
   */
  async getAgentConversations(agentId: string, limit = 20, offset = 0) {
    const db = getDatabase();

    const conversations = await db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.agentId, agentId))
      .orderBy(desc(schema.conversations.lastActiveAt))
      .limit(limit)
      .offset(offset);

    return conversations;
  }

  /**
   * 更新对话会话
   */
  async updateConversation(
    conversationId: string,
    updates: Partial<{
      state: string;
      variables: Record<string, any>;
      context: Record<string, any>;
      metadata: Record<string, any>;
      endedAt: Date;
    }>
  ) {
    const db = getDatabase();

    const [conversation] = await db
      .update(schema.conversations)
      .set({
        ...updates,
        updatedAt: new Date(),
        lastActiveAt: new Date(),
      })
      .where(eq(schema.conversations.id, conversationId))
      .returning();

    return conversation;
  }

  /**
   * 关闭对话会话
   */
  async closeConversation(conversationId: string) {
    return this.updateConversation(conversationId, {
      state: 'closed',
      endedAt: new Date(),
    });
  }

  /**
   * 添加消息到对话（带重试机制）
   */
  async addMessage(params: {
    conversationId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    metadata?: Record<string, any>;
    tokens?: number;
    model?: string;
  }) {
    let lastError: Error | null = null;
    const maxRetries = 3;

    for (let i = 0; i < maxRetries; i++) {
      try {
        const db = await getDatabaseWithRetry();

        const [message] = await db
          .insert(schema.messages)
          .values({
            conversationId: params.conversationId,
            role: params.role,
            content: params.content,
            metadata: params.metadata || {},
            tokens: params.tokens,
            model: params.model,
          })
          .returning();

        // 更新对话的最后活跃时间
        await db
          .update(schema.conversations)
          .set({
            lastActiveAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(schema.conversations.id, params.conversationId));

        return message;
      } catch (error) {
        lastError = error as Error;
        console.error(`addMessage attempt ${i + 1} failed:`, error);

        if (i < maxRetries - 1) {
          // 等待一段时间后重试
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        } else {
          console.error('addMessage failed after retries:', error);
          throw lastError;
        }
      }
    }

    throw lastError || new Error('Failed to add message');
  }

  /**
   * 获取对话的所有消息
   */
  async getMessages(conversationId: string) {
    const db = getDatabase();

    const messages = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, conversationId))
      .orderBy(schema.messages.createdAt);

    return messages;
  }

  /**
   * 获取对话历史（用于 Agent 上下文）
   */
  async getConversationHistory(conversationId: string, limit = 10) {
    const messages = await this.getMessages(conversationId);
    return messages.slice(-limit);
  }

  /**
   * 获取格式化的对话历史（用于 LLM 提示词）
   */
  async getFormattedHistory(conversationId: string, limit = 10) {
    const messages = await this.getConversationHistory(conversationId, limit);

    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  /**
   * 删除对话会话及其所有消息
   */
  async deleteConversation(conversationId: string) {
    const db = getDatabase();

    // 由于有外键级联删除，删除对话会自动删除所有消息
    await db
      .delete(schema.conversations)
      .where(eq(schema.conversations.id, conversationId));
  }

  /**
   * 搜索对话历史
   */
  async searchConversations(params: {
    agentId?: string;
    userId?: string;
    keyword?: string;
    limit?: number;
    offset?: number;
  }) {
    const db = getDatabase();

    let query = db.select().from(schema.conversations);

    if (params.agentId) {
      query = query.where(eq(schema.conversations.agentId, params.agentId));
    }

    if (params.userId) {
      query = query.where(eq(schema.conversations.userId, params.userId));
    }

    const conversations = await query
      .orderBy(desc(schema.conversations.lastActiveAt))
      .limit(params.limit || 20)
      .offset(params.offset || 0);

    return conversations;
  }
}

// 导出单例
export const conversationHistory = new ConversationHistoryService();

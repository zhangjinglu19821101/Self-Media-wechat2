/**
 * Agent 记忆管理服务
 * 负责长期记忆的存储、检索和管理
 */

import { eq, and, desc, or, like, sql } from 'drizzle-orm';
import { getDatabase, schema } from '../db';

export class AgentMemoryService {
  /**
   * 创建记忆
   */
  async createMemory(params: {
    agentId: string;
    memoryType: 'decision' | 'strategy' | 'experience' | 'rule' | 'knowledge';
    title: string;
    content: string;
    tags?: string[];
    importance?: number; // 0-10
    source?: 'manual' | 'auto' | 'import';
    metadata?: Record<string, any>;
  }) {
    const db = getDatabase();

    const [memory] = await db
      .insert(schema.agentMemories)
      .values({
        agentId: params.agentId,
        memoryType: params.memoryType,
        title: params.title,
        content: params.content,
        tags: params.tags || [],
        importance: params.importance || 0,
        source: params.source || 'auto',
        metadata: params.metadata || {},
      })
      .returning();

    return memory;
  }

  /**
   * 获取单个记忆
   */
  async getMemory(memoryId: string) {
    const db = getDatabase();

    const [memory] = await db
      .select()
      .from(schema.agentMemories)
      .where(eq(schema.agentMemories.id, memoryId));

    return memory;
  }

  /**
   * 获取 Agent 的所有记忆
   */
  async getAgentMemories(agentId: string, options?: {
    memoryType?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
  }) {
    const db = getDatabase();

    let query = db
      .select()
      .from(schema.agentMemories)
      .where(eq(schema.agentMemories.agentId, agentId));

    if (options?.memoryType) {
      query = query.where(eq(schema.agentMemories.memoryType, options.memoryType));
    }

    const memories = await query
      .orderBy(desc(schema.agentMemories.importance), desc(schema.agentMemories.createdAt))
      .limit(options?.limit || 50)
      .offset(options?.offset || 0);

    // 过滤标签
    if (options?.tags && options.tags.length > 0) {
      return memories.filter((memory) =>
        options.tags!.some((tag) => memory.tags.includes(tag))
      );
    }

    return memories;
  }

  /**
   * 搜索记忆
   */
  async searchMemories(params: {
    agentId?: string;
    keyword?: string;
    memoryType?: string;
    tags?: string[];
    minImportance?: number;
    limit?: number;
    offset?: number;
  }) {
    const db = getDatabase();

    let query = db.select().from(schema.agentMemories);

    const conditions = [];

    if (params.agentId) {
      conditions.push(eq(schema.agentMemories.agentId, params.agentId));
    }

    if (params.memoryType) {
      conditions.push(eq(schema.agentMemories.memoryType, params.memoryType));
    }

    if (params.minImportance !== undefined) {
      conditions.push(sql`${schema.agentMemories.importance} >= ${params.minImportance}`);
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const memories = await query
      .orderBy(desc(schema.agentMemories.importance), desc(schema.agentMemories.createdAt))
      .limit(params.limit || 20)
      .offset(params.offset || 0);

    // 关键词搜索
    if (params.keyword) {
      const keyword = params.keyword.toLowerCase();
      return memories.filter(
        (memory) =>
          memory.title.toLowerCase().includes(keyword) ||
          memory.content.toLowerCase().includes(keyword)
      );
    }

    // 标签过滤
    if (params.tags && params.tags.length > 0) {
      return memories.filter((memory) =>
        params.tags!.some((tag) => memory.tags.includes(tag))
      );
    }

    return memories;
  }

  /**
   * 更新记忆
   */
  async updateMemory(
    memoryId: string,
    updates: Partial<{
      title: string;
      content: string;
      tags: string[];
      importance: number;
      metadata: Record<string, any>;
    }>
  ) {
    const db = getDatabase();

    const [memory] = await db
      .update(schema.agentMemories)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(schema.agentMemories.id, memoryId))
      .returning();

    return memory;
  }

  /**
   * 删除记忆
   */
  async deleteMemory(memoryId: string) {
    const db = getDatabase();

    await db
      .delete(schema.agentMemories)
      .where(eq(schema.agentMemories.id, memoryId));
  }

  /**
   * 获取相关记忆（基于关键词）
   */
  async getRelatedMemories(agentId: string, keywords: string[], limit = 5) {
    const memories = await this.searchMemories({
      agentId,
      limit: 50,
    });

    // 计算相关性分数
    const scoredMemories = memories.map((memory) => {
      let score = 0;
      const title = memory.title.toLowerCase();
      const content = memory.content.toLowerCase();
      const tags = memory.tags.map((t) => t.toLowerCase());

      keywords.forEach((keyword) => {
        const kw = keyword.toLowerCase();
        if (title.includes(kw)) score += 3;
        if (content.includes(kw)) score += 2;
        if (tags.includes(kw)) score += 1;
      });

      return { memory, score };
    });

    // 按分数排序并返回
    return scoredMemories
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => item.memory);
  }

  /**
   * 导出 Agent 的所有记忆
   */
  async exportAgentMemories(agentId: string) {
    const memories = await this.getAgentMemories(agentId, { limit: 1000 });

    return {
      agentId,
      exportTime: new Date().toISOString(),
      totalMemories: memories.length,
      memories,
    };
  }

  /**
   * 导入记忆
   */
  async importMemories(agentId: string, memories: Array<{
    memoryType: string;
    title: string;
    content: string;
    tags?: string[];
    importance?: number;
  }>) {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const memory of memories) {
      try {
        await this.createMemory({
          agentId,
          memoryType: memory.memoryType as any,
          title: memory.title,
          content: memory.content,
          tags: memory.tags,
          importance: memory.importance,
          source: 'import',
        });
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push(`Failed to import "${memory.title}": ${error}`);
      }
    }

    return results;
  }

  /**
   * 获取记忆统计
   */
  async getMemoryStats(agentId: string) {
    const db = getDatabase();

    const memories = await db
      .select()
      .from(schema.agentMemories)
      .where(eq(schema.agentMemories.agentId, agentId));

    const stats = {
      total: memories.length,
      byType: {} as Record<string, number>,
      byImportance: {} as Record<string, number>,
      averageImportance: 0,
    };

    memories.forEach((memory) => {
      // 按类型统计
      stats.byType[memory.memoryType] = (stats.byType[memory.memoryType] || 0) + 1;

      // 按重要性统计
      const importanceRange = memory.importance >= 8 ? 'high' :
                            memory.importance >= 5 ? 'medium' : 'low';
      stats.byImportance[importanceRange] = (stats.byImportance[importanceRange] || 0) + 1;

      // 计算平均重要性
      stats.averageImportance += memory.importance;
    });

    if (memories.length > 0) {
      stats.averageImportance = Math.round((stats.averageImportance / memories.length) * 10) / 10;
    }

    return stats;
  }
}

// 导出单例
export const agentMemory = new AgentMemoryService();

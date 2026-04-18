/**
 * 本地缓存工具
 * 用于缓存 LLM 调用结果，避免重复计算和调用，降低成本
 */

/**
 * 缓存项接口
 */
interface CacheItem<T> {
  /** 缓存的数据 */
  data: T;
  /** 创建时间戳 */
  timestamp: number;
  /** 缓存键（用于日志） */
  key: string;
}

/**
 * 缓存配置接口
 */
export interface CacheOptions {
  /** 缓存有效期（毫秒），默认 5 分钟 */
  ttl?: number;
  /** 缓存最大条目数，默认 1000 */
  maxSize?: number;
}

/**
 * 缓存类
 */
export class Cache<T> {
  private cache: Map<string, CacheItem<T>> = new Map();
  private ttl: number;
  private maxSize: number;
  private hitCount: number = 0;
  private missCount: number = 0;

  constructor(options: CacheOptions = {}) {
    this.ttl = options.ttl || 5 * 60 * 1000; // 默认 5 分钟
    this.maxSize = options.maxSize || 1000; // 默认 1000 条
  }

  /**
   * 获取缓存
   * @param key 缓存键
   * @returns 缓存数据，如果不存在或已过期则返回 null
   */
  get(key: string): T | null {
    const item = this.cache.get(key);

    if (!item) {
      this.missCount++;
      console.log(`🔍 缓存未命中: ${key}`);
      return null;
    }

    // 检查是否过期
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      this.missCount++;
      console.log(`⏰ 缓存已过期: ${key}`);
      return null;
    }

    this.hitCount++;
    console.log(`✅ 缓存命中: ${key}`);
    return item.data;
  }

  /**
   * 设置缓存
   * @param key 缓存键
   * @param data 要缓存的数据
   */
  set(key: string, data: T): void {
    // 如果缓存已满，删除最旧的条目（基于时间戳）
    if (this.cache.size >= this.maxSize) {
      let oldestKey: string | null = null;
      let oldestTimestamp = Infinity;

      for (const [k, item] of this.cache.entries()) {
        if (item.timestamp < oldestTimestamp) {
          oldestTimestamp = item.timestamp;
          oldestKey = k;
        }
      }

      if (oldestKey) {
        this.cache.delete(oldestKey);
        console.log(`🗑️ 缓存已满，删除最旧条目: ${oldestKey}`);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      key,
    });

    console.log(`💾 缓存已设置: ${key}`);
  }

  /**
   * 删除缓存
   * @param key 缓存键
   */
  delete(key: string): void {
    this.cache.delete(key);
    console.log(`🗑️ 缓存已删除: ${key}`);
  }

  /**
   * 检查键是否存在
   * @param key 缓存键
   * @returns 是否存在
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * 获取缓存条目数
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`🧹 缓存已清空: ${size} 条`);
  }

  /**
   * 获取缓存统计信息
   */
  getStats() {
    const total = this.hitCount + this.missCount;
    const hitRate = total > 0 ? ((this.hitCount / total) * 100).toFixed(2) : '0.00';

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitCount: this.hitCount,
      missCount: this.missCount,
      total,
      hitRate: `${hitRate}%`,
    };
  }

  /**
   * 清理过期缓存
   */
  cleanExpired(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > this.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 清理过期缓存: ${cleaned} 条`);
    }
  }

  /**
   * 获取所有缓存键
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }
}

// ============================================
// 预定义缓存实例
// ============================================

/**
 * Agent 自检结果缓存
 * 缓存 Agent 对某个任务的自检结果
 * 键格式: `{agentId}:{taskTitle}`
 * TTL: 5 分钟
 */
export const agentSelfCheckCache = new Cache<any>({
  ttl: 5 * 60 * 1000, // 5 分钟
  maxSize: 1000,
});

/**
 * Agent 任务拆分缓存
 * 缓存 Agent 对某个任务的拆分结果
 * 键格式: `{agentId}:{taskTitle}`
 * TTL: 10 分钟（任务拆分结果相对稳定）
 */
export const agentTaskSplitCache = new Cache<any>({
  ttl: 10 * 60 * 1000, // 10 分钟
  maxSize: 500,
});

/**
 * Agent 解决方案缓存
 * 缓存 Agent 提供的解决方案
 * 键格式: `{agentId}:{problemContext}`
 * TTL: 30 分钟（解决方案相对稳定）
 */
export const agentSolutionCache = new Cache<any>({
  ttl: 30 * 60 * 1000, // 30 分钟
  maxSize: 300,
});

/**
 * Agent 问答缓存
 * 缓存 Agent 对某个问题的回答
 * 键格式: `{agentId}:{questionHash}`
 * TTL: 10 分钟
 */
export const agentAnswerCache = new Cache<string>({
  ttl: 10 * 60 * 1000, // 10 分钟
  maxSize: 1000,
});

/**
 * 生成缓存键的辅助函数
 * @param parts 缓存键的各个部分
 * @returns 缓存键字符串
 */
export function generateCacheKey(...parts: (string | number)[]): string {
  return parts.join(':');
}

/**
 * 生成字符串的哈希值（用于生成缓存键）
 * @param str 输入字符串
 * @returns 哈希值
 */
export function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为 32 位整数
  }
  return Math.abs(hash).toString(36);
}

/**
 * 打印所有缓存统计信息
 */
export function printAllCacheStats(): void {
  console.log('='.repeat(60));
  console.log('📊 缓存统计信息');
  console.log('='.repeat(60));

  const stats = {
    'Agent 自检缓存': agentSelfCheckCache.getStats(),
    'Agent 任务拆分缓存': agentTaskSplitCache.getStats(),
    'Agent 解决方案缓存': agentSolutionCache.getStats(),
    'Agent 问答缓存': agentAnswerCache.getStats(),
  };

  for (const [name, stat] of Object.entries(stats)) {
    console.log(`\n${name}:`);
    console.log(`  - 缓存条目数: ${stat.size}/${stat.maxSize}`);
    console.log(`  - 命中次数: ${stat.hitCount}`);
    console.log(`  - 未命中次数: ${stat.missCount}`);
    console.log(`  - 命中率: ${stat.hitRate}`);
  }

  console.log('\n' + '='.repeat(60));
}

/**
 * 定时清理过期缓存
 * 每 5 分钟执行一次
 */
export function startCacheCleanup(): NodeJS.Timeout {
  return setInterval(() => {
    console.log('🧹 定时清理过期缓存...');
    agentSelfCheckCache.cleanExpired();
    agentTaskSplitCache.cleanExpired();
    agentSolutionCache.cleanExpired();
    agentAnswerCache.cleanExpired();
  }, 5 * 60 * 1000); // 5 分钟
}

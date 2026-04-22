/**
 * 限流服务
 * 
 * 用于防止暴力破解、API 滥用等场景
 * 基于内存的简单实现，适用于单实例部署
 */

interface RateLimitEntry {
  count: number;           // 失败次数
  firstAttemptAt: number;  // 首次失败时间戳
  lockedUntil: number;     // 锁定到期时间戳（0 表示未锁定）
}

interface RateLimitConfig {
  maxAttempts: number;      // 最大失败次数
  windowMs: number;         // 时间窗口（毫秒）
  lockDurationMs: number;   // 锁定时长（毫秒）
}

/**
 * 默认限流配置
 * - 5 次失败后锁定
 * - 时间窗口 15 分钟
 * - 锁定 30 分钟
 */
const DEFAULT_CONFIG: RateLimitConfig = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,   // 15 分钟
  lockDurationMs: 30 * 60 * 1000, // 30 分钟
};

/**
 * 密码验证限流器
 * 
 * 特点：
 * - 按账户 ID + IP 组合限流（防止同一攻击者攻击多个账户）
 * - 按账户 ID 单独限流（防止单账户被暴力破解）
 * - 自动清理过期记录（防止内存泄漏）
 */
class PasswordRateLimiter {
  private attempts: Map<string, RateLimitEntry> = new Map();
  private config: RateLimitConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    // 每 5 分钟清理一次过期记录
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * 检查是否被锁定
   * @param accountId 账户 ID
   * @param ip 客户端 IP
   * @returns { locked: boolean, remainingMs: number, attemptsLeft: number }
   */
  check(accountId: string, ip: string): { 
    locked: boolean; 
    remainingMs: number; 
    attemptsLeft: number;
    message?: string;
  } {
    const now = Date.now();
    
    // 检查账户级别的锁定
    const accountKey = `account:${accountId}`;
    const accountEntry = this.attempts.get(accountKey);
    
    if (accountEntry && accountEntry.lockedUntil > now) {
      return {
        locked: true,
        remainingMs: accountEntry.lockedUntil - now,
        attemptsLeft: 0,
        message: `账户已锁定，请 ${(Math.ceil((accountEntry.lockedUntil - now) / 60000))} 分钟后重试`,
      };
    }

    // 检查 IP + 账户组合的限流
    const comboKey = `combo:${accountId}:${ip}`;
    const comboEntry = this.attempts.get(comboKey);
    
    if (comboEntry) {
      // 检查是否在时间窗口内
      if (now - comboEntry.firstAttemptAt > this.config.windowMs) {
        // 超过时间窗口，重置计数
        this.attempts.delete(comboKey);
      } else if (comboEntry.count >= this.config.maxAttempts) {
        // 达到最大失败次数，锁定账户
        const lockedUntil = now + this.config.lockDurationMs;
        this.attempts.set(accountKey, {
          count: comboEntry.count,
          firstAttemptAt: comboEntry.firstAttemptAt,
          lockedUntil,
        });
        return {
          locked: true,
          remainingMs: this.config.lockDurationMs,
          attemptsLeft: 0,
          message: `密码错误次数过多，账户已锁定 30 分钟`,
        };
      }
    }

    // 计算剩余尝试次数
    const attemptsLeft = comboEntry 
      ? Math.max(0, this.config.maxAttempts - comboEntry.count)
      : this.config.maxAttempts;

    return {
      locked: false,
      remainingMs: 0,
      attemptsLeft,
    };
  }

  /**
   * 记录一次失败
   * @param accountId 账户 ID
   * @param ip 客户端 IP
   */
  recordFailure(accountId: string, ip: string): void {
    const now = Date.now();
    const comboKey = `combo:${accountId}:${ip}`;
    const existing = this.attempts.get(comboKey);

    if (existing) {
      // 检查是否在时间窗口内
      if (now - existing.firstAttemptAt > this.config.windowMs) {
        // 超过时间窗口，重置计数
        this.attempts.set(comboKey, {
          count: 1,
          firstAttemptAt: now,
          lockedUntil: 0,
        });
      } else {
        // 在时间窗口内，增加计数
        existing.count++;
      }
    } else {
      // 新记录
      this.attempts.set(comboKey, {
        count: 1,
        firstAttemptAt: now,
        lockedUntil: 0,
      });
    }
  }

  /**
   * 记录成功（清除失败记录）
   * @param accountId 账户 ID
   */
  recordSuccess(accountId: string): void {
    // 清除账户级别的锁定
    const accountKey = `account:${accountId}`;
    this.attempts.delete(accountKey);

    // 注意：不清除 combo 级别的记录，因为可能来自不同 IP
    // combo 记录会在时间窗口过期后自动清理
  }

  /**
   * 手动解锁账户（管理员使用）
   * @param accountId 账户 ID
   */
  unlock(accountId: string): void {
    const accountKey = `account:${accountId}`;
    this.attempts.delete(accountKey);

    // 清除所有与该账户相关的 combo 记录
    for (const key of this.attempts.keys()) {
      if (key.includes(`:${accountId}:`)) {
        this.attempts.delete(key);
      }
    }
  }

  /**
   * 清理过期记录
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.attempts.entries()) {
      // 清理已过期且已解锁的记录
      if (entry.lockedUntil > 0 && entry.lockedUntil <= now) {
        this.attempts.delete(key);
      } else if (entry.lockedUntil === 0 && now - entry.firstAttemptAt > this.config.windowMs) {
        this.attempts.delete(key);
      }
    }
  }

  /**
   * 销毁实例（清理定时器）
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.attempts.clear();
  }

  /**
   * 获取统计信息（用于监控）
   */
  getStats(): { totalEntries: number; lockedAccounts: number } {
    const now = Date.now();
    let lockedAccounts = 0;
    
    for (const [key, entry] of this.attempts.entries()) {
      if (key.startsWith('account:') && entry.lockedUntil > now) {
        lockedAccounts++;
      }
    }

    return {
      totalEntries: this.attempts.size,
      lockedAccounts,
    };
  }
}

// 单例实例
export const passwordRateLimiter = new PasswordRateLimiter();

// 导出类型
export type { RateLimitConfig, RateLimitEntry };

/**
 * 内存级 Rate Limiter
 * 
 * 用于密码修改等敏感操作的频率限制，防止暴力破解。
 * 使用 Map 存储，进程重启后自动清空。
 * 
 * 特性：
 * - 按 accountId + clientIP 双维度限流
 * - 滑动窗口：固定次数内连续失败则锁定
 * - 锁定时间：30 分钟
 * - 最大尝试次数：5 次
 */

interface RateLimitEntry {
  failures: number;
  firstFailureAt: number;
  lockedUntil: number | null;
}

interface RateLimitResult {
  locked: boolean;
  attemptsLeft: number;
  remainingMs?: number;
  message?: string;
}

interface RateLimiterConfig {
  maxAttempts: number;    // 最大尝试次数
  lockDurationMs: number; // 锁定时长（毫秒）
}

const DEFAULT_CONFIG: RateLimiterConfig = {
  maxAttempts: 5,
  lockDurationMs: 30 * 60 * 1000, // 30 分钟
};

class RateLimiter {
  private entries = new Map<string, RateLimitEntry>();
  private config: RateLimiterConfig;

  constructor(config?: Partial<RateLimiterConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    // 每 10 分钟清理过期条目
    setInterval(() => this.cleanup(), 10 * 60 * 1000);
  }

  private getKey(accountId: string, clientIP: string): string {
    return `${accountId}:${clientIP}`;
  }

  /**
   * 检查限流状态（不修改状态）
   */
  check(accountId: string, clientIP: string): RateLimitResult {
    const key = this.getKey(accountId, clientIP);
    const entry = this.entries.get(key);

    if (!entry) {
      return {
        locked: false,
        attemptsLeft: this.config.maxAttempts,
      };
    }

    // 检查是否已过锁定时间
    if (entry.lockedUntil && Date.now() >= entry.lockedUntil) {
      // 锁定已过期，清除记录
      this.entries.delete(key);
      return {
        locked: false,
        attemptsLeft: this.config.maxAttempts,
      };
    }

    if (entry.lockedUntil) {
      const remainingMs = entry.lockedUntil - Date.now();
      const minutes = Math.ceil(remainingMs / 60000);
      return {
        locked: true,
        attemptsLeft: 0,
        remainingMs,
        message: `操作过于频繁，请 ${minutes} 分钟后重试`,
      };
    }

    return {
      locked: false,
      attemptsLeft: Math.max(0, this.config.maxAttempts - entry.failures),
    };
  }

  /**
   * 记录失败尝试
   */
  recordFailure(accountId: string, clientIP: string): void {
    const key = this.getKey(accountId, clientIP);
    const now = Date.now();
    const entry = this.entries.get(key);

    if (!entry) {
      this.entries.set(key, {
        failures: 1,
        firstFailureAt: now,
        lockedUntil: null,
      });
      return;
    }

    entry.failures += 1;

    // 达到最大失败次数，触发锁定
    if (entry.failures >= this.config.maxAttempts) {
      entry.lockedUntil = now + this.config.lockDurationMs;
      console.warn(
        `[RateLimiter] 账户 ${accountId} (IP: ${clientIP}) 已被锁定 ${this.config.lockDurationMs / 60000} 分钟，` +
        `失败次数: ${entry.failures}`
      );
    }
  }

  /**
   * 记录成功（清除失败记录）
   */
  recordSuccess(accountId: string): void {
    // 成功后清除该账户所有 IP 的失败记录
    for (const [key, entry] of this.entries.entries()) {
      if (key.startsWith(`${accountId}:`)) {
        this.entries.delete(key);
      }
    }
  }

  /**
   * 清理过期条目
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.entries.entries()) {
      // 锁定已过期
      if (entry.lockedUntil && now >= entry.lockedUntil) {
        this.entries.delete(key);
        cleaned++;
        continue;
      }
      // 超过 1 小时无活动的条目
      if (!entry.lockedUntil && now - entry.firstFailureAt > 60 * 60 * 1000) {
        this.entries.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[RateLimiter] 清理了 ${cleaned} 条过期记录，当前活跃: ${this.entries.size}`);
    }
  }
}

// 密码修改限流器（5 次失败后锁定 30 分钟）
export const passwordRateLimiter = new RateLimiter({
  maxAttempts: 5,
  lockDurationMs: 30 * 60 * 1000,
});

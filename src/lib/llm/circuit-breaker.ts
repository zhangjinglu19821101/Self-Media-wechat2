/**
 * LLM 熔断器（Circuit Breaker）
 * 
 * 保护系统免受 LLM 服务故障的级联影响：
 * 1. 连续失败达到阈值 → 进入 OPEN 状态，直接拒绝请求
 * 2. OPEN 状态持续冷却期后 → 进入 HALF_OPEN，放行一个探测请求
 * 3. 探测成功 → 恢复 CLOSED；探测失败 → 继续 OPEN
 * 
 * 设计原则：
 * - 进程级单例，所有 callLLM 调用共享同一熔断器
 * - 按 Agent 维度隔离（一个 Agent 的 LLM 故障不影响其他 Agent）
 * - 熔断后返回降级错误，而非无限等待
 */

// ========== 熔断器状态 ==========
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

// ========== 熔断器配置 ==========
export interface CircuitBreakerConfig {
  /** 连续失败次数阈值，达到后进入 OPEN（默认 5） */
  failureThreshold: number;
  /** OPEN 状态冷却时间 ms，过后进入 HALF_OPEN（默认 30000 = 30s） */
  cooldownMs: number;
  /** HALF_OPEN 状态下的探测超时 ms（默认 60000 = 60s） */
  halfOpenTimeoutMs: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  cooldownMs: 30000,
  halfOpenTimeoutMs: 60000,
};

// ========== 单个 Agent 的熔断器实例 ==========
class AgentCircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  private readonly config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig = DEFAULT_CONFIG) {
    this.config = config;
  }

  /**
   * 检查是否允许请求通过
   * @returns true=允许, false=熔断中
   */
  allowRequest(): boolean {
    switch (this.state) {
      case 'CLOSED':
        return true;

      case 'OPEN': {
        // 冷却期过后转为 HALF_OPEN
        if (this.lastFailureTime && Date.now() - this.lastFailureTime >= this.config.cooldownMs) {
          console.log(`[CircuitBreaker] 冷却期结束，进入 HALF_OPEN 状态`);
          this.state = 'HALF_OPEN';
          return true; // 允许一个探测请求
        }
        return false; // 仍在冷却期
      }

      case 'HALF_OPEN':
        // HALF_OPEN 只允许一个探测请求（已在 OPEN→HALF_OPEN 转换时放行）
        // 后续请求在探测结果出来前仍拒绝
        return false;
    }
  }

  /**
   * 记录成功
   */
  recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      console.log(`[CircuitBreaker] 探测成功，恢复 CLOSED 状态`);
    }
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  /**
   * 记录失败
   */
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      // 探测失败，回到 OPEN
      console.warn(`[CircuitBreaker] 探测失败，回到 OPEN 状态`);
      this.state = 'OPEN';
      return;
    }

    // CLOSED 状态下连续失败达到阈值
    if (this.failureCount >= this.config.failureThreshold) {
      console.error(`[CircuitBreaker] 连续失败 ${this.failureCount} 次，达到阈值 ${this.config.failureThreshold}，进入 OPEN 状态`);
      this.state = 'OPEN';
    }
  }

  /**
   * 获取当前状态
   */
  getState(): CircuitState {
    // 懒检查：OPEN → HALF_OPEN 状态转换
    if (this.state === 'OPEN' && this.lastFailureTime &&
        Date.now() - this.lastFailureTime >= this.config.cooldownMs) {
      return 'HALF_OPEN';
    }
    return this.state;
  }

  /**
   * 获取诊断信息
   */
  getStats() {
    return {
      state: this.getState(),
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
      cooldownRemaining: this.state === 'OPEN' && this.lastFailureTime
        ? Math.max(0, this.config.cooldownMs - (Date.now() - this.lastFailureTime))
        : 0,
    };
  }

  /**
   * 手动重置（用于管理操作）
   */
  reset(): void {
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED';
    console.log(`[CircuitBreaker] 手动重置为 CLOSED 状态`);
  }
}

// ========== 全局熔断器管理 ==========
const circuitBreakers = new Map<string, AgentCircuitBreaker>();

/**
 * 获取指定 Agent 的熔断器
 */
export function getCircuitBreaker(agentId: string, config?: Partial<CircuitBreakerConfig>): AgentCircuitBreaker {
  if (!circuitBreakers.has(agentId)) {
    circuitBreakers.set(agentId, new AgentCircuitBreaker({
      ...DEFAULT_CONFIG,
      ...config,
    }));
  }
  return circuitBreakers.get(agentId)!;
}

/**
 * 获取所有熔断器状态（用于健康检查）
 */
export function getAllCircuitBreakerStats(): Record<string, ReturnType<AgentCircuitBreaker['getStats']>> {
  const stats: Record<string, ReturnType<AgentCircuitBreaker['getStats']>> = {};
  const entries = Array.from(circuitBreakers.entries());
  for (const [agentId, breaker] of entries) {
    stats[agentId] = breaker.getStats();
  }
  return stats;
}

/**
 * 重置所有熔断器
 */
export function resetAllCircuitBreakers(): void {
  const breakers = Array.from(circuitBreakers.values());
  for (const breaker of breakers) {
    breaker.reset();
  }
}

// ========== LLM 重试工具 ==========

export interface RetryConfig {
  /** 最大重试次数（默认 3） */
  maxRetries: number;
  /** 基础延迟 ms（默认 2000） */
  baseDelayMs: number;
  /** 最大延迟 ms（默认 30000） */
  maxDelayMs: number;
  /** 可重试的错误模式（默认超时 + 5xx + 网络错误） */
  isRetryable: (error: Error) => boolean;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 2000,
  maxDelayMs: 30000,
  isRetryable: (error: Error) => {
    const msg = error.message?.toLowerCase() || '';
    // 超时
    if (msg.includes('timeout') || msg.includes('超时')) return true;
    // 网络错误
    if (msg.includes('econnreset') || msg.includes('econnrefused') || msg.includes('etimedout')) return true;
    // 5xx 服务端错误
    if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('429')) return true;
    // LLM 特有错误
    if (msg.includes('rate_limit') || msg.includes('rate limit') || msg.includes('too many requests')) return true;
    return false;
  },
};

/**
 * 带指数退避的 LLM 调用重试
 * 
 * @param fn 要重试的异步函数
 * @param config 重试配置
 * @returns fn 的返回值
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config?: Partial<RetryConfig>
): Promise<T> {
  const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // 最后一次尝试不再重试
      if (attempt >= cfg.maxRetries) {
        break;
      }

      // 判断是否可重试
      if (!cfg.isRetryable(lastError)) {
        console.warn(`[LLM Retry] 错误不可重试，直接抛出: ${lastError.message}`);
        break;
      }

      // 计算退避延迟：base * 2^attempt + 随机抖动
      const jitter = Math.random() * 1000;
      const delay = Math.min(cfg.baseDelayMs * Math.pow(2, attempt) + jitter, cfg.maxDelayMs);

      console.warn(
        `[LLM Retry] 第 ${attempt + 1}/${cfg.maxRetries} 次重试，` +
        `错误: ${lastError.message}，` +
        `${Math.round(delay)}ms 后重试...`
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

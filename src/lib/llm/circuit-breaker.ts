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
  failureThreshold: 8, // 🔴 P1 修复：从 5 提高到 8，减少生产环境误触发
  cooldownMs: 30000,
  halfOpenTimeoutMs: 60000,
};

/**
 * 🔴 P1 新增：按 Agent 维度的熔断器配置覆盖
 * 
 * 某些 Agent（如写作类 Agent）的 LLM 调用更复杂、更容易因超时失败，
 * 需要更高的 failureThreshold 以避免误触发熔断。
 * 
 * 新增 Agent 时，如需特殊配置在此添加即可。
 */
const AGENT_CONFIG_OVERRIDES: Partial<Record<string, Partial<CircuitBreakerConfig>>> = {
  // 写作类 Agent：调用链更长、超时更频繁，给更大的容错空间
  'insurance-d': { failureThreshold: 10 },
  'insurance-xiaohongshu': { failureThreshold: 10 },
  'insurance-zhihu': { failureThreshold: 10 },
  'insurance-toutiao': { failureThreshold: 10 },
  // Agent B（协调者）：调用频率高但内容简短，保持默认
  // Agent T（技术专家）：MCP 调用可能偶尔超时，稍微放宽
  'T': { failureThreshold: 8 },
};

// ========== 单个 Agent 的熔断器实例 ==========
class AgentCircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  private readonly config: CircuitBreakerConfig;
  /** HALF_OPEN 进入时间戳（用于超时回退 OPEN） */
  private halfOpenEnteredAt: number | null = null;
  /** HALF_OPEN 状态下已放行的探测请求数（最多放行 1 个） */
  private halfOpenProbeInFlight = false;

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
          this.halfOpenEnteredAt = Date.now();
          this.halfOpenProbeInFlight = false;
          // 继续走 HALF_OPEN 分支
          // falls through
        } else {
          return false; // 仍在冷却期
        }
      }

      // eslint-disable-next-line no-fallthrough
      case 'HALF_OPEN': {
        // 🔴 P0 修复：HALF_OPEN 超时后回退到 OPEN
        if (this.halfOpenEnteredAt && Date.now() - this.halfOpenEnteredAt >= this.config.halfOpenTimeoutMs) {
          console.warn(`[CircuitBreaker] HALF_OPEN 探测超时 (${this.config.halfOpenTimeoutMs}ms)，回退 OPEN 状态`);
          this.state = 'OPEN';
          this.lastFailureTime = Date.now();
          this.halfOpenEnteredAt = null;
          return false;
        }

        // 🔴 P0 修复：HALF_OPEN 只放行 1 个探测请求，后续请求拒绝
        if (this.halfOpenProbeInFlight) {
          return false; // 已有探测请求在途，拒绝
        }

        this.halfOpenProbeInFlight = true;
        return true;
      }
    }
  }

  /**
   * 记录成功
   */
  recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      console.log(`[CircuitBreaker] 探测成功，恢复 CLOSED 状态`);
      this.halfOpenEnteredAt = null;
      this.halfOpenProbeInFlight = false;
    }
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  /**
   * 记录失败
   */
  recordFailure(): void {
    // 🔴 P0 修复：failureCount 上限保护，避免无限增长
    this.failureCount = Math.min(this.failureCount + 1, this.config.failureThreshold + 10);
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      // 探测失败，回到 OPEN
      console.warn(`[CircuitBreaker] 探测失败，回到 OPEN 状态`);
      this.state = 'OPEN';
      this.halfOpenEnteredAt = null;
      this.halfOpenProbeInFlight = false;
      return;
    }

    // CLOSED 状态下连续失败达到阈值
    if (this.failureCount >= this.config.failureThreshold) {
      console.error(`[CircuitBreaker] 连续失败 ${this.failureCount} 次，达到阈值 ${this.config.failureThreshold}，进入 OPEN 状态`);
      this.state = 'OPEN';
      this.halfOpenEnteredAt = null;
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
    // 🔴 P0 修复：HALF_OPEN 超时检查
    if (this.state === 'HALF_OPEN' && this.halfOpenEnteredAt &&
        Date.now() - this.halfOpenEnteredAt >= this.config.halfOpenTimeoutMs) {
      return 'OPEN'; // 反映实际回退后的状态
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
      halfOpenProbeInFlight: this.halfOpenProbeInFlight,
    };
  }

  /**
   * 手动重置（用于管理操作）
   */
  reset(): void {
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.halfOpenEnteredAt = null;
    this.halfOpenProbeInFlight = false;
    this.state = 'CLOSED';
    console.log(`[CircuitBreaker] 手动重置为 CLOSED 状态`);
  }
}

// ========== 全局熔断器管理 ==========
const circuitBreakers = new Map<string, AgentCircuitBreaker>();

/**
 * 获取指定 Agent 的熔断器
 * 🔴 P1 修复：支持按 Agent 维度配置覆盖
 */
export function getCircuitBreaker(agentId: string, config?: Partial<CircuitBreakerConfig>): AgentCircuitBreaker {
  if (!circuitBreakers.has(agentId)) {
    // 合并顺序：DEFAULT_CONFIG → AGENT_CONFIG_OVERRIDES → 调用方传入的 config
    const agentOverride = AGENT_CONFIG_OVERRIDES[agentId] || {};
    circuitBreakers.set(agentId, new AgentCircuitBreaker({
      ...DEFAULT_CONFIG,
      ...agentOverride,
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

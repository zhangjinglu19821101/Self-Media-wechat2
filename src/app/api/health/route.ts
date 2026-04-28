/**
 * 增强版服务健康检查 API
 * 
 * 🔴 阶段1新增：全面的生产就绪健康检查
 * 
 * 检查维度：
 * 1. 数据库连通性 + 延迟 + 连接池状态
 * 2. LLM 熔断器状态（每个 Agent 维度）
 * 3. WebSocket 服务状态 + 已连接 Agent 列表
 * 4. 子任务执行引擎状态
 * 5. 进程基础信息（内存、运行时间、Node 版本）
 * 
 * 响应格式：
 * - 200: 所有检查通过（healthy）
 * - 503: 有检查降级或失败（degraded / unhealthy）
 * 
 * 🔴 P1 修复：
 * - degraded 返回 503（而非 200），外部监控可区分正常和降级
 * - 新增 5s 内存缓存，避免高频探测（如 LB 每 10s）每次都查库
 */

import { NextRequest, NextResponse } from 'next/server';

// 健康级别
type HealthLevel = 'healthy' | 'degraded' | 'unhealthy';

interface HealthCheckResult {
  timestamp: string;
  status: HealthLevel;
  uptime: number;
  nodeVersion: string;
  environment: string;
  memory: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    rssMB: string;
    heapUsedMB: string;
  };
  checks: {
    database?: {
      status: HealthLevel;
      connected: boolean;
      latencyMs: number;
      schema?: string;
      projectEnv?: string;
      currentSearchPath?: string;
      poolStats?: Record<string, number>;
      error?: string;
    };
    circuitBreakers?: {
      status: HealthLevel;
      breakers: Record<string, {
        state: string;
        failureCount: number;
        lastFailureTime: string | null;
        cooldownRemaining: number;
      }>;
    };
    websocket?: {
      status: HealthLevel;
      running: boolean;
      port: number;
      connectedAgents: string[];
      totalConnections: number;
    };
    engine?: {
      status: HealthLevel;
      isExecuting: boolean;
      executingGroups: number;
      maxParallelGroups: number;
      groupDetails: Array<{ commandResultId: string; startTime: string; runningMs: number }>;
      executionStartTime: string | null;
      runningDurationMs: number | null;
    };
  };
}

// 🔴 P1 新增：健康检查内存缓存（5s TTL）
// 负载均衡器通常每 10s 探测一次，5s 缓存可以避免每次都查库
// 使用 globalThis 确保跨请求持久化（Next.js 模块可能在热更新时重新加载）
const HEALTH_CACHE_TTL_MS = 5000; // 5 秒缓存

interface HealthCache {
  data: Record<string, unknown>;
  status: number;
  cachedAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __healthCheckCache: HealthCache | undefined;
}

function getHealthCache(): HealthCache | null {
  return globalThis.__healthCheckCache || null;
}

function setHealthCache(cache: HealthCache): void {
  globalThis.__healthCheckCache = cache;
}

export async function GET(request: NextRequest) {
  // 🔴 P1 修复：检查缓存是否有效
  const now = Date.now();
  const cachedHealthResult = getHealthCache();
  if (cachedHealthResult && (now - cachedHealthResult.cachedAt) < HEALTH_CACHE_TTL_MS) {
    // 返回缓存结果，附加 fromCache 标记
    return NextResponse.json(
      { ...cachedHealthResult.data, fromCache: true, cacheAgeMs: now - cachedHealthResult.cachedAt },
      { status: cachedHealthResult.status }
    );
  }

  const startTime = Date.now();
  let overallStatus: HealthLevel = 'healthy';

  const result: HealthCheckResult = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    uptime: process.uptime(),
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
    memory: getMemoryInfo(),
    checks: {},
  };

  // ========== 1. 数据库健康检查 ==========
  try {
    const { checkDatabaseHealth } = await import('@/lib/db');
    const dbHealth = await checkDatabaseHealth();
    result.checks.database = {
      status: dbHealth.connected ? 'healthy' : 'unhealthy',
      connected: dbHealth.connected,
      latencyMs: dbHealth.latencyMs,
      schema: dbHealth.schema,
      projectEnv: dbHealth.projectEnv,
      currentSearchPath: dbHealth.currentSearchPath,
      poolStats: dbHealth.poolStats as Record<string, number> | undefined,
      error: dbHealth.error,
    };
    if (!dbHealth.connected) {
      overallStatus = 'unhealthy';
    } else if (dbHealth.latencyMs > 1000) {
      // 延迟超过 1s 视为降级
      result.checks.database.status = 'degraded';
      if (overallStatus === 'healthy') overallStatus = 'degraded';
    }
  } catch (error) {
    result.checks.database = {
      status: 'unhealthy',
      connected: false,
      latencyMs: -1,
      error: error instanceof Error ? error.message : String(error),
    };
    overallStatus = 'unhealthy';
  }

  // ========== 2. LLM 熔断器状态 ==========
  try {
    const { getAllCircuitBreakerStats } = await import('@/lib/llm/circuit-breaker');
    const allStats = getAllCircuitBreakerStats();
    const statsValues = Object.values(allStats);
    const hasOpenBreaker = statsValues.some((s: { state: string }) => s.state === 'OPEN');
    const hasHalfOpenBreaker = statsValues.some((s: { state: string }) => s.state === 'HALF_OPEN');

    result.checks.circuitBreakers = {
      status: hasOpenBreaker ? 'degraded' : (hasHalfOpenBreaker ? 'degraded' : 'healthy'),
      breakers: allStats,
    };
    if (hasOpenBreaker && overallStatus === 'healthy') {
      overallStatus = 'degraded';
    }
  } catch (error) {
    // 熔断器模块加载失败不影响整体健康判断
    result.checks.circuitBreakers = {
      status: 'degraded',
      breakers: {},
    };
  }

  // ========== 3. WebSocket 服务状态 ==========
  try {
    const { wsServer } = await import('@/lib/websocket-server');
    const isRunning = wsServer.isRunning();
    const connectedAgents = wsServer.getConnectedAgents();

    result.checks.websocket = {
      status: isRunning ? 'healthy' : 'unhealthy',
      running: isRunning,
      port: 5001,
      connectedAgents,
      totalConnections: connectedAgents.length,
    };
    if (!isRunning && overallStatus === 'healthy') {
      // WS 不运行视为降级而非不健康（引擎可以通过轮询工作）
      overallStatus = 'degraded';
    }
  } catch (error) {
    result.checks.websocket = {
      status: 'degraded',
      running: false,
      port: 5001,
      connectedAgents: [],
      totalConnections: 0,
    };
    if (overallStatus === 'healthy') overallStatus = 'degraded';
  }

  // ========== 4. 子任务执行引擎状态 ==========
  try {
    const { SubtaskExecutionEngine } = await import('@/lib/services/subtask-execution-engine');
    const engineStatus = SubtaskExecutionEngine.getExecutionStatus();

    result.checks.engine = {
      status: 'healthy',
      isExecuting: engineStatus.isRunning,
      executingGroups: engineStatus.executingGroups,
      maxParallelGroups: engineStatus.maxParallelGroups,
      groupDetails: engineStatus.groupDetails.map(g => ({
        commandResultId: g.commandResultId,
        startTime: g.startTime.toISOString(),
        runningMs: g.runningMs,
      })),
      executionStartTime: engineStatus.startTime?.toISOString() ?? null,
      runningDurationMs: engineStatus.runningDurationMs,
    };
  } catch (error) {
    result.checks.engine = {
      status: 'degraded',
      isExecuting: false,
      executingGroups: 0,
      maxParallelGroups: 5,
      groupDetails: [],
      executionStartTime: null,
      runningDurationMs: null,
    };
  }

  // ========== 汇总 ==========
  result.status = overallStatus;
  const totalLatency = Date.now() - startTime;

  // 🔴 P1 修复：degraded 也返回 503，让外部监控可以区分
  // healthy → 200, degraded → 503, unhealthy → 503
  const httpStatus = overallStatus === 'healthy' ? 200 : 503;

  // 添加总延迟信息（方便监控）
  const response = {
    ...result,
    checkLatencyMs: totalLatency,
  };

  // 🔴 P1 修复：缓存结果（使用 globalThis 持久化）
  setHealthCache({
    data: response,
    status: httpStatus,
    cachedAt: now,
  });

  return NextResponse.json(response, { status: httpStatus });
}

// ========== 辅助函数 ==========

function getMemoryInfo() {
  const mem = process.memoryUsage();
  return {
    rss: mem.rss,
    heapUsed: mem.heapUsed,
    heapTotal: mem.heapTotal,
    external: mem.external,
    rssMB: `${(mem.rss / 1024 / 1024).toFixed(1)}MB`,
    heapUsedMB: `${(mem.heapUsed / 1024 / 1024).toFixed(1)}MB`,
  };
}

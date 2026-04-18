/**
 * 测试环境健康检查
 *
 * 功能：在执行测试前检查依赖服务的健康状态
 * - 数据库连接状态
 * - 其他外部服务状态
 */

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export interface HealthCheckResult {
  overall: 'healthy' | 'unhealthy' | 'degraded';
  checks: {
    database: HealthCheckItem;
    [key: string]: HealthCheckItem | undefined;
  };
  timestamp: string;
}

export interface HealthCheckItem {
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTimeMs?: number;
  error?: string;
  details?: any;
}

export class TestEnvironmentHealthChecker {
  /**
   * 执行所有健康检查
   */
  async checkAll(): Promise<HealthCheckResult> {
    const results: HealthCheckResult = {
      overall: 'healthy',
      checks: {
        database: { status: 'healthy' }
      },
      timestamp: new Date().toISOString()
    };

    console.log('🏥 ========== 开始测试环境健康检查 ==========');

    // 1. 检查数据库
    console.log('🔍 检查数据库连接...');
    const dbCheck = await this.checkDatabase();
    results.checks.database = dbCheck;
    console.log(`   数据库状态: ${dbCheck.status}`);
    if (dbCheck.responseTimeMs) {
      console.log(`   响应时间: ${dbCheck.responseTimeMs}ms`);
    }
    if (dbCheck.error) {
      console.log(`   错误: ${dbCheck.error}`);
    }

    // 计算整体状态
    const allChecks = Object.values(results.checks);
    if (allChecks.some(c => c.status === 'unhealthy')) {
      results.overall = 'unhealthy';
    } else if (allChecks.some(c => c.status === 'degraded')) {
      results.overall = 'degraded';
    }

    console.log('🏥 ========== 健康检查完成 ==========');
    console.log(`整体状态: ${results.overall}`);

    return results;
  }

  /**
   * 检查数据库连接
   */
  private async checkDatabase(): Promise<HealthCheckItem> {
    const startTime = Date.now();
    try {
      // 执行简单查询测试数据库连接
      await db.execute(sql`SELECT 1 as test`);
      
      return {
        status: 'healthy',
        responseTimeMs: Date.now() - startTime
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 快捷方法：检查是否可以开始测试
   */
  async canRunTests(): Promise<{ canRun: boolean; reason?: string; healthCheck: HealthCheckResult }> {
    const healthCheck = await this.checkAll();
    
    if (healthCheck.overall === 'unhealthy') {
      const unhealthyChecks = Object.entries(healthCheck.checks)
        .filter(([_, check]) => check.status === 'unhealthy')
        .map(([name, _]) => name);
      
      return {
        canRun: false,
        reason: `以下服务不健康: ${unhealthyChecks.join(', ')}`,
        healthCheck
      };
    }

    return {
      canRun: true,
      healthCheck
    };
  }
}

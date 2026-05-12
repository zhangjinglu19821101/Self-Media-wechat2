/**
 * 测试失败重试管理器
 *
 * 功能：为单个测试案例提供自动重试机制
 * - 可配置重试次数（默认3次）
 * - 可配置重试间隔（默认5秒）
 * - 记录每次重试的结果
 */

import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export interface RetryConfig {
  maxRetries: number;
  retryDelayMs: number;
  retryableStatuses: string[];
  successStatuses: string[];
  failedStatuses: string[];
}

export interface RetryAttempt {
  attemptNumber: number;
  startTime: Date;
  endTime: Date;
  status: string;
  durationMs: number;
  error?: string;
}

export interface RetryResult {
  success: boolean;
  finalStatus: string;
  totalAttempts: number;
  successfulAttempt?: RetryAttempt;
  allAttempts: RetryAttempt[];
  totalDurationMs: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelayMs: 5000,
  retryableStatuses: ['pending', 'in_progress'],
  successStatuses: ['completed'],
  failedStatuses: ['failed']
};

export class TestRetryManager {
  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  /**
   * 执行带重试的测试
   */
  async executeWithRetry(
    subTaskId: string,
    testCaseId: string,
    testCaseName: string,
    executeFn: () => Promise<void>
  ): Promise<RetryResult> {
    const allAttempts: RetryAttempt[] = [];
    const totalStartTime = Date.now();

    console.log(`🔄 ========== 开始执行测试（带重试）: ${testCaseName} ==========`);
    console.log(`   配置: 最多${this.config.maxRetries}次重试, 间隔${this.config.retryDelayMs}ms`);

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      const attemptStartTime = Date.now();
      console.log(`\n📌 尝试 ${attempt}/${this.config.maxRetries}`);

      let currentStatus = 'unknown';
      let attemptError: string | undefined;

      try {
        // 执行测试
        console.log('   ⚡ 执行测试...');
        await executeFn();

        // 等待执行完成
        console.log('   ⏳ 等待执行完成...');
        await this.waitForCompletion(subTaskId);

        // 查询最终状态
        currentStatus = await this.getSubTaskStatus(subTaskId);
        console.log(`   📊 状态: ${currentStatus}`);

      } catch (error) {
        attemptError = error instanceof Error ? error.message : String(error);
        currentStatus = 'error';
        console.log(`   ❌ 异常: ${attemptError}`);
      }

      const attemptEndTime = Date.now();
      const attempt: RetryAttempt = {
        attemptNumber: attempt,
        startTime: new Date(attemptStartTime),
        endTime: new Date(attemptEndTime),
        status: currentStatus,
        durationMs: attemptEndTime - attemptStartTime,
        error: attemptError
      };
      allAttempts.push(attempt);

      // 检查是否成功
      if (this.config.successStatuses.includes(currentStatus)) {
        console.log(`   ✅ 测试成功！`);
        return {
          success: true,
          finalStatus: currentStatus,
          totalAttempts: attempt,
          successfulAttempt: attempt,
          allAttempts,
          totalDurationMs: Date.now() - totalStartTime
        };
      }

      // 检查是否失败（不需要重试）
      if (this.config.failedStatuses.includes(currentStatus)) {
        console.log(`   ❌ 测试失败，不再重试`);
        return {
          success: false,
          finalStatus: currentStatus,
          totalAttempts: attempt,
          allAttempts,
          totalDurationMs: Date.now() - totalStartTime
        };
      }

      // 如果还有重试机会，继续重试
      if (attempt < this.config.maxRetries) {
        console.log(`   ⏳ 等待 ${this.config.retryDelayMs / 1000}秒后重试...`);
        await this.sleep(this.config.retryDelayMs);
      }
    }

    // 所有重试都失败
    console.log(`\n❌ ========== 所有重试都失败 ==========`);
    return {
      success: false,
      finalStatus: allAttempts[allAttempts.length - 1].status,
      totalAttempts: this.config.maxRetries,
      allAttempts,
      totalDurationMs: Date.now() - totalStartTime
    };
  }

  /**
   * 等待子任务完成
   */
  private async waitForCompletion(subTaskId: string): Promise<void> {
    const maxWaitTime = 60000; // 最多等待60秒
    const checkInterval = 3000; // 每3秒检查一次
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const status = await this.getSubTaskStatus(subTaskId);

      if (this.config.successStatuses.includes(status) ||
          this.config.failedStatuses.includes(status)) {
        return;
      }

      await this.sleep(checkInterval);
    }
  }

  /**
   * 获取子任务状态
   */
  private async getSubTaskStatus(subTaskId: string): Promise<string> {
    const result = await db
      .select({ status: agentSubTasks.status })
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, subTaskId));

    return result[0]?.status || 'unknown';
  }

  /**
   * 睡眠
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 生成重试报告
   */
  generateRetryReport(result: RetryResult): string {
    let report = `\n📋 ========== 重试执行报告 ==========\n`;
    report += `测试案例: ${result.allAttempts[0]?.status ? '已执行' : '未知'}\n`;
    report += `最终结果: ${result.success ? '✅ 成功' : '❌ 失败'}\n`;
    report += `最终状态: ${result.finalStatus}\n`;
    report += `总尝试次数: ${result.totalAttempts}\n`;
    report += `总耗时: ${(result.totalDurationMs / 1000).toFixed(1)}秒\n\n`;

    report += `📊 每次尝试详情:\n`;
    result.allAttempts.forEach((attempt, index) => {
      const isSuccess = this.config.successStatuses.includes(attempt.status);
      const icon = isSuccess ? '✅' : this.config.failedStatuses.includes(attempt.status) ? '❌' : '⚠️';
      
      report += `  ${icon} 尝试 ${attempt.attemptNumber}:\n`;
      report += `     状态: ${attempt.status}\n`;
      report += `     耗时: ${(attempt.durationMs / 1000).toFixed(1)}秒\n`;
      report += `     开始时间: ${attempt.startTime.toLocaleTimeString()}\n`;
      if (attempt.error) {
        report += `     错误: ${attempt.error}\n`;
      }
    });

    return report;
  }
}

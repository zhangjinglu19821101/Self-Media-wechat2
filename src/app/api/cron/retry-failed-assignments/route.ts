/**
 * POST /api/cron/retry-failed-assignments
 * 定时任务：重试下发给 insurance-d 失败的任务
 *
 * 功能：
 * 1. 扫描 daily_task 表中 retry_status = 'failed' 的任务
 * 2. 检查失败次数是否超过阈值（默认 3 次）
 * 3. 尝试重新下发任务给 insurance-d
 * 4. 更新任务状态和失败记录
 *
 * 调用方式：
 * - 每 10 分钟自动执行一次
 * - 或手动触发执行
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dailyTask } from '@/lib/db/schema';
import { eq, and, or, lt } from 'drizzle-orm';

// 配置参数
const MAX_RETRY_COUNT = 3; // 最大重试次数
const RETRY_INTERVAL_MINUTES = 10; // 重试间隔（分钟）

/**
 * POST /api/cron/retry-failed-assignments
 * 重试下发给 insurance-d 失败的任务
 */
export async function POST(request: NextRequest) {
  console.log('🔄 [retry-failed-assignments] 开始扫描失败的任务...');

  try {
    // Step 1: 扫描所有失败的任务
    // 条件：
    // 1. retry_status = 'failed'
    // 2. 失败次数 < 最大重试次数
    // 3. 最后失败时间 >= 重试间隔（避免频繁重试）
    const retryThresholdTime = new Date(Date.now() - RETRY_INTERVAL_MINUTES * 60 * 1000);

    const allFailedTasks = await db
      .select()
      .from(dailyTask)
      .where(eq(dailyTask.retryStatus, 'failed'))
      .orderBy(dailyTask.updatedAt)
      .limit(50); // 先获取所有失败的任务，然后在内存中过滤

    // 在内存中过滤掉超过重试次数和重试间隔不足的任务
    const failedTasks = allFailedTasks.filter(task => {
      const failureCount = task.metadata?.failureCount || 0;
      if (failureCount >= MAX_RETRY_COUNT) {
        return false;
      }

      const lastFailureTime = task.metadata?.lastFailureAt;
      if (lastFailureTime) {
        const lastFailureDate = new Date(lastFailureTime);
        const timeSinceLastFailure = Date.now() - lastFailureDate.getTime();
        const minInterval = RETRY_INTERVAL_MINUTES * 60 * 1000;
        if (timeSinceLastFailure < minInterval) {
          return false;
        }
      }

      return true;
    }).slice(0, 10); // 最多处理 10 个

    console.log(`📋 找到 ${failedTasks.length} 个待重试的失败任务`);

    if (failedTasks.length === 0) {
      return NextResponse.json({
        success: true,
        message: '没有待重试的失败任务',
        retriedCount: 0,
      });
    }

    let retriedCount = 0;
    let successCount = 0;
    let stillFailedCount = 0;
    const results = [];

    // Step 2: 遍历每个失败任务，尝试重试
    for (const task of failedTasks) {
      console.log(`\n🔄 重试任务: ${task.taskId} (${task.taskTitle || task.taskName})`);
      console.log(`  📊 失败次数: ${task.metadata?.failureCount || 0}/${MAX_RETRY_COUNT}`);

      try {
        // 检查失败次数
        const failureCount = task.metadata?.failureCount || 0;
        if (failureCount >= MAX_RETRY_COUNT) {
          console.log(`  ⚠️ 任务 ${task.taskId} 已达到最大重试次数，跳过`);
          stillFailedCount++;
          results.push({
            taskId: task.taskId,
            title: task.taskTitle || task.taskName,
            status: 'max_retries_exceeded',
            failureCount,
          });
          continue;
        }

        // 检查重试间隔
        const lastFailureTime = task.metadata?.lastFailureAt;
        if (lastFailureTime) {
          const lastFailureDate = new Date(lastFailureTime);
          const timeSinceLastFailure = Date.now() - lastFailureDate.getTime();
          const minInterval = RETRY_INTERVAL_MINUTES * 60 * 1000;

          if (timeSinceLastFailure < minInterval) {
            console.log(`  ⚠️ 任务 ${task.taskId} 距离上次失败不足 ${RETRY_INTERVAL_MINUTES} 分钟，跳过`);
            stillFailedCount++;
            results.push({
              taskId: task.taskId,
              title: task.taskTitle || task.taskName,
              status: 'too_soon_to_retry',
              timeSinceLastFailure: Math.floor(timeSinceLastFailure / 1000 / 60), // 分钟
            });
            continue;
          }
        }

        // 尝试重新下发任务
        console.log(`  🔧 尝试重新下发任务...`);

        await db
          .update(dailyTask)
          .set({
            toAgentId: 'insurance-d',
            executor: 'insurance-d',
            splitter: 'agent B',
            executionStatus: 'new',
            retryStatus: 'retrying', // 标记为重试中
            updatedAt: new Date(),
            lastInspectionTime: new Date(), // 更新最后检查时间
          })
          .where(eq(dailyTask.id, task.id));

        // 清除之前的失败记录
        await db
          .update(dailyTask)
          .set({
            retryStatus: null, // 重置为空，表示已成功重试
            remarks: null, // 清除错误信息
            metadata: {
              ...task.metadata,
              lastRetryAt: new Date().toISOString(),
              retrySuccess: true,
            },
            updatedAt: new Date(),
          })
          .where(eq(dailyTask.id, task.id));

        console.log(`  ✅ 任务 ${task.taskId} 重试成功`);
        retriedCount++;
        successCount++;
        results.push({
          taskId: task.taskId,
          title: task.taskTitle || task.taskName,
          status: 'retry_success',
          failureCount,
        });

      } catch (error) {
        // 重试仍然失败
        const errorMsg = `重试任务 ${task.taskId} 失败: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`  ❌ ${errorMsg}`);

        const currentMetadata = task.metadata || {};
        const failureCount = (currentMetadata.failureCount || 0) + 1;

        // 更新失败状态
        try {
          await db
            .update(dailyTask)
            .set({
              retryStatus: 'failed',
              remarks: errorMsg,
              metadata: {
                ...currentMetadata,
                failureReason: errorMsg,
                failureCount: failureCount,
                lastFailureAt: new Date().toISOString(),
                failures: [
                  ...(currentMetadata.failures || []),
                  {
                    time: new Date().toISOString(),
                    error: errorMsg,
                    isRetry: true,
                  },
                ],
              },
              updatedAt: new Date(),
              lastInspectionTime: new Date(),
            })
            .where(eq(dailyTask.id, task.id));
        } catch (updateError) {
          console.error(`  ❌ 更新任务 ${task.taskId} 失败状态失败:`, updateError);
        }

        retriedCount++;
        stillFailedCount++;
        results.push({
          taskId: task.taskId,
          title: task.taskTitle || task.taskName,
          status: 'retry_failed',
          error: errorMsg,
          failureCount,
        });
      }
    }

    console.log(`\n✅ 重试完成: 尝试 ${retriedCount} 个，成功 ${successCount} 个，仍然失败 ${stillFailedCount} 个`);

    return NextResponse.json({
      success: true,
      message: `重试完成: 尝试 ${retriedCount} 个，成功 ${successCount} 个，仍然失败 ${stillFailedCount} 个`,
      retriedCount,
      successCount,
      stillFailedCount,
      results,
    });
  } catch (error) {
    console.error('❌ [retry-failed-assignments] 定时任务失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/retry-failed-assignments
 * 查询失败的任务状态
 */
export async function GET() {
  try {
    const failedTasks = await db
      .select({
        id: dailyTask.id,
        taskId: dailyTask.taskId,
        taskTitle: dailyTask.taskTitle,
        taskName: dailyTask.taskName,
        retryStatus: dailyTask.retryStatus,
        remarks: dailyTask.remarks,
        failureCount: dailyTask.metadata['failureCount'],
        lastFailureAt: dailyTask.metadata['lastFailureAt'],
        updatedAt: dailyTask.updatedAt,
      })
      .from(dailyTask)
      .where(eq(dailyTask.retryStatus, 'failed'))
      .orderBy(dailyTask.updatedAt)
      .limit(20);

    return NextResponse.json({
      success: true,
      data: {
        count: failedTasks.length,
        tasks: failedTasks,
      },
    });
  } catch (error) {
    console.error('❌ 查询失败任务失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

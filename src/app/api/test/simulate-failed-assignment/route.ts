/**
 * POST /api/test/simulate-failed-assignment
 * 测试 API：模拟任务下发失败，用于测试重试机制
 *
 * 功能：
 * 1. 创建一个测试任务
 * 2. 模拟下发失败，将任务标记为 failed
 * 3. 返回任务信息，方便调用重试 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dailyTask } from '@/lib/db/schema';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { exec_sql } from '../../../../lib/db/exec-sql';

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 [simulate-failed-assignment] 开始模拟任务下发失败...');

    // 创建一个测试任务
    const taskId = `test-failed-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const commandId = `cmd-${taskId}`;
    const id = randomUUID();
    // 使用早于 2 分钟前的时间，以便立即触发重试
    const now = new Date(Date.now() - 2 * 60 * 1000); // 2 分钟前
    const nowISO = now.toISOString();
    // executionDate 需要 YYYY-MM-DD 格式
    const executionDate = now.toISOString().split('T')[0];

    // 使用 SQL 直接插入，避免 Drizzle ORM 的问题
    const insertSql = `
      INSERT INTO "daily_task" (
        id, task_id, related_task_id, command_id, task_title, task_name, task_description,
        executor, to_agent_id, splitter, execution_status, retry_status, remarks,
        task_priority, execution_date, execution_deadline_start, execution_deadline_end,
        deliverables, metadata, from_agent_id, entry_user, created_at, updated_at,
        original_command
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
      )
      RETURNING *
    `;

    const metadata = JSON.stringify({
      failureReason: '模拟任务下发失败：数据库连接超时',
      failureCount: 1,
      lastFailureAt: nowISO,
      failures: [
        {
          time: nowISO,
          error: '模拟任务下发失败：数据库连接超时',
          isRetry: false,
        },
      ],
      isTestTask: true,
    });

    const result = await exec_sql(insertSql, [
      id,
      taskId,
      taskId, // related_task_id 可以使用 taskId
      commandId,
      '测试失败任务',
      '测试失败任务',
      '这是一个用于测试重试机制的模拟失败任务',
      'insurance-d',
      'insurance-d',
      'agent B',
      'new',
      'failed',
      '模拟任务下发失败：数据库连接超时',
      'normal',
      executionDate,
      nowISO,
      new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      '测试交付物',
      metadata,
      'agent B',
      'TS',
      nowISO,
      nowISO,
      '测试失败任务', // original_command
    ]);

    const task = result[0];

    console.log(`✅ [simulate-failed-assignment] 已创建模拟失败任务: ${task.taskId}`);

    return NextResponse.json({
      success: true,
      message: '已创建模拟失败任务',
      data: {
        task,
        retryUrl: '/api/cron/retry-failed-assignments',
      },
    });
  } catch (error) {
    console.error('❌ [simulate-failed-assignment] 创建失败任务失败:', error);
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
 * GET /api/test/simulate-failed-assignment
 * 查询所有测试任务
 */
export async function GET() {
  try {
    const testTasks = await db
      .select()
      .from(dailyTask)
      .where(eq(dailyTask.retryStatus, 'failed'))
      .limit(10);

    const isTestTasks = testTasks.filter(task => task.metadata?.isTestTask);

    return NextResponse.json({
      success: true,
      data: {
        count: isTestTasks.length,
        tasks: isTestTasks,
      },
    });
  } catch (error) {
    console.error('❌ 查询测试任务失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

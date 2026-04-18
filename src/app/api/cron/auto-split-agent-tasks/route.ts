import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentTasks } from '@/lib/db/schema';
import { isWritingAgent } from '@/lib/agents/agent-registry';
import { eq, and, or, inArray, isNotNull, lt } from 'drizzle-orm';

/**
 * POST /api/cron/auto-split-agent-tasks
 * 定时任务：自动扫描 agent_tasks 表，触发任务拆解
 *
 * 功能：
 * 1. 扫描 splitStatus='pending_split' 的任务
 * 2. 解析指令中的"执行主体"
 * 3. 调用对应的 Agent 拆解接口
 * 4. 更新任务状态
 *
 * 调用方式：
 * - 每 5 分钟自动执行一次
 * - 或手动触发执行
 */
export async function POST(request: NextRequest) {
  console.log('🕐 [auto-split-agent-tasks] 开始扫描 agent_tasks 表...');

  try {
    // Step 1: 扫描所有待拆解的任务
    // 条件：
    // 1. splitStatus = 'pending_split'（新任务待拆解）
    //    或
    // 2. splitStatus = 'splitting' 且 splitStartTime <= (当前时间 - 60分钟)（超时重试）
    const tasks = await db
      .select()
      .from(agentTasks)
      .where(
        or(
          // 条件1: 新任务待拆解
          eq(agentTasks.splitStatus, 'pending_split'),
          // 条件2: 超时重试（60分钟）
          and(
            eq(agentTasks.splitStatus, 'splitting'),
            isNotNull(agentTasks.splitStartTime),
            lt(agentTasks.splitStartTime, new Date(Date.now() - 60 * 60 * 1000)) // 60分钟前
          )
        )
      )
      .orderBy(agentTasks.createdAt)
      .limit(10);

    console.log(`📋 找到 ${tasks.length} 个待拆解任务`);

    if (tasks.length === 0) {
      return NextResponse.json({
        success: true,
        message: '没有待拆解的任务',
        processedCount: 0,
      });
    }

    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const results = [];

    // Step 2: 遍历每个任务，触发拆解
    for (const task of tasks) {
      console.log(`\n📦 处理任务 ${task.taskId}`);

      try {
        console.log(`  🎯 toAgentId: ${task.toAgentId}`);
        console.log(`  🎯 executor: ${task.executor}`);

        // 根据不同的 toAgentId 调用不同的拆解接口
        let splitUrl: string;
        let requestBody: any;

        if (isWritingAgent(task.toAgentId)) {
          // 写作类 Agent 的任务：调用专用拆解接口
          splitUrl = `http://localhost:5000/api/split-insurance-d-task`;
          requestBody = { taskId: task.taskId };
          console.log(`  🔧 调用 ${task.toAgentId} 专用拆解接口`);
        } else if (task.toAgentId === 'agent B') {
          // Agent B 的任务：调用 Agent B 拆解接口
          splitUrl = `http://localhost:5000/api/agents/tasks/${encodeURIComponent(task.taskId)}/split`;
          requestBody = {};
          console.log(`  🔧 调用 Agent B 拆解接口`);
        } else {
          // 其他 Agent 的任务：暂时跳过，等待后续扩展
          console.log(`  ⏭️  跳过任务 ${task.taskId}: toAgentId ${task.toAgentId} 暂不支持自动拆解`);
          skippedCount++;
          results.push({
            taskId: task.taskId,
            toAgentId: task.toAgentId,
            status: 'skipped',
            reason: '暂不支持此 Agent 的自动拆解',
          });
          continue;
        }

        // 调用拆解接口
        const response = await fetch(splitUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-token': process.env.INTERNAL_API_TOKEN || 'internal-svc-token-2025-07',
          },
          body: JSON.stringify(requestBody),
        });

        const splitResult = await response.json();

        if (splitResult.success) {
          console.log(`  ✅ 拆解成功: ${task.taskId}`);
          processedCount++;
          results.push({
            taskId: task.taskId,
            toAgentId: task.toAgentId,
            status: 'success',
          });
        } else {
          console.log(`  ❌ 拆解失败: ${splitResult.error}`);
          errorCount++;
          results.push({
            taskId: task.taskId,
            toAgentId: task.toAgentId,
            status: 'failed',
            error: splitResult.error,
          });
        }
      } catch (error) {
        console.error(`  ❌ 处理任务 ${task.taskId} 失败:`, error);
        errorCount++;
        results.push({
          taskId: task.taskId,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    console.log(`\n✅ 定时任务完成: 处理 ${processedCount} 个，跳过 ${skippedCount} 个，失败 ${errorCount} 个`);

    return NextResponse.json({
      success: true,
      message: `处理了 ${processedCount} 个任务，跳过 ${skippedCount} 个，失败 ${errorCount} 个`,
      processedCount,
      skippedCount,
      errorCount,
      results,
    });
  } catch (error) {
    console.error('❌ [auto-split-agent-tasks] 定时任务失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

/**
 * GET /api/cron/auto-split-agent-tasks
 * 查询待拆解任务状态
 */
export async function GET() {
  try {
    const tasks = await db
      .select()
      .from(agentTasks)
      .where(
        or(
          eq(agentTasks.splitStatus, 'pending_split'),
          and(
            eq(agentTasks.splitStatus, 'splitting'),
            isNotNull(agentTasks.splitStartTime),
            lt(agentTasks.splitStartTime, new Date(Date.now() - 60 * 60 * 1000))
          )
        )
      );

    return NextResponse.json({
      success: true,
      pendingSplitCount: tasks.length,
      tasks: tasks.map(t => ({
        taskId: t.taskId,
        taskName: t.taskName,
        toAgentId: t.toAgentId,
        executor: t.executor,
        taskPriority: t.taskPriority,
        createdAt: t.createdAt,
      })),
    });
  } catch (error) {
    console.error('❌ 查询失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

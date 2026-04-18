/**
 * 定时任务缓存测试 API
 * 模拟定时任务处理多个任务的场景，验证缓存是否生效
 */

import { NextRequest, NextResponse } from 'next/server';
import { agentSelfCheck, getCacheStats, clearAllCaches } from '@/lib/agent-llm';

/**
 * POST /api/test/cron-cache
 * 测试定时任务场景下的缓存行为
 * 请求体：
 * - taskCount: 任务数量（默认 5）
 * - sameTask: 是否处理相同任务（默认 true）
 */
export async function POST(request: NextRequest) {
  try {
    const { taskCount = 5, sameTask = true } = await request.json();

    console.log('🧪 开始定时任务缓存测试...');
    console.log(`  - 任务数量: ${taskCount}`);
    console.log(`  - 相同任务: ${sameTask}`);

    // 清空缓存，确保测试准确
    clearAllCaches();

    // 模拟任务
    const tasks = [];
    for (let i = 0; i < taskCount; i++) {
      if (sameTask) {
        tasks.push({
          id: i + 1,
          executor: 'insurance-d',
          taskName: '撰写一篇关于重疾险的文章',
          commandContent: '要求包括产品对比、理赔流程、注意事项，字数 1500 字',
        });
      } else {
        tasks.push({
          id: i + 1,
          executor: 'insurance-d',
          taskName: `撰写第 ${i + 1} 篇保险文章`,
          commandContent: `要求包括产品对比、理赔流程、注意事项，字数 ${1000 + i * 100} 字`,
        });
      }
    }

    const results = [];
    let totalDuration = 0;
    let cacheHitCount = 0;

    // 处理所有任务
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      console.log(`\n处理任务 ${i + 1}/${tasks.length} (ID: ${task.id})...`);

      const startTime = Date.now();
      const result = await agentSelfCheck(task.executor, task);
      const duration = Date.now() - startTime;

      totalDuration += duration;

      const isCacheHit = duration < 10;
      if (isCacheHit) {
        cacheHitCount++;
      }

      results.push({
        taskId: task.id,
        taskName: task.taskName,
        duration,
        isCacheHit,
        result: result.resolution,
        hasQuestions: result.hasQuestions,
      });

      console.log(`  - 耗时: ${duration}ms`);
      console.log(`  - 结果: ${result.resolution}`);
      console.log(`  - 缓存: ${isCacheHit ? '✅ 命中' : '❌ 未命中'}`);
    }

    // 获取缓存统计
    const cacheStats = getCacheStats();

    return NextResponse.json({
      success: true,
      data: {
        totalTasks: tasks.length,
        totalDuration,
        averageDuration: (totalDuration / tasks.length).toFixed(2),
        cacheHitCount,
        cacheMissCount: tasks.length - cacheHitCount,
        cacheHitRate: ((cacheHitCount / tasks.length) * 100).toFixed(2),
        results,
        cacheStats,
      },
      message: `处理了 ${tasks.length} 个任务，缓存命中率 ${((cacheHitCount / tasks.length) * 100).toFixed(2)}%`,
    });
  } catch (error) {
    console.error('❌ 测试失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
      message: '测试失败',
    }, { status: 500 });
  }
}

/**
 * GET /api/test/cron-cache/stats
 * 获取缓存统计信息
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📊 获取缓存统计信息...');

    const stats = getCacheStats();

    return NextResponse.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        stats,
      },
      message: '缓存统计信息已获取',
    });
  } catch (error) {
    console.error('❌ 获取缓存统计失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
      message: '获取缓存统计失败',
    }, { status: 500 });
  }
}

/**
 * DELETE /api/test/cron-cache
 * 清空缓存
 */
export async function DELETE(request: NextRequest) {
  try {
    console.log('🧹 清空缓存...');

    clearAllCaches();

    return NextResponse.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        message: '缓存已清空',
      },
      message: '缓存已清空',
    });
  } catch (error) {
    console.error('❌ 清空缓存失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
      message: '清空缓存失败',
    }, { status: 500 });
  }
}

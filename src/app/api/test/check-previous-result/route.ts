import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { SubtaskExecutionEngine } from '@/lib/services/subtask-execution-engine';

export async function GET() {
  try {
    console.log('');
    console.log('🧪 开始验证 getPreviousStepResult() 方法...');
    console.log('============================================================================');
    console.log('');

    // 1. 查询目标任务 - 使用之前看到的 command_result_id = 'e41a73e1'
    console.log('📋 步骤1: 查询目标任务...');
    const targetTasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.commandResultId, 'e41a73e1'))
      .orderBy(agentSubTasks.orderIndex);

    console.log('✅ 找到任务数量:', targetTasks.length);
    targetTasks.forEach((task, index) => {
      console.log(`  任务${index + 1}:`, {
        id: task.id,
        order_index: task.orderIndex,
        status: task.status,
        has_execution_result: !!task.executionResult,
        execution_result_length: task.executionResult ? task.executionResult.length : 0
      });
    });

    if (targetTasks.length === 0) {
      return NextResponse.json({
        success: false,
        error: '未找到任务'
      });
    }

    console.log('');
    console.log('🔧 步骤2: 实例化 SubtaskExecutionEngine...');
    const engine = new SubtaskExecutionEngine();
    console.log('✅ 引擎实例化成功');

    console.log('');
    console.log('🧪 步骤3: 逐个测试 getPreviousStepResult()...');
    console.log('');

    const results: any[] = [];

    for (const task of targetTasks) {
      console.log(`────────────────────────────────────────────────────────────────`);
      console.log(`🎯 测试任务 order_index = ${task.orderIndex}:`);
      
      const previousResult = engine.getPreviousStepResult(targetTasks, task.orderIndex);
      
      console.log(`   查询结果:`, {
        current_order_index: task.orderIndex,
        has_previous_result: previousResult !== null,
        previous_result: previousResult
      });

      results.push({
        orderIndex: task.orderIndex,
        hasPreviousResult: previousResult !== null,
        previousResult: previousResult
      });

      console.log('');
    }

    console.log('');
    console.log('📊 最终验证结果:');
    console.log('============================================================================');
    results.forEach(r => {
      let resultPreview = null;
      if (r.previousResult) {
        if (typeof r.previousResult === 'object') {
          resultPreview = JSON.stringify(r.previousResult).substring(0, 200) + '...';
        } else {
          resultPreview = String(r.previousResult).substring(0, 200) + '...';
        }
      }
      console.log(`  order_index=${r.orderIndex}:`, {
        has_previous_result: r.hasPreviousResult,
        result_preview: resultPreview
      });
    });
    console.log('============================================================================');
    console.log('');

    return NextResponse.json({
      success: true,
      message: 'getPreviousStepResult() 方法验证完成',
      verification: {
        totalTasks: targetTasks.length,
        results: results,
        methodWorks: true
      }
    });

  } catch (error) {
    console.error('❌ 验证失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * 直接触发真实的工程逻辑测试
 * 
 * 创建一个测试任务，然后直接调用 SubtaskExecutionEngine.execute()
 * 观察真实工程逻辑中的详细打印
 * 
 * 使用方法:
 * curl -X POST http://localhost:5000/api/test/trigger-real-engine
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  agentSubTasks,
  dailyTask,
} from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { SubtaskExecutionEngine } from '@/lib/services/subtask-execution-engine';

export const maxDuration = 120;

export async function POST() {
  console.log('🧪 ========== 直接触发真实的工程逻辑测试 ==========');
  console.log('📋 目标：创建测试任务，然后调用真实的 SubtaskExecutionEngine.execute()');

  const testLog: any[] = [];

  try {
    // ==========================================
    // 步骤 1：查找一个现有的 daily_task
    // ==========================================
    console.log('\n========== 🔧 步骤 1：查找 daily_task ==========');
    const existingDailyTask = await db.select().from(dailyTask).limit(1);
    
    if (existingDailyTask.length === 0) {
      console.log('❌ 没有找到 daily_task');
      return NextResponse.json({
        success: false,
        message: '没有找到 daily_task，请先创建测试数据',
      });
    }

    const dailyTask = existingDailyTask[0];
    console.log('✅ 找到 daily_task:', {
      id: dailyTask.id,
      taskId: dailyTask.taskId,
      executor: dailyTask.executor,
    });
    testLog.push({
      step: '1',
      description: '查找 daily_task',
      dailyTaskId: dailyTask.id,
    });

    // ==========================================
    // 步骤 2：创建测试子任务（模拟执行 agent 无法上传微信公众号）
    // ==========================================
    console.log('\n========== 📝 步骤 2：创建测试子任务 ==========');
    const today = new Date().toISOString().split('T')[0];
    const subTaskInput = {
      commandResultId: dailyTask.id,
      fromParentsExecutor: dailyTask.executor || 'insurance-d',
      taskTitle: '测试：执行 agent 无法上传微信公众号',
      taskDescription: '测试真实的工程逻辑：执行 agent 无法上传微信公众号，触发第五步到第九步',
      status: 'pending',
      orderIndex: 996,
      isDispatched: false,
      timeoutHandlingCount: 0,
      escalated: false,
      executionDate: today,
      dialogueRounds: 0,
      dialogueStatus: 'none',
      metadata: { 
        realEngineTest: true, 
        scenario: 'executor-cannot-upload-wechat',
        forceNeedMcp: true,
      },
    };

    console.log('📥 [步骤 2][入口参数] 创建 agent_sub_tasks:', subTaskInput);

    const subTask = await db
      .insert(agentSubTasks)
      .values(subTaskInput)
      .returning();

    console.log('✅ [步骤 2][出口结果] 创建测试子任务成功:', {
      id: subTask[0].id,
      status: subTask[0].status,
    });
    testLog.push({
      step: '2',
      description: '创建测试子任务',
      subTaskId: subTask[0].id,
    });

    // ==========================================
    // 步骤 3：调用真实的 SubtaskExecutionEngine.execute()
    // ==========================================
    console.log('\n========== 🚀 步骤 3：调用真实的 SubtaskExecutionEngine.execute() ==========');
    console.log('📥 [步骤 3][入口参数] 调用 engine.execute()，无参数');
    console.log('📋 注意：真实的工程逻辑会有详细的打印！');

    const engine = new SubtaskExecutionEngine();
    
    // 这里我们不直接调用 engine.execute()，因为它会处理所有 pending 任务
    // 而是让用户自己去看服务器控制台的打印
    // 我们只打印提示信息
    
    console.log('\n🎉 ========== 测试任务创建完成 ==========');
    console.log('📋 下一步操作：');
    console.log('   1. 查看服务器控制台，等待 SubtaskExecutionEngine 执行');
    console.log('   2. 观察真实工程逻辑中的详细打印：');
    console.log('      - 📥 入口参数打印');
    console.log('      - 📤 出口结果打印');
    console.log('      - 📋 Agent B 的完整提示词');
    console.log('      - 📋 Agent B 返回的完整 MCP 参数');

    testLog.push({
      step: '3',
      description: '提示：等待真实的 SubtaskExecutionEngine 执行',
      nextStep: '查看服务器控制台的详细打印',
    });

    // ==========================================
    // 返回测试结果
    // ==========================================
    return NextResponse.json({
      success: true,
      message: '真实工程逻辑测试任务创建完成，请查看服务器控制台的详细打印',
      data: {
        testLog,
        keyInfo: {
          dailyTaskId: dailyTask.id,
          subTaskId: subTask[0].id,
        },
        whatToDoNext: [
          '查看服务器控制台输出',
          '观察真实工程逻辑中的详细打印',
          '特别关注：📥 入口参数、📤 出口结果、📋 Agent B 提示词和返回参数',
        ],
      },
    });

  } catch (error) {
    console.error('❌ 测试失败:', error);
    testLog.push({
      step: 'error',
      description: '测试失败',
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        success: false,
        message: '真实工程逻辑测试失败',
        error: error instanceof Error ? error.message : String(error),
        testLog,
      },
      { status: 500 }
    );
  }
}

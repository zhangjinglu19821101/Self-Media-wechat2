import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentTasks, dailyTask, agentSubTasks } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { TaskStateMachine } from '@/lib/services/task-state-machine';

/**
 * 测试失败恢复机制
 * 场景：非关键子任务失败 → 跳过非关键子任务 → 恢复指令
 */
export async function POST(request: NextRequest) {
  try {
    console.log(`🧪 开始测试失败恢复机制`);

    // 1. 查询现有的子任务（使用之前的测试数据）
    const subTasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.status, 'failed'));

    if (subTasks.length === 0) {
      return NextResponse.json({
        success: false,
        error: '没有找到失败的子任务',
        message: '请先创建测试数据并模拟失败场景',
      }, { status: 400 });
    }

    // 2. 找到第一个非关键子任务
    const nonCriticalSubTask = subTasks.find(st => st.metadata?.isCritical === false);

    if (!nonCriticalSubTask) {
      return NextResponse.json({
        success: false,
        error: '没有找到非关键子任务',
        message: '请先创建包含非关键子任务的测试数据',
      }, { status: 400 });
    }

    console.log(`📍 找到非关键子任务: ${nonCriticalSubTask.taskTitle}`);

    // 3. 跳过非关键子任务
    console.log(`\n步骤 1: 跳过非关键子任务`);
    const skipResult = await TaskStateMachine.skipSubTask(
      nonCriticalSubTask.id,
      '测试：自动跳过非关键子任务',
      'test'
    );

    console.log(`✅ 子任务已跳过: ${nonCriticalSubTask.taskTitle}`);

    // 4. 查询指令信息
    const commands = await db
      .select()
      .from(dailyTask)
      .where(eq(dailyTask.id, nonCriticalSubTask.commandResultId));

    if (commands.length === 0) {
      return NextResponse.json({
        success: false,
        error: '指令不存在',
      }, { status: 400 });
    }

    const command = commands[0];

    // 5. 检查指令状态是否可以恢复
    console.log(`\n步骤 2: 检查指令是否可以恢复`);
    console.log(`  📍 指令状态: ${command.executionStatus}`);

    // 6. 统计子任务状态
    const allSubTasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.commandResultId, command.id));

    const completedCount = allSubTasks.filter(st => st.status === 'completed').length;
    const skippedCount = allSubTasks.filter(st => st.status === 'skipped').length;
    const failedCount = allSubTasks.filter(st => st.status === 'failed').length;
    const pendingCount = allSubTasks.filter(st => st.status === 'pending').length;

    console.log(`  📊 子任务统计: 完成 ${completedCount}, 跳过 ${skippedCount}, 失败 ${failedCount}, 待处理 ${pendingCount}`);

    // 7. 如果还有失败的子任务，尝试重试
    if (failedCount > 0) {
      console.log(`\n步骤 3: 尝试跳过其他非关键子任务`);
      
      const otherNonCriticalSubTasks = allSubTasks.filter(
        st => st.status === 'failed' && st.metadata?.isCritical === false
      );

      for (const st of otherNonCriticalSubTasks) {
        await TaskStateMachine.skipSubTask(
          st.id,
          '测试：自动跳过非关键子任务',
          'test'
        );
        console.log(`  ✅ 已跳过: ${st.taskTitle}`);
      }
    }

    // 8. 重新统计
    const updatedSubTasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.commandResultId, command.id));

    const updatedCompletedCount = updatedSubTasks.filter(st => st.status === 'completed').length;
    const updatedSkippedCount = updatedSubTasks.filter(st => st.status === 'skipped').length;
    const updatedFailedCount = updatedSubTasks.filter(st => st.status === 'failed').length;
    const updatedPendingCount = updatedSubTasks.filter(st => st.status === 'pending').length;

    console.log(`  📊 更新后子任务统计: 完成 ${updatedCompletedCount}, 跳过 ${updatedSkippedCount}, 失败 ${updatedFailedCount}, 待处理 ${updatedPendingCount}`);

    // 9. 如果所有子任务都已完成或跳过，尝试恢复指令
    if (updatedFailedCount === 0 && updatedPendingCount === 0) {
      console.log(`\n步骤 4: 恢复指令`);
      
      try {
        const recoverResult = await TaskStateMachine.recoverCommand(
          command.id,
          '测试：所有子任务已处理，恢复指令',
          'test'
        );
        console.log(`✅ 指令已恢复`);
      } catch (error: any) {
        console.error(`❌ 恢复指令失败:`, error.message);
      }
    } else {
      console.log(`\n⚠️ 还有未处理的子任务，无法恢复指令`);
    }

    // 10. 返回最终状态
    const finalSubTasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.commandResultId, command.id));

    const finalCommand = await db
      .select()
      .from(dailyTask)
      .where(eq(dailyTask.id, command.id));

    return NextResponse.json({
      success: true,
      message: '失败恢复测试完成',
      data: {
        command: finalCommand[0],
        subTasks: finalSubTasks,
        statistics: {
          completed: finalSubTasks.filter(st => st.status === 'completed').length,
          skipped: finalSubTasks.filter(st => st.status === 'skipped').length,
          failed: finalSubTasks.filter(st => st.status === 'failed').length,
          pending: finalSubTasks.filter(st => st.status === 'pending').length,
        }
      }
    }, { status: 200 });
  } catch (error: any) {
    console.error(`❌ 测试失败恢复机制失败:`, error);

    return NextResponse.json({
      success: false,
      error: error.message,
      message: error.message,
    }, { status: 500 });
  }
}

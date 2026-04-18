import { NextRequest, NextResponse } from 'next/server';
import { splitTaskForAgent } from '@/lib/agent-llm';
import { db } from '@/lib/db';
import { dailyTask, agents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * 测试关键子任务判断功能
 *
 * 测试步骤：
 * 1. 查询一个已存在的 commandResult
 * 2. 调用 splitTaskForAgent 拆分任务
 * 3. 验证返回的子任务中是否包含 isCritical 和 criticalReason 字段
 * 4. 输出判断结果
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const agentId = searchParams.get('agentId') || 'insurance-d';
    const commandResultId = searchParams.get('commandResultId');

    console.log(`🧪 测试关键子任务判断功能`);
    console.log(`📍 Agent ID: ${agentId}`);
    console.log(`📍 CommandResult ID: ${commandResultId || '自动查询'}`);

    // 1. 查询或使用指定的 commandResult
    let commandResult;
    if (commandResultId) {
      const results = await db.select().from(dailyTask).where(eq(dailyTask.id, commandResultId));
      commandResult = results[0];
    } else {
      // 查询最新的 commandResult
      const results = await db.select()
        .from(dailyTask)
        .where(eq(dailyTask.fromAgentId, agentId)) // 使用 from_agent_id 字段
        .orderBy(dailyTask.createdAt)
        .limit(1);
      commandResult = results[0];
    }

    if (!commandResult) {
      return NextResponse.json(
        {
          success: false,
          error: '未找到对应的任务',
          hint: '请指定 agentId 和 commandResultId，或确保该 agent 有历史任务',
        },
        { status: 404 }
      );
    }

    console.log(`✅ 找到任务: ${commandResult.id}`);
    console.log(`📋 任务内容: ${commandResult.taskName || commandResult.commandContent?.substring(0, 100)}...`);

    // 2. 调用 splitTaskForAgent
    const subTasks = await splitTaskForAgent(agentId, commandResult);

    console.log(`✅ 拆分完成，共 ${subTasks.length} 个子任务`);

    // 3. 分析关键子任务
    const criticalTasks = subTasks.filter((t) => t.isCritical);
    const nonCriticalTasks = subTasks.filter((t) => !t.isCritical);

    console.log(`🔥 关键子任务: ${criticalTasks.length} 个`);
    console.log(`⚪ 非关键子任务: ${nonCriticalTasks.length} 个`);

    // 4. 输出详细结果
    criticalTasks.forEach((task, index) => {
      console.log(`\n🔥 关键子任务 #${task.orderIndex}: ${task.title}`);
      console.log(`   原因: ${task.criticalReason}`);
    });

    nonCriticalTasks.forEach((task, index) => {
      console.log(`\n⚪ 非关键子任务 #${task.orderIndex}: ${task.title}`);
    });

    // 5. 返回测试结果
    return NextResponse.json({
      success: true,
      message: '关键子任务判断功能测试完成',
      data: {
        agentId,
        commandResultId: commandResult.id,
        commandResultName: commandResult.taskName,
        totalSubTasks: subTasks.length,
        criticalSubTasks: criticalTasks.length,
        nonCriticalSubTasks: nonCriticalTasks.length,
        criticalTasks: criticalTasks.map((task) => ({
          orderIndex: task.orderIndex,
          title: task.title,
          description: task.description,
          criticalReason: task.criticalReason,
        })),
        nonCriticalTasks: nonCriticalTasks.map((task) => ({
          orderIndex: task.orderIndex,
          title: task.title,
          description: task.description,
        })),
        allSubTasks: subTasks,
      },
    });
  } catch (error) {
    console.error('❌ 测试失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        hint: '请检查日志了解详细错误信息',
      },
      { status: 500 }
    );
  }
}

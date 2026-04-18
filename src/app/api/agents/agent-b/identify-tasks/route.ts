/**
 * Agent B 识别任务并分类处理
 * POST /api/agents/agent-b/identify-tasks
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import {
  identifyInsuranceDTasks,
  assignTasksToInsuranceD,
  WeeklyTaskList,
  TaskIdentificationResult,
} from '@/lib/services/task-assignment-service';
import { splitTaskForAgent } from '@/lib/agent-llm';
import { db } from '@/lib/db';
import { dailyTask } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * POST /api/agents/agent-b/identify-tasks
 * Agent B 从 Agent A 的一周工作任务中，识别任务并分类处理：
 * - 属于 insurance-d 的任务：下发给 insurance-d 拆解
 * - 不属于 insurance-d 的任务：Agent B 自己拆解
 */
export async function POST(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    console.log(`📥 收到 Agent B 任务识别请求`);

    // 解析请求体
    const body = await request.json();

    // 验证请求体格式
    if (!body.weeklyTasks) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必填字段：weeklyTasks',
        },
        { status: 400 }
      );
    }

    const weeklyTasks: WeeklyTaskList = body.weeklyTasks;

    // 验证 weeklyTasks 格式
    if (!weeklyTasks.tasks || !Array.isArray(weeklyTasks.tasks)) {
      return NextResponse.json(
        {
          success: false,
          error: 'weeklyTasks.tasks 必须是数组',
        },
        { status: 400 }
      );
    }

    if (weeklyTasks.tasks.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '任务列表为空',
        },
        { status: 400 }
      );
    }

    console.log(`📋 收到 ${weeklyTasks.tasks.length} 个任务`);

    // 步骤 1: Agent B 识别任务分类
    console.log(`\n=== 步骤 1: 识别任务分类 ===`);
    const identifiedTasks = await identifyInsuranceDTasks(weeklyTasks);

    // 分类任务
    const insuranceDTasks = identifiedTasks.filter(r => r.belongsToInsuranceD);
    const agentBTasks = identifiedTasks.filter(r => !r.belongsToInsuranceD);

    console.log(`🎯 任务分类结果：`);
    console.log(`   - 属于 insurance-d: ${insuranceDTasks.length} 个`);
    console.log(`   - 属于 Agent B: ${agentBTasks.length} 个`);

    if (identifiedTasks.length === 0) {
      return NextResponse.json({
        success: true,
        message: '没有识别出任何任务',
        results: [],
      });
    }

    // 步骤 2: 处理属于 insurance-d 的任务
    console.log(`\n=== 步骤 2: 处理 insurance-d 的任务 ===`);
    const insuranceDResults = [];

    if (insuranceDTasks.length > 0) {
      // 下发任务给 insurance-d
      const assignResult = await assignTasksToInsuranceD(insuranceDTasks);

      insuranceDResults.push({
        taskType: 'insurance-d',
        taskCount: insuranceDTasks.length,
        assignedCount: assignResult.assignedCount,
        tasks: insuranceDTasks,
        errors: assignResult.errors,
      });

      console.log(`✅ insurance-d 任务处理完成: 成功 ${assignResult.assignedCount} 个，失败 ${assignResult.errors.length} 个`);
    }

    // 步骤 3: Agent B 拆解自己的任务
    console.log(`\n=== 步骤 3: Agent B 拆解自己的任务 ===`);
    const agentBResults = [];

    if (agentBTasks.length > 0) {
      for (const task of agentBTasks) {
        try {
          console.log(`🔧 Agent B 拆解任务: ${task.taskName} (ID: ${task.taskId})`);

          // 查询任务详情（使用 taskId 字段而不是 id）
          const taskDetail = await db
            .select()
            .from(dailyTask)
            .where(eq(dailyTask.taskId, task.taskId))
            .limit(1);

          if (taskDetail.length === 0) {
            console.warn(`⚠️ 任务 ${task.taskId} 不存在，跳过`);
            continue;
          }

          // Agent B 拆解任务
          const subTasks = await splitTaskForAgent('agent-b', taskDetail[0]);

          agentBResults.push({
            taskId: task.taskId,
            taskName: task.taskName,
            success: true,
            subTaskCount: subTasks.length,
            subTasks: subTasks.map(st => ({
              orderIndex: st.orderIndex,
              title: st.title,
              executor: st.executor,
              isCritical: st.isCritical,
            })),
          });

          console.log(`✅ 任务 ${task.taskName} 拆解成功，子任务数量: ${subTasks.length}`);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`❌ 拆解任务 ${task.taskName} 失败:`, errorMsg);

          agentBResults.push({
            taskId: task.taskId,
            taskName: task.taskName,
            success: false,
            error: errorMsg,
          });
        }
      }

      console.log(`✅ Agent B 任务拆解完成: 成功 ${agentBResults.filter(r => r.success).length} 个，失败 ${agentBResults.filter(r => !r.success).length} 个`);
    }

    // 返回完整结果
    return NextResponse.json({
      success: true,
      message: `任务处理完成: insurance-d ${insuranceDTasks.length} 个，Agent B ${agentBTasks.length} 个`,
      summary: {
        totalTasks: identifiedTasks.length,
        insuranceDCount: insuranceDTasks.length,
        agentBCount: agentBTasks.length,
      },
      results: {
        insuranceD: insuranceDResults,
        agentB: agentBResults,
      },
      allTasks: identifiedTasks,
    });
  } catch (error) {
    console.error(`❌ 任务识别和处理失败:`, error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

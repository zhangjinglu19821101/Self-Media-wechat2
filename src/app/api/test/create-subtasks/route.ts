import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks, dailyTask } from '@/lib/db/schema';
import { randomUUID } from 'crypto';

export async function GET(request: NextRequest) {
  try {
    const results: any[] = [];

    // 1. 创建 agent B 的测试子任务
    const commandResultId1 = randomUUID();
    const subTaskId1 = randomUUID();

    // 先创建一个 commandResult
    await db.insert(dailyTask).values({
      id: commandResultId1,
      commandId: `cmd-test-${Date.now()}-01`,
      relatedTaskId: 'test-task-001',
      commandContent: '协调解决执行问题',
      executor: 'B',
      commandPriority: 'urgent',
      executionDeadlineStart: new Date(),
      executionDeadlineEnd: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2小时后
      deliverables: '提供合规解决方案',
      executionStatus: 'completed',
      splitter: 'test',
      entryUser: 'test',
      fromAgentId: 'test',
      toAgentId: 'test',
      originalCommand: '测试任务',
      executionResult: '{}',
      taskType: 'test',
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: new Date(),
    });

    // 创建 Agent B 的子任务
    await db.insert(agentSubTasks).values({
      id: subTaskId1,
      commandResultId: commandResultId1,
      fromParentsExecutor: 'B',
      taskTitle: '协调解决执行问题',
      taskDescription: 'insurance-d 在执行保险内容创作任务时遇到合规问题，需要你介入协调解决。问题：文章中使用了"最好"这个绝对化用语，不符合微信公众号合规规则。',
      status: 'in_progress',
      orderIndex: 1,
      startedAt: new Date(),
      metadata: {
        deadline: '2024-12-31',
        priority: '高',
        taskType: '协调沟通',
        estimatedHours: 1,
        acceptanceCriteria: '1. 提供明确的合规解决方案；2. 告知保险-d 如何修改内容；3. 确保修改后的内容符合微信公众号合规规则',
        isCritical: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    results.push({
      agentId: 'B',
      subTaskId: subTaskId1,
      status: 'created',
    });

    // 2. 创建 insurance-c 的测试子任务
    const commandResultId2 = randomUUID();
    const subTaskId2 = randomUUID();

    // 先创建一个 commandResult
    await db.insert(dailyTask).values({
      id: commandResultId2,
      commandId: `cmd-test-${Date.now()}-02`,
      relatedTaskId: 'test-task-002',
      commandContent: '制定保险内容推广方案',
      executor: 'insurance-c',
      commandPriority: 'urgent',
      executionDeadlineStart: new Date(),
      executionDeadlineEnd: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4小时后
      deliverables: '推广方案',
      executionStatus: 'completed',
      splitter: 'test',
      entryUser: 'test',
      fromAgentId: 'test',
      toAgentId: 'test',
      originalCommand: '测试任务',
      executionResult: '{}',
      taskType: 'test',
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: new Date(),
    });

    // 创建 insurance-c 的子任务
    await db.insert(agentSubTasks).values({
      id: subTaskId2,
      commandResultId: commandResultId2,
      fromParentsExecutor: 'insurance-c',
      taskTitle: '制定保险内容推广方案',
      taskDescription: '制定一篇关于"三口之家保险配置"科普文章的推广方案。文章已由 insurance-d 完成创作，需要你制定详细的推广策略，包括：1. 推广渠道选择；2. 发布时间规划；3. 互动引导话术；4. 引流触点设计。',
      status: 'in_progress',
      orderIndex: 1,
      startedAt: new Date(),
      metadata: {
        deadline: '2024-12-31',
        priority: '高',
        taskType: '运营推广',
        estimatedHours: 2,
        acceptanceCriteria: '1. 制定完整的推广方案；2. 选择合适的推广渠道（至少3个）；3. 设计合规的互动引导话术；4. 确保推广方案符合微信公众号合规规则',
        isCritical: true,
        criticalReason: '推广方案直接影响内容曝光量和引流效果',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    results.push({
      agentId: 'insurance-c',
      subTaskId: subTaskId2,
      status: 'created',
    });

    return NextResponse.json({
      success: true,
      message: '测试子任务创建成功',
      results,
      executeEndpoints: results.map(r => ({
        agentId: r.agentId,
        endpoint: `/api/subtasks/${r.subTaskId}/execute`,
      })),
    });
  } catch (error) {
    console.error('创建测试子任务失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { TaskManager } from '@/lib/services/task-manager';
import { requireAuth } from '@/lib/auth/context';

/**
 * GET /api/tasks/list
 * 获取任务列表
 *
 * 查询参数：
 * - agentId: Agent ID（可选），返回与该 Agent 相关的任务（发送或接收）
 * - fromAgentId: 发送方 Agent ID（可选），返回该 Agent 发送的任务
 * - toAgentId: 接收方 Agent ID（可选），返回该 Agent 接收的任务
 */
export async function GET(request: NextRequest) {
  console.log('📥 === /api/tasks/list 收到任务列表查询请求 ===');

  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const searchParams = request.nextUrl.searchParams;
    const agentId = searchParams.get('agentId');
    const fromAgentId = searchParams.get('fromAgentId');
    const toAgentId = searchParams.get('toAgentId');

    console.log('📦 查询参数:');
    console.log('  - agentId:', agentId);
    console.log('  - fromAgentId:', fromAgentId);
    console.log('  - toAgentId:', toAgentId);

    let tasks: any[] = [];

    // 根据查询参数获取任务
    if (fromAgentId && toAgentId) {
      // 查询两个 Agent 之间的任务
      tasks = await TaskManager.getTasksBetweenAgents(fromAgentId, toAgentId);
    } else if (fromAgentId) {
      // 查询发送方的任务
      tasks = await TaskManager.getTasksByFromAgent(fromAgentId);
    } else if (toAgentId) {
      // 查询接收方的任务
      tasks = await TaskManager.getTasksByToAgent(toAgentId);
    } else if (agentId) {
      // 查询与该 Agent 相关的所有任务（发送或接收）
      const sentTasks = await TaskManager.getTasksByFromAgent(agentId);
      const receivedTasks = await TaskManager.getTasksByToAgent(agentId);
      // 合并并去重
      tasks = [...sentTasks, ...receivedTasks].filter(
        (task, index, self) =>
          index === self.findIndex((t) => t.taskId === task.taskId)
      );
    } else {
      // 查询所有任务
      tasks = await TaskManager.getTasksByFromAgent('A'); // 临时方案：返回 A 发送的任务
    }

    // 获取任务统计
    let stats = null;
    if (agentId) {
      stats = await TaskManager.getTaskStats(agentId);
    }

    console.log(`✅ 查询到 ${tasks.length} 个任务`);

    return NextResponse.json(
      {
        success: true,
        data: {
          tasks,
          stats,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching tasks:', error);

    return NextResponse.json(
      {
        success: false,
        error: '获取任务列表失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

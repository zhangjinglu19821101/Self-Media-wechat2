/**
 * Stats API
 * 提供系统统计信息
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { agentManager } from '@/lib/agent-manager';
import { taskScheduler } from '@/lib/task-scheduler';
import { messageRouter } from '@/lib/message-router';

/**
 * GET /api/stats - 获取系统统计信息
 */
export async function GET() {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    // 获取 Agent 统计
    const agentStats = agentManager.getSystemStats();

    // 获取任务统计
    const taskStats = taskScheduler.getStats();

    // 获取消息统计
    const messageHistory = messageRouter.getMessageHistory();

    // 获取队列状态
    const queueStatus = taskScheduler.getAllQueueStatus();

    // 获取所有 Agent 的详细信息
    const agents = agentManager.getAllAgents();

    return NextResponse.json({
      success: true,
      data: {
        agents: {
          ...agentStats,
          details: agents.map((agent) => ({
            id: agent.id,
            name: agent.name,
            status: agent.status,
            currentTasks: agent.currentTasks,
            maxConcurrentTasks: agent.maxConcurrentTasks,
            utilization: agent.currentTasks / agent.maxConcurrentTasks,
          })),
        },
        tasks: taskStats,
        messages: {
          total: messageHistory.length,
          recent: messageHistory.slice(-10),
        },
        queues: Array.from(queueStatus.entries()).map(([agentId, status]) => ({
          agentId,
          waiting: status.waiting,
          running: status.running,
          maxConcurrent: status.maxConcurrent,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch stats',
      },
      { status: 500 }
    );
  }
}

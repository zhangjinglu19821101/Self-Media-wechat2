/**
 * Agent B 介入逻辑 API
 * 处理 Agent B 主动介入沟通、协助解决问题等操作
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { db } from '@/lib/db';
import { dailyTask, agentInteractions, agentNotifications } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { agentProvideSolution } from '@/lib/agent-llm';
import { detectProblem } from '@/lib/resolution-detector';
import { generateSessionId } from '@/lib/session-id';

/**
 * POST /api/agents/B/intervene
 * Agent B 主动介入沟通
 * 请求体：
 * - commandResultId: 任务 ID
 * - executorId: 执行者 ID
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { commandResultId, executorId } = await request.json();
    
    if (!commandResultId || !executorId) {
      return NextResponse.json({
        success: false,
        error: '缺少必填字段',
        message: '缺少必填字段：commandResultId, executorId',
      }, { status: 400 });
    }
    
    console.log(`⭐ Agent B 主动介入，任务 ID: ${commandResultId}, executor: ${executorId}`);
    
    // 1. 查询任务信息
    const task = await db
      .select()
      .from(dailyTask)
      .where(eq(dailyTask.id, commandResultId))
      .then(rows => rows[0]);
    
    if (!task) {
      return NextResponse.json({
        success: false,
        error: '任务不存在',
        message: `任务 ID ${commandResultId} 不存在`,
      }, { status: 404 });
    }
    
    // 2. 查询最近的交互记录
    const recentInteractions = await db
      .select()
      .from(agentInteractions)
      .where(eq(agentInteractions.commandResultId, commandResultId))
      .orderBy(desc(agentInteractions.createdAt))
      .limit(5);
    
    // 3. 创建或获取 session_id
    let sessionId = recentInteractions[0]?.sessionId;
    if (!sessionId) {
      sessionId = generateSessionId('consultation', 'B', executorId);
    }
    
    // 4. Agent B 询问 executor 遇到了什么问题
    await db.insert(agentInteractions).values({
      commandResultId,
      taskDescription: task.taskName || task.commandContent?.substring(0, 100),
      sessionId,
      sender: 'B',
      receiver: executorId,
      messageType: 'question',
      content: '你遇到了什么问题？我可以帮你分析并提供解决方案',
      roundNumber: 1,
    });
    
    console.log(`✅ Agent B 已发送询问消息`);
    
    return NextResponse.json({
      success: true,
      sessionId,
      message: 'Agent B 已介入沟通',
    });
  } catch (error) {
    console.error('❌ Agent B 介入失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
      message: 'Agent B 介入失败',
    }, { status: 500 });
  }
}

/**
 * POST /api/agents/B/continue-communication
 * Agent B 继续沟通
 * 请求体：
 * - commandResultId: 任务 ID
 * - executorId: 执行者 ID
 * - sessionId: 会话 ID
 * - currentRound: 当前轮次
 */
export async function PUT(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const { commandResultId, executorId, sessionId, currentRound } = await request.json();
    
    if (!commandResultId || !executorId || !sessionId || !currentRound) {
      return NextResponse.json({
        success: false,
        error: '缺少必填字段',
        message: '缺少必填字段：commandResultId, executorId, sessionId, currentRound',
      }, { status: 400 });
    }
    
    console.log(`💬 Agent B 继续沟通，第 ${currentRound} 轮`);
    
    // 1. 检查是否超过 10 次
    if (currentRound >= 10) {
      console.log(`⚠️ 超过 10 轮沟通，上报 Agent A`);
      
      // 插入 escalation 消息
      await db.insert(agentInteractions).values({
        commandResultId,
        sessionId,
        sender: 'B',
        receiver: 'A',
        messageType: 'escalation',
        content: `⚠️ ${executorId} 的任务经过 10 轮沟通仍未解决，需要您的介入`,
        roundNumber: currentRound,
        metadata: {
          escalationReason: '超过10轮沟通',
          communicationRounds: currentRound,
        },
      });
      
      // 插入到 agent_notifications 表（Agent A 页面可见）
      await db.insert(agentNotifications).values({
        notificationId: `notif-escalation-${Date.now()}`,
        fromAgentId: 'B',
        toAgentId: 'A',
        notificationType: 'escalation',
        title: '⚠️ 任务问题上报',
        content: `${executorId} 的任务经过 10 轮沟通仍未解决，需要您的介入`,
        relatedTaskId: commandResultId,
        status: 'unread',
        priority: 'high',
        metadata: {
          escalationReason: '超过10轮沟通',
          communicationRounds: currentRound,
        },
      });
      
      return NextResponse.json({
        success: true,
        escalated: true,
        message: '已上报 Agent A',
      });
    }
    
    // 2. 查询任务信息
    const task = await db
      .select()
      .from(dailyTask)
      .where(eq(dailyTask.id, commandResultId))
      .then(rows => rows[0]);
    
    // 3. 查询最近的交互记录
    const recentInteractions = await db
      .select()
      .from(agentInteractions)
      .where(eq(agentInteractions.sessionId, sessionId))
      .orderBy(desc(agentInteractions.createdAt))
      .limit(5);
    
    // 4. Agent B 提供建议或进一步提问
    const lastProblem = recentInteractions
      .filter(i => i.messageType === 'answer' && i.sender === executorId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.content || '';
    
    const agentBSuggestion = await agentProvideSolution('B', lastProblem, currentRound);
    
    await db.insert(agentInteractions).values({
      commandResultId,
      taskDescription: task.taskName || task.commandContent?.substring(0, 100),
      sessionId,
      sender: 'B',
      receiver: executorId,
      messageType: 'question',
      content: agentBSuggestion.suggestion,
      roundNumber: currentRound + 1,
    });
    
    console.log(`✅ Agent B 已发送第 ${currentRound + 1} 轮建议`);
    
    return NextResponse.json({
      success: true,
      roundNumber: currentRound + 1,
      suggestion: agentBSuggestion.suggestion,
      message: `Agent B 已发送第 ${currentRound + 1} 轮建议`,
    });
  } catch (error) {
    console.error('❌ Agent B 继续沟通失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
      message: 'Agent B 继续沟通失败',
    }, { status: 500 });
  }
}

/**
 * [DEPRECATED] POST /api/agents/B/process-answer
 * 此功能已移至独立路由 /api/agents/B/process-answer
 * 原废弃代码已删除，避免与上方 POST 冲突
 */

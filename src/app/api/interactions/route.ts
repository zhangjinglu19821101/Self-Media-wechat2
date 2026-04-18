/**
 * Agent 交互记录 API
 * 创建和查询 Agent 之间的交互记录
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentInteractions, dailyTask } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

/**
 * GET /api/interactions
 * 查询交互记录
 * 查询参数：
 * - commandResultId: 任务 ID
 * - sessionId: 会话 ID
 * - sender: 发送方
 * - receiver: 接收方
 * - messageType: 消息类型
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const commandResultId = searchParams.get('commandResultId');
    const sessionId = searchParams.get('sessionId');
    const sender = searchParams.get('sender');
    const receiver = searchParams.get('receiver');
    const messageType = searchParams.get('messageType');
    
    let query = db.select().from(agentInteractions);
    
    // 添加过滤条件
    if (commandResultId) {
      query = query.where(eq(agentInteractions.commandResultId, commandResultId));
    }
    
    if (sessionId) {
      query = query.where(eq(agentInteractions.sessionId, sessionId));
    }
    
    if (sender) {
      query = query.where(eq(agentInteractions.sender, sender));
    }
    
    if (receiver) {
      query = query.where(eq(agentInteractions.receiver, receiver));
    }
    
    if (messageType) {
      query = query.where(eq(agentInteractions.messageType, messageType));
    }
    
    // 按创建时间倒序排列
    const interactions = await query.orderBy(desc(agentInteractions.createdAt));
    
    return NextResponse.json({
      success: true,
      interactions,
      count: interactions.length,
    });
  } catch (error) {
    console.error('❌ 查询交互记录失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
      message: '查询交互记录失败',
    }, { status: 500 });
  }
}

/**
 * POST /api/interactions
 * 创建交互记录
 * 请求体：
 * - commandResultId: 任务 ID
 * - sessionId: 会话 ID
 * - sender: 发送方
 * - receiver: 接收方（可选）
 * - messageType: 消息类型
 * - content: 消息内容
 * - roundNumber: 轮次（可选）
 * - isResolution: 是否解决消息（可选）
 * - metadata: 元数据（可选）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      commandResultId,
      taskDescription,
      sessionId,
      sender,
      receiver,
      messageType,
      content,
      roundNumber,
      isResolution,
      metadata,
    } = body;
    
    // 验证必填字段
    if (!commandResultId || !sessionId || !sender || !messageType || !content) {
      return NextResponse.json({
        success: false,
        error: '缺少必填字段',
        message: '缺少必填字段：commandResultId, sessionId, sender, messageType, content',
      }, { status: 400 });
    }
    
    // 验证任务是否存在
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
    
    // 插入交互记录
    const interaction = await db
      .insert(agentInteractions)
      .values({
        commandResultId,
        taskDescription: taskDescription || task.taskName || task.commandContent?.substring(0, 100),
        sessionId,
        sender,
        receiver,
        messageType,
        content,
        roundNumber,
        isResolution: isResolution || false,
        metadata: metadata || {},
      })
      .returning();
    
    console.log(`✅ 创建交互记录成功：${interaction[0].id}`);
    
    return NextResponse.json({
      success: true,
      interaction: interaction[0],
      message: '创建交互记录成功',
    });
  } catch (error) {
    console.error('❌ 创建交互记录失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
      message: '创建交互记录失败',
    }, { status: 500 });
  }
}

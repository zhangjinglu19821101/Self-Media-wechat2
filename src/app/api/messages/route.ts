/**
 * Messages API
 * 提供消息发送和查询接口
 */

import { NextRequest, NextResponse } from 'next/server';
import { messageRouter } from '@/lib/message-router';
import { MessageType, TaskPriority, AgentId } from '@/lib/agent-types';

/**
 * POST /api/messages - 发送消息
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { from, to, type, content, priority = TaskPriority.MEDIUM, metadata } = body;

    // 验证必要字段
    if (!from || !to || !type || !content) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: from, to, type, content',
        },
        { status: 400 }
      );
    }

    // 验证 MessageType
    if (!Object.values(MessageType).includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid message type: ${type}`,
        },
        { status: 400 }
      );
    }

    // 创建并发送消息
    const message = messageRouter.createMessage(
      from as AgentId,
      to as AgentId,
      type,
      content,
      priority,
      metadata
    );

    const sent = await messageRouter.sendMessage(message);

    if (!sent) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to send message',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: message,
      message: 'Message sent successfully',
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to send message',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/messages - 获取消息历史
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const agentId = searchParams.get('agentId');
    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!)
      : undefined;

    let messages;

    if (agentId) {
      // 获取指定 Agent 的消息
      messages = messageRouter.getAgentMessages(agentId as AgentId, limit);
    } else {
      // 获取所有消息历史
      messages = messageRouter.getMessageHistory(limit);
    }

    return NextResponse.json({
      success: true,
      data: messages,
      count: messages.length,
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch messages',
      },
      { status: 500 }
    );
  }
}

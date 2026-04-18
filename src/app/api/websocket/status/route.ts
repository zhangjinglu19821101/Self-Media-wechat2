/**
 * WebSocket Server Status API
 * 用于查看 WebSocket 服务器的状态
 */

import { NextResponse } from 'next/server';
import { wsServer } from '@/lib/websocket-server';

/**
 * GET /api/websocket/status
 * 获取 WebSocket 服务器状态
 */
export async function GET() {
  try {
    const status = wsServer.getStatus();

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Error getting WebSocket server status:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取 WebSocket 服务器状态失败',
      },
      { status: 500 }
    );
  }
}

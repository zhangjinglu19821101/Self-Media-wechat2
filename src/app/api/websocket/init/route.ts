import { NextResponse } from 'next/server';
import { wsServer } from '@/lib/websocket-server';

/**
 * POST /api/websocket/init
 * 初始化 WebSocket 服务器
 *
 * 这个接口用于确保 WebSocket 服务器在应用启动时被初始化
 */
export async function POST() {
  try {
    console.log('🚀 Initializing WebSocket server...');

    // 检查 WebSocket 服务器是否已经在运行
    const status = wsServer.getStatus();

    if (status.running) {
      console.log('✅ WebSocket server is already running on port', status.port);
      return NextResponse.json({
        success: true,
        message: 'WebSocket server is already running',
        data: status,
      });
    }

    // 启动 WebSocket 服务器
    wsServer.start();

    // 等待一小段时间让服务器启动
    await new Promise(resolve => setTimeout(resolve, 100));

    // 再次检查状态
    const newStatus = wsServer.getStatus();

    if (newStatus.running) {
      console.log('✅ WebSocket server started successfully on port', newStatus.port);
      return NextResponse.json({
        success: true,
        message: 'WebSocket server started successfully',
        data: newStatus,
      });
    } else {
      throw new Error('Failed to start WebSocket server');
    }
  } catch (error) {
    console.error('❌ Failed to initialize WebSocket server:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/websocket/init
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
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

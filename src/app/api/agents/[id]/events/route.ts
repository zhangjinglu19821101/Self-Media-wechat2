/**
 * GET /api/agents/[id]/events
 * Server-Sent Events (SSE) API
 * 用于向 Agent 推送实时通知（任务结果等）
 */

import { NextRequest } from 'next/server';
import {
  addAgentConnection,
  removeAgentConnection,
} from '../../sse-manager';

/**
 * SSE API Route
 */
export const runtime = 'nodejs'; // 🔥 强制使用 Node.js Runtime

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;

  console.log(`📡 Agent ${agentId} 建立 SSE 连接`);

  let controller: ReadableStreamDefaultController | null = null;
  let heartbeatInterval: NodeJS.Timeout | null = null;

  // 创建一个 ReadableStream
  const stream = new ReadableStream({
    start(c) {
      controller = c;

      // 将连接添加到映射中
      addAgentConnection(agentId, controller);

      // 🔥 发送初始注释（不是消息），保持连接打开
      // 浏览器的 EventSource 会忽略注释
      const initialComment = `: Agent ${agentId} SSE connection established\n\n`;
      controller.enqueue(new TextEncoder().encode(initialComment));

      console.log(`✅ Agent ${agentId} SSE 连接已建立`);

      // 启动心跳（每 30 秒发送一次注释，保持连接活跃）
      heartbeatInterval = setInterval(() => {
        if (controller) {
          try {
            const heartbeat = `: keep-alive\n\n`;
            controller.enqueue(new TextEncoder().encode(heartbeat));
          } catch (error) {
            console.error(`SSE 心跳发送失败 Agent ${agentId}:`, error);
            if (heartbeatInterval) {
              clearInterval(heartbeatInterval);
            }
          }
        }
      }, 30000); // 每 30 秒发送一次心跳
    },

    cancel() {
      console.log(`❌ Agent ${agentId} SSE 连接已断开（cancel）`);

      // 清除心跳定时器
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }

      // 从映射中移除连接
      if (controller) {
        removeAgentConnection(agentId, controller);
      }
    },
  });

  // 返回 SSE 响应
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // 禁用 Nginx 缓冲
    },
  });
}

/**
 * 调度器测试 API
 * 用于手动启动/停止 TS 定时任务和 Agent B 巡检
 */

import { NextRequest, NextResponse } from 'next/server';
import { TSScheduler } from '@/lib/services/ts-scheduler';
import { AgentBInspector } from '@/lib/services/agent-b-inspector';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'status';

  try {
    console.log(`🔍 调度器测试 API，操作: ${action}`);

    if (action === 'start') {
      // 启动 TS 定时任务
      TSScheduler.start();
      console.log('✅ TS 定时任务已启动');

      // 启动 Agent B 巡检
      AgentBInspector.start();
      console.log('✅ Agent B 巡检已启动');

      return NextResponse.json({
        success: true,
        message: '调度器已启动',
        data: {
          tsScheduler: 'running',
          agentBInspector: 'running',
        },
      });
    } else if (action === 'stop') {
      // 停止 TS 定时任务
      TSScheduler.stop();
      console.log('✅ TS 定时任务已停止');

      // 停止 Agent B 巡检
      AgentBInspector.stop();
      console.log('✅ Agent B 巡检已停止');

      return NextResponse.json({
        success: true,
        message: '调度器已停止',
        data: {
          tsScheduler: 'stopped',
          agentBInspector: 'stopped',
        },
      });
    } else {
      // 返回状态
      return NextResponse.json({
        success: true,
        message: '调度器状态查询',
        data: {
          action: 'status',
          note: '使用 ?action=start 或 ?action=stop 来控制调度器',
        },
      });
    }
  } catch (error) {
    console.error('❌ 调度器测试失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '调度器测试失败',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

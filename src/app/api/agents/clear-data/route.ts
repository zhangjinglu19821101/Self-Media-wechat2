import { NextResponse } from 'next/server';
import { clearAgentData } from '@/lib/scripts/clear-agent-data';

/**
 * 清空 Agent 相关表数据
 *
 * POST /api/agents/clear-data
 *
 * 功能：
 * 1. 清空所有 agent 相关表的数据
 * 2. 重置 daily_task 表的状态字段
 * 3. 用于重新测试
 *
 * 注意：此操作会永久删除所有数据，请谨慎使用
 */
export async function POST() {
  try {
    console.log('📡 收到清空 Agent 数据请求');

    // 执行清空操作
    await clearAgentData();

    return NextResponse.json({
      success: true,
      message: 'Agent 相关表数据已清空',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ 清空数据失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

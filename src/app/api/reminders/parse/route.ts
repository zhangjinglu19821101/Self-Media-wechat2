/**
 * 提醒智能解析 API
 * POST /api/reminders/parse
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceId } from '@/lib/auth/context';
import { parseReminderInput } from '@/lib/services/reminder-parse-service';

export async function POST(request: NextRequest) {
  try {
    // 获取工作区ID
    const workspaceId = await getWorkspaceId(request);
    if (!workspaceId) {
      return NextResponse.json(
        { error: '未授权访问' },
        { status: 401 }
      );
    }
    
    // 解析请求体
    const body = await request.json();
    const { input } = body;
    
    if (!input || typeof input !== 'string') {
      return NextResponse.json(
        { error: '缺少 input 参数' },
        { status: 400 }
      );
    }
    
    // 调用解析服务
    const result = await parseReminderInput(input, workspaceId);
    
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[API /reminders/parse] 解析失败:', error);
    return NextResponse.json(
      { 
        error: '解析失败',
        message: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
}

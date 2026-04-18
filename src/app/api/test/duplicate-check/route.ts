/**
 * 防重功能测试 API
 * 测试 agentTasks 和 dailyTask 两张表的业务层面防重
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkDuplicateTaskSimple, checkDuplicateDailyTaskSimple } from '@/lib/services/duplicate-detection';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('🔍 [防重测试] 收到请求:', body);

    const { tableType, executor, command, taskId } = body;

    if (!tableType || !executor || !command) {
      return NextResponse.json(
        { success: false, error: '缺少必填参数：tableType, executor, command' },
        { status: 400 }
      );
    }

    let result;

    if (tableType === 'agentTasks') {
      // 测试 agentTasks 表
      console.log('🔍 [防重测试] 测试 agentTasks 表...');
      result = await checkDuplicateTaskSimple({
        executor: executor,
        coreCommand: command,
        excludeTaskId: taskId,
        timeWindowDays: 7,
      });
      console.log('✅ [防重测试] agentTasks 检测结果:', result);
    } else if (tableType === 'dailyTask') {
      // 测试 dailyTask 表
      console.log('🔍 [防重测试] 测试 dailyTask 表...');
      result = await checkDuplicateDailyTaskSimple({
        executor: executor,
        originalCommand: command,
        excludeTaskId: taskId,
        timeWindowDays: 7,
      });
      console.log('✅ [防重测试] dailyTask 检测结果:', result);
    } else {
      return NextResponse.json(
        { success: false, error: 'tableType 必须是 agentTasks 或 dailyTask' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      tableType,
      isDuplicate: result.isDuplicate,
      duplicateCount: result.duplicateTasks?.length || 0,
      duplicateTasks: result.duplicateTasks,
      warningMessage: result.warningMessage,
    });
  } catch (error) {
    console.error('❌ [防重测试] 测试失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '防重测试失败',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tableType = searchParams.get('tableType');
    const executor = searchParams.get('executor');
    const command = searchParams.get('command');
    const taskId = searchParams.get('taskId') || undefined;

    if (!tableType || !executor || !command) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必填参数：tableType, executor, command',
          usage: 'GET /api/test/duplicate-check?tableType=agentTasks&executor=insurance-d&command=测试指令',
        },
        { status: 400 }
      );
    }

    // 重定向到 POST
    return NextResponse.json({
      success: false,
      message: '请使用 POST 方法',
      usage: 'POST /api/test/duplicate-check with body: { tableType, executor, command, taskId }',
    });
  } catch (error) {
    console.error('❌ [防重测试] GET 请求失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '防重测试失败',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

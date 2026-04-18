import { NextRequest, NextResponse } from 'next/server';
import { agentTask } from '@/lib/services/agent-task';
import { checkDuplicateTaskSimple, checkDuplicateTaskFuzzy } from '@/lib/services/duplicate-detection';

/**
 * POST /api/agents/tasks
 * 创建Agent任务
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      fromAgentId,
      toAgentId,
      command,
      commandType,
      priority,
      metadata,
      checkDuplicate = true, // 是否检查重复，默认开启
      duplicateCheckMode = 'simple' // 重复检查模式：'simple' | 'fuzzy'
    } = body;

    // 验证参数
    if (!fromAgentId || !toAgentId || !command) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必要参数: fromAgentId, toAgentId, command',
        },
        { status: 400 }
      );
    }

    // 验证Agent ID（只有Agent A可以下达任务）
    if (fromAgentId !== 'A') {
      return NextResponse.json(
        {
          success: false,
          error: '只有Agent A（总裁）可以下达任务',
        },
        { status: 403 }
      );
    }

    // 验证目标Agent
    const validAgents = ['B', 'C', 'D', 'insurance-c', 'insurance-d'];
    if (!validAgents.includes(toAgentId)) {
      return NextResponse.json(
        {
          success: false,
          error: '无效的目标Agent ID',
        },
        { status: 400 }
      );
    }

    // 🔥 检测重复任务
    let duplicateCheckResult = null;
    if (checkDuplicate) {
      console.log(`[DuplicateCheck] 开始检测重复任务...`);
      console.log(`[DuplicateCheck] 模式: ${duplicateCheckMode}`);
      console.log(`[DuplicateCheck] 执行主体: ${toAgentId}`);

      if (duplicateCheckMode === 'fuzzy') {
        // 模糊匹配
        duplicateCheckResult = await checkDuplicateTaskFuzzy({
          executor: toAgentId,
          coreCommand: command,
          timeWindowDays: 7,
          similarityThreshold: 0.8,
        });
      } else {
        // 简单匹配（默认）
        duplicateCheckResult = await checkDuplicateTaskSimple({
          executor: toAgentId,
          coreCommand: command,
          timeWindowDays: 7,
        });
      }

      console.log(`[DuplicateCheck] 结果: ${duplicateCheckResult.isDuplicate ? '发现重复' : '无重复'}`);
      if (duplicateCheckResult.isDuplicate) {
        console.log(`[DuplicateCheck] 警告: ${duplicateCheckResult.warningMessage}`);
        console.log(`[DuplicateCheck] 重复任务数: ${duplicateCheckResult.duplicateTasks.length}`);
      }
    }

    // 🔥 如果检测到重复，返回警告信息
    if (duplicateCheckResult && duplicateCheckResult.isDuplicate) {
      return NextResponse.json({
        success: false,
        error: '检测到重复任务',
        duplicateCheck: {
          isDuplicate: true,
          duplicateTasks: duplicateCheckResult.duplicateTasks,
          warningMessage: duplicateCheckResult.warningMessage,
        },
        message: '检测到相似任务，是否确认继续创建？',
      }, { status: 409 }); // 409 Conflict
    }

    // 创建任务
    const task = await agentTask.createTask({
      fromAgentId,
      toAgentId,
      command,
      commandType: commandType || 'instruction',
      priority: priority || 'normal',
      metadata: metadata || {},
    });

    return NextResponse.json({
      success: true,
      data: {
        task,
        message: '任务已创建，等待执行',
      },
    });
  } catch (error) {
    console.error('Error creating agent task:', error);
    return NextResponse.json(
      {
        success: false,
        error: '创建任务失败',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

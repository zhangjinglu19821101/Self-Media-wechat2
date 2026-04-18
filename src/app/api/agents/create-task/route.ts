/**
 * 创建 agent_tasks 记录（第一次弹框确认时调用）
 * POST /api/agents/create-task
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { createAgentTaskWithDuplicateCheck } from '@/lib/services/command-result-service';

/**
 * POST /api/agents/create-task
 * 创建 agent_tasks 记录
 */
export async function POST(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const body = await request.json();
    const {
      fromAgentId,
      toAgentId,
      commandContent,
      priority = 'normal',
      commandType = 'instruction',
      taskName,
    } = body;

    if (!fromAgentId || !toAgentId || !commandContent) {
      return NextResponse.json(
        { success: false, error: '缺少必需参数：fromAgentId, toAgentId, commandContent' },
        { status: 400 }
      );
    }

    // 生成 taskId
    const taskId = `task-${fromAgentId}-to-${toAgentId}-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;

    // 提取任务名称
    const finalTaskName = taskName || commandContent.split('\n')[0].trim().substring(0, 100) || '未命名任务';

    // 计算时间范围（7天后）
    const taskDurationStart = new Date();
    const taskDurationEnd = new Date();
    taskDurationEnd.setDate(taskDurationEnd.getDate() + 7);

    // 提取验收标准（从指令中查找）
    const acceptanceCriteriaMatch = commandContent.match(/验收标准[:：]\s*([^。\n]+)/);
    const acceptanceCriteria = acceptanceCriteriaMatch ? acceptanceCriteriaMatch[1] : '按照指令要求完成任务';

    // 🔥 使用带防重功能的方法创建任务
    console.log(`🔍 [create-task] 准备创建任务: ${taskId}`);
    const result = await createAgentTaskWithDuplicateCheck({
      taskId,
      taskName: `任务拆解：${finalTaskName}`,
      coreCommand: commandContent,
      executor: `agent ${toAgentId}`,
      fromAgentId,
      toAgentId,
      acceptanceCriteria: acceptanceCriteria,
      taskType: 'master',
      splitStatus: 'splitting', // 🔥 修改：落库即开始拆解
      taskDurationStart,
      taskDurationEnd,
      totalDeliverables: '待确定',
      taskPriority: priority === 'high' ? 'urgent' : 'normal',
      taskStatus: 'unsplit', // 未拆解
      creator: fromAgentId,
      updater: fromAgentId,
      commandType,
      metadata: {
        source: 'agent-command',
        createdAt: new Date().toISOString(),
      },
      timeWindowDays: 7,
    });

    if (result.isDuplicate) {
      console.log(`⚠️ [create-task] 检测到重复任务: ${taskId}`);
      return NextResponse.json({
        success: true,
        message: '检测到重复任务，已跳过创建',
        data: {
          taskId,
          isDuplicate: true,
          duplicateTaskInfo: result.duplicateTaskInfo,
        },
      });
    }

    console.log(`✅ [create-task] 成功创建任务: taskId=${taskId}`);

    return NextResponse.json({
      success: true,
      message: '任务创建成功',
      data: {
        taskId,
        task: result.data,
        isDuplicate: false,
      },
    });
  } catch (error) {
    console.error('❌ 创建任务失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

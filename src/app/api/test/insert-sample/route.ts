/**
 * 插入测试数据 API
 * 用于测试防重功能
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentTasks, dailyTask } from '@/lib/db/schema';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('🔍 [插入测试数据] 收到请求:', body);

    const { tableType, executor, command, taskId } = body;

    if (!tableType || !executor || !command) {
      return NextResponse.json(
        { success: false, error: '缺少必填参数：tableType, executor, command' },
        { status: 400 }
      );
    }

    let result;

    if (tableType === 'agentTasks') {
      // 插入 agentTasks 表
      console.log('🔍 [插入测试数据] 插入 agentTasks 表...');
      const testTaskId = taskId || `test-agent-${Date.now()}`;
      result = await db.insert(agentTasks).values({
        taskId: testTaskId,
        taskName: `测试任务 ${testTaskId}`,
        coreCommand: command,
        executor: executor,
        acceptanceCriteria: '测试验收标准',
        taskType: 'split',
        taskStatus: 'pending',
        creator: 'A',
        updater: 'A',
        fromAgentId: 'A',
        toAgentId: executor,
        commandType: 'instruction',
        totalDeliverables: '0',
        taskDurationStart: new Date(),
        taskDurationEnd: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      console.log('✅ [插入测试数据] agentTasks 插入成功:', result);
    } else if (tableType === 'dailyTask') {
      // 插入 dailyTask 表
      console.log('🔍 [插入测试数据] 插入 dailyTask 表...');
      const testTaskId = taskId || `test-daily-${Date.now()}`;
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      result = await db.insert(dailyTask).values({
        taskId: testTaskId,
        commandId: `cmd-${Date.now()}`,
        relatedTaskId: 'test-master-task-001',
        taskTitle: `测试日任务 ${testTaskId}`,
        taskDescription: command,
        executor: executor,
        fromAgentId: 'A',
        toAgentId: executor,
        originalCommand: command,
        executionStatus: 'new',
        executionResult: null,
        executionDate: today,
        executionDeadlineStart: now,
        executionDeadlineEnd: new Date(now.getTime() + 86400000),
        deliverables: '测试交付物',
        taskPriority: 'normal',
        outputData: {},
        metrics: {},
        attachments: [],
        metadata: {},
        createdAt: now,
        updatedAt: now,
        // 必填字段默认值
        splitter: 'agent B',
        entryUser: 'TS',
        taskType: 'daily',
        dependencies: {},
        sortOrder: 0,
        completedSubTasks: 0,
        subTaskCount: 0,
        questionStatus: 'none',
        tsAwakeningCount: 0,
        awakeningCount: 0,
        reportCount: 0,
        requiresIntervention: false,
        dialogueRounds: 0,
        dialogueStatus: 'none',
      }).returning();
      console.log('✅ [插入测试数据] dailyTask 插入成功:', result);
    } else {
      return NextResponse.json(
        { success: false, error: 'tableType 必须是 agentTasks 或 dailyTask' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      tableType,
      data: result,
    });
  } catch (error) {
    console.error('❌ [插入测试数据] 插入失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '插入失败',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

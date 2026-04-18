/**
 * Agent B 上报功能
 * Agent B 上报报告给 Agent A
 */

import { getDatabase, schema } from '@/lib/db';
import { randomUUID } from 'crypto';
import { DialogueSummary, SuggestedAction, DialogueProcessEntry } from './summarize-dialogue';
import { DialogueResult } from './judge-executor-response';

// === 类型定义 ===

export interface ReportParams {
  reportType: 'subtask_timeout' | 'task_timeout'; // 报告类型
  commandResultId: string; // 指令结果 ID
  subTaskId?: string; // 子任务 ID（可选）
  summary: string; // 总结信息
  conclusion: string; // 结论
  dialogueProcess: DialogueProcessEntry[]; // 对话过程信息
  suggestedActions: SuggestedAction[]; // 建议的后续行动
  reportedFrom: string; // 上报人（通常是 'agent_b'）
}

// === 上报函数 ===

/**
 * Agent B 上报报告给 Agent A
 * @param params 上报参数
 * @returns 报告 ID
 */
export async function reportToAgentA(params: ReportParams): Promise<string> {
  console.log(`[Agent B] 开始上报报告给 Agent A...`);
  console.log(`[Agent B] 报告类型: ${params.reportType}`);
  console.log(`[Agent B] 指令结果 ID: ${params.commandResultId}`);

  const db = getDatabase();

  try {
    // === 步骤 1：创建报告记录 ===
    const reportId = randomUUID();

    await db.insert(schema.agentReports).values({
      id: reportId,
      reportType: params.reportType,
      commandResultId: params.commandResultId,
      subTaskId: params.subTaskId,
      summary: params.summary,
      conclusion: params.conclusion,
      dialogueProcess: params.dialogueProcess,
      suggestedActions: params.suggestedActions,
      reportedTo: 'agent_a',
      reportedFrom: params.reportedFrom,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(`[Agent B] 报告已创建，ID: ${reportId}`);

    // === 步骤 2：更新 command_results 表 ===
    await db
      .update(schema.dailyTask)
      .set({
        latestReportId: reportId,
        reportCount: sql`report_count + 1`,
        requiresIntervention: true,
        updatedAt: new Date(),
      })
      .where(eq(schema.dailyTask.id, params.commandResultId));

    console.log(`[Agent B] 已更新指令结果表`);

    // === 步骤 3：通知 Agent A ===
    await notifyAgentA(reportId, params);

    console.log(`[Agent B] 已通知 Agent A`);

    // === 步骤 4：返回报告 ID ===
    return reportId;
  } catch (error) {
    console.error('[Agent B] 上报报告失败:', error);
    throw error;
  }
}

/**
 * Agent B 上报报告（简化版，直接传入对话结果）
 * @param dialogueResult 对话结果
 * @param dialogueSummary 对话总结
 * @returns 报告 ID
 */
export async function reportDialogueResult(
  dialogueResult: DialogueResult,
  dialogueSummary: DialogueSummary
): Promise<string> {
  console.log(`[Agent B] 上报对话结果...`);

  // 确定报告类型
  const reportType: 'subtask_timeout' | 'task_timeout' =
    dialogueResult.roundCount > 5 ? 'task_timeout' : 'subtask_timeout';

  // 上报报告
  const reportId = await reportToAgentA({
    reportType,
    commandResultId: 'TODO: 从 dialogueResult 中获取', // TODO: 需要从 dialogueResult 中获取
    summary: dialogueSummary.summary,
    conclusion: dialogueSummary.conclusion,
    dialogueProcess: dialogueSummary.dialogueProcess,
    suggestedActions: dialogueSummary.suggestedActions,
    reportedFrom: 'agent_b',
  });

  console.log(`[Agent B] 对话结果已上报，报告 ID: ${reportId}`);

  return reportId;
}

/**
 * 通知 Agent A
 */
async function notifyAgentA(
  reportId: string,
  params: ReportParams
): Promise<void> {
  // TODO: 实际场景中，这里需要调用 Agent A 的通知接口
  // 目前只是记录日志

  console.log(`[Agent B] 通知 Agent A 查看报告: ${reportId}`);
  console.log(`[Agent B] 报告类型: ${params.reportType}`);
  console.log(`[Agent B] 总结: ${params.summary}`);
  console.log(`[Agent B] 结论: ${params.conclusion}`);
  console.log(`[Agent B] 建议行动: ${params.suggestedActions.map(a => a.action).join(', ')}`);

  // 创建通知记录（可选）
  try {
    const db = getDatabase();

    await db.insert(schema.agentNotifications).values({
      notificationId: `notify-${reportId}`,
      fromAgentId: 'agent_b',
      toAgentId: 'agent_a',
      notificationType: 'report',
      title: `新的报告需要处理`,
      content: params.summary,
      relatedTaskId: params.commandResultId,
      status: 'unread',
      priority: params.suggestedActions.some(a => a.priority === 'high') ? 'high' : 'normal',
      createdAt: new Date(),
    });

    console.log(`[Agent B] 已创建通知记录`);
  } catch (error) {
    console.error('[Agent B] 创建通知记录失败:', error);
    // 不抛出错误，因为通知记录是可选的
  }
}

// 导出 SQL 工具
import { sql } from 'drizzle-orm';
import { eq } from 'drizzle-orm';

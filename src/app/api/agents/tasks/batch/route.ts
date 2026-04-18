import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { db } from '@/lib/db';
import { agentTasks } from '@/lib/db/schema';
import { nanoid } from 'nanoid';
import { checkDuplicateTaskSimple, checkDuplicateTaskFuzzy } from '@/lib/services/duplicate-detection';

/**
 * 批量任务提交 API
 * POST /api/agents/tasks/batch
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { commands, checkDuplicate = true, duplicateCheckMode = 'simple' } = await request.json();

    // 参数验证
    if (!Array.isArray(commands) || commands.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'commands 必须是非空数组',
        },
        { status: 400 }
      );
    }

    // 验证每个 command 的必要字段
    for (const cmd of commands) {
      if (!cmd.fromAgentId || !cmd.toAgentId || !cmd.command) {
        return NextResponse.json(
          {
            success: false,
            error: '每个 command 必须包含 fromAgentId, toAgentId 和 command',
          },
          { status: 400 }
        );
      }
    }

    // 批量处理任务
    const results = await Promise.all(
      commands.map(async (cmd, index) => {
        try {
          // 重复检测
          let duplicateCheck: any = null;

          if (checkDuplicate) {
            // 根据模式选择检测方式
            if (duplicateCheckMode === 'fuzzy') {
              duplicateCheck = await checkDuplicateTaskFuzzy({
                executor: cmd.toAgentId,
                coreCommand: cmd.command,
              });
            } else {
              duplicateCheck = await checkDuplicateTaskSimple({
                executor: cmd.toAgentId,
                coreCommand: cmd.command,
              });
            }
          }

          // 检测到重复，返回重复信息（不创建）
          if (duplicateCheck?.isDuplicate) {
            return {
              index,
              command: cmd.command,
              status: 'duplicate' as const,
              duplicateCheck,
            };
          }

          // 无重复，创建任务
          const taskId = `task-${Date.now()}-${nanoid(8)}`;
          const now = new Date();
          const taskDurationEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 默认3天工期

          const newTask = await db.insert(agentTasks).values({
            taskId,
            taskName: `任务 ${taskId}`,
            coreCommand: cmd.command,
            executor: cmd.toAgentId,
            acceptanceCriteria: '待补充',
            taskType: 'master',
            splitStatus: 'pending_split',
            taskDurationStart: now,
            taskDurationEnd,
            totalDeliverables: 0,
            taskPriority: cmd.priority || 'normal',
            taskStatus: 'pending',
            creator: cmd.fromAgentId,
            updater: 'TS',
            remarks: null,
            fromAgentId: cmd.fromAgentId,
            toAgentId: cmd.toAgentId,
            commandType: cmd.commandType || 'task',
            result: null,
            metadata: {},
            createdAt: now,
            updatedAt: now,
            completedAt: null,
          }).returning();

          return {
            index,
            command: cmd.command,
            status: 'created' as const,
            task: newTask[0],
          };
        } catch (error: any) {
          return {
            index,
            command: cmd.command,
            status: 'error' as const,
            error: error.message || '创建失败',
          };
        }
      })
    );

    // 统计汇总
    const summary = {
      total: results.length,
      created: results.filter((r) => r.status === 'created').length,
      duplicates: results.filter((r) => r.status === 'duplicate').length,
      errors: results.filter((r) => r.status === 'error').length,
    };

    return NextResponse.json({
      success: true,
      results,
      summary,
    });
  } catch (error: any) {
    console.error('批量任务提交失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '批量任务提交失败',
      },
      { status: 500 }
    );
  }
}

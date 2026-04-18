/**
 * POST /api/commands/reject - Agent A 拒绝拆解
 *
 * 兼容两种模式：
 * 1. Agent B 拆解模式（处理 agent_tasks 表）
 * 2. insurance-d 拆解模式（处理 daily_task 表，暂预留）
 *
 * 请求体（兼容两种格式）：
 * {
 *   // Agent B 模式（旧格式）：
 *   agentId: "agent A",
 *   taskId: "task-001",
 *   rejectionReason: "..."
 *
 *   // 新模式（有 notificationId）：
 *   notificationId: "uuid",
 *   taskId: "task-id",
 *   rejectionReason: "..."
 * }
 *
 * 响应：
 * {
 *   success: true,
 *   message: "任务拆解已拒绝",
 *   data: { taskId, rejectionReason }
 * }
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dailyTask, agentTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { TaskManager } from '@/lib/services/task-manager';
import { insuranceDBatchSplitTask } from '@/lib/services/task-assignment-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[DEBUG] [/api/commands/reject] ===== 进入拒绝 API =====');
    console.log('[DEBUG] [/api/commands/reject] 收到请求:', body);
    console.log('[DEBUG] [/api/commands/reject] 是否有 splitResult:', !!body.splitResult);
    console.log('[DEBUG] [/api/commands/reject] splitResult 内容:', body.splitResult ? JSON.stringify(body.splitResult).substring(0, 200) + '...' : '无');

    // 兼容两种参数格式
    const {
      agentId,
      notificationId,
      taskId,
      rejectionReason,
      splitResult,
    } = body;

    // 检查必填参数
    if (!taskId || !rejectionReason) {
      return NextResponse.json(
        { success: false, error: '缺少必填参数：taskId, rejectionReason' },
        { status: 400 }
      );
    }

    // 判断是哪种模式
    const isNewFormat = !!notificationId;
    console.log(`🔥 [/api/commands/reject] 模式判断:`, {
      isNewFormat,
      agentId,
      notificationId,
      taskId,
    });

    if (isNewFormat) {
      // ==========================================
      // 新模式（有 notificationId）
      // ==========================================
      console.log('🔥 [/api/commands/reject] 处理新模式（有 notificationId）');

      if (!notificationId) {
        return NextResponse.json(
          { success: false, error: '新模式需要 notificationId 参数' },
          { status: 400 }
        );
      }

      // 先尝试查询 agent_tasks 表（Agent B 拆解）
      let agentTasksResult = await db
        .select()
        .from(agentTasks)
        .where(eq(agentTasks.taskId, taskId))
        .limit(1);

      if (agentTasksResult.length > 0) {
        // ==========================================
        // Agent B 拆解模式（处理 agent_tasks 表）
        // ==========================================
        const agentTask = agentTasksResult[0];
        console.log('[DEBUG] [/api/commands/reject] ===== 处理 Agent B 拆解模式 =====');
        console.log('[DEBUG] [/api/commands/reject] agentTask.metadata 原始 metadata:', JSON.stringify(agentTask.metadata, null, 2));
        console.log('[DEBUG] [/api/commands/reject] 准备保存的 splitResult:', splitResult ? JSON.stringify(splitResult).substring(0, 200) + '...' : '无');
        console.log(`✅ 找到 agent_task: id=${agentTask.id}, task_id=${agentTask.taskId}`);

        // 更新 agent_tasks 状态
        await db
          .update(agentTasks)
          .set({
            splitStatus: 'split_rejected', // 拆解被拒绝
            taskStatus: 'pending_review', // 回到待确认状态
            rejectionReason: rejectionReason, // 记录拒绝原因
            updatedAt: new Date(),
            metadata: {
              ...(agentTask.metadata || {}),
              splitRejected: true,
              splitRejectedAt: new Date().toISOString(),
              splitNotificationId: notificationId,
              rejectionReason: rejectionReason, // 🔥 保存拒绝原因到 metadata
              rejectionCount: ((agentTask.metadata?.rejectionCount || 0) + 1),
              splitResult: splitResult, // 🔥 保存上次拆解结果到 metadata（与 splitTaskForAgent 保持一致）
            },
          })
          .where(eq(agentTasks.taskId, taskId));

        console.log(`✅ agent_tasks 已更新: split_status=split_rejected`);

        // 🔥 异步触发重新拆解（不等待返回）
        console.log(`🔄 异步触发 Agent B 重新拆解...`);

        // 后台异步触发重新拆解（不等待）
        (async () => {
          try {
            console.log(`🔄 [后台] 开始调用重新拆解接口...`);
            const response = await fetch(`http://localhost:5000/api/agents/tasks/${taskId}/split`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-internal-token': process.env.INTERNAL_API_TOKEN || 'internal-svc-token-2025-07' },
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error(`❌ [后台] 重新拆解失败: ${errorText}`);
            } else {
              const result = await response.json();
              console.log(`✅ [后台] 重新拆解成功: ${result.data?.splitResult?.subtasks?.length || '新'} 个子任务`);
            }
          } catch (error) {
            console.error(`❌ [后台] 重新拆解异常:`, error);
          }
        })();

        // 立即返回，不等待后台拆解
        console.log(`✅ 立即返回响应，后台异步进行重新拆解`);
        return NextResponse.json({
          success: true,
          message: '拆解结果已拒绝，正在后台重新拆解',
          data: {
            taskId,
            asyncSplit: true, // 标记为异步拆解
          },
        });
      }

      // 如果 agent_tasks 表没找到，尝试查询 daily_task 表（insurance-d 拆解）
      let dailyTaskResult = await db
        .select()
        .from(dailyTask)
        .where(eq(dailyTask.taskId, taskId))
        .limit(1);

      if (dailyTaskResult.length === 0) {
        // 尝试用 UUID 查询
        dailyTaskResult = await db
          .select()
          .from(dailyTask)
          .where(eq(dailyTask.id, taskId))
          .limit(1);
      }

      if (dailyTaskResult.length > 0) {
        // ==========================================
        // insurance-d 拆解模式（处理 daily_task 表）
        // ==========================================
        console.log('🔥 [/api/commands/reject] 处理 insurance-d 拆解模式（daily_task 表）');

        const task = dailyTaskResult[0]; // 🔥 修复：变量名改为 task，避免与 schema 冲突
        console.log(`✅ 找到 daily_task: id=${task.id}, task_id=${task.taskId}`);

        // 更新 daily_task 状态
        await db
          .update(dailyTask)
          .set({
            executionStatus: 'pending_review', // 回到待确认状态
            updatedAt: new Date(),
            metadata: {
              ...(task.metadata || {}),
              splitRejected: true,
              splitRejectedAt: new Date().toISOString(),
              splitNotificationId: notificationId,
              rejectionReason: rejectionReason, // 🔥 保存拒绝原因到 metadata
              rejectionCount: ((task.metadata?.rejectionCount || 0) + 1),
              splitResult: splitResult, // 🔥 保存上次拆解结果到 metadata（与 splitTaskForAgent 保持一致）
            },
          })
          .where(eq(dailyTask.id, task.id)); // 🔥 修复：使用 task.id

        console.log(`✅ daily_task 已更新: splitRejected=true`);

        // 🔥 异步触发重新拆解（不等待返回）
        console.log(`🔄 异步触发 insurance-d 重新拆解...`);

        // 后台异步触发重新拆解（不等待）
        (async () => {
          try {
            console.log(`🔄 [后台] 开始调用 insuranceDBatchSplitTask...`);
            console.log(`🔄 [后台] 任务ID:`, task.id);
            
            const result = await insuranceDBatchSplitTask([task.id]);
            
            console.log(`✅ [后台] insurance-d 重新拆解成功:`, result);
          } catch (error) {
            console.error(`❌ [后台] insurance-d 重新拆解异常:`, error);
          }
        })();

        // 立即返回，不等待后台拆解
        console.log(`✅ 立即返回响应，后台异步进行重新拆解`);
        return NextResponse.json({
          success: true,
          message: '拆解结果已拒绝，正在后台重新拆解',
          data: {
            taskId,
            asyncSplit: true, // 标记为异步拆解
          },
        });
      }

      // 两个表都没找到
      console.error(`❌ [/api/commands/reject] 任务不存在: ${taskId}`);
      return NextResponse.json(
        { success: false, error: '任务不存在' },
        { status: 404 }
      );
    } else {
      // ==========================================
      // 旧模式（有 agentId）- 保持原有逻辑
      // ==========================================
      console.log('🔥 [/api/commands/reject] 处理旧模式（有 agentId）');

      if (!agentId) {
        return NextResponse.json(
          { success: false, error: '旧模式需要 agentId 参数' },
          { status: 400 }
        );
      }

      // 1. 验证总任务是否存在且属于该 Agent A
      const task = await TaskManager.getTask(taskId);
      if (!task) {
        return NextResponse.json(
          { success: false, error: '任务不存在' },
          { status: 404 }
        );
      }

      if (task.fromAgentId !== agentId) {
        return NextResponse.json(
          { success: false, error: '无权拒绝此任务' },
          { status: 403 }
        );
      }

      if (task.splitStatus !== 'split_pending_review') {
        return NextResponse.json(
          { success: false, error: '任务状态不允许拒绝' },
          { status: 400 }
        );
      }

      // 2. 获取当前拒绝历史（如果存在）
      const rejectionHistory = task.metadata?.rejectionHistory || [];

      // 3. 添加本次拒绝原因到历史记录
      const newRejectionHistory = [
        ...rejectionHistory,
        {
          reason: rejectionReason,
          rejectedAt: new Date().toISOString(),
          rejectedBy: agentId,
          rejectionCount: rejectionHistory.length + 1,
        },
      ];

      console.log(`📝 [/api/commands/reject] 拒绝历史记录 (${newRejectionHistory.length}次):`, newRejectionHistory.map((r) => `#${r.rejectionCount}: ${r.reason}`).join('\n'));

      // 4. 删除所有关联的子任务
      await db
        .delete(dailyTask)
        .where(eq(dailyTask.relatedTaskId, taskId));

      console.log(`✅ [/api/commands/reject] 已删除子任务数据`);

      // 5. 更新任务状态
      await TaskManager.updateTaskSplitStatus(taskId, 'split_rejected', {
        metadata: {
          ...task.metadata,
          rejectionReason,
          rejectedAt: new Date().toISOString(),
          rejectedBy: agentId,
          rejectionHistory: newRejectionHistory,
          totalRejections: newRejectionHistory.length,
        },
      });

      console.log(`✅ [/api/commands/reject] 任务拆解已拒绝: taskId=${taskId}, reason=${rejectionReason}, by=${agentId}`);

      return NextResponse.json({
        success: true,
        message: '任务拆解已拒绝',
        data: {
          taskId,
          rejectionReason,
          totalRejections: newRejectionHistory.length,
          rejectionHistory: newRejectionHistory,
          asyncSplit: false, // 🔥 明确标记为同步模式
        },
      });
    }
  } catch (error: any) {
    console.error('❌ [/api/commands/reject] 拒绝拆解失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '拒绝失败' },
      { status: 500 }
    );
  }
}

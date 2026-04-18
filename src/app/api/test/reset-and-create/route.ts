/**
 * 重置通知状态并创建新通知（原子操作）
 * POST /api/test/reset-and-create
 */

import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

export async function POST(request: NextRequest) {
  try {
    const sql = postgres(DATABASE_URL, {
      ssl: 'require',
      max: 1,
    });

    console.log('🔍 [重置+创建] 开始...');

    // 1. 先删除我刚才创建的测试通知
    await sql`
      DELETE FROM agent_notifications
      WHERE notification_id LIKE 'notif-%'
    `;
    console.log('✅ [重置+创建] 已删除测试通知');

    // 2. 重置旧通知的弹框状态
    await sql`
      UPDATE agent_notifications
      SET metadata = metadata - 'splitPopupStatus' - 'popupShownAt'
      WHERE notification_type = 'insurance_d_split_result'
        AND metadata ? 'splitPopupStatus'
    `;
    console.log('✅ [重置+创建] 已重置旧通知状态');

    // 3. 查询一个 insurance-d 任务
    const tasks = await sql`
      SELECT 
        id,
        task_id,
        task_title,
        executor,
        execution_date,
        sub_task_count
      FROM daily_task
      WHERE executor = 'insurance-d'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (tasks.length === 0) {
      await sql.end();
      return NextResponse.json({
        success: false,
        error: '没有 insurance-d 任务',
      });
    }

    const task = tasks[0];
    console.log(`📋 [重置+创建] 任务:`, task);

    // 4. 创建新通知（使用和旧通知完全一样的格式）
    const notificationId = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const splitResultContent = {
      fromAgentId: "insurance-d",
      toAgentId: "A",
      splitResult: {
        date: task.execution_date?.toISOString().split('T')[0] || "2026-02-20",
        executor: "insurance-d",
        taskCount: 1,
        totalSubTasks: 8,
        tasks: [
          {
            taskId: task.task_id,
            taskTitle: task.task_title,
            executor: "insurance-d",
            subTasks: [
              {
                orderIndex: 1,
                title: "指令拆解与核心方向确认",
                description: "接收任务指令，明确核心关键词，拆解用户需求，确定文章核心价值",
                executor: "insurance-d",
                deadline: "2026-02-20",
                priority: "urgent",
                estimatedHours: 2,
                acceptanceCriteria: "明确核心关键词、用户需求、文章核心价值",
                isCritical: true,
                criticalReason: "指令拆解决定文章整体方向"
              },
              {
                orderIndex: 2,
                title: "核心文本材料与案例获取",
                description: "获取基础科普素材，结合场景生成真实对比案例",
                executor: "insurance-d",
                deadline: "2026-02-20",
                priority: "urgent",
                estimatedHours: 3,
                acceptanceCriteria: "获取或生成至少2组对比案例",
                isCritical: true,
                criticalReason: "案例与素材是文章对比的基础"
              },
              {
                orderIndex: 3,
                title: "标题创作与合规自查",
                description: "创作标题，完成后自查合规性",
                executor: "insurance-d",
                deadline: "2026-02-20",
                priority: "urgent",
                estimatedHours: 2,
                acceptanceCriteria: "标题符合要求，无偏向性引导",
                isCritical: true,
                criticalReason: "标题是吸引目标用户的关键"
              },
              {
                orderIndex: 4,
                title: "文章框架搭建",
                description: "对照固定结构搭建框架",
                executor: "insurance-d",
                deadline: "2026-02-20",
                priority: "urgent",
                estimatedHours: 2,
                acceptanceCriteria: "框架完整，包含开头、正文、结尾",
                isCritical: true,
                criticalReason: "框架是文章的骨架"
              },
              {
                orderIndex: 5,
                title: "正文撰写与场景融入",
                description: "按内容规则撰写正文",
                executor: "insurance-d",
                deadline: "2026-02-21",
                priority: "urgent",
                estimatedHours: 6,
                acceptanceCriteria: "正文完成，字数符合要求",
                isCritical: true,
                criticalReason: "正文是任务的核心交付物"
              },
              {
                orderIndex: 6,
                title: "合规自查与结论标注",
                description: "对照合规底线检查，标注合规自查结论",
                executor: "insurance-d",
                deadline: "2026-02-21",
                priority: "urgent",
                estimatedHours: 2,
                acceptanceCriteria: "通过合规检查，文末标注明确的合规自查结论",
                isCritical: true,
                criticalReason: "保险内容必须通过合规审核"
              },
              {
                orderIndex: 7,
                title: "去AI校验与细节优化",
                description: "对照去AI核心要求自查",
                executor: "insurance-d",
                deadline: "2026-02-21",
                priority: "normal",
                estimatedHours: 2,
                acceptanceCriteria: "通过去AI校验，有2-3个生活化语气词",
                isCritical: false,
                criticalReason: ""
              },
              {
                orderIndex: 8,
                title: "最终核对与提交复核",
                description: "整体核对并提交复核",
                executor: "insurance-d",
                deadline: "2026-02-21",
                priority: "urgent",
                estimatedHours: 1,
                acceptanceCriteria: "所有核对项符合要求，提交至insurance-c",
                isCritical: true,
                criticalReason: "最终核对是确保文章符合任务要求的最后关卡"
              }
            ]
          }
        ]
      }
    };

    // 插入通知（使用和旧通知完全一样的字段名）
    const newNotification = await sql`
      INSERT INTO agent_notifications (
        notification_id,
        from_agent_id,
        to_agent_id,
        notification_type,
        title,
        content,
        related_task_id,
        status,
        priority,
        metadata,
        is_read
      ) VALUES (
        ${notificationId},
        'insurance-d',
        'A',
        'insurance_d_split_result',
        ${`insurance-d 批量拆解完成: 1 个任务 (${task.execution_date?.toISOString().split('T')[0] || '2026-02-20'}, insurance-d)`},
        ${JSON.stringify(splitResultContent)},
        ${task.task_id},
        'unread',
        'normal',
        ${JSON.stringify({
          taskId: task.task_id,
          // 注意：不设置 splitPopupStatus，让它保持 null
        })},
        false
      )
      RETURNING id, notification_id
    `;

    console.log(`✅ [重置+创建] 通知已创建:`, newNotification[0]);

    await sql.end();

    return NextResponse.json({
      success: true,
      message: '操作完成',
      taskId: task.task_id,
      notificationId: newNotification[0].notification_id,
      instructions: '请立即访问 /agents/A 页面查看弹框是否显示！',
    });
  } catch (error) {
    console.error('❌ [重置+创建] 失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

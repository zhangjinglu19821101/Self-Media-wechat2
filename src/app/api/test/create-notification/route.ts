/**
 * 为 insurance-d 创建拆解结果通知（模拟定时任务）
 * POST /api/test/create-notification
 */

import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/multi_platform_publish_db?sslmode=require&channel_binding=require';

export async function POST(request: NextRequest) {
  try {
    const sql = postgres(DATABASE_URL, {
      ssl: 'require',
      max: 1,
    });

    console.log('🔍 [创建通知] 开始...');

    // 查询任意状态的 insurance-d 任务
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

    console.log(`✅ [创建通知] 找到 ${tasks.length} 个任务`);

    if (tasks.length === 0) {
      await sql.end();
      return NextResponse.json({
        success: false,
        error: '没有 pending_review 状态的 insurance-d 任务',
      });
    }

    const task = tasks[0];
    console.log(`📋 [创建通知] 任务:`, task);

    // 使用之前成功的那个通知的 content
    const splitResultContent = {
      fromAgentId: "insurance-d",
      toAgentId: "A",
      splitResult: {
        date: "2026-02-20",
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
                title: "指令拆解与方向确认",
                description: "接收任务指令，明确核心关键词，拆解受众需求，确定文章核心价值",
                executor: "insurance-d",
                deadline: "2026-02-20",
                priority: "urgent",
                estimatedHours: 2,
                acceptanceCriteria: "明确核心关键词、受众需求、文章核心价值",
                isCritical: true,
                criticalReason: "指令拆解决定文章整体方向"
              },
              {
                orderIndex: 2,
                title: "核心文本材料获取与案例生成",
                description: "获取或生成基础科普素材、真实对比案例",
                executor: "insurance-d",
                deadline: "2026-02-20",
                priority: "urgent",
                estimatedHours: 3,
                acceptanceCriteria: "获取或生成至少2组真实场景案例",
                isCritical: true,
                criticalReason: "素材是文章撰写的基础"
              },
              {
                orderIndex: 3,
                title: "标题创作与合规自查",
                description: "严格按照标题规则创作标题，完成后自查合规性",
                executor: "insurance-d",
                deadline: "2026-02-20",
                priority: "urgent",
                estimatedHours: 2,
                acceptanceCriteria: "标题符合字数要求，包含三类指定词汇",
                isCritical: true,
                criticalReason: "标题是吸引读者的核心"
              },
              {
                orderIndex: 4,
                title: "文章框架搭建",
                description: "对照固定结构梳理内容框架",
                executor: "insurance-d",
                deadline: "2026-02-20",
                priority: "urgent",
                estimatedHours: 2,
                acceptanceCriteria: "框架包含开头、正文3条实操、结尾提醒",
                isCritical: true,
                criticalReason: "框架是文章的骨架"
              },
              {
                orderIndex: 5,
                title: "正文撰写与关键词嵌入",
                description: "按内容规则撰写正文",
                executor: "insurance-d",
                deadline: "2026-02-21",
                priority: "urgent",
                estimatedHours: 6,
                acceptanceCriteria: "正文完成，字数符合要求",
                isCritical: true,
                criticalReason: "正文是文章核心内容"
              },
              {
                orderIndex: 6,
                title: "合规自查与结论标注",
                description: "对照合规底线检查，标注合规自查结论",
                executor: "insurance-d",
                deadline: "2026-02-21",
                priority: "urgent",
                estimatedHours: 2,
                acceptanceCriteria: "通过合规检查，文末标注清晰的合规自查结论",
                isCritical: true,
                criticalReason: "保险内容必须合规"
              },
              {
                orderIndex: 7,
                title: "去AI校验与内容优化",
                description: "对照去AI核心要求自查",
                executor: "insurance-d",
                deadline: "2026-02-21",
                priority: "normal",
                estimatedHours: 2,
                acceptanceCriteria: "有2-3个生活化语气词，至少1条场景碎片",
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

    const notificationId = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // 插入通知
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
          splitPopupStatus: null,
        })},
        false
      )
      RETURNING id, notification_id
    `;

    console.log(`✅ [创建通知] 通知已创建:`, newNotification[0]);

    await sql.end();

    return NextResponse.json({
      success: true,
      message: '通知创建成功',
      taskId: task.task_id,
      notificationId: newNotification[0].notification_id,
    });
  } catch (error) {
    console.error('❌ [创建通知] 失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

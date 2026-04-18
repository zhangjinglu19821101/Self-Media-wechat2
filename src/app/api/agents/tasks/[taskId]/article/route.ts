/**
 * PUT /api/agents/tasks/[taskId]/article
 * 保存用户编辑的文章内容
 * 
 * 【两阶段流程】
 * - 第一阶段：用户编辑 insurance-d 生成的文章，保存后可触发第二阶段
 * - 文章内容存储在 resultText 字段，同时记录到 metadata.confirmedArticleContent
 * - 第二阶段任务通过 commandResultId 查询获取文章内容
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    console.log(`✏️ 保存用户编辑的文章，任务ID: ${taskId}`);

    // 解析请求体
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { success: false, error: '请求体格式错误' },
        { status: 400 }
      );
    }

    const { content } = body;

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { success: false, error: '文章内容不能为空' },
        { status: 400 }
      );
    }

    // 查询任务
    const task = await db.query.agentSubTasks.findFirst({
      where: eq(agentSubTasks.id, taskId),
    });

    if (!task) {
      return NextResponse.json(
        { success: false, error: '任务不存在' },
        { status: 404 }
      );
    }

    console.log(`📝 找到任务:`, {
      id: task.id,
      executor: task.fromParentsExecutor,
      orderIndex: task.orderIndex,
      originalLength: (task.executionResult || '').length,
      newLength: content.length,
    });

    // 更新文章内容到 executionResult 字段
    // 同时在 metadata 中记录用户编辑信息和阶段状态
    const updatedMetadata = {
      ...(task.metadata as object || {}),
      userEditedAt: new Date().toISOString(),
      userEditedContent: true,
      originalContent: task.executionResult,
      // 🔥 两阶段流程：标记文章已编辑，可进入第二阶段
      phase: 'creation_ready_for_publish', // 第一阶段完成，等待用户确认发布
      confirmedArticleContent: content, // 🔥 关键：存储最终确认的文章内容（第二阶段任务通过此字段获取）
      confirmedArticleLength: content.length,
    };

    await db
      .update(agentSubTasks)
      .set({
        resultText: content,
        metadata: updatedMetadata,
        updatedAt: new Date(),
      })
      .where(eq(agentSubTasks.id, taskId));

    console.log(`✅ 文章已保存，字数: ${content.length}`);

    return NextResponse.json({
      success: true,
      data: {
        taskId,
        contentLength: content.length,
        savedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('❌ 保存文章失败:', error);
    return NextResponse.json(
      { success: false, error: '保存失败: ' + (error instanceof Error ? error.message : '未知错误') },
      { status: 500 }
    );
  }
}

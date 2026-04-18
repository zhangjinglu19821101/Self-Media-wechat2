/**
 * 文章预览 API
 * 
 * GET /api/agents/preview-article - 获取文章预览内容
 * 
 * 功能：
 * 1. 获取指定预览节点任务的文章内容
 * 2. 从 resultData 中提取文章内容（由 executeUserPreviewEditTask 写入）
 * 3. 返回平台信息供前端选择合适的预览组件
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq, and, lt, desc } from 'drizzle-orm';
// 🔥🔥🔥 【P1-3修复】统一使用 agent-registry 中的平台映射
import { isWritingAgent, getPlatformForExecutor } from '@/lib/agents/agent-registry';

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  // 🔴 P0-2 修复：获取 workspaceId 用于隔离验证
  const workspaceId = authResult.workspaceId;

  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json(
        { success: false, error: '缺少 taskId 参数' },
        { status: 400 }
      );
    }

    // 🔴 P0-2 修复：查询时增加 workspaceId 隔离，防止越权访问
    const task = await db.query.agentSubTasks.findFirst({
      where: and(
        eq(agentSubTasks.id, taskId),
        eq(agentSubTasks.workspaceId, workspaceId)  // 强制隔离
      ),
    });

    if (!task) {
      return NextResponse.json(
        { success: false, error: '未找到任务' },
        { status: 404 }
      );
    }

    // 2. 从 resultData 提取预览数据
    let resultData: any = {};
    try {
      resultData = typeof task.resultData === 'string' 
        ? JSON.parse(task.resultData) 
        : task.resultData || {};
    } catch {
      resultData = {};
    }

    // 如果 resultData 中已有文章内容（由 executeUserPreviewEditTask 写入），直接使用
    let articleContent = resultData.articleContent || '';
    let articleTitle = resultData.articleTitle || '';
    let platform = resultData.platform || '';
    const writingTaskId = resultData.writingTaskId || null;
    // 🔥🔥🔥 【架构改造】平台渲染数据（独立于 articleContent 纯文本）
    let platformRenderData = resultData.platformRenderData || null;

    // 3. 如果没有预存内容（兼容旧流程），从前序写作任务获取
    if (!articleContent) {
      const previousTasks = await db
        .select()
        .from(agentSubTasks)
        .where(
          and(
            eq(agentSubTasks.commandResultId, task.commandResultId),
            lt(agentSubTasks.orderIndex, task.orderIndex)
          )
        )
        .orderBy(desc(agentSubTasks.orderIndex));

      const writingTask = previousTasks.find(t => isWritingAgent(t.fromParentsExecutor));

      if (writingTask) {
        // 🔥🔥🔥 【P0修复】安全解析 JSON，捕获异常
        let writingResultData: any = {};
        try {
          writingResultData = typeof writingTask.resultData === 'string'
            ? JSON.parse(writingTask.resultData)
            : writingTask.resultData || {};
        } catch (parseError) {
          console.error('[Preview Article] 解析 writingTask.resultData 失败:', parseError);
          writingResultData = {};
        }
        
        // 提取完整的执行结果
        const executorOutput = writingResultData?.executorOutput;
        const structuredResult = executorOutput?.structuredResult;
        const platformData = structuredResult?.resultContent?.platformData || 
                            structuredResult?.platformData;
        
        // 🔥🔥🔥 【架构改造】使用平台渲染数据提取器
        // 优先使用提取器获取结构化平台渲染数据
        const writingPlatform = getPlatformForExecutor(writingTask.fromParentsExecutor);
        if (writingPlatform && !platformRenderData) {
          try {
            const { extractPlatformRenderData } = await import('@/lib/platform-render/extractors');
            const taskMetadata = typeof task.metadata === 'object' && task.metadata !== null
              ? task.metadata as Record<string, unknown>
              : {};
            platformRenderData = extractPlatformRenderData(
              writingPlatform,
              writingTask.resultData,
              taskMetadata
            );
          } catch (extractErr) {
            console.warn('[Preview Article] 平台渲染数据提取失败:', extractErr);
          }
        }

        // 对于小红书，articleContent 保持为纯文本（来自 resultText）
        // 前端通过 platformRenderData 渲染卡片
        if (platformData && platformData.platform === 'xiaohongshu') {
          // 🔥🔥🔥 【架构改造】articleContent 不再是 JSON 字符串，改为纯文本
          // 旧逻辑：articleContent = JSON.stringify({...}) → 前端 parseXhsContent() 解析
          // 新逻辑：articleContent = 纯文本正文，platformRenderData = 结构化卡片数据
          articleContent = structuredResult?.resultContent?.content || writingTask.resultText || '';
          articleTitle = platformData.title || structuredResult?.resultContent?.articleTitle || '';
          platform = 'xiaohongshu';
        } else {
          // 其他平台使用 resultText
          articleContent = writingTask.resultText || '';
          articleTitle = extractArticleTitleFromResultData(writingTask.resultData, writingTask.taskTitle);
          // 🔥🔥🔥 【P1-3修复】使用 agent-registry 中的统一映射函数
          platform = resultData.platform || getPlatformForExecutor(writingTask.fromParentsExecutor);
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        taskId: task.id,
        taskTitle: task.taskTitle,
        articleContent,
        articleTitle,
        platform,
        writingTaskId,
        canEdit: resultData.canEdit !== false,
        canSkip: resultData.canSkip !== false,
        // 🔥🔥🔥 【架构改造】返回平台渲染数据
        // 前端组件根据此字段渲染平台专属UI（如小红书卡片）
        // articleContent 保持纯文本，platformRenderData 提供结构化数据
        platformRenderData,
      },
    });
  } catch (error) {
    console.error('[Preview Article] 获取预览内容失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '获取预览内容失败' },
      { status: 500 }
    );
  }
}

// ========== 辅助函数 ==========

function extractArticleTitleFromResultData(resultData: any, fallbackTitle?: string | null): string {
  if (!resultData) return fallbackTitle || '';
  try {
    const data = typeof resultData === 'string' ? JSON.parse(resultData) : resultData;
    if (data?.result?.articleTitle) return data.result.articleTitle;
    if (data?.articleTitle) return data.articleTitle;
    if (data?.executorOutput?.structuredResult?.articleTitle) return data.executorOutput.structuredResult.articleTitle;
  } catch {
    // ignore
  }
  return fallbackTitle || '';
}

// 🔥🔥🔥 【P1-3修复】已删除本地 getPlatformFromExecutor 函数
// 统一使用 agent-registry.ts 中的 getPlatformForExecutor

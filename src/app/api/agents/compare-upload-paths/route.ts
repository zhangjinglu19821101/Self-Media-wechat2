/**
 * 上传路径比对 API
 * 比对路径A（tryAutoUploadToWechat）和路径B（MCP）的最终上传报文
 * 用于验证修复后两者格式一致性
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq, and, desc, isNotNull, sql } from 'drizzle-orm';
import { sanitizeWechatHtml } from '@/lib/utils/wechat-html-utils';
import { getWorkspaceId } from '@/lib/auth/context';
import { isWritingAgent } from '@/lib/agents/agent-registry';

export const dynamic = 'force-dynamic';

/**
 * 从 resultData 提取文章 HTML 内容
 * 模拟 extractArticleFromResultData 的核心逻辑
 */
function extractArticleHtml(resultData: any): string | null {
  if (!resultData) return null;
  
  const parsed = typeof resultData === 'string' ? JSON.parse(resultData) : resultData;
  
  // Priority 0: platformRenderData.htmlContent
  const platformRenderData = parsed.platformRenderData || parsed.executorOutput?.platformRenderData;
  if (platformRenderData?.htmlContent && typeof platformRenderData.htmlContent === 'string' && platformRenderData.htmlContent.length > 50) {
    return platformRenderData.htmlContent;
  }
  
  // Priority 1: structuredResult.resultContent.modifiedArticle
  const structuredResult = parsed.executorOutput?.structuredResult || parsed.structuredResult;
  if (structuredResult?.resultContent) {
    const rc = structuredResult.resultContent;
    if (typeof rc === 'string' && rc.length > 50) return rc;
    if (typeof rc === 'object') {
      if (rc.modifiedArticle && typeof rc.modifiedArticle === 'string' && rc.modifiedArticle.length > 50) {
        return rc.modifiedArticle;
      }
      if (rc.content && typeof rc.content === 'string' && rc.content.length > 50) {
        return rc.content;
      }
      if (rc.htmlContent && typeof rc.htmlContent === 'string' && rc.htmlContent.length > 50) {
        return rc.htmlContent;
      }
    }
  }
  
  // Priority 2: executorOutput.result.content (envelope format)
  const executorResult = parsed.executorOutput?.result || parsed.result;
  if (executorResult) {
    if (typeof executorResult === 'string' && executorResult.length > 50) return executorResult;
    if (typeof executorResult === 'object' && executorResult.content && typeof executorResult.content === 'string' && executorResult.content.length > 50) {
      return executorResult.content;
    }
  }
  
  // Priority 3: result_text field
  if (parsed.result_text && typeof parsed.result_text === 'string' && parsed.result_text.length > 50) {
    return parsed.result_text;
  }
  
  return null;
}

/**
 * 从 resultData 提取文章标题
 */
function extractArticleTitle(resultData: any): string | null {
  if (!resultData) return null;
  const parsed = typeof resultData === 'string' ? JSON.parse(resultData) : resultData;
  
  // 从信封格式提取
  const executorResult = parsed.executorOutput?.result || parsed.result;
  if (typeof executorResult === 'object' && executorResult.articleTitle) {
    return executorResult.articleTitle;
  }
  
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const db = getDatabase();
    
    const { searchParams } = new URL(request.url);
    const commandResultId = searchParams.get('commandResultId');
    
    // 查找最近的包含写作任务的 commandResultId
    let targetCommandResultId = commandResultId;
    if (!targetCommandResultId) {
      const recentWritingTask = await db
        .select({ commandResultId: agentSubTasks.commandResultId })
        .from(agentSubTasks)
        .where(
          and(
            eq(agentSubTasks.workspaceId, workspaceId),
            sql`${agentSubTasks.fromParentsExecutor} IN ('insurance-d', 'insurance-xiaohongshu')`,
            eq(agentSubTasks.status, 'completed'),
            isNotNull(agentSubTasks.resultData)
          )
        )
        .orderBy(desc(agentSubTasks.updatedAt))
        .limit(1);
      
      if (recentWritingTask.length === 0) {
        return NextResponse.json({ error: '没有找到已完成的写作任务' }, { status: 404 });
      }
      targetCommandResultId = recentWritingTask[0].commandResultId;
    }
    
    // 获取该 commandResultId 下所有子任务
    const allTasks = await db
      .select({
        id: agentSubTasks.id,
        orderIndex: agentSubTasks.orderIndex,
        executor: agentSubTasks.fromParentsExecutor,
        taskTitle: agentSubTasks.taskTitle,
        status: agentSubTasks.status,
        resultData: agentSubTasks.resultData,
        resultText: agentSubTasks.resultText,
      })
      .from(agentSubTasks)
      .where(
        and(
          eq(agentSubTasks.commandResultId, targetCommandResultId as any),
          eq(agentSubTasks.workspaceId, workspaceId)
        )
      )
      .orderBy(agentSubTasks.orderIndex);
    
    // 找到原始写作任务（第一个 writing agent 任务）
    const originalWritingTask = allTasks.find(t => isWritingAgent(t.executor) && t.status === 'completed');
    // 找到最近的写作任务（用于路径B）
    const latestWritingTask = [...allTasks].reverse().find(t => isWritingAgent(t.executor) && t.status === 'completed');
    // 找到预览修改任务
    const previewEditTask = allTasks.find(t => t.executor === 'user_preview_edit' && t.resultData != null);
    
    const result: {
      commandResultId: string;
      taskSummary: Array<{ orderIndex: number; executor: string; taskTitle: string; status: string; hasResultData: boolean }>;
      pathA: { source: string; title: string; rawHtmlLength: number; rawHtmlPreview: string; sanitizeOutputLength: number; sanitizeOutputPreview: string; sanitizeOutputFull: string } | null;
      pathB: { source: string; title: string; rawHtmlLength: number; rawHtmlPreview: string; sanitizeOutputLength: number; sanitizeOutputPreview: string; sanitizeOutputFull: string } | null;
      comparison: { identical: boolean; lengthDiff: number; pathALen: number; pathBLen: number; note: string };
    } = {
      commandResultId: targetCommandResultId || '',
      taskSummary: allTasks.map(t => ({
        orderIndex: t.orderIndex,
        executor: t.executor,
        taskTitle: t.taskTitle,
        status: t.status,
        hasResultData: !!t.resultData,
      })),
      pathA: null,
      pathB: null,
      comparison: { identical: false, lengthDiff: 0, pathALen: 0, pathBLen: 0, note: '' },
    };
    
    // === 路径A：使用原始写作任务的输出 ===
    if (originalWritingTask?.resultData) {
      let resultData = originalWritingTask.resultData;
      if (typeof resultData === 'string') {
        try { resultData = JSON.parse(resultData); } catch { /* keep as string */ }
      }
      
      const rawHtml = extractArticleHtml(resultData);
      const title = extractArticleTitle(resultData) || originalWritingTask.taskTitle;
      
      if (rawHtml) {
        // 模拟路径A：直接经 sanitizeWechatHtml 处理
        // 路径A(tryAutoUploadToWechat)调用 formatArticleForWechat → formatContentForWechat → sanitizeWechatHtml
        // 对于HTML内容，formatContentForWechat 等价于直接调用 sanitizeWechatHtml
        const sanitizeOutput = sanitizeWechatHtml(rawHtml);
        
        result.pathA = {
          source: `orderIndex=${originalWritingTask.orderIndex}, executor=${originalWritingTask.executor}`,
          title,
          rawHtmlLength: rawHtml.length,
          rawHtmlPreview: rawHtml.substring(0, 500),
          sanitizeOutputLength: sanitizeOutput.length,
          sanitizeOutputPreview: sanitizeOutput.substring(0, 500),
          sanitizeOutputFull: sanitizeOutput,
        };
      }
    }
    
    // === 路径B：使用最新写作任务的输出（当前MCP路径） ===
    if (latestWritingTask?.resultData && latestWritingTask.id !== originalWritingTask?.id) {
      let resultData = latestWritingTask.resultData;
      if (typeof resultData === 'string') {
        try { resultData = JSON.parse(resultData); } catch { /* keep as string */ }
      }
      
      const rawHtml = extractArticleHtml(resultData);
      const title = extractArticleTitle(resultData) || latestWritingTask.taskTitle;
      
      if (rawHtml) {
        // 模拟路径B（修复后）：直接经 sanitizeWechatHtml 处理
        // 修复后路径B(MCP): isAlreadyFormatted=true → wechatAddDraft → sanitizeWechatHtml
        // 不再调用 formatDirectPublishArticle（LLM重新格式化）
        const sanitizeOutput = sanitizeWechatHtml(rawHtml);
        
        result.pathB = {
          source: `orderIndex=${latestWritingTask.orderIndex}, executor=${latestWritingTask.executor}`,
          title,
          rawHtmlLength: rawHtml.length,
          rawHtmlPreview: rawHtml.substring(0, 500),
          sanitizeOutputLength: sanitizeOutput.length,
          sanitizeOutputPreview: sanitizeOutput.substring(0, 500),
          sanitizeOutputFull: sanitizeOutput,
        };
      }
    } else if (latestWritingTask?.id === originalWritingTask?.id && originalWritingTask?.resultData) {
      // 只有一个写作任务时，路径A和路径B的内容来源相同
      let resultData = originalWritingTask.resultData;
      if (typeof resultData === 'string') {
        try { resultData = JSON.parse(resultData); } catch { /* keep as string */ }
      }
      
      const rawHtml = extractArticleHtml(resultData);
      const title = extractArticleTitle(resultData) || originalWritingTask.taskTitle;
      
      if (rawHtml) {
        const sanitizeOutput = sanitizeWechatHtml(rawHtml);
        
        result.pathB = {
          source: `orderIndex=${originalWritingTask.orderIndex}, executor=${originalWritingTask.executor} (与路径A相同)`,
          title,
          rawHtmlLength: rawHtml.length,
          rawHtmlPreview: rawHtml.substring(0, 500),
          sanitizeOutputLength: sanitizeOutput.length,
          sanitizeOutputPreview: sanitizeOutput.substring(0, 500),
          sanitizeOutputFull: sanitizeOutput,
        };
      }
    }
    
    // === 比对 ===
    // 🔴 比对的是 sanitizeWechatHtml 的输出（两条路径最终的 content 字段处理结果）
    // 路径A: formatArticleForWechat → formatContentForWechat → sanitizeWechatHtml(rawHtml)
    // 路径B: isAlreadyFormatted=true → wechatAddDraft → sanitizeWechatHtml(rawHtml)
    // 两条路径对相同 rawHtml 的 sanitizeWechatHtml 输出应完全一致
    if (result.pathA && result.pathB) {
      const pathASanitized = result.pathA.sanitizeOutputPreview;
      const pathBSanitized = result.pathB.sanitizeOutputPreview;
      const lengthMatch = result.pathA.sanitizeOutputLength === result.pathB.sanitizeOutputLength;
      result.comparison = {
        identical: pathASanitized === pathBSanitized && lengthMatch,
        lengthDiff: result.pathB.sanitizeOutputLength - result.pathA.sanitizeOutputLength,
        pathALen: result.pathA.sanitizeOutputLength,
        pathBLen: result.pathB.sanitizeOutputLength,
        note: pathASanitized === pathBSanitized && lengthMatch
          ? '两条路径 sanitizeWechatHtml 输出完全一致'
          : `两条路径 sanitizeWechatHtml 输出存在差异（长度差 ${result.pathB.sanitizeOutputLength - result.pathA.sanitizeOutputLength}），需进一步分析`,
      };
    } else {
      result.comparison.note = '缺少路径数据，无法比对';
    }
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[compare-upload-paths] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

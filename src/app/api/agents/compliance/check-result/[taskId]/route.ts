import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { agentTask } from '@/lib/services/agent-task';
import { db } from '@/lib/db';
import { agentTasks } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

/**
 * 获取合规校验结果
 *
 * GET /api/agents/compliance/check-result/:taskId
 *
 * 参数：
 * - taskId: 原始任务 ID
 *
 * 返回：
 * - 最新的合规校验结果
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const { taskId } = await params;

    console.log(`📡 查询合规校验结果`);
    console.log(`📍 原始任务 ID: ${taskId}`);

    // 查找相关的合规校验任务
    // 合规校验任务的 taskId 格式为: compliance-{originalTaskId}-{timestamp}
    const complianceTasks = await db
      .select()
      .from(agentTasks)
      .where(
        and(
          eq(agentTasks.taskType, 'compliance_check'),
          // 模糊匹配原始任务 ID
          // TODO: 使用 metadata.originalTaskId 进行精确匹配
        )
      )
      .orderBy(desc(agentTasks.createdAt))
      .limit(10);

    // 筛选出匹配的合规校验任务
    const matchedTask = complianceTasks.find(
      task => task.metadata?.originalTaskId === taskId
    );

    if (!matchedTask) {
      return NextResponse.json({
        success: false,
        error: '未找到合规校验结果',
        message: `任务 ${taskId} 没有合规校验记录`,
      }, { status: 404 });
    }

    console.log(`✅ 找到合规校验结果: ${matchedTask.taskId}`);

    // 解析校验结果
    let complianceResult;
    try {
      if (matchedTask.result) {
        // 尝试从 result 字段提取 JSON
        const jsonMatch = matchedTask.result.match(/```json\s*([\s\S]*?)\s*```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : matchedTask.result;
        complianceResult = JSON.parse(jsonStr);
      } else {
        complianceResult = matchedTask.metadata?.complianceResult;
      }
    } catch (error) {
      console.error('解析合规校验结果失败:', error);
      complianceResult = null;
    }

    return NextResponse.json({
      success: true,
      data: {
        complianceTaskId: matchedTask.taskId,
        originalTaskId: taskId,
        articleTitle: matchedTask.metadata?.articleTitle,
        isCompliant: matchedTask.metadata?.isCompliant,
        complianceScore: matchedTask.metadata?.complianceScore,
        complianceResult: complianceResult,
        // 🔥 新增：返回格式化摘要
        formattedSummary: matchedTask.metadata?.formattedSummary,
        createdAt: matchedTask.createdAt,
        completedAt: matchedTask.completedAt,
      },
      message: '合规校验结果查询成功',
    });
  } catch (error) {
    console.error('❌ 查询合规校验结果失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

/**
 * 手动触发合规校验
 *
 * POST /api/agents/compliance/check-result/:taskId/trigger
 *
 * 参数：
 * - taskId: 原始任务 ID
 * - body:
 *   - articleTitle: 文章标题（可选，如果不提供则从任务中获取）
 *   - articleContent: 文章内容（可选，如果不提供则从任务中获取）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const { taskId } = await params;
    const body = await request.json();
    const { articleTitle, articleContent } = body;

    console.log(`📡 手动触发合规校验`);
    console.log(`📍 原始任务 ID: ${taskId}`);

    // 查询原始任务
    const originalTasks = await db
      .select()
      .from(agentTasks)
      .where(eq(agentTasks.taskId, taskId));

    if (originalTasks.length === 0) {
      return NextResponse.json({
        success: false,
        error: '原始任务不存在',
        message: `任务 ID ${taskId} 不存在`,
      }, { status: 404 });
    }

    const originalTask = originalTasks[0];

    // 如果没有提供文章内容，从任务结果中提取
    let finalArticleTitle = articleTitle;
    let finalArticleContent = articleContent;

    if (!finalArticleTitle || !finalArticleContent) {
      try {
        const resultData = JSON.parse(originalTask.result || '{}');
        finalArticleTitle = finalArticleTitle || resultData.title || resultData.articleTitle || originalTask.taskName;
        finalArticleContent = finalArticleContent || resultData.content || resultData.articleContent || originalTask.result;
      } catch {
        finalArticleTitle = finalArticleTitle || originalTask.taskName;
        finalArticleContent = finalArticleContent || originalTask.result;
      }
    }

    if (!finalArticleContent) {
      return NextResponse.json({
        success: false,
        error: '无法获取文章内容',
        message: '请提供 articleContent 参数，或确保原始任务包含文章内容',
      }, { status: 400 });
    }

    // 调用 AgentTaskService 的内部方法触发合规校验
    // 注意：这里需要访问私有方法，所以需要创建一个公共接口
    // 暂时返回错误，提示用户通过正常流程触发

    return NextResponse.json({
      success: false,
      error: '手动触发功能尚未实现',
      message: '请通过正常流程（insurance-d 完成文章）触发合规校验',
    }, { status: 501 });
  } catch (error) {
    console.error('❌ 手动触发合规校验失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

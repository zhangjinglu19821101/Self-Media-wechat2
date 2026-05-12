import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks, articleMetadata, capabilityList, articleContent } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json({ 
        success: false, 
        error: '缺少 taskId 参数' 
      }, { status: 400 });
    }

    // 查询子任务
    const subtask = await db.query.agentSubTasks.findFirst({
      where: eq(agentSubTasks.id, taskId)
    });

    if (!subtask) {
      return NextResponse.json({ 
        success: false, 
        error: '任务不存在' 
      }, { status: 404 });
    }

    // 查询关联的文章元数据
    let articleMeta = null;
    if (subtask.articleMetadata) {
      articleMeta = subtask.articleMetadata;
    }

    // 查询关联的能力定义
    let capability = null;
    // 注意：agentSubTasks 表中可能没有 mcpCapabilityId 字段，需要查看 metadata
    const metadata = subtask.metadata as any;
    if (metadata?.mcpCapabilityId) {
      capability = await db.query.capabilityList.findFirst({
        where: eq(capabilityList.id, metadata.mcpCapabilityId)
      });
    }

    // 查询文章内容
    let articleContentData = null;
    if (subtask.commandResultId) {
      articleContentData = await db.query.articleContent.findFirst({
        where: eq(articleContent.taskId, subtask.commandResultId)
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        subtask,
        articleMeta,
        capability,
        articleContent: articleContentData,
        hasArticleContent: !!articleContentData,
        articleContentLength: articleContentData?.articleContent?.length || 0
      }
    });
  } catch (error) {
    console.error('查询任务详情失败:', error);
    return NextResponse.json({ 
      success: false, 
      error: '查询失败: ' + (error as Error).message 
    }, { status: 500 });
  }
}

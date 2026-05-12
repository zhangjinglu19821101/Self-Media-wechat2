/**
 * 测试更新 article_metadata
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { 
  createInitialArticleMetadata, 
  updateArticleMetadataStep 
} from '@/lib/types/article-metadata';

export async function GET() {
  const subTaskId = '0f81b2a7-3a2d-4d1a-b09b-6d4f6a95c8fa';
  
  try {
    // 查询子任务
    const subTasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, subTaskId))
      .limit(1);
    
    if (subTasks.length === 0) {
      return NextResponse.json({
        success: false,
        error: '找不到子任务',
      });
    }
    
    const subTask = subTasks[0];
    
    // 创建或更新 article_metadata
    let articleMetadata;
    if (!subTask.articleMetadata || Object.keys(subTask.articleMetadata).length === 0) {
      console.log('创建初始 article_metadata');
      articleMetadata = createInitialArticleMetadata({
        articleTitle: subTask.taskTitle,
        creatorAgent: subTask.fromParentsExecutor,
        taskType: 'article_generation',
        totalSteps: 4,
      });
    } else {
      console.log('更新现有 article_metadata');
      articleMetadata = updateArticleMetadataStep(
        subTask.articleMetadata as any,
        {
          stepNo: subTask.orderIndex,
          stepStatus: 'success',
          stepOutput: '文章初稿撰写完成',
          confirmStatus: '已确认',
        }
      );
    }
    
    // 更新数据库
    await db
      .update(agentSubTasks)
      .set({
        articleMetadata: articleMetadata as any,
      })
      .where(eq(agentSubTasks.id, subTaskId));
    
    return NextResponse.json({
      success: true,
      message: 'article_metadata 更新成功',
      articleMetadata,
    });
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

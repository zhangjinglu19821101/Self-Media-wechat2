/**
 * 测试文章审核服务
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { ArticleReviewService } from '@/lib/services/article-review-service';

export async function GET() {
  // 使用步骤2的子任务（文章合规与内容校验）
  const subTaskId = 'cdd98aab-5932-4dde-bad8-e8dace88e0e4';
  
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
    console.log('找到子任务:', subTask.id, subTask.taskTitle);
    
    // 调用审核服务
    const reviewService = ArticleReviewService.getInstance();
    const reviewResult = await reviewService.executeReview(subTask);
    
    return NextResponse.json({
      success: true,
      subTask: {
        id: subTask.id,
        taskTitle: subTask.taskTitle,
        orderIndex: subTask.orderIndex,
      },
      hasReviewResult: !!reviewResult,
      reviewResult: reviewResult ? {
        reviewId: reviewResult.reviewId,
        platform: reviewResult.platform,
        result: reviewResult.result,
        commentsCount: reviewResult.comments.length,
        comments: reviewResult.comments,
        summary: reviewResult.summary,
        reviewedAt: reviewResult.reviewedAt,
        reviewer: reviewResult.reviewer,
      } : null,
    });
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

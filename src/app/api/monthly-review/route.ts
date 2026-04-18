/**
 * 月度复盘报告生成 API
 * 用于生成和获取月度复盘报告
 */

import { NextRequest, NextResponse } from 'next/server';
import { MonthlyReviewReport, ResearchQualityMetrics } from '@/lib/agent-types';

// 内存存储（实际项目中应该使用数据库）
const monthlyReviews: Map<string, MonthlyReviewReport> = new Map();

/**
 * POST /api/monthly-review - 生成月度复盘报告
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { year, month, qualityMetrics, summary, lowQualityIterations, improvementSuggestions, nextMonthGoals } = body;

    if (!year || !month) {
      return NextResponse.json(
        { success: false, error: '缺少年份或月份参数' },
        { status: 400 }
      );
    }

    const reviewId = `review_${year}_${month}`;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // 构建月度复盘报告
    const review: MonthlyReviewReport = {
      id: reviewId,
      year,
      month,
      reportPeriod: {
        start: startDate,
        end: endDate,
      },
      summary: {
        totalResearchCount: summary.totalResearchCount || 0,
        redLevelCount: summary.redLevelCount || 0,
        yellowLevelCount: summary.yellowLevelCount || 0,
        greenLevelCount: summary.greenLevelCount || 0,
        fastTrackCount: summary.fastTrackCount || 0,
      },
      qualityMetrics: qualityMetrics as ResearchQualityMetrics,
      lowQualityIterations: lowQualityIterations || [],
      improvementSuggestions: improvementSuggestions || [],
      nextMonthGoals: nextMonthGoals || {
        targetAuthenticity: 70,
        targetAccuracy: 80,
        targetAdoptionRate: 60,
      },
      submittedBy: 'B', // 提交人始终是 Agent B
      submittedAt: new Date(),
      status: 'pending',
    };

    monthlyReviews.set(reviewId, review);

    return NextResponse.json({
      success: true,
      message: '月度复盘报告已生成',
      data: review,
    });
  } catch (error) {
    console.error('Error generating monthly review:', error);
    return NextResponse.json(
      { success: false, error: '生成月度复盘报告失败' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/monthly-review - 获取月度复盘报告
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const reviewId = searchParams.get('reviewId');
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    if (reviewId) {
      // 获取指定ID的复盘报告
      const review = monthlyReviews.get(reviewId);
      if (!review) {
        return NextResponse.json(
          { success: false, error: '未找到该复盘报告' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: review,
      });
    } else if (year && month) {
      // 获取指定年月的复盘报告
      const targetReviewId = `review_${year}_${month}`;
      const review = monthlyReviews.get(targetReviewId);
      if (!review) {
        return NextResponse.json(
          { success: false, error: '未找到该月份的复盘报告' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: review,
      });
    } else {
      // 获取所有复盘报告
      const allReviews = Array.from(monthlyReviews.values())
        .sort((a, b) => {
          // 按时间倒序排序
          const timeA = a.reportPeriod.start.getTime();
          const timeB = b.reportPeriod.start.getTime();
          return timeB - timeA;
        });

      return NextResponse.json({
        success: true,
        data: allReviews,
        total: allReviews.length,
      });
    }
  } catch (error) {
    console.error('Error getting monthly review:', error);
    return NextResponse.json(
      { success: false, error: '获取月度复盘报告失败' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/monthly-review/:reviewId/approve - 审批月度复盘报告
 */
export async function APPROVE_REVIEW(request: NextRequest, { params }: { params: { reviewId: string } }) {
  try {
    const reviewId = params.reviewId;
    const body = await request.json();
    const { approved, comment } = body;

    const review = monthlyReviews.get(reviewId);
    if (!review) {
      return NextResponse.json(
        { success: false, error: '未找到该复盘报告' },
        { status: 404 }
      );
    }

    // 更新审批状态
    review.status = approved ? 'approved' : 'rejected';
    review.reviewedBy = 'A'; // 审批人始终是 Agent A
    review.reviewedAt = new Date();

    monthlyReviews.set(reviewId, review);

    return NextResponse.json({
      success: true,
      message: approved ? '复盘报告已审批通过' : '复盘报告已驳回',
      data: review,
    });
  } catch (error) {
    console.error('Error approving monthly review:', error);
    return NextResponse.json(
      { success: false, error: '审批月度复盘报告失败' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/monthly-review/latest - 获取最新的月度复盘报告
 */
export async function GET_LATEST() {
  try {
    const allReviews = Array.from(monthlyReviews.values())
      .sort((a, b) => b.reportPeriod.start.getTime() - a.reportPeriod.start.getTime());

    if (allReviews.length === 0) {
      return NextResponse.json(
        { success: false, error: '暂无复盘报告' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: allReviews[0],
    });
  } catch (error) {
    console.error('Error getting latest monthly review:', error);
    return NextResponse.json(
      { success: false, error: '获取最新复盘报告失败' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/monthly-review/summary - 获取复盘报告汇总
 */
export async function GET_SUMMARY() {
  try {
    const allReviews = Array.from(monthlyReviews.values());

    if (allReviews.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          totalReviews: 0,
          approvedCount: 0,
          rejectedCount: 0,
          pendingCount: 0,
        },
      });
    }

    const approvedCount = allReviews.filter(r => r.status === 'approved').length;
    const rejectedCount = allReviews.filter(r => r.status === 'rejected').length;
    const pendingCount = allReviews.filter(r => r.status === 'pending').length;

    // 计算最近3个月的质量指标趋势
    const recentReviews = allReviews.slice(0, 3);
    const qualityTrend = recentReviews.map(r => ({
      year: r.year,
      month: r.month,
      authenticity: r.qualityMetrics.feedbackAuthenticity,
      accuracy: r.qualityMetrics.predictionAccuracy,
      adoptionRate: r.qualityMetrics.adoptionRate,
    }));

    return NextResponse.json({
      success: true,
      data: {
        totalReviews: allReviews.length,
        approvedCount,
        rejectedCount,
        pendingCount,
        qualityTrend,
      },
    });
  } catch (error) {
    console.error('Error getting monthly review summary:', error);
    return NextResponse.json(
      { success: false, error: '获取复盘报告汇总失败' },
      { status: 500 }
    );
  }
}

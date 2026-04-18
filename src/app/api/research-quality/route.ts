/**
 * 调研质量数据收集 API
 * 用于收集和存储调研质量相关数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { ResearchQualityMetrics, ResearchReport } from '@/lib/agent-types';

// 内存存储（实际项目中应该使用数据库）
const researchQualityData: Map<string, ResearchQualityMetrics> = new Map();
const researchReports: Map<string, ResearchReport> = new Map();

/**
 * POST /api/research-quality - 提交调研质量数据
 */
export async function POST(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const body = await request.json();

    const { ruleIterationId, metrics } = body;

    if (!ruleIterationId || !metrics) {
      return NextResponse.json(
        { success: false, error: '缺少必需参数' },
        { status: 400 }
      );
    }

    // 验证质量指标数据
    const qualityMetrics: ResearchQualityMetrics = {
      feedbackAuthenticity: metrics.feedbackAuthenticity || 0,
      predictionAccuracy: metrics.predictionAccuracy || 0,
      adoptionRate: metrics.adoptionRate || 0,
      vetoAdoptionRate: metrics.vetoAdoptionRate || 0,
      majorRiskAdoptionRate: metrics.majorRiskAdoptionRate || 0,
      optimizationAdoptionRate: metrics.optimizationAdoptionRate || 0,
    };

    // 存储质量数据
    researchQualityData.set(ruleIterationId, qualityMetrics);

    return NextResponse.json({
      success: true,
      message: '调研质量数据已提交',
      data: {
        ruleIterationId,
        metrics: qualityMetrics,
      },
    });
  } catch (error) {
    console.error('Error submitting research quality data:', error);
    return NextResponse.json(
      { success: false, error: '提交调研质量数据失败' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/research-quality - 获取调研质量数据
 */
export async function GET(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const searchParams = request.nextUrl.searchParams;
    const ruleIterationId = searchParams.get('ruleIterationId');

    if (ruleIterationId) {
      // 获取单个规则的质量数据
      const metrics = researchQualityData.get(ruleIterationId);
      if (!metrics) {
        return NextResponse.json(
          { success: false, error: '未找到该规则的调研质量数据' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: metrics,
      });
    } else {
      // 获取所有质量数据
      const allMetrics = Array.from(researchQualityData.entries()).map(([id, metrics]) => ({
        ruleIterationId: id,
        metrics,
      }));

      return NextResponse.json({
        success: true,
        data: allMetrics,
        total: allMetrics.length,
      });
    }
  } catch (error) {
    console.error('Error getting research quality data:', error);
    return NextResponse.json(
      { success: false, error: '获取调研质量数据失败' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/research-quality - 更新调研质量数据
 */
export async function PUT(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const body = await request.json();

    const { ruleIterationId, metrics } = body;

    if (!ruleIterationId || !metrics) {
      return NextResponse.json(
        { success: false, error: '缺少必需参数' },
        { status: 400 }
      );
    }

    // 检查数据是否存在
    const existingMetrics = researchQualityData.get(ruleIterationId);
    if (!existingMetrics) {
      return NextResponse.json(
        { success: false, error: '未找到该规则的调研质量数据' },
        { status: 404 }
      );
    }

    // 更新质量数据
    const updatedMetrics: ResearchQualityMetrics = {
      ...existingMetrics,
      ...metrics,
    };

    researchQualityData.set(ruleIterationId, updatedMetrics);

    return NextResponse.json({
      success: true,
      message: '调研质量数据已更新',
      data: updatedMetrics,
    });
  } catch (error) {
    console.error('Error updating research quality data:', error);
    return NextResponse.json(
      { success: false, error: '更新调研质量数据失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/research-quality - 删除调研质量数据
 */
export async function DELETE(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const searchParams = request.nextUrl.searchParams;
    const ruleIterationId = searchParams.get('ruleIterationId');

    if (!ruleIterationId) {
      return NextResponse.json(
        { success: false, error: '缺少规则迭代ID' },
        { status: 400 }
      );
    }

    const deleted = researchQualityData.delete(ruleIterationId);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: '未找到该规则的调研质量数据' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '调研质量数据已删除',
    });
  } catch (error) {
    console.error('Error deleting research quality data:', error);
    return NextResponse.json(
      { success: false, error: '删除调研质量数据失败' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/research-quality/aggregate - 获取聚合质量数据
 */
export async function GET_AGGREGATE() {
  try {
    const allMetrics = Array.from(researchQualityData.values());

    if (allMetrics.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          averageAuthenticity: 0,
          averageAccuracy: 0,
          averageAdoptionRate: 0,
          totalIterations: 0,
        },
      });
    }

    // 计算平均值
    const averageAuthenticity =
      allMetrics.reduce((sum, m) => sum + m.feedbackAuthenticity, 0) / allMetrics.length;
    const averageAccuracy =
      allMetrics.reduce((sum, m) => sum + m.predictionAccuracy, 0) / allMetrics.length;
    const averageAdoptionRate =
      allMetrics.reduce((sum, m) => sum + m.adoptionRate, 0) / allMetrics.length;

    // 达标率统计
    const authenticity达标率 = allMetrics.filter(m => m.feedbackAuthenticity >= 70).length / allMetrics.length;
    const accuracy达标率 = allMetrics.filter(m => m.predictionAccuracy >= 80).length / allMetrics.length;
    const adoption达标率 = allMetrics.filter(m => m.adoptionRate >= 60).length / allMetrics.length;

    return NextResponse.json({
      success: true,
      data: {
        averageAuthenticity: Math.round(averageAuthenticity * 100) / 100,
        averageAccuracy: Math.round(averageAccuracy * 100) / 100,
        averageAdoptionRate: Math.round(averageAdoptionRate * 100) / 100,
        authenticity达标率: Math.round(authenticity达标率 * 100),
        accuracy达标率: Math.round(accuracy达标率 * 100),
        adoption达标率: Math.round(adoption达标率 * 100),
        totalIterations: allMetrics.length,
      },
    });
  } catch (error) {
    console.error('Error getting aggregate quality data:', error);
    return NextResponse.json(
      { success: false, error: '获取聚合质量数据失败' },
      { status: 500 }
    );
  }
}

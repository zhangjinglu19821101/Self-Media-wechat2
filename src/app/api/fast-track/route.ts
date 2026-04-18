/**
 * 快速通道统计和监控 API
 * 用于跟踪快速通道执行情况和统计数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { FastTrackExecution, FastTrackType } from '@/lib/agent-types';

// 内存存储（实际项目中应该使用数据库）
const fastTrackExecutions: Map<string, FastTrackExecution> = new Map();

/**
 * POST /api/fast-track - 创建快速通道执行记录
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      ruleIterationId,
      fastTrackInfo,
      execution,
      monitoringData,
      issues,
    } = body;

    if (!ruleIterationId || !fastTrackInfo) {
      return NextResponse.json(
        { success: false, error: '缺少必需参数' },
        { status: 400 }
      );
    }

    const executionId = `fast_track_${ruleIterationId}_${Date.now()}`;

    // 构建快速通道执行记录
    const fastTrack: FastTrackExecution = {
      id: executionId,
      ruleIterationId,
      fastTrackInfo: {
        enabled: fastTrackInfo.enabled || true,
        type: fastTrackInfo.type as FastTrackType,
        reason: fastTrackInfo.reason,
        deadline: fastTrackInfo.deadline ? new Date(fastTrackInfo.deadline) : undefined,
        approvedBy: fastTrackInfo.approvedBy || 'A',
        approvedAt: fastTrackInfo.approvedAt ? new Date(fastTrackInfo.approvedAt) : new Date(),
      },
      execution: {
        researchDuration: execution.researchDuration || 0,
        monitoringInterval: execution.monitoringInterval || 8,
        initialReportAt: execution.initialReportAt ? new Date(execution.initialReportAt) : new Date(),
        finalReportAt: execution.finalReportAt ? new Date(execution.finalReportAt) : undefined,
      },
      monitoringData: monitoringData || [],
      issues: issues || [],
      summary: execution.summary || '',
    };

    fastTrackExecutions.set(executionId, fastTrack);

    return NextResponse.json({
      success: true,
      message: '快速通道执行记录已创建',
      data: fastTrack,
    });
  } catch (error) {
    console.error('Error creating fast track execution:', error);
    return NextResponse.json(
      { success: false, error: '创建快速通道执行记录失败' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/fast-track - 获取快速通道执行记录
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const executionId = searchParams.get('executionId');
    const ruleIterationId = searchParams.get('ruleIterationId');
    const status = searchParams.get('status'); // active, completed, failed

    if (executionId) {
      // 获取指定ID的执行记录
      const execution = fastTrackExecutions.get(executionId);
      if (!execution) {
        return NextResponse.json(
          { success: false, error: '未找到该执行记录' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: execution,
      });
    } else {
      // 获取执行记录列表
      let executions = Array.from(fastTrackExecutions.values());

      // 按规则迭代ID过滤
      if (ruleIterationId) {
        executions = executions.filter(e => e.ruleIterationId === ruleIterationId);
      }

      // 按状态过滤
      if (status) {
        executions = executions.filter(e => {
          if (status === 'active') {
            return !e.completedAt && !e.rollback;
          } else if (status === 'completed') {
            return !!e.completedAt;
          } else if (status === 'failed') {
            return !!e.rollback;
          }
          return true;
        });
      }

      // 按时间倒序排序
      executions.sort((a, b) =>
        b.fastTrackInfo.approvedAt.getTime() - a.fastTrackInfo.approvedAt.getTime()
      );

      return NextResponse.json({
        success: true,
        data: executions,
        total: executions.length,
      });
    }
  } catch (error) {
    console.error('Error getting fast track executions:', error);
    return NextResponse.json(
      { success: false, error: '获取快速通道执行记录失败' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/fast-track/:executionId - 更新快速通道执行记录
 */
export async function PUT(request: NextRequest, { params }: { params: { executionId: string } }) {
  try {
    const executionId = params.executionId;
    const body = await request.json();

    const execution = fastTrackExecutions.get(executionId);
    if (!execution) {
      return NextResponse.json(
        { success: false, error: '未找到该执行记录' },
        { status: 404 }
      );
    }

    // 更新执行记录
    if (body.monitoringData) {
      execution.monitoringData.push(...body.monitoringData);
    }
    if (body.issues) {
      execution.issues.push(...body.issues);
    }
    if (body.summary !== undefined) {
      execution.summary = body.summary;
    }
    if (body.finalReportAt) {
      execution.execution.finalReportAt = new Date(body.finalReportAt);
    }
    if (body.completedAt) {
      execution.completedAt = new Date(body.completedAt);
    }
    if (body.rollback) {
      execution.rollback = {
        timestamp: new Date(body.rollback.timestamp),
        reason: body.rollback.reason,
      };
    }

    fastTrackExecutions.set(executionId, execution);

    return NextResponse.json({
      success: true,
      message: '快速通道执行记录已更新',
      data: execution,
    });
  } catch (error) {
    console.error('Error updating fast track execution:', error);
    return NextResponse.json(
      { success: false, error: '更新快速通道执行记录失败' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/fast-track/stats - 获取快速通道统计数据
 */
export async function GET_STATS() {
  try {
    const allExecutions = Array.from(fastTrackExecutions.values());

    if (allExecutions.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          total: 0,
          active: 0,
          completed: 0,
          failed: 0,
          byType: {},
          averageDuration: 0,
        },
      });
    }

    // 统计各状态数量
    const active = allExecutions.filter(e => !e.completedAt && !e.rollback).length;
    const completed = allExecutions.filter(e => e.completedAt && !e.rollback).length;
    const failed = allExecutions.filter(e => e.rollback).length;

    // 按类型统计
    const byType: Record<string, number> = {};
    allExecutions.forEach(e => {
      const type = e.fastTrackInfo.type || 'unknown';
      byType[type] = (byType[type] || 0) + 1;
    });

    // 计算平均执行时长
    const completedExecutions = allExecutions.filter(e => e.completedAt && e.execution.initialReportAt);
    let averageDuration = 0;
    if (completedExecutions.length > 0) {
      const totalDuration = completedExecutions.reduce((sum, e) => {
        const duration = e.completedAt!.getTime() - e.execution.initialReportAt.getTime();
        return sum + duration;
      }, 0);
      averageDuration = totalDuration / completedExecutions.length;
    }

    return NextResponse.json({
      success: true,
      data: {
        total: allExecutions.length,
        active,
        completed,
        failed,
        byType,
        averageDuration: Math.round(averageDuration / 1000), // 转换为秒
        successRate: completedExecutions.length > 0
          ? Math.round((completed / allExecutions.length) * 100)
          : 0,
      },
    });
  } catch (error) {
    console.error('Error getting fast track stats:', error);
    return NextResponse.json(
      { success: false, error: '获取快速通道统计数据失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fast-track/:executionId/monitor - 提交监控数据
 */
export async function SUBMIT_MONITORING_DATA(
  request: NextRequest,
  { params }: { params: { executionId: string } }
) {
  try {
    const executionId = params.executionId;
    const body = await request.json();

    const execution = fastTrackExecutions.get(executionId);
    if (!execution) {
      return NextResponse.json(
        { success: false, error: '未找到该执行记录' },
        { status: 404 }
      );
    }

    // 添加监控数据
    const monitoringRecord = {
      timestamp: new Date(body.timestamp || Date.now()),
      metrics: body.metrics || {},
    };

    execution.monitoringData.push(monitoringRecord);

    fastTrackExecutions.set(executionId, execution);

    return NextResponse.json({
      success: true,
      message: '监控数据已提交',
      data: monitoringRecord,
    });
  } catch (error) {
    console.error('Error submitting monitoring data:', error);
    return NextResponse.json(
      { success: false, error: '提交监控数据失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fast-track/:executionId/issue - 提交问题记录
 */
export async function SUBMIT_ISSUE(
  request: NextRequest,
  { params }: { params: { executionId: string } }
) {
  try {
    const executionId = params.executionId;
    const body = await request.json();

    const execution = fastTrackExecutions.get(executionId);
    if (!execution) {
      return NextResponse.json(
        { success: false, error: '未找到该执行记录' },
        { status: 404 }
      );
    }

    // 添加问题记录
    const issueRecord = {
      timestamp: new Date(body.timestamp || Date.now()),
      description: body.description,
      resolved: body.resolved || false,
      actionTaken: body.actionTaken || '',
    };

    execution.issues.push(issueRecord);

    fastTrackExecutions.set(executionId, execution);

    return NextResponse.json({
      success: true,
      message: '问题记录已提交',
      data: issueRecord,
    });
  } catch (error) {
    console.error('Error submitting issue:', error);
    return NextResponse.json(
      { success: false, error: '提交问题记录失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fast-track/:executionId/rollback - 执行回滚
 */
export async function EXECUTE_ROLLBACK(
  request: NextRequest,
  { params }: { params: { executionId: string } }
) {
  try {
    const executionId = params.executionId;
    const body = await request.json();

    const execution = fastTrackExecutions.get(executionId);
    if (!execution) {
      return NextResponse.json(
        { success: false, error: '未找到该执行记录' },
        { status: 404 }
      );
    }

    // 记录回滚
    execution.rollback = {
      timestamp: new Date(),
      reason: body.reason || '执行出现问题，执行回滚',
    };

    fastTrackExecutions.set(executionId, execution);

    return NextResponse.json({
      success: true,
      message: '已执行回滚',
      data: execution,
    });
  } catch (error) {
    console.error('Error executing rollback:', error);
    return NextResponse.json(
      { success: false, error: '执行回滚失败' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/fast-track/active - 获取所有活跃的快速通道
 */
export async function GET_ACTIVE() {
  try {
    const activeExecutions = Array.from(fastTrackExecutions.values())
      .filter(e => !e.completedAt && !e.rollback)
      .sort((a, b) =>
        b.fastTrackInfo.approvedAt.getTime() - a.fastTrackInfo.approvedAt.getTime()
      );

    return NextResponse.json({
      success: true,
      data: activeExecutions,
      total: activeExecutions.length,
    });
  } catch (error) {
    console.error('Error getting active fast tracks:', error);
    return NextResponse.json(
      { success: false, error: '获取活跃快速通道失败' },
      { status: 500 }
    );
  }
}

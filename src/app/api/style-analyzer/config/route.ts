/**
 * 风格学习配置管理 API
 * GET /api/style-analyzer/config
 * PUT /api/style-analyzer/config
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { defaultStyleLearningConfig, ArticleSource } from '@/config/style-learning.config';

/**
 * 模拟配置存储（实际应该保存到数据库或文件）
 */
let configStore = defaultStyleLearningConfig;

/**
 * GET /api/style-analyzer/config
 * 获取风格学习配置
 */
export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      data: configStore,
    });
  } catch (error: any) {
    console.error('获取配置失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '获取配置失败',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/style-analyzer/config
 * 更新风格学习配置
 */
export async function PUT(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const body = await request.json();
    const { agent, updates } = body;

    if (!agent || !updates) {
      return NextResponse.json(
        {
          success: false,
          error: '参数错误：agent 和 updates 必填',
        },
        { status: 400 }
      );
    }

    if (agent !== 'insurance-d' && agent !== 'agent-d') {
      return NextResponse.json(
        {
          success: false,
          error: '参数错误：agent 必须是 insurance-d 或 agent-d',
        },
        { status: 400 }
      );
    }

    // 更新配置
    if (agent === 'insurance-d') {
      configStore.insuranceD = { ...configStore.insuranceD, ...updates };
    } else {
      configStore.agentD = { ...configStore.agentD, ...updates };
    }

    return NextResponse.json({
      success: true,
      data: agent === 'insurance-d' ? configStore.insuranceD : configStore.agentD,
      message: '配置更新成功',
    });
  } catch (error: any) {
    console.error('更新配置失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '更新配置失败',
      },
      { status: 500 }
    );
  }
}

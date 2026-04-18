/**
 * 缓存统计 API
 * 查看所有缓存的统计信息，包括命中率、缓存条目数等
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCacheStats, clearAllCaches } from '@/lib/agent-llm';

/**
 * GET /api/cache/stats
 * 获取所有缓存的统计信息
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📊 获取缓存统计信息...');

    const stats = getCacheStats();

    return NextResponse.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        message: '缓存统计信息已更新',
      },
    });
  } catch (error) {
    console.error('❌ 获取缓存统计失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
      message: '获取缓存统计失败',
    }, { status: 500 });
  }
}

/**
 * DELETE /api/cache/stats
 * 清空所有缓存
 */
export async function DELETE(request: NextRequest) {
  try {
    console.log('🧹 清空所有缓存...');

    clearAllCaches();

    return NextResponse.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        message: '所有缓存已清空',
      },
    });
  } catch (error) {
    console.error('❌ 清空缓存失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
      message: '清空缓存失败',
    }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/articles/generate/trigger
 * 手动触发文章生成
 * 
 * 注意：此功能已迁移到新的任务系统，请使用 /api/agents/b/simple-split 接口
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error: '此功能已迁移到新的任务系统',
      message: '请使用 /api/agents/b/simple-split 接口进行文章生成',
    },
    { status: 410 } // 410 Gone - 表示资源已不存在
  );
}

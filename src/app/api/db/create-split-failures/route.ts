/**
 * 数据库初始化 API
 * 创建 split_failures 表
 */

import { NextResponse } from 'next/server';
import { createSplitFailuresTable } from '@/lib/db/init-split-failures';

export async function GET() {
  try {
    const success = await createSplitFailuresTable();
    
    if (success) {
      return NextResponse.json({
        success: true,
        message: 'split_failures 表创建成功',
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'split_failures 表创建失败',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: '表创建失败',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

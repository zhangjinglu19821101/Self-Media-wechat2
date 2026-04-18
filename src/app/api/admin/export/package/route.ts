/**
 * 生成商业化部署包
 */

import { NextResponse } from 'next/server';
import { generateCommercialPackage } from '@/lib/agent-export';
import { writeFileSync, readFileSync } from 'fs';

/**
 * GET /api/admin/export/package
 * 生成并下载商业化部署包
 */
export async function GET() {
  try {
    // 生成部署包
    const packagePath = await generateCommercialPackage('/tmp/agent-commercial-package');

    return NextResponse.json({
      success: true,
      data: {
        path: packagePath,
        files: [
          'agent-configs.json',
          'agent-complete-export.json',
          'DEPLOYMENT.md',
          'LICENSE',
          'README.md',
        ],
      },
      message: '商业化部署包生成成功',
    });
  } catch (error) {
    console.error('生成部署包失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '生成部署包失败',
      },
      { status: 500 }
    );
  }
}

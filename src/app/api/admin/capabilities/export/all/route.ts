/**
 * 导出所有能力 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { capabilityExporter, ExportFormat, generateExportSummary } from '@/lib/capability-export';

/**
 * GET /api/admin/capabilities/export/all
 * 导出所有能力（基础 + 领域）
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get('format') as ExportFormat) || ExportFormat.JSON;

    // 导出所有能力
    const output = capabilityExporter.exportAllCapabilities(format);
    const exportData = JSON.parse(output);

    // 生成摘要
    const summary = generateExportSummary(exportData);

    return NextResponse.json({
      success: true,
      data: {
        filename: `all-capabilities.${format}`,
        format,
        output,
        summary,
      },
      message: '所有能力（基础 + 领域）导出成功',
    });
  } catch (error) {
    console.error('导出所有能力失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '导出所有能力失败',
      },
      { status: 500 }
    );
  }
}

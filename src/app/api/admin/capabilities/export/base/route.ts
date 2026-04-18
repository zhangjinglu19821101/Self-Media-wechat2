/**
 * 导出基础能力 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { capabilityExporter, ExportFormat } from '@/lib/capability-export';

/**
 * GET /api/admin/capabilities/export/base
 * 导出基础能力
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const format = (searchParams.get('format') as ExportFormat) || ExportFormat.JSON;

    let output: string;
    let filename: string;

    if (agentId) {
      // 导出特定 Agent 的基础能力
      output = capabilityExporter.exportAgentBaseCapabilities(agentId, format);
      filename = `base-capabilities-${agentId}.${format}`;
    } else {
      // 导出所有基础能力
      output = capabilityExporter.exportBaseCapabilities(format);
      filename = `base-capabilities.${format}`;
    }

    // 解析摘要信息
    const exportData = JSON.parse(output);
    const summary = {
      filename,
      agentId,
      scope: 'base',
      totalCapabilities: Object.values(exportData.capabilities || {}).reduce(
        (sum: number, skills: any[]) => sum + skills.length,
        0
      ),
      checksum: exportData.metadata.checksum,
    };

    return NextResponse.json({
      success: true,
      data: {
        filename,
        format,
        output,
        summary,
      },
      message: agentId
        ? `Agent ${agentId} 的基础能力导出成功`
        : '所有基础能力导出成功',
    });
  } catch (error) {
    console.error('导出基础能力失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '导出基础能力失败',
      },
      { status: 500 }
    );
  }
}

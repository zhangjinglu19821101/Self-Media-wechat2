/**
 * 导出领域能力 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { capabilityExporter, ExportFormat } from '@/lib/capability-export';

/**
 * GET /api/admin/capabilities/export/domain
 * 导出领域能力
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const domain = searchParams.get('domain');
    const format = (searchParams.get('format') as ExportFormat) || ExportFormat.JSON;

    let output: string;
    let filename: string;

    if (agentId) {
      // 导出特定 Agent 的领域能力
      output = capabilityExporter.exportAgentDomainCapabilities(agentId, domain || undefined, format);
      filename = domain
        ? `domain-capabilities-${agentId}-${domain}.${format}`
        : `domain-capabilities-${agentId}.${format}`;
    } else {
      // 导出所有领域能力
      const domains = domain ? [domain] : undefined;
      output = capabilityExporter.exportDomainCapabilities(domains, format);
      filename = domain
        ? `domain-capabilities-${domain}.${format}`
        : `domain-capabilities.${format}`;
    }

    // 解析摘要信息
    const exportData = JSON.parse(output);
    const summary = {
      filename,
      agentId,
      domain,
      scope: 'domain',
      totalCapabilities: 0,
      checksum: exportData.metadata.checksum,
    };

    // 计算总能力数
    if (exportData.capabilities) {
      for (const key of Object.keys(exportData.capabilities)) {
        const data = exportData.capabilities[key];
        if (Array.isArray(data)) {
          summary.totalCapabilities += data.length;
        } else if (typeof data === 'object') {
          for (const agentId of Object.keys(data)) {
            summary.totalCapabilities += data[agentId].length;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        filename,
        format,
        output,
        summary,
      },
      message: agentId
        ? `Agent ${agentId} 的领域能力导出成功`
        : '所有领域能力导出成功',
    });
  } catch (error) {
    console.error('导出领域能力失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '导出领域能力失败',
      },
      { status: 500 }
    );
  }
}

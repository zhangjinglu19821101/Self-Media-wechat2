/**
 * Agent 能力分析 API
 * 用于展示基础能力和领域能力的分布
 */

import { NextResponse } from 'next/server';
import {
  getBaseCapabilities,
  getDomainCapabilitiesTemplate,
  combineCapabilities,
  calculateReplicability,
  getCapabilitiesSummary,
  DOMAIN_CAPABILITIES_TEMPLATES,
} from '@/lib/agent-capabilities';

/**
 * GET /api/admin/capabilities/analysis
 * 获取能力分析报告
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const domain = searchParams.get('domain');

    const analysis: any = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
    };

    if (agentId) {
      // 分析单个 Agent
      analysis.agentId = agentId;

      // 基础能力
      analysis.baseCapabilities = getBaseCapabilities(agentId);

      // 可领域能力
      if (domain) {
        analysis.domainCapabilities = getDomainCapabilitiesTemplate(agentId, domain);
      } else {
        analysis.availableDomains = {};
        for (const d of Object.keys(DOMAIN_CAPABILITIES_TEMPLATES)) {
          const skills = getDomainCapabilitiesTemplate(agentId, d);
          if (skills.length > 0) {
            analysis.availableDomains[d] = {
              skillCount: skills.length,
              skills: skills.map((s) => ({
                id: s.id,
                name: s.name,
                level: s.level,
                description: s.description,
              })),
            };
          }
        }
      }

      // 组合能力
      if (domain) {
        analysis.combinedCapabilities = combineCapabilities(agentId, domain);
      }

      // 可复制性分析
      analysis.replicability = calculateReplicability(agentId);

      // 摘要
      analysis.summary = getCapabilitiesSummary(agentId);
    } else {
      // 分析所有 Agent
      analysis.agents = {};
      for (const id of ['A', 'B', 'C', 'D']) {
        analysis.agents[id] = {
          baseCapabilities: getBaseCapabilities(id).length,
          domainCapabilities: Object.keys(DOMAIN_CAPABILITIES_TEMPLATES).reduce(
            (sum, d) => sum + (DOMAIN_CAPABILITIES_TEMPLATES[d][id]?.length || 0),
            0
          ),
          summary: getCapabilitiesSummary(id),
          replicability: calculateReplicability(id),
        };
      }

      // 整体统计
      const agentsData = Object.values(analysis.agents) as Array<{ baseCapabilities: number; domainCapabilities: number }>;
      const totalBase: number = agentsData.reduce((sum, a) => sum + a.baseCapabilities, 0);
      const totalDomain: number = agentsData.reduce((sum, a) => sum + a.domainCapabilities, 0);

      analysis.overall = {
        totalBaseCapabilities: totalBase,
        totalDomainCapabilities: totalDomain,
        overallReplicability: totalBase + totalDomain > 0 ? Math.round((totalBase / (totalBase + totalDomain)) * 100) : 0,
        recommendation: getOverallRecommendation(totalBase, totalDomain),
      };
    }

    return NextResponse.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    console.error('获取能力分析失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取能力分析失败',
      },
      { status: 500 }
    );
  }
}

/**
 * 生成整体建议
 */
function getOverallRecommendation(baseCount: number, domainCount: number): string {
  const baseRatio = (baseCount / (baseCount + domainCount)) * 100;

  if (baseRatio >= 70) {
    return '基础能力占主导，适合标准化产品，可直接商业化复制';
  } else if (baseRatio >= 50) {
    return '基础能力与领域能力相当，建议采用"平台能力+行业模板"混合模式';
  } else {
    return '领域能力占主导，建议采用定制化服务模式，需要领域专家深度参与';
  }
}

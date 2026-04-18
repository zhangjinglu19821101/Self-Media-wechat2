import { NextRequest, NextResponse } from 'next/server';

/**
 * 导出 Agent B 的新媒体通用规则
 * GET /api/admin/export/rules
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 从数据库获取所有规则
    const rulesResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5000'}/api/rules`, {
      method: 'GET',
    });

    if (!rulesResponse.ok) {
      throw new Error('获取规则失败');
    }

    const rulesData = await rulesResponse.json();

    // 2. 组织导出格式
    const exportData = {
      version: '1.0.0',
      exportTime: new Date().toISOString(),
      agent: 'B',
      agentName: 'AI商业运营体系技术总负责人',
      categories: {
        // 内容类通用规则
        content: rulesData.data.filter((r: any) => r.category === 'content'),
        // 运营类通用规则
        operations: rulesData.data.filter((r: any) => r.category === 'operations'),
        // 技术类通用技能
        technical: rulesData.data.filter((r: any) => r.category === 'technical'),
        // 合规类通用规则
        compliance: rulesData.data.filter((r: any) => r.category === 'compliance'),
        // 安全类通用规则
        security: rulesData.data.filter((r: any) => r.category === 'security'),
        // 策略类通用规则
        strategy: rulesData.data.filter((r: any) => r.category === 'strategy'),
      },
      statistics: {
        total: rulesData.data.length,
        byCategory: {
          content: rulesData.data.filter((r: any) => r.category === 'content').length,
          operations: rulesData.data.filter((r: any) => r.category === 'operations').length,
          technical: rulesData.data.filter((r: any) => r.category === 'technical').length,
          compliance: rulesData.data.filter((r: any) => r.category === 'compliance').length,
          security: rulesData.data.filter((r: any) => r.category === 'security').length,
          strategy: rulesData.data.filter((r: any) => r.category === 'strategy').length,
        },
      },
    };

    // 3. 返回 JSON 格式
    return NextResponse.json({
      success: true,
      data: exportData,
    });
  } catch (error) {
    console.error('导出规则失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '导出规则失败',
      },
      { status: 500 }
    );
  }
}

/**
 * 导出为 Markdown 格式
 * GET /api/admin/export/rules?format=markdown
 */
export async function POST(request: NextRequest) {
  try {
    const { format } = await request.json();

    // 1. 获取规则数据
    const rulesResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5000'}/api/rules`, {
      method: 'GET',
    });

    if (!rulesResponse.ok) {
      throw new Error('获取规则失败');
    }

    const rulesData = await rulesResponse.json();

    // 2. 生成 Markdown 内容
    let markdown = `# Agent B 新媒体通用规则导出\n\n`;
    markdown += `**导出时间**: ${new Date().toLocaleString('zh-CN')}\n\n`;
    markdown += `**规则总数**: ${rulesData.data.length}\n\n`;
    markdown += `---\n\n`;

    const categories = [
      { key: 'content', name: '内容类通用规则' },
      { key: 'operations', name: '运营类通用规则' },
      { key: 'technical', name: '技术类通用技能' },
      { key: 'compliance', name: '合规类通用规则' },
      { key: 'security', name: '安全类通用规则' },
      { key: 'strategy', name: '策略类通用规则' },
    ];

    for (const category of categories) {
      const categoryRules = rulesData.data.filter((r: any) => r.category === category.key);
      if (categoryRules.length === 0) continue;

      markdown += `## ${category.name}\n\n`;
      markdown += `**规则数量**: ${categoryRules.length}\n\n`;

      for (const rule of categoryRules) {
        markdown += `### ${rule.name}\n\n`;
        markdown += `**ID**: ${rule.id}\n`;
        markdown += `**描述**: ${rule.description}\n`;
        markdown += `**赛道**: ${rule.domain}\n`;
        markdown += `**优先级**: ${rule.priority}\n\n`;

        if (rule.conditions && rule.conditions.length > 0) {
          markdown += `**触发条件**:\n`;
          for (const condition of rule.conditions) {
            markdown += `- ${condition.description}\n`;
          }
          markdown += `\n`;
        }

        if (rule.actions && rule.actions.length > 0) {
          markdown += `**执行动作**:\n`;
          for (const action of rule.actions) {
            markdown += `- ${action.description}\n`;
          }
          markdown += `\n`;
        }

        markdown += `---\n\n`;
      }
    }

    // 3. 返回 Markdown
    return NextResponse.json({
      success: true,
      data: {
        content: markdown,
        filename: `agent-b-rules-${new Date().toISOString().split('T')[0]}.md`,
      },
    });
  } catch (error) {
    console.error('导出规则失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '导出规则失败',
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { agents } from '@/lib/agent-prompts';

/**
 * 导出 Agent 提示词
 * GET /api/admin/export/prompts?agentId=B
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');

    if (!agentId) {
      // 返回所有 Agent 的提示词
      const allAgents = agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        role: agent.role,
        description: agent.description,
        systemPrompt: agent.systemPrompt,
        capabilities: agent.capabilities,
        restrictions: agent.restrictions,
        tools: agent.tools,
      }));

      return NextResponse.json({
        success: true,
        data: {
          version: '1.0.0',
          exportTime: new Date().toISOString(),
          agents: allAgents,
        },
      });
    }

    // 返回指定 Agent 的提示词
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) {
      return NextResponse.json(
        {
          success: false,
          error: `找不到 Agent: ${agentId}`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        version: '1.0.0',
        exportTime: new Date().toISOString(),
        agent: {
          id: agent.id,
          name: agent.name,
          role: agent.role,
          description: agent.description,
          systemPrompt: agent.systemPrompt,
          capabilities: agent.capabilities,
          restrictions: agent.restrictions,
          tools: agent.tools,
        },
      },
    });
  } catch (error) {
    console.error('导出提示词失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '导出提示词失败',
      },
      { status: 500 }
    );
  }
}

/**
 * 导出为 Markdown 格式
 * POST /api/admin/export/prompts
 */
export async function POST(request: NextRequest) {
  try {
    const { agentId, format } = await request.json();

    if (!agentId) {
      return NextResponse.json(
        {
          success: false,
          error: '必须指定 agentId',
        },
        { status: 400 }
      );
    }

    const agent = agents.find((a) => a.id === agentId);
    if (!agent) {
      return NextResponse.json(
        {
          success: false,
          error: `找不到 Agent: ${agentId}`,
        },
        { status: 404 }
      );
    }

    // 生成 Markdown 内容
    let markdown = `# Agent ${agent.id} 提示词导出\n\n`;
    markdown += `**导出时间**: ${new Date().toLocaleString('zh-CN')}\n\n`;
    markdown += `---\n\n`;

    markdown += `## 基本信息\n\n`;
    markdown += `- **ID**: ${agent.id}\n`;
    markdown += `- **名称**: ${agent.name}\n`;
    markdown += `- **角色**: ${agent.role}\n`;
    markdown += `- **描述**: ${agent.description}\n\n`;

    markdown += `---\n\n`;

    markdown += `## 系统提示词\n\n`;
    markdown += `\`\`\`\n${agent.systemPrompt}\n\`\`\`\n\n`;

    markdown += `---\n\n`;

    markdown += `## 核心能力\n\n`;
    for (const capability of agent.capabilities) {
      markdown += `- ${capability}\n`;
    }
    markdown += `\n`;

    markdown += `---\n\n`;

    if (agent.restrictions && agent.restrictions.length > 0) {
      markdown += `## 限制条件\n\n`;
      for (const restriction of agent.restrictions) {
        markdown += `- ${restriction}\n`;
      }
      markdown += `\n`;
    }

    markdown += `---\n\n`;

    if (agent.tools && agent.tools.length > 0) {
      markdown += `## 可用工具\n\n`;
      for (const tool of agent.tools) {
        markdown += `- **${tool.name}**: ${tool.url}\n`;
      }
      markdown += `\n`;
    }

    return NextResponse.json({
      success: true,
      data: {
        content: markdown,
        filename: `agent-${agent.id}-prompt-${new Date().toISOString().split('T')[0]}.md`,
      },
    });
  } catch (error) {
    console.error('导出提示词失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '导出提示词失败',
      },
      { status: 500 }
    );
  }
}

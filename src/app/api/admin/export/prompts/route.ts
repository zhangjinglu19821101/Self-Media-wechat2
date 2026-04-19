import { NextRequest, NextResponse } from 'next/server';
import { AGENT_PROMPTS, getAgentPrompt, getAllAgentPrompts } from '@/lib/agent-prompts';
import type { AgentId } from '@/lib/agent-types';

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
      const allPrompts = getAllAgentPrompts();
      const allAgents = Object.entries(allPrompts).map(([id, prompt]) => ({
        id,
        name: id.toUpperCase(),
        role: 'Agent',
        systemPrompt: prompt.systemPrompt,
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
    const prompt = getAgentPrompt(agentId as AgentId);
    if (!prompt) {
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
          id: agentId,
          name: agentId.toUpperCase(),
          role: 'Agent',
          systemPrompt: prompt.systemPrompt,
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

    const prompt = getAgentPrompt(agentId);
    if (!prompt) {
      return NextResponse.json(
        {
          success: false,
          error: `找不到 Agent: ${agentId}`,
        },
        { status: 404 }
      );
    }

    // 生成 Markdown 内容
    let markdown = `# Agent ${agentId} 提示词导出\n\n`;
    markdown += `**导出时间**: ${new Date().toLocaleString('zh-CN')}\n\n`;
    markdown += `---\n\n`;

    markdown += `## 基本信息\n\n`;
    markdown += `- **ID**: ${agentId}\n`;
    markdown += `- **名称**: ${agentId.toUpperCase()}\n\n`;

    markdown += `---\n\n`;

    markdown += `## 系统提示词\n\n`;
    markdown += `\`\`\`\n${prompt.systemPrompt}\n\`\`\`\n\n`;

    return NextResponse.json({
      success: true,
      data: {
        content: markdown,
        filename: `agent-${agentId}-prompt-${new Date().toISOString().split('T')[0]}.md`,
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

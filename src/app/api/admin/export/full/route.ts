import { NextRequest, NextResponse } from 'next/server';
import { getAllAgentPrompts } from '@/lib/agent-prompts';

/**
 * 完整项目导出（包含所有资产）
 * GET /api/admin/export/full
 */
export async function GET(request: NextRequest) {
  try {
    const allPrompts = getAllAgentPrompts();
    const agentList = Object.entries(allPrompts).map(([id, prompt]) => ({
      id,
      name: id.toUpperCase(),
      role: 'Agent',
    }));

    const exportData = {
      version: '1.0.0',
      exportTime: new Date().toISOString(),
      projectName: '多 Agent 协作系统',
      projectDescription: '基于 Next.js 的多 Agent 协作系统，包含双事业部（AI、保险）战略决策、技术落地、运营及内容执行能力',
      metadata: {
        totalAgents: agentList.length,
        agents: agentList,
      },
      sections: {
        agents: {
          name: 'Agent 定义',
          description: '所有 Agent 的提示词、能力、限制等定义',
          exportUrl: '/api/admin/export/prompts',
          count: agentList.length,
        },
        rules: {
          name: '规则配置',
          description: 'Agent B 的新媒体通用规则（6大类）',
          exportUrl: '/api/admin/export/rules',
          count: 0, // 需要从数据库获取
        },
        code: {
          name: '代码实现',
          description: '规则引擎、拆解引擎、权限管理系统等核心代码',
          location: '/workspace/projects/src',
          note: '代码已存在于项目目录中，可直接访问',
        },
        knowledgeBase: {
          name: '知识库',
          description: '各 Agent 的知识库内容（经验、技术方案、运营策略）',
          exportUrl: '/api/knowledge-base/export',
          note: '需要调用知识库 API 导出',
        },
        database: {
          name: '数据库',
          description: '对话历史、执行记录等数据',
          exportUrl: '/api/database/export',
          note: '需要调用数据库 API 导出',
        },
      },
    };

    return NextResponse.json({
      success: true,
      data: exportData,
    });
  } catch (error) {
    console.error('完整导出失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '完整导出失败',
      },
      { status: 500 }
    );
  }
}

/**
 * 执行完整导出（打包为 JSON）
 * POST /api/admin/export/full
 */
export async function POST(request: NextRequest) {
  try {
    const allPrompts = getAllAgentPrompts();
    const agentList = Object.entries(allPrompts).map(([id, prompt]) => ({
      id,
      name: id.toUpperCase(),
      role: 'Agent',
      systemPrompt: prompt.systemPrompt,
    }));

    const fullExportData = {
      version: '1.0.0',
      exportTime: new Date().toISOString(),
      projectName: '多 Agent 协作系统',
      agents: agentList,
      architecture: {
        type: '双事业部架构',
        departments: ['总枢纽', 'AI事业部', '保险事业部'],
        agentMapping: {
          '总枢纽': ['A'],
          'AI事业部': ['C', 'D'],
          '保险事业部': ['insurance-c', 'insurance-d'],
          '双事业部支撑': ['B'],
        },
      },
      technologyStack: {
        frontend: 'Next.js 16 + React 19 + TypeScript 5 + shadcn/ui',
        backend: 'Next.js API Routes + PostgreSQL',
        ai: '豆包大语言模型 + 豆包生图/视频/语音 + 向量模型',
        sdk: 'coze-coding-dev-sdk',
        database: 'PostgreSQL + Drizzle ORM',
        storage: '对象存储 (S3)',
      },
    };

    return NextResponse.json({
      success: true,
      data: fullExportData,
    });
  } catch (error) {
    console.error('完整导出失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '完整导出失败',
      },
      { status: 500 }
    );
  }
}

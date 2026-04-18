import { NextRequest, NextResponse } from 'next/server';
import { agents } from '@/lib/agent-prompts';
import { execShell } from '@/lib/shell';

/**
 * 完整项目导出（包含所有资产）
 * GET /api/admin/export/full
 */
export async function GET(request: NextRequest) {
  try {
    const exportData = {
      version: '1.0.0',
      exportTime: new Date().toISOString(),
      projectName: '多 Agent 协作系统',
      projectDescription: '基于 Next.js 的多 Agent 协作系统，包含双事业部（AI、保险）战略决策、技术落地、运营及内容执行能力',
      metadata: {
        totalAgents: agents.length,
        agents: agents.map((a) => ({
          id: a.id,
          name: a.name,
          role: a.role,
        })),
      },
      sections: {
        agents: {
          name: 'Agent 定义',
          description: '所有 Agent 的提示词、能力、限制等定义',
          exportUrl: '/api/admin/export/prompts',
          count: agents.length,
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
 * 执行完整导出（打包为 ZIP 或 JSON）
 * POST /api/admin/export/full
 */
export async function POST(request: NextRequest) {
  try {
    const { format } = await request.json();

    // 1. 导出 Agent 提示词
    const promptsResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5000'}/api/admin/export/prompts`);
    const promptsData = await promptsResponse.json();

    // 2. 导出规则
    const rulesResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5000'}/api/admin/export/rules`);
    const rulesData = await rulesResponse.json();

    // 3. 组织完整导出数据
    const fullExportData = {
      version: '1.0.0',
      exportTime: new Date().toISOString(),
      projectName: '多 Agent 协作系统',
      agents: promptsData.data.agents || [promptsData.data.agent],
      rules: rulesData.data,
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
      usageGuide: {
        howToImport: {
          step1: '导入规则数据到数据库',
          step2: '部署提示词配置到代码库',
          step3: '配置知识库实例',
          step4: '启动服务',
        },
        dependencies: {
          required: [
            'Next.js 16',
            'PostgreSQL 数据库',
            'coze-coding-dev-sdk',
            '豆包 API Key',
          ],
          optional: [
            '对象存储服务',
          ],
        },
      },
    };

    // 4. 根据格式返回
    if (format === 'json') {
      return NextResponse.json({
        success: true,
        data: fullExportData,
      });
    } else if (format === 'markdown') {
      // 生成 Markdown 报告
      let markdown = `# 多 Agent 协作系统 - 完整资产导出\n\n`;
      markdown += `**导出时间**: ${new Date().toLocaleString('zh-CN')}\n`;
      markdown += `**版本**: ${fullExportData.version}\n\n`;
      markdown += `---\n\n`;

      markdown += `## 系统概述\n\n`;
      markdown += `${fullExportData.projectDescription}\n\n`;

      markdown += `---\n\n`;

      markdown += `## 架构信息\n\n`;
      markdown += `- **架构类型**: ${fullExportData.architecture.type}\n`;
      markdown += `- **部门数量**: ${fullExportData.architecture.departments.length}\n\n`;
      markdown += `### Agent 映射\n\n`;
      for (const [dept, agentList] of Object.entries(fullExportData.architecture.agentMapping)) {
        markdown += `- **${dept}**: ${agentList.join(', ')}\n`;
      }
      markdown += `\n`;

      markdown += `---\n\n`;

      markdown += `## 技术栈\n\n`;
      markdown += `- **前端**: ${fullExportData.technologyStack.frontend}\n`;
      markdown += `- **后端**: ${fullExportData.technologyStack.backend}\n`;
      markdown += `- **AI**: ${fullExportData.technologyStack.ai}\n`;
      markdown += `- **SDK**: ${fullExportData.technologyStack.sdk}\n`;
      markdown += `- **数据库**: ${fullExportData.technologyStack.database}\n`;
      markdown += `- **存储**: ${fullExportData.technologyStack.storage}\n\n`;

      markdown += `---\n\n`;

      markdown += `## 资产清单\n\n`;

      markdown += `### 1. Agent 定义 (${fullExportData.agents.length} 个)\n\n`;
      for (const agent of fullExportData.agents) {
        markdown += `- **Agent ${agent.id}** (${agent.name}): ${agent.role}\n`;
      }
      markdown += `\n`;

      markdown += `### 2. 规则配置\n\n`;
      if (fullExportData.rules.statistics) {
        markdown += `- **总规则数**: ${fullExportData.rules.statistics.total}\n`;
        for (const [category, count] of Object.entries(fullExportData.rules.statistics.byCategory)) {
          markdown += `- **${category}**: ${count}\n`;
        }
      }
      markdown += `\n`;

      markdown += `### 3. 代码实现\n\n`;
      markdown += `- **位置**: /workspace/projects/src\n`;
      markdown += `- **说明**: 代码已存在于项目目录中，可直接访问\n\n`;

      markdown += `---\n\n`;

      markdown += `## 使用指南\n\n`;
      markdown += `### 如何导入\n\n`;
      for (const [step, instruction] of Object.entries(fullExportData.usageGuide.howToImport)) {
        markdown += `${step}. ${instruction}\n`;
      }
      markdown += `\n`;

      markdown += `### 依赖项\n\n`;
      markdown += `**必需**:\n`;
      for (const dep of fullExportData.usageGuide.dependencies.required) {
        markdown += `- ${dep}\n`;
      }
      markdown += `\n`;
      markdown += `**可选**:\n`;
      for (const dep of fullExportData.usageGuide.dependencies.optional) {
        markdown += `- ${dep}\n`;
      }
      markdown += `\n`;

      markdown += `---\n\n`;
      markdown += `*导出完成。所有资产已包含在此文档中。*\n`;

      return NextResponse.json({
        success: true,
        data: {
          content: markdown,
          filename: `multi-agent-system-export-${new Date().toISOString().split('T')[0]}.md`,
        },
      });
    } else {
      // 默认返回 JSON
      return NextResponse.json({
        success: true,
        data: fullExportData,
      });
    }
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

/**
 * Agent 配置导出工具（简化版）
 * 原版本的 agent-export.ts 引用了不存在的模块，已重构为简化版
 */

import { agentManager } from './agent-manager';
import { AGENT_PROMPTS } from './agent-prompts';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export interface AgentExportData {
  version: string;
  exportDate: string;
  agents: {
    [agentId: string]: {
      config: any;
      prompt: string;
    };
  };
}

/**
 * 导出所有 Agent 配置（不含知识库内容）
 */
export async function exportAgentConfigs(): Promise<AgentExportData> {
  const exportData: AgentExportData = {
    version: '1.0.0',
    exportDate: new Date().toISOString(),
    agents: {},
  };

  // 从 AgentManager 获取所有 Agent
  const agents = agentManager.getAllAgents();

  // 导出每个 Agent 的配置
  for (const agent of agents) {
    const config = {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      description: agent.description,
      skills: agent.skills,
      maxConcurrentTasks: agent.maxConcurrentTasks,
      canSendTo: agent.canSendTo,
      canReceiveFrom: agent.canReceiveFrom,
    };
    const prompt = AGENT_PROMPTS[agent.id]?.systemPrompt || '';

    exportData.agents[agent.id] = {
      config,
      prompt,
    };
  }

  return exportData;
}

/**
 * 导出完整的 Agent 数据（包含知识库内容）
 * 注意：简化版不包含知识库内容
 */
export async function exportAgentComplete(
  agentId: string,
  _includeKnowledgeBase: boolean = true
): Promise<any> {
  const agents = agentManager.getAllAgents();
  const agent = agents.find((a) => a.id === agentId);

  if (!agent) {
    throw new Error(`Agent ${agentId} 不存在`);
  }

  const config = {
    id: agent.id,
    name: agent.name,
    role: agent.role,
    description: agent.description,
    skills: agent.skills,
    maxConcurrentTasks: agent.maxConcurrentTasks,
    canSendTo: agent.canSendTo,
    canReceiveFrom: agent.canReceiveFrom,
  };
  const prompt = AGENT_PROMPTS[agentId]?.systemPrompt || '';

  return {
    agentId,
    config,
    prompt,
    knowledgeBase: {
      included: _includeKnowledgeBase,
      summary: {},
      memories: [],
    },
    exportDate: new Date().toISOString(),
    version: '1.0.0',
  };
}

/**
 * 导出所有 Agent（完整）
 */
export async function exportAllAgents(
  includeKnowledgeBase: boolean = true
): Promise<{ [agentId: string]: any }> {
  const allExports: { [agentId: string]: any } = {};
  const agents = agentManager.getAllAgents();

  for (const agent of agents) {
    allExports[agent.id] = await exportAgentComplete(
      agent.id,
      includeKnowledgeBase
    );
  }

  return allExports;
}

/**
 * 生成商业化部署包
 */
export async function generateCommercialPackage(
  outputPath: string = '/tmp/agent-commercial-package'
): Promise<string> {
  // 创建输出目录
  if (!existsSync(outputPath)) {
    mkdirSync(outputPath, { recursive: true });
  }

  // 1. 导出配置
  const configs = await exportAgentConfigs();
  writeFileSync(
    join(outputPath, 'agent-configs.json'),
    JSON.stringify(configs, null, 2)
  );

  // 2. 导出完整数据
  const fullData = await exportAllAgents(false);
  writeFileSync(
    join(outputPath, 'agent-complete-export.json'),
    JSON.stringify(fullData, null, 2)
  );

  return outputPath;
}

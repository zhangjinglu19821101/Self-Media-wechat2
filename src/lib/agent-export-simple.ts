/**
 * 简化版 Agent 配置导出工具
 */

import { agentManager } from './agent-manager';
import { AGENT_PROMPTS } from './agent-prompts';

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

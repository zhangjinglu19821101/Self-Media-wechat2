/**
 * Agent 提示词配置
 * 这个文件定义了所有 Agent 的提示词和行为规则
 * 提示词内容已拆分为单独的 Markdown 文件，存放在 src/lib/agents/prompts/ 目录
 *
 * 后期可以直接修改对应的 Markdown 文件来调整 Agent 的行为
 */

import { AgentId } from './agent-types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 从 Markdown 文件读取 Agent 提示词
 */
function readAgentPrompt(agentId: AgentId): {
  systemPrompt: string;
  behaviorRules: string[];
  restrictions: string[];
  skillPrompts?: Record<string, string>;
} {
  try {
    const filePath = path.join(process.cwd(), 'src/lib/agents/prompts', `${agentId}.md`);
    const content = fs.readFileSync(filePath, 'utf8');

    // 解析 Markdown 文件
    const sections: Record<string, string> = {};
    let currentSection = '';

    content.split('\n').forEach(line => {
      const sectionMatch = line.match(/^## (.+)$/);
      if (sectionMatch) {
        currentSection = sectionMatch[1];
        sections[currentSection] = '';
      } else if (currentSection) {
        sections[currentSection] += line + '\n';
      }
    });

    // 解析系统提示词
    const systemPrompt = sections['系统提示词']?.trim() || '';

    // 解析行为规则
    const behaviorRulesText = sections['行为规则']?.trim() || '';
    const behaviorRules = behaviorRulesText
      .split('\n')
      .map(line => line.replace(/^-\s*/, '').trim())
      .filter(line => line.length > 0);

    // 解析限制条款
    const restrictionsText = sections['限制条款']?.trim() || '';
    const restrictions = restrictionsText
      .split('\n')
      .map(line => line.replace(/^-\s*/, '').trim())
      .filter(line => line.length > 0);

    // 解析技能提示词
    const skillPromptsText = sections['技能提示词']?.trim() || '{}';
    let skillPrompts: Record<string, string> = {};
    try {
      skillPrompts = JSON.parse(skillPromptsText);
    } catch (e) {
      console.warn(`Failed to parse skillPrompts for ${agentId}:`, e);
    }

    return {
      systemPrompt,
      behaviorRules,
      restrictions,
      skillPrompts,
    };
  } catch (error) {
    console.error(`Failed to read prompt for agent ${agentId}:`, error);
    return {
      systemPrompt: '',
      behaviorRules: [],
      restrictions: [],
      skillPrompts: undefined,
    };
  }
}

/**
 * Agent 基本信息
 */
const AGENT_NAMES: Record<AgentId, string> = {
  A: '总裁',
  B: 'AI商业运营体系技术总负责人',
  C: 'AI事业部资深运营总监',
  D: 'AI-business事业部 内容主编',
  'insurance-c': '保险事业部运营总监',
  'insurance-d': '保险事业部内容负责人',
  'insurance-xiaohongshu': '小红书图文创作专家',
  'insurance-zhihu': '知乎创作专家',
  'insurance-toutiao': '头条创作专家',
  'deai-optimizer': '去AI化优化专家',
};

/**
 * Agent 提示词配置
 */
export const AGENT_PROMPTS: Record<
  AgentId,
  {
    id: AgentId;
    name: string;
    systemPrompt: string;
    behaviorRules: string[];
    restrictions: string[];
    skillPrompts?: Record<string, string>;
  }
> = {
  A: {
    id: 'A',
    name: AGENT_NAMES.A,
    ...readAgentPrompt('A'),
  },
  B: {
    id: 'B',
    name: AGENT_NAMES.B,
    ...readAgentPrompt('B'),
  },
  C: {
    id: 'C',
    name: AGENT_NAMES.C,
    ...readAgentPrompt('C'),
  },
  D: {
    id: 'D',
    name: AGENT_NAMES.D,
    ...readAgentPrompt('D'),
  },
  'insurance-c': {
    id: 'insurance-c',
    name: AGENT_NAMES['insurance-c'],
    ...readAgentPrompt('insurance-c'),
  },
  'insurance-d': {
    id: 'insurance-d',
    name: AGENT_NAMES['insurance-d'],
    ...readAgentPrompt('insurance-d'),
  },
  'insurance-xiaohongshu': {
    id: 'insurance-xiaohongshu',
    name: AGENT_NAMES['insurance-xiaohongshu'],
    ...readAgentPrompt('insurance-xiaohongshu'),
  },
  'insurance-zhihu': {
    id: 'insurance-zhihu',
    name: AGENT_NAMES['insurance-zhihu'],
    ...readAgentPrompt('insurance-zhihu'),
  },
  'insurance-toutiao': {
    id: 'insurance-toutiao',
    name: AGENT_NAMES['insurance-toutiao'],
    ...readAgentPrompt('insurance-toutiao'),
  },
  'deai-optimizer': {
    id: 'deai-optimizer',
    name: AGENT_NAMES['deai-optimizer'],
    ...readAgentPrompt('deai-optimizer'),
  },
};

/**
 * 获取指定 Agent 的提示词
 */
export function getAgentPrompt(agentId: AgentId) {
  return AGENT_PROMPTS[agentId];
}

/**
 * 获取所有 Agent 的提示词
 */
export function getAllAgentPrompts() {
  return AGENT_PROMPTS;
}

/**
 * Agent 提示词加载器
 * 负责加载各个 agent 的身份提示词和功能提示词
 * 
 * 加载策略：
 * - 执行 Agent（insurance-d, insurance-c 等）：优先 .md 文件，兜底 .ts 配置
 * - 评审 Agent（Agent B, Agent T 等）：优先 .ts 配置，兜底 .md 文件
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getAgentRoleConfig, getAllAgentRoleIds, type AgentRole } from './agent-roles-config';
import { generateAgentRolePrompt } from './agent-prompt-generator';

/**
 * Agent 提示词缓存
 */
const promptCache = new Map<string, string>();

/**
 * 执行 Agent 列表 - 优先使用 .md 文件
 * 这些 Agent 的 .md 文件包含完整的角色定义、业务规则
 * 
 * 注意：此列表 ≠ WRITING_AGENTS，还包含 insurance-c 等非写作执行 Agent
 */
const EXECUTOR_AGENTS = ['insurance-d', 'insurance-c', 'insurance-xiaohongshu', 'insurance-zhihu', 'insurance-toutiao', 'deai-optimizer'];

/**
 * 传统 Agent ID 到文件名的映射（向后兼容）
 * 🔴 优先使用 v2 版本！
 */
const legacyAgentPromptFiles: Record<string, string> = {
  'A': 'A.md',
  'B': 'B.md',
  'C': 'C.md',
  'D': 'D.md',
  // 🔴 Agent T 使用 src/lib/agents/prompts/agent-t-tech-expert.ts，不在此映射
  'insurance-c': 'insurance-c.md',
  // 🔴 insurance-d 优先使用 v3 版本（需求文档3.2节：固定基础提示词 + 动态拼接）
  'insurance-d': 'insurance-d-v3.md',
  // 🔴 insurance-xiaohongshu 使用小红书专属提示词
  'insurance-xiaohongshu': 'insurance-xiaohongshu.md',
  // 🔴 insurance-zhihu 使用知乎专属提示词
  'insurance-zhihu': 'insurance-zhihu.md',
  // 🔴 insurance-toutiao 使用头条专属提示词
  'insurance-toutiao': 'insurance-toutiao.md',
  // 🔴 deai-optimizer 去AI化优化专家
  'deai-optimizer': 'deai-optimizer.md',
  
  // 功能提示词
  'executor-standard-result': 'executor-standard-result.md',
  'agent-b-structured-review': 'agent-b-structured-review.md',
  'precedent-selector-system-prompt': 'precedent-selector-system-prompt.md',
};

/**
 * 获取传统 Agent 提示词文件路径
 * @param agentId Agent ID
 * @returns 文件路径
 */
function getLegacyPromptFilePath(agentId: string): string {
  // 🔴 修复：标准化 agentId（将下划线替换为连字符）
  const normalizedAgentId = agentId.replace(/_/g, '-');
  const fileName = legacyAgentPromptFiles[normalizedAgentId];
  if (!fileName) {
    throw new Error(`未找到 Agent ${agentId} 的提示词文件`);
  }
  
  return join(process.cwd(), 'src', 'lib', 'agents', 'prompts', fileName);
}

/**
 * 加载 Agent 提示词
 * 
 * 策略：
 * - 执行 Agent（insurance-d, insurance-c 等）：优先 .md 文件
 * - 其他 Agent：优先 .ts 配置
 * 
 * @param agentId Agent ID
 * @returns 提示词内容
 */
export function loadAgentPrompt(agentId: string): string {
  // 🔴 修复：标准化 agentId（将下划线替换为连字符）
  const normalizedAgentId = agentId.replace(/_/g, '-');
  
  // 🔴 强制不使用缓存，每次重新加载
  promptCache.delete(normalizedAgentId);
  
  // ========== 执行 Agent：优先 .md 文件 ==========
  if (EXECUTOR_AGENTS.includes(normalizedAgentId)) {
    return loadExecutorAgentPrompt(normalizedAgentId);
  }
  
  // ========== 其他 Agent：优先 .ts 配置 ==========
  return loadReviewerAgentPrompt(normalizedAgentId);
}

/**
 * 加载执行 Agent 提示词（优先 .md）
 */
function loadExecutorAgentPrompt(agentId: string): string {
  // 步骤1：优先从 .md 文件加载
  try {
    const filePath = getLegacyPromptFilePath(agentId);
    if (existsSync(filePath)) {
      const prompt = readFileSync(filePath, 'utf-8');
      promptCache.set(agentId, prompt);
      console.log(`✅ [执行Agent] Agent ${agentId} 使用 .md 文件，长度: ${prompt.length} 字符`);
      return prompt;
    }
  } catch (error) {
    // 文件不存在，继续
  }
  
  // 步骤2：.md 不存在时，兜底使用 .ts 配置
  try {
    const config = getAgentRoleConfig(agentId as AgentRole);
    if (config) {
      const prompt = generateAgentRolePrompt(config);
      promptCache.set(agentId, prompt);
      console.log(`✅ [执行Agent] Agent ${agentId} 使用 .ts 配置（兜底），长度: ${prompt.length} 字符`);
      return prompt;
    }
  } catch (error) {
    // 配置不存在
  }
  
  throw new Error(`Agent ${agentId} 既没有 .md 文件，也没有 .ts 配置！`);
}

/**
 * 加载评审 Agent 提示词（优先 .ts）
 */
function loadReviewerAgentPrompt(agentId: string): string {
  // 步骤1：优先使用 .ts 配置
  try {
    const agentRoleConfig = getAgentRoleConfig(agentId as AgentRole);
    if (agentRoleConfig) {
      console.log(`✅ [评审Agent] Agent ${agentId} 使用 .ts 配置`);
      const prompt = generateAgentRolePrompt(agentRoleConfig);
      promptCache.set(agentId, prompt);
      console.log(`✅ 成功生成 Agent ${agentId} 提示词，长度: ${prompt.length} 字符`);
      return prompt;
    }
  } catch (error) {
    // 配置不存在，继续尝试文件方式
  }
  
  // 步骤2：.ts 不存在时，兜底使用 .md 文件
  try {
    const filePath = getLegacyPromptFilePath(agentId);
    if (existsSync(filePath)) {
      const prompt = readFileSync(filePath, 'utf-8');
      promptCache.set(agentId, prompt);
      console.log(`✅ [评审Agent] Agent ${agentId} 使用 .md 文件（兜底），长度: ${prompt.length} 字符`);
      return prompt;
    }
  } catch (error) {
    // 文件不存在
  }
  
  throw new Error(`Agent ${agentId} 既没有 .ts 配置，也没有 .md 文件！`);
}

/**
 * 加载 Agent 角色配置提示词（新系统）
 * @param agentRole Agent 角色
 * @returns 提示词内容
 */
export function loadAgentRolePrompt(agentRole: AgentRole): string {
  const cacheKey = `role-${agentRole}`;
  
  // 检查缓存
  if (promptCache.has(cacheKey)) {
    console.log(`✅ 从缓存加载 Agent 角色 ${agentRole} 提示词`);
    return promptCache.get(cacheKey)!;
  }
  
  // 获取配置并生成提示词
  const config = getAgentRoleConfig(agentRole);
  const prompt = generateAgentRolePrompt(config);
  
  // 缓存提示词
  promptCache.set(cacheKey, prompt);
  
  console.log(`✅ 成功生成 Agent 角色 ${agentRole} 提示词，长度: ${prompt.length} 字符`);
  
  return prompt;
}

/**
 * 清除 Agent 提示词缓存
 * @param agentId Agent ID（可选，不传则清除所有）
 */
export function clearPromptCache(agentId?: string) {
  if (agentId) {
    promptCache.delete(agentId);
    console.log(`✅ 已清除 Agent ${agentId} 提示词缓存`);
  } else {
    promptCache.clear();
    console.log(`✅ 已清除所有 Agent 提示词缓存`);
  }
}

/**
 * 检查 Agent 是否有提示词文件
 * @param agentId Agent ID
 * @returns 是否有提示词文件
 */
export function hasAgentPrompt(agentId: string): boolean {
  // 首先检查是否是新配置系统中的角色
  try {
    const config = getAgentRoleConfig(agentId as AgentRole);
    if (config) {
      return true;
    }
  } catch (error) {
    // 不是新配置系统角色，继续检查传统方式
  }
  
  // 检查传统方式
  const fileName = legacyAgentPromptFiles[agentId];
  if (!fileName) {
    return false;
  }
  
  const filePath = join(process.cwd(), 'src', 'lib', 'agents', 'prompts', fileName);
  return existsSync(filePath);
}

/**
 * 获取所有支持的 Agent ID（包含新配置系统和传统方式）
 * @returns Agent ID 列表
 */
export function getSupportedAgentIds(): string[] {
  const legacyIds = Object.keys(legacyAgentPromptFiles);
  const newRoleIds = getAllAgentRoleIds();
  
  // 合并并去重
  const allIds = [...new Set([...legacyIds, ...newRoleIds])];
  return allIds;
}

/**
 * 加载功能提示词
 * @param promptId 功能提示词ID
 * @returns 提示词内容
 */
export function loadFeaturePrompt(promptId: string): string {
  // 检查缓存
  if (promptCache.has(promptId)) {
    console.log(`✅ 从缓存加载功能提示词 ${promptId}`);
    return promptCache.get(promptId)!;
  }
  
  // 加载文件
  const fileName = legacyAgentPromptFiles[promptId];
  if (!fileName) {
    throw new Error(`未找到功能提示词 ${promptId} 的文件`);
  }
  
  const filePath = join(process.cwd(), 'src', 'lib', 'agents', 'prompts', fileName);
  
  if (!existsSync(filePath)) {
    throw new Error(`功能提示词 ${promptId} 的文件不存在: ${filePath}`);
  }
  
  const prompt = readFileSync(filePath, 'utf-8');
  
  // 缓存提示词
  promptCache.set(promptId, prompt);
  
  console.log(`✅ 成功加载功能提示词 ${promptId}，长度: ${prompt.length} 字符`);
  
  return prompt;
}

/**
 * 获取 Agent 角色配置
 * @param agentRole Agent 角色
 * @returns 配置对象
 */
export { getAgentRoleConfig, getAllAgentRoleIds } from './agent-roles-config';

/**
 * Agent 角色类型导出
 */
export type {
  AgentRole,
  AgentRoleConfig,
  ResponseType,
  StandardResponseConfig,
  CustomResponseConfig,
  AgentTaskDescription
} from './agent-roles-config';

/**
 * 执行者身份配置导出
 */
export {
  EXECUTOR_IDENTITIES,
  getExecutorIdentity,
  buildExecutorIdentityText
} from './executor-identity-config';

export type { ExecutorIdentity } from './executor-identity-config';

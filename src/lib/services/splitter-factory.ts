/**
 * 拆分器工厂
 * 
 * 🔥 已修改：统一使用 Agent B 统一拆分器
 * 不再区分 insurance-d、insurance-c 等 executor，所有任务都由 Agent B 统一拆分
 */

import { BaseSplitter } from './splitters/base-splitter';
import { AgentBUnifiedSplitter } from './splitters/agent-b-unified-splitter';

/**
 * 拆分器注册表
 * 🔥 已修改：只保留 Agent B 统一拆分器
 */
const splitterRegistry: Record<string, new () => BaseSplitter> = {
  'B': AgentBUnifiedSplitter,
  'insurance-d': AgentBUnifiedSplitter, // 🔥 兼容旧代码，仍然指向统一拆分器
  'insurance-xiaohongshu': AgentBUnifiedSplitter, // 🔥 小红书创作 Agent，同样使用统一拆分器
  'insurance-c': AgentBUnifiedSplitter, // 🔥 兼容旧代码，仍然指向统一拆分器
  'insurance-a': AgentBUnifiedSplitter, // 🔥 兼容旧代码，仍然指向统一拆分器
};

/**
 * 根据 Agent ID 获取拆分器
 * 🔥 已修改：无论传入什么 agentId，都返回 Agent B 统一拆分器
 * @param agentId Agent ID（兼容性参数，实际不使用）
 * @returns 拆分器实例
 */
export function getSplitter(agentId?: string): BaseSplitter {
  // 🔥 无论传入什么 agentId，都返回 Agent B 统一拆分器
  console.log(`🔄 [splitter-factory] 统一使用 Agent B 统一拆分器（忽略 agentId: ${agentId}）`);
  return new AgentBUnifiedSplitter();
}

/**
 * 获取所有已注册的拆分器
 * 🔥 已修改：只返回 Agent B 统一拆分器
 * @returns 拆分器实例数组
 */
export function getAllSplitters(): BaseSplitter[] {
  console.log(`🔍 获取所有已注册的拆分器...`);
  console.log(`📋 已注册的 Agent（统一使用 Agent B）`);
  
  return [new AgentBUnifiedSplitter()];
}

/**
 * 注册新的拆分器
 * 🔥 已修改：不再使用，保留兼容性
 * @param agentId Agent ID
 * @param splitterClass 拆分器类
 */
export function registerSplitter(agentId: string, splitterClass: new () => BaseSplitter): void {
  console.log(`⚠️ [splitter-factory] registerSplitter 已禁用（统一使用 Agent B 拆分器）`);
  // 🔥 不再注册新的拆分器，统一使用 Agent B
}

/**
 * 获取所有已注册的 Agent ID
 * 🔥 已修改：只返回 Agent B
 * @returns Agent ID 数组
 */
export function getRegisteredAgentIds(): string[] {
  return ['B'];
}

/**
 * 兼容性说明：
 * - 旧代码调用 getSplitter('insurance-d') 或 getSplitter('insurance-c') 仍然可以正常工作
 * - 但实际上都会返回 Agent B 统一拆分器
 * - 这样可以平滑过渡，不需要修改所有调用方
 */

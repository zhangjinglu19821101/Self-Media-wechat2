/**
 * Agent 管理器全局实例初始化
 */

import { AgentManager } from './agent-manager';

let agentManagerInstance: AgentManager | null = null;

/**
 * 获取 Agent 管理器全局实例
 */
export function getAgentManager(): AgentManager {
  if (!agentManagerInstance) {
    agentManagerInstance = new AgentManager({
      maxRetries: 3,
      retryDelay: 5000,
      strategy: 'auto_restart' as any,
      autoHealEnabled: true,
      healthCheckInterval: 30000,
      gracefulShutdownTimeout: 10000,
    });
  }

  return agentManagerInstance;
}

/**
 * 编排引擎全局实例初始化
 * 在应用启动时初始化全局的单例实例
 * 
 * ⚠️ BYOK 说明：编排引擎当前使用平台 Key。
 * 如需按 workspace 隔离，需重构为工厂模式（Phase 2）。
 */

import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { getPlatformLLM } from '@/lib/llm/factory';
import { OrchestrationEngine } from './index';

let orchestrationEngineInstance: OrchestrationEngine | null = null;

/**
 * 获取编排引擎全局实例
 */
export function getOrchestrationEngine(): OrchestrationEngine {
  if (!orchestrationEngineInstance) {
    const llm = getPlatformLLM();

    orchestrationEngineInstance = new OrchestrationEngine(llm, {
      messageTimeout: 30000,
      messageMaxRetries: 3,
      schedulingStrategy: 'priority' as any,
      taskTimeout: 60000,
      taskMaxRetries: 3,
      maxConcurrentTasks: 10,
      workflowTimeout: 300000,
      enableWorkflowRecovery: true,
      conversationTimeout: 1800000,
      maxConversationHistory: 100,
      enableDecisionLogging: true,
      decisionConfidenceThreshold: 0.7,
    });
  }

  return orchestrationEngineInstance;
}

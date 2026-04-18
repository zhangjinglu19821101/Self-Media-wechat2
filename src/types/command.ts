/**
 * Agent 和指令相关的类型定义
 */

export type AgentType = 'A' | 'B' | 'C' | 'D' | 'insurance-c' | 'insurance-d';

/**
 * 指令
 */
export interface Command {
  id: string;
  agentId: AgentType;
  agentName: string;
  content: string;
  createdAt: Date;
  status: 'pending' | 'sent' | 'completed' | 'failed';
}

/**
 * 工作流程触发器
 * 解析对话中的工作流程触发指令
 */

import { workflowEngine } from './workflow-engine';
import { WorkflowTriggerRequest, WorkflowStage } from './workflow-types';
import { AgentId, TaskPriority } from './agent-types';

/**
 * 触发指令模式
 */
interface TriggerPattern {
  regex: RegExp;
  priority: number;
  action: (match: RegExpMatchArray, agentId: AgentId) => Promise<void>;
}

/**
 * 触发指令解析器
 */
export class WorkflowTriggerParser {
  private patterns: TriggerPattern[] = [];

  constructor() {
    this.initializePatterns();
  }

  /**
   * 初始化触发指令模式
   */
  private initializePatterns(): void {
    // 模式1: "触发工作流程：[标题] - [描述]"
    this.patterns.push({
      regex: /触发工作流程[：:]\s*(.+?)\s*[-–]\s*(.+?)(?:\s|$)/,
      priority: 100,
      action: async (match, agentId) => {
        await workflowEngine.triggerWorkflow({
          title: match[1].trim(),
          description: match[2].trim(),
          initiator: agentId,
          priority: TaskPriority.HIGH,
          tags: ['手动触发'],
        });
      },
    });

    // 模式2: "启动战略计划：[标题]"
    this.patterns.push({
      regex: /启动战略计划[：:]\s*(.+?)(?:\s|$)/,
      priority: 90,
      action: async (match, agentId) => {
        await workflowEngine.triggerWorkflow({
          title: match[1].trim(),
          description: `战略计划：${match[1].trim()}`,
          initiator: agentId,
          priority: TaskPriority.URGENT,
          tags: ['战略', '计划'],
        });
      },
    });

    // 模式3: "向 [Agent ID] 下达任务：[任务描述]"
    this.patterns.push({
      regex: /向\s*([A-D])\s*下达任务[：:]\s*(.+?)(?:\s|$)/,
      priority: 80,
      action: async (match, agentId) => {
        const targetAgent = match[1] as AgentId;
        const task = match[2].trim();

        await workflowEngine.triggerWorkflow({
          title: `任务下达：${targetAgent}`,
          description: `向 Agent ${targetAgent} 下达任务：${task}`,
          initiator: agentId,
          priority: TaskPriority.HIGH,
          tags: ['任务下达', targetAgent],
          initialTasks: [
            {
              agent: targetAgent,
              task: task,
            },
          ],
        });
      },
    });
  }

  /**
   * 解析消息，检查是否包含触发指令
   */
  async parse(message: string, agentId: AgentId): Promise<string | null> {
    let triggeredWorkflow = null;

    // 按优先级匹配模式
    const sortedPatterns = [...this.patterns].sort((a, b) => b.priority - a.priority);

    for (const pattern of sortedPatterns) {
      const match = message.match(pattern.regex);
      if (match) {
        await pattern.action(match, agentId);
        triggeredWorkflow = `已触发工作流程：${match[1].trim()}`;
        break;
      }
    }

    return triggeredWorkflow;
  }

  /**
   * 检查消息是否包含触发指令
   */
  containsTrigger(message: string): boolean {
    return this.patterns.some(pattern => pattern.regex.test(message));
  }

  /**
   * 获取支持的触发指令说明
   */
  getTriggerInstructions(): string[] {
    return [
      '触发工作流程：[标题] - [描述]',
      '启动战略计划：[标题]',
      '向 [A/B/C/D] 下达任务：[任务描述]',
    ];
  }
}

// 单例实例
export const workflowTriggerParser = new WorkflowTriggerParser();

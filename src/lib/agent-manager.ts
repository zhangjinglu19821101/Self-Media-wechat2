/**
 * Agent 管理器
 * 负责管理所有 Agent 的状态、能力和调度
 */

import {
  Agent,
  AgentId,
  AgentStatus,
  Skill,
  ScheduledTask,
  TaskPriority,
  TaskQueueConfig,
  AgentCapability,
} from './agent-types';

export class AgentManager {
  private agents: Map<AgentId, Agent> = new Map();
  private taskQueues: Map<AgentId, TaskQueueConfig> = new Map();
  private scheduledTasks: Map<string, ScheduledTask> = new Map();

  constructor() {
    this.initializeAgents();
  }

  /**
   * 初始化所有 Agent
   */
  private initializeAgents(): void {
    // Agent A - 核心协调者
    this.createAgent({
      id: 'A',
      name: '核心战略决策者',
      role: 'Strategic Decision Maker',
      description: 'AI事业部、保险事业部最高战略决策者、唯一总枢纽，统筹两大事业部所有Agent',
      status: AgentStatus.IDLE,
      skills: [
        {
          id: 'task-decomposition',
          name: '任务分解',
          level: 90,
          description: '将复杂需求分解为具体任务',
          experience: 0,
          maxExperience: 100,
        },
        {
          id: 'coordination',
          name: '协调能力',
          level: 85,
          description: '协调多个 Agent 协同工作',
          experience: 0,
          maxExperience: 100,
        },
        {
          id: 'decision-making',
          name: '决策能力',
          level: 88,
          description: '快速做出决策',
          experience: 0,
          maxExperience: 100,
        },
      ],
      maxConcurrentTasks: 5,
      currentTasks: 0,
      scheduledTasks: [],
      // A 是中心，可以发送给所有 Agent
      canSendTo: ['B', 'C', 'D', 'insurance-c', 'insurance-d'],
      // A 接收来自所有 Agent 的反馈
      canReceiveFrom: ['B', 'C', 'D', 'insurance-c', 'insurance-d'],
      createdAt: new Date(),
      lastActiveAt: new Date(),
    });

    // Agent B - 技术执行者
    this.createAgent({
      id: 'B',
      name: '技术执行者',
      role: 'Technical Executor',
      description: '执行技术类任务，支持编程、系统维护等',
      status: AgentStatus.IDLE,
      skills: [
        {
          id: 'programming',
          name: '编程开发',
          level: 85,
          description: '编写高质量代码',
          experience: 0,
          maxExperience: 100,
        },
        {
          id: 'debugging',
          name: '调试能力',
          level: 80,
          description: '快速定位和修复问题',
          experience: 0,
          maxExperience: 100,
        },
        {
          id: 'optimization',
          name: '性能优化',
          level: 75,
          description: '优化系统性能',
          experience: 0,
          maxExperience: 100,
        },
      ],
      maxConcurrentTasks: 3,
      currentTasks: 0,
      scheduledTasks: [],
      // B 可以发送给 A（汇报进度）
      canSendTo: ['A'],
      // B 可以接收来自 A、C、D 的任务
      canReceiveFrom: ['A', 'C', 'D'],
      createdAt: new Date(),
      lastActiveAt: new Date(),
    });

    // Agent C - 运营执行者
    this.createAgent({
      id: 'C',
      name: '运营执行者',
      role: 'Operations Executor',
      description: '执行运营类任务，数据分析和报告',
      status: AgentStatus.IDLE,
      skills: [
        {
          id: 'data-analysis',
          name: '数据分析',
          level: 88,
          description: '收集和分析运营数据',
          experience: 0,
          maxExperience: 100,
        },
        {
          id: 'reporting',
          name: '报告生成',
          level: 85,
          description: '生成专业的运营报告',
          experience: 0,
          maxExperience: 100,
        },
      ],
      maxConcurrentTasks: 3,
      currentTasks: 0,
      scheduledTasks: [],
      // C 可以发送给 A（汇报）、B（技术需求）
      canSendTo: ['A', 'B'],
      // C 接收来自 A 的任务
      canReceiveFrom: ['A'],
      createdAt: new Date(),
      lastActiveAt: new Date(),
    });

    // Agent D - 内容执行者
    this.createAgent({
      id: 'D',
      name: '内容执行者',
      role: 'Content Executor',
      description: '执行内容类任务，创作高质量内容',
      status: AgentStatus.IDLE,
      skills: [
        {
          id: 'content-creation',
          name: '内容创作',
          level: 90,
          description: '创作高质量内容',
          experience: 0,
          maxExperience: 100,
        },
        {
          id: 'seo-optimization',
          name: 'SEO 优化',
          level: 82,
          description: '优化内容搜索引擎排名',
          experience: 0,
          maxExperience: 100,
        },
      ],
      maxConcurrentTasks: 3,
      currentTasks: 0,
      scheduledTasks: [],
      // D 可以发送给 A（汇报）、B（技术需求）
      canSendTo: ['A', 'B'],
      // D 接收来自 A 的任务
      canReceiveFrom: ['A'],
      createdAt: new Date(),
      lastActiveAt: new Date(),
    });

    // Agent insurance-c - 保险运营执行者
    this.createAgent({
      id: 'insurance-c',
      name: 'C - 保险运营',
      role: 'Insurance Operations Executor',
      description: '保险赛道专属运营执行者，聚焦公众号通俗化科普运营',
      status: AgentStatus.IDLE,
      skills: [
        {
          id: 'insurance-strategy',
          name: '保险运营策略',
          level: 90,
          description: '制定保险赛道公众号运营策略',
          experience: 0,
          maxExperience: 100,
        },
        {
          id: 'content-creation',
          name: '内容创作',
          level: 88,
          description: '创作通俗易懂的保险科普内容',
          experience: 0,
          maxExperience: 100,
        },
        {
          id: 'data-analysis',
          name: '数据分析',
          level: 85,
          description: '分析保险用户数据，优化运营策略',
          experience: 0,
          maxExperience: 100,
        },
        {
          id: 'compliance',
          name: '合规运营',
          level: 92,
          description: '确保运营动作符合保险合规要求',
          experience: 0,
          maxExperience: 100,
        },
      ],
      maxConcurrentTasks: 4,
      currentTasks: 0,
      scheduledTasks: [],
      // insurance-c 仅向A单向闭环
      canSendTo: ['A'],
      // insurance-c 仅接收A的指令
      canReceiveFrom: ['A'],
      createdAt: new Date(),
      lastActiveAt: new Date(),
    });

    // Agent insurance-d - 保险内容执行者
    this.createAgent({
      id: 'insurance-d',
      name: 'D - 保险内容',
      role: 'Insurance Content Executor',
      description: '保险赛道专属内容执行者，聚焦通俗化内容创作与合规校验',
      status: AgentStatus.IDLE,
      skills: [
        {
          id: 'insurance-content-creation',
          name: '保险内容创作',
          level: 92,
          description: '创作通俗易懂的保险科普内容',
          experience: 0,
          maxExperience: 100,
        },
        {
          id: 'insurance-topic-selection',
          name: '保险选题',
          level: 88,
          description: '选择大众关心的保险入门、配置技巧等话题',
          experience: 0,
          maxExperience: 100,
        },
        {
          id: 'compliance-check',
          name: '合规校验',
          level: 95,
          description: '进行保险合规二次校验，杜绝违规表述',
          experience: 0,
          maxExperience: 100,
        },
        {
          id: 'content-optimization',
          name: '内容优化',
          level: 87,
          description: '优化内容质量，贴合公众号科普定位',
          experience: 0,
          maxExperience: 100,
        },
      ],
      maxConcurrentTasks: 4,
      currentTasks: 0,
      scheduledTasks: [],
      // insurance-d 仅向A单向闭环
      canSendTo: ['A'],
      // insurance-d 仅接收A的指令
      canReceiveFrom: ['A'],
      createdAt: new Date(),
      lastActiveAt: new Date(),
    });

    // 初始化任务队列
    this.initializeTaskQueues();
  }

  /**
   * 创建 Agent
   */
  private createAgent(agent: Agent): void {
    this.agents.set(agent.id, agent);
  }

  /**
   * 初始化任务队列
   */
  private initializeTaskQueues(): void {
    this.agents.forEach((agent) => {
      this.taskQueues.set(agent.id, {
        agentId: agent.id,
        maxConcurrent: agent.maxConcurrentTasks,
        currentRunning: 0,
        waitingQueue: [],
      });
    });
  }

  /**
   * 获取所有 Agent
   */
  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  /**
   * 获取指定 Agent
   */
  getAgent(agentId: AgentId): Agent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * 更新 Agent 状态
   */
  updateAgentStatus(agentId: AgentId, status: AgentStatus): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = status;
      agent.lastActiveAt = new Date();
    }
  }

  /**
   * 更新 Agent 技能经验值
   */
  updateAgentSkillExperience(agentId: AgentId, skillId: string, experience: number): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      const skill = agent.skills.find((s) => s.id === skillId);
      if (skill) {
        skill.experience += experience;

        // 检查是否升级
        if (skill.experience >= skill.maxExperience) {
          skill.level = Math.min(100, skill.level + 5);
          skill.experience = skill.experience - skill.maxExperience;
          skill.maxExperience = Math.floor(skill.maxExperience * 1.5);
        }
      }
    }
  }

  /**
   * 添加定时任务
   */
  addScheduledTask(task: ScheduledTask): void {
    this.scheduledTasks.set(task.id, task);

    // 添加到对应的 Agent
    const agent = this.agents.get(task.agentId);
    if (agent) {
      agent.scheduledTasks.push(task);
    }
  }

  /**
   * 获取 Agent 的定时任务
   */
  getScheduledTasks(agentId: AgentId): ScheduledTask[] {
    const agent = this.agents.get(agentId);
    return agent?.scheduledTasks || [];
  }

  /**
   * 检查 Agent 是否可以接收来自某个 Agent 的消息
   */
  canReceiveMessage(from: AgentId, to: AgentId): boolean {
    const targetAgent = this.agents.get(to);
    if (!targetAgent) {
      return false;
    }
    return targetAgent.canReceiveFrom.includes(from);
  }

  /**
   * 检查 Agent 是否可以发送消息给某个 Agent
   */
  canSendMessage(from: AgentId, to: AgentId): boolean {
    const sourceAgent = this.agents.get(from);
    if (!sourceAgent) {
      return false;
    }
    return sourceAgent.canSendTo.includes(to);
  }

  /**
   * 检查 Agent 是否有可用并发槽位
   */
  hasAvailableSlot(agentId: AgentId): boolean {
    const queue = this.taskQueues.get(agentId);
    if (!queue) {
      return false;
    }
    return queue.currentRunning < queue.maxConcurrent;
  }

  /**
   * 获取任务队列
   */
  getTaskQueue(agentId: AgentId): TaskQueueConfig | undefined {
    return this.taskQueues.get(agentId);
  }

  /**
   * 评估 Agent 能力
   */
  evaluateAgentCapability(agentId: AgentId): AgentCapability {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // 计算技能得分
    const skillScores: { [skillId: string]: number } = {};
    agent.skills.forEach((skill) => {
      skillScores[skill.id] = skill.level;
    });

    // 计算总分
    const totalScore =
      Object.values(skillScores).reduce((sum, score) => sum + score, 0) /
      agent.skills.length;

    // TODO: 添加实际的历史性能数据
    const recentPerformance = {
      tasksCompleted: 0,
      averageTime: 0,
      successRate: 1,
    };

    return {
      agentId,
      totalScore,
      skillScores,
      recentPerformance,
      recommendations: this.generateRecommendations(agent),
    };
  }

  /**
   * 生成建议
   */
  private generateRecommendations(agent: Agent): string[] {
    const recommendations: string[] = [];

    // 检查低级技能
    agent.skills.forEach((skill) => {
      if (skill.level < 60) {
        recommendations.push(
          `建议提升 ${skill.name} 技能，当前级别 ${skill.level}`
        );
      }
    });

    // 检查负载
    const queue = this.taskQueues.get(agent.id);
    if (queue && queue.currentRunning >= queue.maxConcurrent) {
      recommendations.push('Agent 负载过高，建议增加并发限制或优化任务分配');
    }

    if (recommendations.length === 0) {
      recommendations.push('Agent 状态良好，无需特殊建议');
    }

    return recommendations;
  }

  /**
   * 获取系统统计信息
   */
  getSystemStats() {
    const totalAgents = this.agents.size;
    const activeAgents = Array.from(this.agents.values()).filter(
      (a) => a.status === AgentStatus.BUSY
    ).length;

    return {
      totalAgents,
      activeAgents,
    };
  }
}

// 导出单例
export const agentManager = new AgentManager();

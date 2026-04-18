/**
 * 拆解引擎
 * 负责任务拆解的核心逻辑执行
 */

import {
  Task,
  SubTask,
  DecompositionResult,
  Rule,
  RuleScope,
  RuleCategory,
  RuleStatus,
  AgentId,
  EngineStatus,
} from './rule-types';
import { ruleManager } from './rule-manager';

/**
 * 拆解引擎
 */
export class DecompositionEngine {
  private status: 'running' | 'stopped' | 'error' = 'stopped';
  private startTime: number = 0;
  private lastReloadAt: number = 0;
  private loadedRules: Map<string, Rule> = new Map();
  private errorMessage?: string;

  /**
   * 启动引擎
   */
  start(): { success: boolean; error?: string } {
    try {
      if (this.status === 'running') {
        return {
          success: true,
        };
      }

      this.status = 'running';
      this.startTime = Date.now();
      this.errorMessage = undefined;

      // 加载已发布的规则
      this.reloadRules();

      return {
        success: true,
      };
    } catch (error) {
      this.status = 'error';
      this.errorMessage = error instanceof Error ? error.message : '未知错误';
      return {
        success: false,
        error: this.errorMessage,
      };
    }
  }

  /**
   * 停止引擎
   */
  stop(): { success: boolean; error?: string } {
    try {
      if (this.status === 'stopped') {
        return {
          success: true,
        };
      }

      this.status = 'stopped';
      this.startTime = 0;

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 获取引擎状态
   */
  getEngineStatus(): EngineStatus {
    return {
      status: this.status,
      loadedRuleCount: this.loadedRules.size,
      lastReloadAt: this.lastReloadAt > 0 ? new Date(this.lastReloadAt) : undefined,
      uptime: this.status === 'running' ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
      errorMessage: this.errorMessage,
    };
  }

  /**
   * 加载规则
   */
  loadRules(ruleLibraryId?: string): { success: boolean; loadedCount?: number; error?: string } {
    try {
      const filters: any = { status: RuleStatus.PUBLISHED };

      // 如果指定了规则库，根据规则库类型加载
      if (ruleLibraryId) {
        const library = ruleManager.getRuleLibrary(ruleLibraryId);
        if (!library) {
          return {
            success: false,
            error: '规则库不存在',
          };
        }

        // 根据规则库类型过滤
        if (library.type === RuleScope.AI) {
          filters.scope = RuleScope.AI;
        } else if (library.type === RuleScope.INSURANCE) {
          filters.scope = RuleScope.INSURANCE;
        } else {
          filters.scope = RuleScope.UNIVERSAL;
        }
      }

      const rules = ruleManager.queryRules(filters);

      // 加载规则到内存
      this.loadedRules.clear();
      for (const rule of rules) {
        this.loadedRules.set(rule.id, rule);
      }

      this.lastReloadAt = Date.now();

      return {
        success: true,
        loadedCount: rules.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 热加载规则（不重启引擎）
   */
  reloadRules(): { success: boolean; loadedCount?: number; error?: string } {
    return this.loadRules();
  }

  /**
   * 执行任务拆解
   */
  decompose(task: Task, inputRuleId?: string): DecompositionResult {
    try {
      if (this.status !== 'running') {
        throw new Error('引擎未运行');
      }

      let rule: Rule | null = null;
      let warnings: string[] = [];

      // 如果指定了规则ID，使用指定的规则
      if (inputRuleId) {
        rule = this.loadedRules.get(inputRuleId) || null;
        if (!rule) {
          warnings.push(`指定的规则 ${inputRuleId} 未找到，尝试自动匹配规则`);
        }
      }

      // 如果没有指定规则或规则未找到，自动匹配规则
      if (!rule) {
        rule = this.matchRule(task);
        if (!rule) {
          warnings.push('未找到匹配的规则，使用默认拆解逻辑');
        }
      }

      // 执行拆解
      let subTasks: SubTask[];

      if (rule) {
        subTasks = this.decomposeWithRule(task, rule);
      } else {
        // 默认拆解逻辑
        subTasks = this.defaultDecompose(task);
      }

      // 计算总预计耗时
      const totalEstimatedDuration = subTasks.reduce(
        (sum, subTask) => sum + subTask.estimatedDuration,
        0
      );

      // 生成拆解结果
      const result: DecompositionResult = {
        taskId: task.id,
        ruleId: rule?.id,
        subTasks,
        totalEstimatedDuration,
        decomposedBy: 'B' as AgentId, // 由Agent B执行拆解
        decomposedAt: new Date(),
        confidence: rule ? 90 : 60, // 使用规则时置信度高
        warnings: warnings.length > 0 ? warnings : undefined,
      };

      // 记录规则使用
      if (rule) {
        ruleManager.recordRuleUsage(rule.id, true);
      }

      return result;
    } catch (error) {
      // 记录规则使用失败
      if (inputRuleId) {
        ruleManager.recordRuleUsage(inputRuleId, false);
      }

      throw error;
    }
  }

  /**
   * 匹配规则
   */
  private matchRule(task: Task): Rule | null {
    const rules = Array.from(this.loadedRules.values());

    // 根据任务类型和目标赛道匹配规则
    let matchedRules = rules.filter((rule) => {
      // 检查适用范围
      const scopeMatch =
        rule.scope === RuleScope.UNIVERSAL || rule.scope === task.targetScope;

      // 检查任务类型
      let categoryMatch = true;
      if (task.type === 'content') {
        categoryMatch = rule.category === RuleCategory.CONTENT;
      } else if (task.type === 'operation') {
        categoryMatch = rule.category === RuleCategory.OPERATION;
      }

      return scopeMatch && categoryMatch;
    });

    // 按使用率和成功率排序
    matchedRules.sort((a, b) => {
      const scoreA = a.usageCount * (a.successRate / 100);
      const scoreB = b.usageCount * (b.successRate / 100);
      return scoreB - scoreA;
    });

    return matchedRules.length > 0 ? matchedRules[0] : null;
  }

  /**
   * 使用规则进行拆解
   */
  private decomposeWithRule(task: Task, rule: Rule): SubTask[] {
    const subTasks: SubTask[] = [];

    // 根据规则的拆解动作生成子任务
    rule.decompositionActions.forEach((action, index) => {
      const subTaskId = `subtask_${task.id}_${index + 1}`;

      subTasks.push({
        id: subTaskId,
        parentTaskId: task.id,
        name: action,
        description: `基于规则【${rule.name}】的拆解动作：${action}`,
        executor: this.determineExecutor(task, rule),
        estimatedDuration: this.estimateDuration(action),
        completionCriteria: rule.judgmentCriteria,
        dependencies: index > 0 ? [subTasks[index - 1].id] : [],
        status: 'pending',
        order: index + 1,
      });
    });

    return subTasks;
  }

  /**
   * 默认拆解逻辑
   */
  private defaultDecompose(task: Task): SubTask[] {
    const subTasks: SubTask[] = [];

    if (task.type === 'content') {
      // 内容类任务默认拆解
      subTasks.push({
        id: `subtask_${task.id}_1`,
        parentTaskId: task.id,
        name: '选题分析',
        description: '分析任务目标，确定内容选题方向',
        executor: 'D' as AgentId,
        estimatedDuration: 30,
        completionCriteria: '完成选题分析报告',
        dependencies: [],
        status: 'pending',
        order: 1,
      });

      subTasks.push({
        id: `subtask_${task.id}_2`,
        parentTaskId: task.id,
        name: '内容创作',
        description: '根据选题完成内容创作',
        executor: 'D' as AgentId,
        estimatedDuration: 120,
        completionCriteria: '完成内容初稿',
        dependencies: [subTasks[0].id],
        status: 'pending',
        order: 2,
      });

      subTasks.push({
        id: `subtask_${task.id}_3`,
        parentTaskId: task.id,
        name: '内容审核',
        description: '审核内容的合规性、专业性',
        executor: 'D' as AgentId,
        estimatedDuration: 30,
        completionCriteria: '通过审核并完成修改',
        dependencies: [subTasks[1].id],
        status: 'pending',
        order: 3,
      });
    } else if (task.type === 'operation') {
      // 运营类任务默认拆解
      const executor = task.targetScope === RuleScope.AI ? 'C' : 'insurance-c';

      subTasks.push({
        id: `subtask_${task.id}_1`,
        parentTaskId: task.id,
        name: '任务分析',
        description: '分析运营任务的目标和要求',
        executor: executor as AgentId,
        estimatedDuration: 20,
        completionCriteria: '完成任务分析',
        dependencies: [],
        status: 'pending',
        order: 1,
      });

      subTasks.push({
        id: `subtask_${task.id}_2`,
        parentTaskId: task.id,
        name: '执行运营动作',
        description: '执行具体的运营动作',
        executor: executor as AgentId,
        estimatedDuration: 60,
        completionCriteria: '完成运营动作',
        dependencies: [subTasks[0].id],
        status: 'pending',
        order: 2,
      });

      subTasks.push({
        id: `subtask_${task.id}_3`,
        parentTaskId: task.id,
        name: '数据监测',
        description: '监测运营数据和效果',
        executor: executor as AgentId,
        estimatedDuration: 15,
        completionCriteria: '完成数据监测报告',
        dependencies: [subTasks[1].id],
        status: 'pending',
        order: 3,
      });
    }

    return subTasks;
  }

  /**
   * 确定执行者
   */
  private determineExecutor(task: Task, rule: Rule): AgentId {
    if (rule.category === RuleCategory.CONTENT) {
      // 内容类任务
      if (task.targetScope === RuleScope.AI) {
        return 'D' as AgentId;
      } else if (task.targetScope === RuleScope.INSURANCE) {
        return 'insurance-d' as AgentId;
      }
    } else if (rule.category === RuleCategory.OPERATION) {
      // 运营类任务
      if (task.targetScope === RuleScope.AI) {
        return 'C' as AgentId;
      } else if (task.targetScope === RuleScope.INSURANCE) {
        return 'insurance-c' as AgentId;
      }
    }

    return 'B' as AgentId; // 默认由B执行
  }

  /**
   * 估算耗时
   */
  private estimateDuration(action: string): number {
    // 根据动作关键词估算耗时
    if (action.includes('分析') || action.includes('核查')) {
      return 30;
    } else if (action.includes('创作') || action.includes('生成')) {
      return 120;
    } else if (action.includes('审核') || action.includes('品控')) {
      return 45;
    } else if (action.includes('发布') || action.includes('分发')) {
      return 15;
    } else {
      return 60; // 默认60分钟
    }
  }
}

// 导出单例实例
export const decompositionEngine = new DecompositionEngine();

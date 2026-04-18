/**
 * 工作流程引擎
 * 管理多 Agent 协作的闭环工作流程
 */

import {
  Workflow,
  WorkflowStage,
  WorkflowStatus,
  WorkflowStepExecution,
  WorkflowTriggerRequest,
  WorkflowUpdateRequest,
  WorkflowQuery,
  WorkflowStats,
  WORKFLOW_TEMPLATE,
} from './workflow-types';
import { AgentId, TaskPriority, TaskStatus } from './agent-types';
import { agentActivityMonitor } from './agent-activity-monitor';

/**
 * 工作流程引擎
 */
export class WorkflowEngine {
  private workflows: Map<string, Workflow> = new Map();
  private eventListeners: Map<string, Set<(workflow: Workflow) => void>> = new Map();

  constructor() {
    this.initialize();
  }

  /**
   * 初始化引擎
   */
  private initialize(): void {
    console.log('Workflow Engine initialized');
  }

  /**
   * 触发新的工作流程
   */
  async triggerWorkflow(request: WorkflowTriggerRequest): Promise<Workflow> {
    const workflowId = `wf_${Date.now()}`;

    // 初始化步骤执行状态
    const steps: WorkflowStepExecution[] = WORKFLOW_TEMPLATE.map(step => {
      // 根据 fromAgent/toAgent 确定负责人
      const assignedTo = this.determineStepOwner(step, request.initialTasks);

      return {
        stepId: step.id,
        status: TaskStatus.PENDING,
        assignedTo,
      };
    });

    const workflow: Workflow = {
      id: workflowId,
      title: request.title,
      description: request.description,
      status: WorkflowStatus.RUNNING,
      currentStep: 1,
      steps,
      startedAt: new Date(),
      metadata: {
        initiator: request.initiator,
        priority: request.priority || TaskPriority.MEDIUM,
        tags: request.tags || [],
      },
    };

    this.workflows.set(workflowId, workflow);
    this.emit('workflow:created', workflow);

    // 自动启动第一步
    await this.startStep(workflowId, steps[0].stepId);

    return workflow;
  }

  /**
   * 确定步骤负责人
   */
  private determineStepOwner(step: any, initialTasks?: any[]): AgentId {
    // 如果有初始任务，使用初始任务的 Agent
    if (initialTasks) {
      const task = initialTasks.find(t => step.toAgent?.includes(t.agent));
      if (task) return task.agent;
    }

    // 默认使用步骤定义的第一个接收者
    if (step.toAgent && step.toAgent.length > 0) {
      return step.toAgent[0] as AgentId;
    }

    // 默认返回发起者
    return step.fromAgent || 'A';
  }

  /**
   * 开始工作流程步骤
   */
  async startStep(workflowId: string, stepId: string): Promise<Workflow | null> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return null;

    const stepExecution = workflow.steps.find(s => s.stepId === stepId);
    if (!stepExecution) return null;

    stepExecution.status = TaskStatus.RUNNING;
    stepExecution.startedAt = new Date();

    workflow.currentStep = WORKFLOW_TEMPLATE.findIndex(s => s.id === stepId) + 1;

    this.workflows.set(workflowId, workflow);
    this.emit('step:started', workflow);

    return workflow;
  }

  /**
   * 完成工作流程步骤
   */
  async completeStep(
    workflowId: string,
    request: WorkflowUpdateRequest
  ): Promise<Workflow | null> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return null;

    const stepExecution = workflow.steps.find(s => s.stepId === request.stepId);
    if (!stepExecution) return null;

    stepExecution.status = TaskStatus.COMPLETED;
    stepExecution.completedAt = new Date();
    stepExecution.result = request.result;
    stepExecution.feedback = request.feedback;
    stepExecution.attachments = request.attachments;

    // 检查该步骤是否需要人类确认
    const currentStepIndex = WORKFLOW_TEMPLATE.findIndex(s => s.id === request.stepId);
    const currentStep = WORKFLOW_TEMPLATE[currentStepIndex];

    if (currentStep?.requiresHumanConfirmation && currentStep.confirmationMessage) {
      // 设置 Agent 为等待确认状态
      const assignedAgent = stepExecution.assignedTo;
      agentActivityMonitor.setWaitingConfirmation(
        assignedAgent,
        currentStep.name,
        currentStep.confirmationMessage,
        workflowId,
        request.stepId
      );

      // 不自动启动下一步，等待人类确认
      this.workflows.set(workflowId, workflow);
      this.emit('step:completed', workflow);
      this.emit('step:waiting_confirmation', workflow);

      return workflow;
    }

    // 检查是否所有步骤都完成
    const allCompleted = workflow.steps.every(s => s.status === TaskStatus.COMPLETED);

    if (allCompleted) {
      workflow.status = WorkflowStatus.COMPLETED;
      workflow.completedAt = new Date();
      this.emit('workflow:completed', workflow);
    } else {
      // 自动启动下一步
      const nextStep = WORKFLOW_TEMPLATE[currentStepIndex + 1];

      if (nextStep) {
        await this.startStep(workflowId, nextStep.id);
      }
    }

    this.workflows.set(workflowId, workflow);
    this.emit('step:completed', workflow);

    return workflow;
  }

  /**
   * 更新工作流程步骤（失败/暂停/恢复）
   */
  async updateStep(
    workflowId: string,
    request: WorkflowUpdateRequest
  ): Promise<Workflow | null> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return null;

    const stepExecution = workflow.steps.find(s => s.stepId === request.stepId);
    if (!stepExecution) return null;

    switch (request.action) {
      case 'fail':
        stepExecution.status = TaskStatus.FAILED;
        stepExecution.feedback = request.feedback;
        workflow.status = WorkflowStatus.FAILED;
        break;

      case 'pause':
        stepExecution.status = TaskStatus.PENDING;
        workflow.status = WorkflowStatus.PAUSED;
        break;

      case 'resume':
        stepExecution.status = TaskStatus.RUNNING;
        workflow.status = WorkflowStatus.RUNNING;
        break;
    }

    this.workflows.set(workflowId, workflow);
    this.emit('step:updated', workflow);

    return workflow;
  }

  /**
   * 获取工作流程
   */
  getWorkflow(workflowId: string): Workflow | null {
    return this.workflows.get(workflowId) || null;
  }

  /**
   * 查询工作流程
   */
  queryWorkflows(query: WorkflowQuery): Workflow[] {
    let result = Array.from(this.workflows.values());

    if (query.status) {
      result = result.filter(w => w.status === query.status);
    }

    if (query.initiator) {
      result = result.filter(w => w.metadata?.initiator === query.initiator);
    }

    if (query.startDate) {
      result = result.filter(w => w.startedAt >= query.startDate!);
    }

    if (query.endDate) {
      result = result.filter(w => w.startedAt <= query.endDate!);
    }

    // 按开始时间倒序排序
    result.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

    // 分页
    const offset = query.offset || 0;
    const limit = query.limit || 20;
    return result.slice(offset, offset + limit);
  }

  /**
   * 获取工作流程统计
   */
  getStats(): WorkflowStats {
    const workflows = Array.from(this.workflows.values());

    const byStatus: Record<string, number> = {};
    const byStage: Record<string, number> = {};
    let totalDuration = 0;
    let completedCount = 0;

    for (const wf of workflows) {
      // 按状态统计
      byStatus[wf.status] = (byStatus[wf.status] || 0) + 1;

      // 按当前阶段统计
      const currentStage = WORKFLOW_TEMPLATE[wf.currentStep - 1]?.stage;
      if (currentStage) {
        byStage[currentStage] = (byStage[currentStage] || 0) + 1;
      }

      // 计算平均时长
      if (wf.completedAt) {
        const duration = wf.completedAt.getTime() - wf.startedAt.getTime();
        totalDuration += duration;
        completedCount++;
      }
    }

    return {
      total: workflows.length,
      byStatus,
      byStage,
      averageDuration: completedCount > 0 ? totalDuration / completedCount : 0,
      successRate: completedCount > 0
        ? (byStatus[WorkflowStatus.COMPLETED] || 0) / completedCount
        : 0,
    };
  }

  /**
   * 获取工作流程模板
   */
  getTemplate(): typeof WORKFLOW_TEMPLATE {
    return WORKFLOW_TEMPLATE;
  }

  /**
   * 人类确认步骤，继续工作流程
   */
  async confirmStep(
    workflowId: string,
    stepId: string,
    agentId: AgentId,
    approved: boolean,
    comment?: string
  ): Promise<Workflow | null> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return null;

    // 更新 Agent 活动状态
    if (approved) {
      // 清除等待确认状态
      const activity = agentActivityMonitor.getActivity(agentId);
      if (activity) {
        agentActivityMonitor.updateActivity(agentId, {
          status: 'idle' as any,
          currentTask: undefined,
        });
        agentActivityMonitor.logExecution(
          agentId,
          'confirmation',
          '人类确认',
          `步骤已获得人类确认，继续执行: ${comment || '无评论'}`,
          { stepId, approved, comment }
        );
      }

      // 检查是否所有步骤都完成
      const allCompleted = workflow.steps.every(s => s.status === TaskStatus.COMPLETED);

      if (allCompleted) {
        workflow.status = WorkflowStatus.COMPLETED;
        workflow.completedAt = new Date();
        this.emit('workflow:completed', workflow);
      } else {
        // 自动启动下一步
        const currentStepIndex = WORKFLOW_TEMPLATE.findIndex(s => s.id === stepId);
        const nextStep = WORKFLOW_TEMPLATE[currentStepIndex + 1];

        if (nextStep) {
          await this.startStep(workflowId, nextStep.id);
        }
      }
    } else {
      // 未通过确认，记录拒绝信息
      agentActivityMonitor.logExecution(
        agentId,
        'confirmation',
        '人类拒绝',
        `步骤被拒绝: ${comment || '无评论'}`,
        { stepId, approved, comment }
      );

      // 可以选择暂停工作流程或标记为失败
      // 这里选择暂停
      workflow.status = WorkflowStatus.PAUSED;
    }

    this.workflows.set(workflowId, workflow);
    this.emit('step:confirmed', workflow);

    return workflow;
  }

  /**
   * 获取当前步骤信息
   */
  getCurrentStep(workflowId: string): any | null {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return null;

    const templateStep = WORKFLOW_TEMPLATE[workflow.currentStep - 1];
    const executionStep = workflow.steps[workflow.currentStep - 1];

    return {
      template: templateStep,
      execution: executionStep,
      workflow,
    };
  }

  /**
   * 注册事件监听器
   */
  on(event: string, listener: (workflow: Workflow) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  /**
   * 取消事件监听器
   */
  off(event: string, listener: (workflow: Workflow) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * 触发事件
   */
  private emit(event: string, workflow: Workflow): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(workflow));
    }
  }
}

// 单例实例
export const workflowEngine = new WorkflowEngine();

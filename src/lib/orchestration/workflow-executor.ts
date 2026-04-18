/**
 * 工作流执行引擎
 * 负责解析和执行工作流定义，管理工作流实例
 */

import { EventEmitter } from 'events';
import { TaskScheduler } from './task-scheduler';
import {
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowStatus,
  WorkflowNode,
  WorkflowEdge,
  NodeType,
} from './types';

export class WorkflowExecutor extends EventEmitter {
  private definitions: Map<string, WorkflowDefinition> = new Map();
  private instances: Map<string, WorkflowInstance> = new Map();
  private taskScheduler: TaskScheduler;
  private runningWorkflows: Set<string> = new Set();
  private nextInstanceId: number = 1;

  constructor(taskScheduler: TaskScheduler) {
    super();
    this.taskScheduler = taskScheduler;

    // 监听任务完成事件
    this.taskScheduler.on('taskCompleted', (task) => {
      this.handleTaskCompleted(task);
    });

    this.taskScheduler.on('taskFailed', (task) => {
      this.handleTaskFailed(task);
    });
  }

  /**
   * 注册工作流定义
   */
  registerDefinition(definition: WorkflowDefinition): void {
    // 验证工作流定义
    this.validateDefinition(definition);

    this.definitions.set(definition.id, definition);
    this.emit('definitionRegistered', definition);
  }

  /**
   * 注销工作流定义
   */
  unregisterDefinition(definitionId: string): boolean {
    const result = this.definitions.delete(definitionId);
    if (result) {
      this.emit('definitionUnregistered', definitionId);
    }
    return result;
  }

  /**
   * 获取工作流定义
   */
  getDefinition(definitionId: string): WorkflowDefinition | undefined {
    return this.definitions.get(definitionId);
  }

  /**
   * 获取所有工作流定义
   */
  getAllDefinitions(): WorkflowDefinition[] {
    return Array.from(this.definitions.values());
  }

  /**
   * 创建工作流实例
   */
  createInstance(definitionId: string, initialVariables?: Record<string, any>): WorkflowInstance {
    const definition = this.definitions.get(definitionId);
    if (!definition) {
      throw new Error(`Workflow definition not found: ${definitionId}`);
    }

    const instance: WorkflowInstance = {
      id: this.generateInstanceId(),
      definitionId,
      status: WorkflowStatus.ACTIVE,
      currentNodes: this.findStartNodes(definition),
      variables: { ...definition.variables, ...initialVariables },
      tasks: [],
      messages: [],
      startedAt: Date.now(),
      metadata: {},
    };

    this.instances.set(instance.id, instance);
    this.emit('instanceCreated', instance);

    return instance;
  }

  /**
   * 启动工作流实例
   */
  async startInstance(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Workflow instance not found: ${instanceId}`);
    }

    if (this.runningWorkflows.has(instanceId)) {
      throw new Error(`Workflow instance is already running: ${instanceId}`);
    }

    this.runningWorkflows.add(instanceId);
    instance.status = WorkflowStatus.RUNNING;
    this.emit('instanceStarted', instance);

    // 执行当前节点
    await this.executeCurrentNodes(instance);
  }

  /**
   * 暂停工作流实例
   */
  pauseInstance(instanceId: string): void {
    const instance = this.instances.get(instanceId);
    if (instance && this.runningWorkflows.has(instanceId)) {
      instance.status = WorkflowStatus.PAUSED;
      this.runningWorkflows.delete(instanceId);
      this.emit('instancePaused', instance);
    }
  }

  /**
   * 恢复工作流实例
   */
  async resumeInstance(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (instance && instance.status === WorkflowStatus.PAUSED) {
      await this.startInstance(instanceId);
    }
  }

  /**
   * 取消工作流实例
   */
  cancelInstance(instanceId: string): void {
    const instance = this.instances.get(instanceId);
    if (instance) {
      instance.status = WorkflowStatus.CANCELLED;
      this.runningWorkflows.delete(instanceId);

      // 取消所有关联的任务
      instance.tasks.forEach(taskId => {
        this.taskScheduler.cancelTask(taskId);
      });

      this.emit('instanceCancelled', instance);
    }
  }

  /**
   * 获取工作流实例
   */
  getInstance(instanceId: string): WorkflowInstance | undefined {
    return this.instances.get(instanceId);
  }

  /**
   * 获取所有工作流实例
   */
  getAllInstances(): WorkflowInstance[] {
    return Array.from(this.instances.values());
  }

  /**
   * 验证工作流定义
   */
  private validateDefinition(definition: WorkflowDefinition): void {
    // 检查是否有开始节点
    const startNodes = definition.nodes.filter(n => n.type === NodeType.START);
    if (startNodes.length === 0) {
      throw new Error('Workflow must have at least one START node');
    }

    // 检查是否有结束节点
    const endNodes = definition.nodes.filter(n => n.type === NodeType.END);
    if (endNodes.length === 0) {
      throw new Error('Workflow must have at least one END node');
    }

    // 检查节点 ID 唯一性
    const nodeIds = new Set(definition.nodes.map(n => n.id));
    if (nodeIds.size !== definition.nodes.length) {
      throw new Error('Workflow nodes must have unique IDs');
    }

    // 检查边引用的节点是否存在
    definition.edges.forEach(edge => {
      if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
        throw new Error(`Invalid edge: node not found - ${edge.from} -> ${edge.to}`);
      }
    });
  }

  /**
   * 查找开始节点
   */
  private findStartNodes(definition: WorkflowDefinition): string[] {
    return definition.nodes
      .filter(n => n.type === NodeType.START)
      .map(n => n.id);
  }

  /**
   * 查找结束节点
   */
  private findEndNodes(definition: WorkflowDefinition): string[] {
    return definition.nodes
      .filter(n => n.type === NodeType.END)
      .map(n => n.id);
  }

  /**
   * 执行当前节点
   */
  private async executeCurrentNodes(instance: WorkflowInstance): Promise<void> {
    const definition = this.definitions.get(instance.definitionId);
    if (!definition) {
      return;
    }

    const tasksToExecute: string[] = [];

    for (const nodeId of instance.currentNodes) {
      const node = definition.nodes.find(n => n.id === nodeId);
      if (!node) {
        continue;
      }

      try {
        const task = await this.executeNode(node, instance);
        if (task) {
          tasksToExecute.push(task.id);
          instance.tasks.push(task.id);
        }
      } catch (error) {
        this.handleNodeError(instance, nodeId, error as Error);
      }
    }

    // 更新当前节点
    instance.currentNodes = tasksToExecute;
  }

  /**
   * 执行单个节点
   */
  private async executeNode(node: WorkflowNode, instance: WorkflowInstance): Promise<any> {
    switch (node.type) {
      case NodeType.START:
        return this.executeStartNode(node, instance);

      case NodeType.AGENT:
        return this.executeAgentNode(node, instance);

      case NodeType.CONDITION:
        return this.executeConditionNode(node, instance);

      case NodeType.PARALLEL:
        return this.executeParallelNode(node, instance);

      case NodeType.MERGE:
        return this.executeMergeNode(node, instance);

      case NodeType.END:
        return this.executeEndNode(node, instance);

      case NodeType.DELAY:
        return this.executeDelayNode(node, instance);

      case NodeType.HUMAN:
        return this.executeHumanNode(node, instance);

      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }
  }

  /**
   * 执行开始节点
   */
  private async executeStartNode(node: WorkflowNode, instance: WorkflowInstance): Promise<void> {
    this.emit('nodeExecuted', instance.id, node.id, instance.variables);

    // 移动到下一个节点
    const nextNodes = this.getNextNodeIds(node.id);
    instance.currentNodes = nextNodes;
  }

  /**
   * 执行 Agent 节点
   */
  private async executeAgentNode(node: WorkflowNode, instance: WorkflowInstance): Promise<any> {
    if (!node.agentId) {
      throw new Error('Agent node must have agentId');
    }

    const task = this.taskScheduler.submitTask({
      workflowId: instance.id,
      agentId: node.agentId!,
      taskType: 'workflow_task',
      title: node.name,
      description: node.description || '',
      payload: {
        ...instance.variables,
        nodeMetadata: node.metadata,
      },
      priority: node.metadata?.priority || 2,
      timeout: node.timeout,
      maxRetries: node.retryCount,
    });

    this.emit('nodeExecuted', instance.id, node.id, { taskId: task.id });
    return task;
  }

  /**
   * 执行条件节点
   */
  private async executeConditionNode(node: WorkflowNode, instance: WorkflowInstance): Promise<void> {
    if (!node.condition) {
      throw new Error('Condition node must have condition function');
    }

    const result = node.condition(instance.variables);

    if (result) {
      const nextNodes = this.getNextNodeIds(node.id);
      instance.currentNodes = nextNodes;
    }

    this.emit('nodeExecuted', instance.id, node.id, { conditionResult: result });
  }

  /**
   * 执行并行节点
   */
  private async executeParallelNode(node: WorkflowNode, instance: WorkflowInstance): Promise<void> {
    const nextNodes = this.getNextNodeIds(node.id);
    instance.currentNodes = nextNodes;

    this.emit('nodeExecuted', instance.id, node.id, { parallelNodes: nextNodes });
  }

  /**
   * 执行合并节点
   */
  private async executeMergeNode(node: WorkflowNode, instance: WorkflowInstance): Promise<void> {
    // 等待所有前置任务完成
    const allTasksCompleted = instance.tasks.every(taskId => {
      const task = this.taskScheduler.getTask(taskId);
      return task && (task.status === 'completed' || task.status === 'failed');
    });

    if (allTasksCompleted) {
      const nextNodes = this.getNextNodeIds(node.id);
      instance.currentNodes = nextNodes;
    }

    this.emit('nodeExecuted', instance.id, node.id, { merged: allTasksCompleted });
  }

  /**
   * 执行结束节点
   */
  private async executeEndNode(node: WorkflowNode, instance: WorkflowInstance): Promise<void> {
    instance.status = WorkflowStatus.COMPLETED;
    instance.completedAt = Date.now();
    this.runningWorkflows.delete(instance.id);
    this.emit('nodeExecuted', instance.id, node.id, instance.variables);
    this.emit('instanceCompleted', instance);
  }

  /**
   * 执行延迟节点
   */
  private async executeDelayNode(node: WorkflowNode, instance: WorkflowInstance): Promise<void> {
    const delay = node.delay || 1000;
    await new Promise(resolve => setTimeout(resolve, delay));

    const nextNodes = this.getNextNodeIds(node.id);
    instance.currentNodes = nextNodes;

    this.emit('nodeExecuted', instance.id, node.id, { delay });
  }

  /**
   * 执行人工节点
   */
  private async executeHumanNode(node: WorkflowNode, instance: WorkflowInstance): Promise<void> {
    instance.status = WorkflowStatus.PAUSED;
    this.runningWorkflows.delete(instance.id);

    this.emit('nodeExecuted', instance.id, node.id, {
      requiresHumanIntervention: true,
    });
  }

  /**
   * 获取下一个节点 ID
   */
  private getNextNodeIds(nodeId: string): string[] {
    const instances = Array.from(this.instances.values());
    let currentInstance: WorkflowInstance | null = null;

    for (const instance of instances) {
      if (instance.currentNodes.includes(nodeId)) {
        currentInstance = instance;
        break;
      }
    }

    if (!currentInstance) {
      return [];
    }

    const definition = this.definitions.get(currentInstance.definitionId);
    if (!definition) {
      return [];
    }

    const edges = definition.edges.filter(e => e.from === nodeId);
    return edges.map(e => e.to);
  }

  /**
   * 处理任务完成
   */
  private handleTaskCompleted(task: any): void {
    // 查找关联的工作流实例
    for (const instance of this.instances.values()) {
      if (instance.tasks.includes(task.id)) {
        // 更新实例变量
        if (task.result) {
          instance.variables = { ...instance.variables, ...task.result };
        }

        // 检查是否所有任务都完成了
        const allCompleted = instance.tasks.every(taskId => {
          const t = this.taskScheduler.getTask(taskId);
          return t && t.status === 'completed';
        });

        if (allCompleted && instance.currentNodes.length > 0) {
          // 继续执行下一个节点
          this.executeCurrentNodes(instance);
        }

        break;
      }
    }
  }

  /**
   * 处理任务失败
   */
  private handleTaskFailed(task: any): void {
    // 查找关联的工作流实例
    for (const instance of this.instances.values()) {
      if (instance.tasks.includes(task.id)) {
        instance.status = WorkflowStatus.FAILED;
        instance.error = task.error;
        this.runningWorkflows.delete(instance.id);
        this.emit('instanceFailed', instance);
        break;
      }
    }
  }

  /**
   * 处理节点错误
   */
  private handleNodeError(instance: WorkflowInstance, nodeId: string, error: Error): void {
    instance.status = WorkflowStatus.FAILED;
    instance.error = error.message;
    this.runningWorkflows.delete(instance.id);
    this.emit('nodeFailed', instance.id, nodeId, error);
    this.emit('instanceFailed', instance);
  }

  /**
   * 生成实例 ID
   */
  private generateInstanceId(): string {
    return `workflow-${Date.now()}-${this.nextInstanceId++}`;
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      totalDefinitions: this.definitions.size,
      totalInstances: this.instances.size,
      runningWorkflows: this.runningWorkflows.size,
      completedWorkflows: Array.from(this.instances.values())
        .filter(i => i.status === WorkflowStatus.COMPLETED).length,
      failedWorkflows: Array.from(this.instances.values())
        .filter(i => i.status === WorkflowStatus.FAILED).length,
    };
  }
}

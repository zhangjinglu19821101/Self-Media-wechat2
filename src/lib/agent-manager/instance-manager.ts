/**
 * Agent 实例管理器
 * 负责管理 Agent 实例的注册、发现、状态监控和负载信息
 */

import { EventEmitter } from 'events';
import {
  AgentInstance,
  AgentStatus,
  AgentHealth,
  AgentMetrics,
  AgentRegistration,
  AgentDiscovery,
} from './types';

export class InstanceManager extends EventEmitter {
  private instances: Map<string, AgentInstance> = new Map();
  private registrations: Map<string, AgentRegistration> = new Map();
  private nextInstanceId: number = 1;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private metricsUpdateInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startHealthChecks();
    this.startMetricsUpdate();
  }

  /**
   * 注册 Agent
   */
  registerAgent(registration: AgentRegistration): AgentInstance {
    // 创建 Agent 实例
    const instance: AgentInstance = {
      id: this.generateInstanceId(),
      agentId: registration.agentId,
      name: registration.name,
      description: registration.description,
      status: AgentStatus.INITIALIZING,
      health: AgentHealth.HEALTHY,
      currentTasks: [],
      maxConcurrentTasks: registration.maxConcurrentTasks || 5,
      capabilities: registration.capabilities,
      configuration: registration.configuration || {},
      metrics: this.createInitialMetrics(),
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      metadata: registration.metadata,
    };

    // 保存注册信息和实例
    this.registrations.set(registration.agentId, registration);
    this.instances.set(instance.id, instance);

    // 初始化 Agent
    this.initializeAgent(instance.id);

    this.emit('agentRegistered', instance);
    return instance;
  }

  /**
   * 注销 Agent
   */
  unregisterAgent(instanceId: string): boolean {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return false;
    }

    // 停止 Agent
    this.stopAgent(instanceId);

    // 移除实例
    this.instances.delete(instanceId);
    this.registrations.delete(instance.agentId);

    this.emit('agentUnregistered', instance);
    return true;
  }

  /**
   * 获取 Agent 实例
   */
  getInstance(instanceId: string): AgentInstance | undefined {
    return this.instances.get(instanceId);
  }

  /**
   * 根据 Agent ID 获取实例
   */
  getInstanceByAgentId(agentId: string): AgentInstance | undefined {
    return Array.from(this.instances.values()).find(
      instance => instance.agentId === agentId
    );
  }

  /**
   * 获取所有实例
   */
  getAllInstances(): AgentInstance[] {
    return Array.from(this.instances.values());
  }

  /**
   * 获取活跃实例
   */
  getActiveInstances(): AgentInstance[] {
    return Array.from(this.instances.values()).filter(
      instance =>
        instance.status === AgentStatus.IDLE ||
        instance.status === AgentStatus.BUSY
    );
  }

  /**
   * 根据 capability 获取实例
   */
  getInstancesByCapability(capability: string): AgentInstance[] {
    return Array.from(this.instances.values()).filter(instance =>
      instance.capabilities.includes(capability)
    );
  }

  /**
   * 获取负载最低的实例
   */
  getLeastLoadedInstance(agentId?: string): AgentInstance | null {
    let candidates = this.getActiveInstances();

    if (agentId) {
      candidates = candidates.filter(i => i.agentId === agentId);
    }

    if (candidates.length === 0) {
      return null;
    }

    // 按当前任务数排序
    candidates.sort((a, b) => a.currentTasks.length - b.currentTasks.length);

    return candidates[0];
  }

  /**
   * 初始化 Agent
   */
  private async initializeAgent(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return;
    }

    try {
      this.emit('agentInitializing', instance);

      // 模拟初始化过程
      await this.simulateInitialization(instance);

      // 更新状态为启动中
      instance.status = AgentStatus.IDLE;
      instance.startedAt = Date.now();
      instance.health = AgentHealth.HEALTHY;

      this.emit('agentInitialized', instance);
    } catch (error) {
      instance.status = AgentStatus.ERROR;
      instance.health = AgentHealth.UNHEALTHY;
      instance.error = (error as Error).message;
      this.emit('agentInitializationFailed', instance, error);
    }
  }

  /**
   * 模拟初始化过程
   */
  private async simulateInitialization(instance: AgentInstance): Promise<void> {
    return new Promise(resolve => {
      setTimeout(() => {
        // 这里可以添加实际的初始化逻辑
        resolve();
      }, 500);
    });
  }

  /**
   * 启动 Agent
   */
  async startAgent(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Agent instance not found: ${instanceId}`);
    }

    if (instance.status === AgentStatus.IDLE) {
      return;
    }

    this.emit('agentStarting', instance);

    // 模拟启动过程
    await new Promise(resolve => setTimeout(resolve, 300));

    instance.status = AgentStatus.IDLE;
    instance.startedAt = Date.now();
    instance.lastActiveAt = Date.now();

    this.emit('agentStarted', instance);
  }

  /**
   * 停止 Agent
   */
  async stopAgent(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Agent instance not found: ${instanceId}`);
    }

    if (instance.status === AgentStatus.OFFLINE || instance.status === AgentStatus.TERMINATED) {
      return;
    }

    this.emit('agentStopping', instance);

    // 等待当前任务完成
    if (instance.currentTasks.length > 0) {
      await this.waitForTasksComplete(instanceId, 5000);
    }

    instance.status = AgentStatus.OFFLINE;
    instance.lastActiveAt = Date.now();

    this.emit('agentStopped', instance);
  }

  /**
   * 重启 Agent
   */
  async restartAgent(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Agent instance not found: ${instanceId}`);
    }

    this.emit('agentRestarting', instance);

    await this.stopAgent(instanceId);
    await this.startAgent(instanceId);

    this.emit('agentRestarted', instance);
  }

  /**
   * 等待任务完成
   */
  private async waitForTasksComplete(instanceId: string, timeout: number): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const instance = this.instances.get(instanceId);
      if (!instance || instance.currentTasks.length === 0) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * 添加任务到 Agent
   */
  addTaskToAgent(instanceId: string, taskId: string): boolean {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return false;
    }

    // 检查是否达到最大并发数
    if (instance.currentTasks.length >= instance.maxConcurrentTasks) {
      return false;
    }

    instance.currentTasks.push(taskId);
    instance.lastActiveAt = Date.now();

    if (instance.currentTasks.length > 0) {
      instance.status = AgentStatus.BUSY;
    }

    this.emit('agentTaskAdded', instance, taskId);
    return true;
  }

  /**
   * 从 Agent 移除任务
   */
  removeTaskFromAgent(instanceId: string, taskId: string): boolean {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return false;
    }

    const index = instance.currentTasks.indexOf(taskId);
    if (index === -1) {
      return false;
    }

    instance.currentTasks.splice(index, 1);
    instance.lastActiveAt = Date.now();

    if (instance.currentTasks.length === 0) {
      instance.status = AgentStatus.IDLE;
    }

    this.emit('agentTaskRemoved', instance, taskId);
    return true;
  }

  /**
   * 更新 Agent 状态
   */
  updateAgentStatus(instanceId: string, status: AgentStatus): void {
    const instance = this.instances.get(instanceId);
    if (instance) {
      const oldStatus = instance.status;
      instance.status = status;
      instance.lastActiveAt = Date.now();
      this.emit('agentStatusChanged', instance, oldStatus);
    }
  }

  /**
   * 更新 Agent 健康状态
   */
  updateAgentHealth(instanceId: string, health: AgentHealth): void {
    const instance = this.instances.get(instanceId);
    if (instance) {
      const oldHealth = instance.health;
      instance.health = health;
      this.emit('agentHealthChanged', instance, oldHealth);
    }
  }

  /**
   * 更新 Agent 配置
   */
  updateAgentConfiguration(instanceId: string, config: Record<string, any>): void {
    const instance = this.instances.get(instanceId);
    if (instance) {
      instance.configuration = { ...instance.configuration, ...config };
      this.emit('agentConfigurationUpdated', instance);
    }
  }

  /**
   * 获取 Agent 发现信息
   */
  getDiscovery(): AgentDiscovery {
    const instances = this.getAllInstances();
    return {
      agents: instances,
      timestamp: Date.now(),
      totalAgents: instances.length,
      activeAgents: instances.filter(
        i =>
          i.status === AgentStatus.IDLE ||
          i.status === AgentStatus.BUSY
      ).length,
    };
  }

  /**
   * 开始健康检查
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, 30000); // 每 30 秒检查一次
  }

  /**
   * 执行健康检查
   */
  private performHealthChecks(): void {
    this.instances.forEach((instance, instanceId) => {
      if (instance.status === AgentStatus.OFFLINE || instance.status === AgentStatus.TERMINATED) {
        return;
      }

      const health = this.checkAgentHealth(instance);
      this.updateAgentHealth(instanceId, health);
    });
  }

  /**
   * 检查 Agent 健康状态
   */
  private checkAgentHealth(instance: AgentInstance): AgentHealth {
    // 检查是否有错误
    if (instance.status === AgentStatus.ERROR) {
      return AgentHealth.UNHEALTHY;
    }

    // 检查任务失败率
    const failureRate =
      instance.metrics.totalTasks > 0
        ? instance.metrics.failedTasks / instance.metrics.totalTasks
        : 0;

    if (failureRate > 0.5) {
      return AgentHealth.UNHEALTHY;
    }

    if (failureRate > 0.2) {
      return AgentHealth.DEGRADED;
    }

    return AgentHealth.HEALTHY;
  }

  /**
   * 开始指标更新
   */
  private startMetricsUpdate(): void {
    this.metricsUpdateInterval = setInterval(() => {
      this.updateMetrics();
    }, 5000); // 每 5 秒更新一次
  }

  /**
   * 更新指标
   */
  private updateMetrics(): void {
    this.instances.forEach(instance => {
      if (instance.status === AgentStatus.OFFLINE || instance.status === AgentStatus.TERMINATED) {
        return;
      }

      // 更新运行时间
      if (instance.startedAt) {
        instance.metrics.uptime = Date.now() - instance.startedAt;
      }
    });
  }

  /**
   * 创建初始指标
   */
  private createInitialMetrics(): AgentMetrics {
    return {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      averageTaskDuration: 0,
      totalMessageCount: 0,
      uptime: 0,
    };
  }

  /**
   * 生成实例 ID
   */
  private generateInstanceId(): string {
    return `agent-instance-${Date.now()}-${this.nextInstanceId++}`;
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.metricsUpdateInterval) {
      clearInterval(this.metricsUpdateInterval);
      this.metricsUpdateInterval = null;
    }

    this.instances.clear();
    this.registrations.clear();
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const instances = this.getAllInstances();
    return {
      totalInstances: instances.length,
      activeInstances: this.getActiveInstances().length,
      idleInstances: instances.filter(i => i.status === AgentStatus.IDLE).length,
      busyInstances: instances.filter(i => i.status === AgentStatus.BUSY).length,
      errorInstances: instances.filter(i => i.status === AgentStatus.ERROR).length,
      healthyInstances: instances.filter(i => i.health === AgentHealth.HEALTHY).length,
      degradedInstances: instances.filter(i => i.health === AgentHealth.DEGRADED).length,
      unhealthyInstances: instances.filter(i => i.health === AgentHealth.UNHEALTHY).length,
    };
  }
}

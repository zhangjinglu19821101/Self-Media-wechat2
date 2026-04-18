/**
 * Agent 生命周期控制器
 * 负责 Agent 的启动、停止、重启、错误恢复等生命周期管理
 */

import { EventEmitter } from 'events';
import { InstanceManager } from './instance-manager';
import {
  AgentInstance,
  AgentStatus,
  LifecycleEvent,
  LifecycleStrategy,
  LifecycleConfig,
} from './types';

export class LifecycleController extends EventEmitter {
  private instanceManager: InstanceManager;
  private config: LifecycleConfig;
  private retryCounts: Map<string, number> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(
    instanceManager: InstanceManager,
    config?: LifecycleConfig
  ) {
    super();
    this.instanceManager = instanceManager;
    this.config = {
      maxRetries: 3,
      retryDelay: 5000,
      strategy: LifecycleStrategy.AUTO_RESTART,
      autoHealEnabled: true,
      healthCheckInterval: 30000,
      gracefulShutdownTimeout: 10000,
      ...config,
    };

    this.startHealthMonitoring();
  }

  /**
   * 启动 Agent
   */
  async startAgent(instanceId: string): Promise<boolean> {
    const instance = this.instanceManager.getInstance(instanceId);
    if (!instance) {
      this.emit('error', new Error(`Agent instance not found: ${instanceId}`));
      return false;
    }

    try {
      this.emit(LifecycleEvent.STARTING, instance);
      await this.instanceManager.startAgent(instanceId);
      this.emit(LifecycleEvent.STARTED, instance);
      return true;
    } catch (error) {
      this.emit(LifecycleEvent.ERROR, instance, error);
      return false;
    }
  }

  /**
   * 停止 Agent
   */
  async stopAgent(
    instanceId: string,
    graceful: boolean = true
  ): Promise<boolean> {
    const instance = this.instanceManager.getInstance(instanceId);
    if (!instance) {
      this.emit('error', new Error(`Agent instance not found: ${instanceId}`));
      return false;
    }

    try {
      this.emit(LifecycleEvent.STOPPING, instance);

      if (graceful) {
        await this.gracefulShutdown(instanceId);
      } else {
        await this.forceShutdown(instanceId);
      }

      this.emit(LifecycleEvent.STOPPED, instance);
      return true;
    } catch (error) {
      this.emit(LifecycleEvent.ERROR, instance, error);
      return false;
    }
  }

  /**
   * 重启 Agent
   */
  async restartAgent(instanceId: string): Promise<boolean> {
    const instance = this.instanceManager.getInstance(instanceId);
    if (!instance) {
      this.emit('error', new Error(`Agent instance not found: ${instanceId}`));
      return false;
    }

    try {
      this.emit(LifecycleEvent.RESTARTING, instance);
      await this.instanceManager.restartAgent(instanceId);
      this.emit(LifecycleEvent.RESTARTED, instance);

      // 重置重试计数
      this.retryCounts.delete(instanceId);
      return true;
    } catch (error) {
      this.emit(LifecycleEvent.ERROR, instance, error);
      await this.handleAgentError(instanceId, error as Error);
      return false;
    }
  }

  /**
   * 优雅关闭
   */
  private async gracefulShutdown(instanceId: string): Promise<void> {
    const instance = this.instanceManager.getInstance(instanceId);
    if (!instance) {
      return;
    }

    const startTime = Date.now();

    // 等待当前任务完成
    while (instance.currentTasks.length > 0) {
      if (Date.now() - startTime > this.config.gracefulShutdownTimeout!) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 停止 Agent
    await this.instanceManager.stopAgent(instanceId);
  }

  /**
   * 强制关闭
   */
  private async forceShutdown(instanceId: string): Promise<void> {
    await this.instanceManager.stopAgent(instanceId);
  }

  /**
   * 处理 Agent 错误
   */
  private async handleAgentError(
    instanceId: string,
    error: Error
  ): Promise<void> {
    const instance = this.instanceManager.getInstance(instanceId);
    if (!instance) {
      return;
    }

    // 根据策略处理错误
    switch (this.config.strategy) {
      case LifecycleStrategy.AUTO_RESTART:
        await this.autoRestart(instanceId);
        break;

      case LifecycleStrategy.TERMINATE_ON_ERROR:
        await this.terminateOnError(instanceId);
        break;

      case LifecycleStrategy.MANUAL_RESTART:
        await this.manualRestart(instanceId);
        break;

      case LifecycleStrategy.GRACEFUL_SHUTDOWN:
        await this.gracefulShutdown(instanceId);
        break;
    }
  }

  /**
   * 自动重启
   */
  private async autoRestart(instanceId: string): Promise<void> {
    const retryCount = this.retryCounts.get(instanceId) || 0;

    if (retryCount >= this.config.maxRetries!) {
      this.emit('maxRetriesReached', instanceId);
      await this.terminateOnError(instanceId);
      return;
    }

    // 延迟重启
    await new Promise(resolve =>
      setTimeout(resolve, this.config.retryDelay!)
    );

    this.retryCounts.set(instanceId, retryCount + 1);
    await this.restartAgent(instanceId);
  }

  /**
   * 错误时终止
   */
  private async terminateOnError(instanceId: string): Promise<void> {
    await this.stopAgent(instanceId, false);
    this.retryCounts.delete(instanceId);
  }

  /**
   * 手动重启（需要外部介入）
   */
  private async manualRestart(instanceId: string): Promise<void> {
    this.emit('manualRestartRequired', instanceId);
    await this.stopAgent(instanceId, true);
  }

  /**
   * 开始健康监控
   */
  private startHealthMonitoring(): void {
    if (!this.config.autoHealEnabled) {
      return;
    }

    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheckInterval!);
  }

  /**
   * 执行健康检查
   */
  private performHealthChecks(): void {
    const instances = this.instanceManager.getAllInstances();

    instances.forEach(instance => {
      if (this.shouldHealAgent(instance)) {
        this.healAgent(instance.id);
      }
    });
  }

  /**
   * 判断是否需要修复 Agent
   */
  private shouldHealAgent(instance: AgentInstance): boolean {
    // 检查状态
    if (instance.status === AgentStatus.ERROR) {
      return true;
    }

    // 检查健康状态
    if (instance.health !== 'healthy') {
      return true;
    }

    // 检查是否超时
    if (Date.now() - instance.lastActiveAt > this.config.healthCheckInterval! * 3) {
      return true;
    }

    return false;
  }

  /**
   * 修复 Agent
   */
  private async healAgent(instanceId: string): Promise<void> {
    this.emit('healingAgent', instanceId);

    try {
      await this.restartAgent(instanceId);
      this.emit('agentHealed', instanceId);
    } catch (error) {
      this.emit('healFailed', instanceId, error);
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<LifecycleConfig>): void {
    this.config = { ...this.config, ...config };

    // 重启健康监控
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.startHealthMonitoring();
  }

  /**
   * 获取配置
   */
  getConfig(): LifecycleConfig {
    return { ...this.config };
  }

  /**
   * 获取重试统计
   */
  getRetryStats(): Map<string, number> {
    return new Map(this.retryCounts);
  }

  /**
   * 清除重试计数
   */
  clearRetryCount(instanceId: string): void {
    this.retryCounts.delete(instanceId);
  }

  /**
   * 销毁控制器
   */
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    this.retryCounts.clear();
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      config: this.config,
      retryStats: Object.fromEntries(this.retryCounts),
      healingEnabled: this.config.autoHealEnabled,
    };
  }
}

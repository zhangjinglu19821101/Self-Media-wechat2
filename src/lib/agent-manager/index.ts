/**
 * Agent 管理器主入口
 * 整合所有 Agent 管理模块，提供统一的接口
 */

import { EventEmitter } from 'events';
import { InstanceManager } from './instance-manager';
import { LifecycleController } from './lifecycle-controller';
import { CollaborationProtocolManager } from './collaboration-protocol';

// 导出类型
export * from './types';

export class AgentManager extends EventEmitter {
  private instanceManager: InstanceManager;
  private lifecycleController: LifecycleController;
  private collaborationManager: CollaborationProtocolManager;

  constructor(lifecycleConfig?: any) {
    super();

    // 初始化各模块
    this.instanceManager = new InstanceManager();
    this.lifecycleController = new LifecycleController(
      this.instanceManager,
      lifecycleConfig
    );
    this.collaborationManager = new CollaborationProtocolManager();

    // 建立模块之间的连接
    this.connectModules();
  }

  /**
   * 连接模块
   */
  private connectModules(): void {
    // 生命周期事件转发
    this.lifecycleController.on('agentStarted', (instance) => {
      this.emit('agentStarted', instance);
    });

    this.lifecycleController.on('agentStopped', (instance) => {
      this.emit('agentStopped', instance);
    });

    this.lifecycleController.on('agentRestarted', (instance) => {
      this.emit('agentRestarted', instance);
    });

    this.lifecycleController.on('agentHealed', (instanceId) => {
      this.emit('agentHealed', instanceId);
    });

    // 协作事件转发
    this.collaborationManager.on('sessionCreated', (session) => {
      this.emit('collaborationSessionCreated', session);
    });

    this.collaborationManager.on('sessionCompleted', (session) => {
      this.emit('collaborationSessionCompleted', session);
    });
  }

  // ============================================================================
  // Agent 实例管理接口
  // ============================================================================

  /**
   * 注册 Agent
   */
  registerAgent(registration: any) {
    return this.instanceManager.registerAgent(registration);
  }

  /**
   * 注销 Agent
   */
  unregisterAgent(instanceId: string): boolean {
    return this.instanceManager.unregisterAgent(instanceId);
  }

  /**
   * 获取 Agent 实例
   */
  getInstance(instanceId: string) {
    return this.instanceManager.getInstance(instanceId);
  }

  /**
   * 根据 Agent ID 获取实例
   */
  getInstanceByAgentId(agentId: string) {
    return this.instanceManager.getInstanceByAgentId(agentId);
  }

  /**
   * 获取所有实例
   */
  getAllInstances() {
    return this.instanceManager.getAllInstances();
  }

  /**
   * 获取活跃实例
   */
  getActiveInstances() {
    return this.instanceManager.getActiveInstances();
  }

  /**
   * 根据 capability 获取实例
   */
  getInstancesByCapability(capability: string) {
    return this.instanceManager.getInstancesByCapability(capability);
  }

  /**
   * 获取负载最低的实例
   */
  getLeastLoadedInstance(agentId?: string) {
    return this.instanceManager.getLeastLoadedInstance(agentId);
  }

  /**
   * 添加任务到 Agent
   */
  addTaskToAgent(instanceId: string, taskId: string): boolean {
    return this.instanceManager.addTaskToAgent(instanceId, taskId);
  }

  /**
   * 从 Agent 移除任务
   */
  removeTaskFromAgent(instanceId: string, taskId: string): boolean {
    return this.instanceManager.removeTaskFromAgent(instanceId, taskId);
  }

  // ============================================================================
  // 生命周期管理接口
  // ============================================================================

  /**
   * 启动 Agent
   */
  async startAgent(instanceId: string): Promise<boolean> {
    return this.lifecycleController.startAgent(instanceId);
  }

  /**
   * 停止 Agent
   */
  async stopAgent(instanceId: string, graceful?: boolean): Promise<boolean> {
    return this.lifecycleController.stopAgent(instanceId, graceful);
  }

  /**
   * 重启 Agent
   */
  async restartAgent(instanceId: string): Promise<boolean> {
    return this.lifecycleController.restartAgent(instanceId);
  }

  /**
   * 获取生命周期配置
   */
  getLifecycleConfig() {
    return this.lifecycleController.getConfig();
  }

  /**
   * 更新生命周期配置
   */
  updateLifecycleConfig(config: any): void {
    this.lifecycleController.updateConfig(config);
  }

  // ============================================================================
  // 协作协议接口
  // ============================================================================

  /**
   * 注册协作协议
   */
  registerProtocol(protocol: any): void {
    this.collaborationManager.registerProtocol(protocol);
  }

  /**
   * 注销协作协议
   */
  unregisterProtocol(protocolId: string): boolean {
    return this.collaborationManager.unregisterProtocol(protocolId);
  }

  /**
   * 获取协议
   */
  getProtocol(protocolId: string) {
    return this.collaborationManager.getProtocol(protocolId);
  }

  /**
   * 获取所有协议
   */
  getAllProtocols() {
    return this.collaborationManager.getAllProtocols();
  }

  /**
   * 创建协作会话
   */
  createCollaborationSession(
    initiatorId: string,
    protocolId: string,
    participantIds: string[],
    initialContext?: any
  ) {
    return this.collaborationManager.createSession(
      initiatorId,
      protocolId,
      participantIds,
      initialContext
    );
  }

  /**
   * 获取协作会话
   */
  getCollaborationSession(sessionId: string) {
    return this.collaborationManager.getSession(sessionId);
  }

  /**
   * 发送协作消息
   */
  async sendCollaborationMessage(
    sessionId: string,
    from: string,
    to: string,
    messageType: any,
    content: any
  ): Promise<boolean> {
    return this.collaborationManager.sendMessage(
      sessionId,
      from,
      to,
      messageType,
      content
    );
  }

  /**
   * 完成协作会话
   */
  completeCollaborationSession(sessionId: string): void {
    this.collaborationManager.completeSession(sessionId);
  }

  // ============================================================================
  // 统一统计接口
  // ============================================================================

  /**
   * 获取管理器整体统计信息
   */
  getStats() {
    return {
      instanceManager: this.instanceManager.getStats(),
      lifecycleController: this.lifecycleController.getStats(),
      collaborationManager: this.collaborationManager.getStats(),
    };
  }

  /**
   * 获取 Agent 发现信息
   */
  getDiscovery() {
    return this.instanceManager.getDiscovery();
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    this.instanceManager.destroy();
    this.lifecycleController.destroy();
    this.collaborationManager.destroy();
    this.removeAllListeners();
  }
}

// 导出子模块
export { InstanceManager } from './instance-manager';
export { LifecycleController } from './lifecycle-controller';
export { CollaborationProtocolManager } from './collaboration-protocol';

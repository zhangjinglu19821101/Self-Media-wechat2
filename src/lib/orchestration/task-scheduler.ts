/**
 * Agent 任务调度器
 * 负责任务的分配、排队、执行和监控
 */

import { EventEmitter } from 'events';
import {
  ScheduledTask,
  TaskStatus,
  TaskPriority,
  SchedulingStrategy,
} from './types';

// Agent 负载信息接口
interface AgentLoadInfo {
  agentId: string;
  runningTasks: number;
  maxConcurrent: number;
  utilization: number; // 0-1
  averageTaskDuration: number;
}

export class TaskScheduler extends EventEmitter {
  private taskQueue: ScheduledTask[] = [];
  private runningTasks: Map<string, ScheduledTask> = new Map();
  private agentLoadInfo: Map<string, AgentLoadInfo> = new Map();
  private schedulingStrategy: SchedulingStrategy = SchedulingStrategy.PRIORITY;
  private maxConcurrentTasks: number = 10;
  private processing: boolean = false;
  private nextTaskId: number = 1;

  constructor(strategy: SchedulingStrategy = SchedulingStrategy.PRIORITY) {
    super();
    this.schedulingStrategy = strategy;
    this.startScheduling();
  }

  /**
   * 设置调度策略
   */
  setSchedulingStrategy(strategy: SchedulingStrategy): void {
    this.schedulingStrategy = strategy;
    this.emit('strategyChanged', strategy);
  }

  /**
   * 设置最大并发任务数
   */
  setMaxConcurrentTasks(max: number): void {
    this.maxConcurrentTasks = max;
    this.emit('maxConcurrentTasksChanged', max);
  }

  /**
   * 更新 Agent 负载信息
   */
  updateAgentLoadInfo(agentId: string, loadInfo: Omit<AgentLoadInfo, 'agentId'>): void {
    this.agentLoadInfo.set(agentId, {
      agentId,
      ...loadInfo,
    });
    this.emit('agentLoadInfoUpdated', agentId, loadInfo);
  }

  /**
   * 提交任务
   */
  submitTask(task: Omit<ScheduledTask, 'id' | 'status' | 'createdAt'>): ScheduledTask {
    const newTask: ScheduledTask = {
      ...task,
      id: this.generateTaskId(),
      status: TaskStatus.PENDING,
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: task.maxRetries || 3,
      progress: 0,
    };

    this.taskQueue.push(newTask);
    this.emit('taskSubmitted', newTask);

    return newTask;
  }

  /**
   * 批量提交任务
   */
  submitTasks(tasks: Omit<ScheduledTask, 'id' | 'status' | 'createdAt'>[]): ScheduledTask[] {
    return tasks.map(task => this.submitTask(task));
  }

  /**
   * 取消任务
   */
  cancelTask(taskId: string): boolean {
    // 检查队列中的任务
    const queueIndex = this.taskQueue.findIndex(t => t.id === taskId);
    if (queueIndex !== -1) {
      const task = this.taskQueue.splice(queueIndex, 1)[0];
      task.status = TaskStatus.CANCELLED;
      this.emit('taskCancelled', task);
      return true;
    }

    // 检查运行中的任务
    const runningTask = this.runningTasks.get(taskId);
    if (runningTask) {
      runningTask.status = TaskStatus.CANCELLED;
      this.runningTasks.delete(taskId);
      this.emit('taskCancelled', runningTask);
      return true;
    }

    return false;
  }

  /**
   * 获取任务
   */
  getTask(taskId: string): ScheduledTask | undefined {
    // 先检查运行中的任务
    const runningTask = this.runningTasks.get(taskId);
    if (runningTask) {
      return runningTask;
    }

    // 再检查队列中的任务
    return this.taskQueue.find(t => t.id === taskId);
  }

  /**
   * 获取所有任务
   */
  getAllTasks(): ScheduledTask[] {
    return [...this.taskQueue, ...Array.from(this.runningTasks.values())];
  }

  /**
   * 获取队列中的任务
   */
  getQueuedTasks(): ScheduledTask[] {
    return [...this.taskQueue];
  }

  /**
   * 获取运行中的任务
   */
  getRunningTasks(): ScheduledTask[] {
    return Array.from(this.runningTasks.values());
  }

  /**
   * 开始调度
   */
  private startScheduling(): void {
    this.schedule();
  }

  /**
   * 调度循环
   */
  private async schedule(): Promise<void> {
    if (this.processing) {
      return;
    }

    this.processing = true;

    while (this.taskQueue.length > 0 && this.runningTasks.size < this.maxConcurrentTasks) {
      const task = this.selectNextTask();
      if (task) {
        await this.executeTask(task);
      }
    }

    this.processing = false;

    // 继续调度
    setTimeout(() => this.schedule(), 100);
  }

  /**
   * 选择下一个要执行的任务（根据调度策略）
   */
  private selectNextTask(): ScheduledTask | null {
    if (this.taskQueue.length === 0) {
      return null;
    }

    let selectedIndex = 0;

    switch (this.schedulingStrategy) {
      case SchedulingStrategy.FIFO:
        // 先进先出，选择队列第一个
        selectedIndex = 0;
        break;

      case SchedulingStrategy.PRIORITY:
        // 优先级调度，选择优先级最高的
        selectedIndex = this.taskQueue.findIndex(t =>
          t.priority === Math.max(...this.taskQueue.map(t => t.priority))
        );
        break;

      case SchedulingStrategy.ROUND_ROBIN:
        // 轮询调度，选择最久未执行的 Agent
        selectedIndex = this.selectTaskByRoundRobin();
        break;

      case SchedulingStrategy.LEAST_LOADED:
        // 负载均衡，选择负载最低的 Agent 的任务
        selectedIndex = this.selectTaskByLeastLoaded();
        break;

      case SchedulingStrategy.EARLIEST_DEADLINE:
        // 最早截止时间，选择最早到期的任务
        selectedIndex = this.taskQueue.findIndex(t =>
          t.scheduledAt && t.scheduledAt === Math.min(
            ...this.taskQueue
              .filter(t => t.scheduledAt)
              .map(t => t.scheduledAt!)
          )
        );
        break;
    }

    return this.taskQueue.splice(selectedIndex, 1)[0];
  }

  /**
   * 轮询调度
   */
  private selectTaskByRoundRobin(): number {
    const agentTaskCounts = new Map<string, number>();

    // 统计每个 Agent 的任务数
    this.taskQueue.forEach(task => {
      const count = agentTaskCounts.get(task.agentId) || 0;
      agentTaskCounts.set(task.agentId, count + 1);
    });

    this.runningTasks.forEach(task => {
      const count = agentTaskCounts.get(task.agentId) || 0;
      agentTaskCounts.set(task.agentId, count + 1);
    });

    // 选择任务数最少的 Agent 的任务
    let selectedTask: ScheduledTask | null = null;
    let minCount = Infinity;

    this.taskQueue.forEach((task, index) => {
      const count = agentTaskCounts.get(task.agentId) || 0;
      if (count < minCount) {
        minCount = count;
        selectedTask = task;
      }
    });

    return this.taskQueue.indexOf(selectedTask!);
  }

  /**
   * 负载均衡调度
   */
  private selectTaskByLeastLoaded(): number {
    let selectedTask: ScheduledTask | null = null;
    let minUtilization = Infinity;

    this.taskQueue.forEach((task, index) => {
      const loadInfo = this.agentLoadInfo.get(task.agentId);
      if (loadInfo) {
        if (loadInfo.utilization < minUtilization) {
          minUtilization = loadInfo.utilization;
          selectedTask = task;
        }
      }
    });

    // 如果没有负载信息，默认选择第一个
    if (!selectedTask) {
      return 0;
    }

    return this.taskQueue.indexOf(selectedTask);
  }

  /**
   * 执行任务
   */
  private async executeTask(task: ScheduledTask): Promise<void> {
    try {
      // 检查依赖
      if (task.dependencies && task.dependencies.length > 0) {
        const dependenciesCompleted = task.dependencies.every(depId => {
          const depTask = this.getTask(depId);
          return depTask && depTask.status === TaskStatus.COMPLETED;
        });

        if (!dependenciesCompleted) {
          // 依赖未完成，重新加入队列
          task.status = TaskStatus.PENDING;
          this.taskQueue.push(task);
          return;
        }
      }

      // 更新任务状态
      task.status = TaskStatus.RUNNING;
      task.scheduledAt = Date.now();
      this.runningTasks.set(task.id, task);
      this.emit('taskStarted', task);

      // 设置超时检查
      if (task.timeout) {
        setTimeout(() => {
          if (task.status === TaskStatus.RUNNING) {
            this.handleTaskTimeout(task);
          }
        }, task.timeout);
      }

      // 发送任务执行事件，由外部处理实际的执行逻辑
      this.emit('taskExecute', task);

    } catch (error) {
      this.handleTaskError(task, error as Error);
    }
  }

  /**
   * 更新任务进度
   */
  updateTaskProgress(taskId: string, progress: number): void {
    const task = this.runningTasks.get(taskId);
    if (task) {
      task.progress = Math.min(100, Math.max(0, progress));
      this.emit('taskProgressUpdated', task);
    }
  }

  /**
   * 完成任务
   */
  completeTask(taskId: string, result?: any): void {
    const task = this.runningTasks.get(taskId);
    if (task) {
      task.status = TaskStatus.COMPLETED;
      task.completedAt = Date.now();
      task.actualDuration = task.completedAt - task.startedAt!;
      task.result = result;
      task.progress = 100;

      this.runningTasks.delete(taskId);
      this.emit('taskCompleted', task);

      // 更新 Agent 负载信息
      this.updateAgentTaskStats(task.agentId);
    }
  }

  /**
   * 标记任务失败
   */
  failTask(taskId: string, error: string): void {
    const task = this.runningTasks.get(taskId);
    if (task) {
      task.status = TaskStatus.FAILED;
      task.error = error;

      // 检查是否需要重试
      const retryCount = (task.retryCount || 0) + 1;
      const maxRetries = task.maxRetries || 3;

      if (retryCount <= maxRetries) {
        task.retryCount = retryCount;
        task.status = TaskStatus.PENDING;
        this.runningTasks.delete(taskId);
        this.taskQueue.push(task);
        this.emit('taskRetry', task);
      } else {
        task.completedAt = Date.now();
        task.actualDuration = task.completedAt - task.startedAt!;
        this.runningTasks.delete(taskId);
        this.emit('taskFailed', task);
      }

      // 更新 Agent 负载信息
      this.updateAgentTaskStats(task.agentId);
    }
  }

  /**
   * 处理任务超时
   */
  private handleTaskTimeout(task: ScheduledTask): void {
    task.status = TaskStatus.TIMEOUT;
    task.completedAt = Date.now();
    task.actualDuration = task.completedAt - task.startedAt!;
    this.runningTasks.delete(task.id);
    this.emit('taskTimeout', task);

    // 更新 Agent 负载信息
    this.updateAgentTaskStats(task.agentId);
  }

  /**
   * 处理任务错误
   */
  private handleTaskError(task: ScheduledTask, error: Error): void {
    task.status = TaskStatus.FAILED;
    task.error = error.message;
    task.completedAt = Date.now();
    this.runningTasks.delete(task.id);
    this.emit('taskFailed', task);

    // 更新 Agent 负载信息
    this.updateAgentTaskStats(task.agentId);
  }

  /**
   * 更新 Agent 任务统计
   */
  private updateAgentTaskStats(agentId: string): void {
    const loadInfo = this.agentLoadInfo.get(agentId);
    if (loadInfo) {
      const runningTasks = Array.from(this.runningTasks.values())
        .filter(t => t.agentId === agentId).length;

      loadInfo.runningTasks = runningTasks;
      loadInfo.utilization = runningTasks / loadInfo.maxConcurrent;
    }
  }

  /**
   * 生成任务 ID
   */
  private generateTaskId(): string {
    return `task-${Date.now()}-${this.nextTaskId++}`;
  }

  /**
   * 清空任务队列
   */
  clearQueue(): void {
    this.taskQueue = [];
    this.emit('queueCleared');
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      queuedTasks: this.taskQueue.length,
      runningTasks: this.runningTasks.size,
      maxConcurrentTasks: this.maxConcurrentTasks,
      schedulingStrategy: this.schedulingStrategy,
      agentLoadInfo: Array.from(this.agentLoadInfo.values()),
    };
  }
}

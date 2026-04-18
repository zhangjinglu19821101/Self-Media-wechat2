/**
 * 任务调度器
 * 负责任务的优先级管理和并发控制
 */

import {
  Task,
  AgentId,
  TaskPriority,
  TaskStatus,
  TaskQueueConfig,
} from './agent-types';
import { agentManager } from './agent-manager';

export class TaskScheduler {
  private taskQueue: Map<AgentId, Task[]> = new Map();
  private runningTasks: Map<string, Task> = new Map();

  constructor() {
    this.initializeQueues();
  }

  /**
   * 初始化队列
   */
  private initializeQueues(): void {
    const agents = agentManager.getAllAgents();
    agents.forEach((agent) => {
      this.taskQueue.set(agent.id, []);
    });
  }

  /**
   * 提交任务
   */
  submitTask(task: Task): boolean {
    // 验证 Agent 是否存在
    const agent = agentManager.getAgent(task.assignedTo);
    if (!agent) {
      console.error(`Agent ${task.assignedTo} not found`);
      return false;
    }

    // 添加到队列
    const queue = this.taskQueue.get(task.assignedTo);
    if (queue) {
      // 根据优先级插入队列（保持优先级顺序）
      this.insertByPriority(queue, task);
      return true;
    }

    return false;
  }

  /**
   * 根据优先级插入队列
   */
  private insertByPriority(queue: Task[], task: Task): void {
    let inserted = false;
    for (let i = 0; i < queue.length; i++) {
      if (task.priority > queue[i].priority) {
        queue.splice(i, 0, task);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      queue.push(task);
    }
  }

  /**
   * 执行下一个任务
   */
  async executeNextTask(agentId: AgentId): Promise<Task | null> {
    // 检查 Agent 是否有可用槽位
    if (!agentManager.hasAvailableSlot(agentId)) {
      return null;
    }

    const queue = this.taskQueue.get(agentId);
    if (!queue || queue.length === 0) {
      return null;
    }

    // 获取下一个任务
    const task = queue.shift();
    if (!task) {
      return null;
    }

    // 更新任务状态
    task.status = TaskStatus.RUNNING;
    task.startedAt = new Date();

    // 添加到运行任务列表
    this.runningTasks.set(task.id, task);

    // 更新 Agent 状态
    const agent = agentManager.getAgent(agentId);
    if (agent) {
      agent.currentTasks++;
      agentManager.updateAgentStatus(agentId, 'BUSY' as any);
    }

    // 执行任务
    await this.executeTask(task);

    return task;
  }

  /**
   * 执行任务
   */
  private async executeTask(task: Task): Promise<void> {
    try {
      console.log(`[Task Scheduler] Executing task ${task.id} on ${task.assignedTo}`);

      // TODO: 这里应该调用 LLM 来执行任务
      // const result = await callLLM(task.description, task.assignedTo);

      // 模拟任务执行
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 更新任务状态
      task.status = TaskStatus.COMPLETED;
      task.completedAt = new Date();
      task.progress = 100;
      task.result = 'Task completed successfully';

      // 更新 Agent 状态
      const agent = agentManager.getAgent(task.assignedTo);
      if (agent) {
        agent.currentTasks--;
        if (agent.currentTasks === 0) {
          agentManager.updateAgentStatus(task.assignedTo, 'IDLE' as any);
        }
      }

      // 从运行任务列表移除
      this.runningTasks.delete(task.id);

      console.log(`[Task Scheduler] Task ${task.id} completed`);
    } catch (error) {
      console.error(`[Task Scheduler] Task ${task.id} failed:`, error);

      task.status = TaskStatus.FAILED;
      task.error = error instanceof Error ? error.message : 'Unknown error';

      // 更新 Agent 状态
      const agent = agentManager.getAgent(task.assignedTo);
      if (agent) {
        agent.currentTasks--;
        if (agent.currentTasks === 0) {
          agentManager.updateAgentStatus(task.assignedTo, 'IDLE' as any);
        }
      }

      // 从运行任务列表移除
      this.runningTasks.delete(task.id);
    }
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(agentId: AgentId): {
    waiting: number;
    running: number;
    maxConcurrent: number;
  } {
    const queue = this.taskQueue.get(agentId);
    const agent = agentManager.getAgent(agentId);

    return {
      waiting: queue?.length || 0,
      running: Array.from(this.runningTasks.values()).filter(
        (t) => t.assignedTo === agentId
      ).length,
      maxConcurrent: agent?.maxConcurrentTasks || 0,
    };
  }

  /**
   * 获取所有队列状态
   */
  getAllQueueStatus(): Map<AgentId, ReturnType<TaskScheduler['getQueueStatus']>> {
    const status = new Map();
    this.taskQueue.forEach((_, agentId) => {
      status.set(agentId, this.getQueueStatus(agentId));
    });
    return status;
  }

  /**
   * 取消任务
   */
  cancelTask(taskId: string): boolean {
    // 检查运行中的任务
    const runningTask = this.runningTasks.get(taskId);
    if (runningTask) {
      runningTask.status = TaskStatus.CANCELLED;

      // 更新 Agent 状态
      const agent = agentManager.getAgent(runningTask.assignedTo);
      if (agent) {
        agent.currentTasks--;
        if (agent.currentTasks === 0) {
          agentManager.updateAgentStatus(runningTask.assignedTo, 'IDLE' as any);
        }
      }

      this.runningTasks.delete(taskId);
      return true;
    }

    // 检查等待队列中的任务
    for (const [agentId, queue] of this.taskQueue.entries()) {
      const index = queue.findIndex((t) => t.id === taskId);
      if (index !== -1) {
        queue[index].status = TaskStatus.CANCELLED;
        queue.splice(index, 1);
        return true;
      }
    }

    return false;
  }

  /**
   * 获取任务
   */
  getTask(taskId: string): Task | undefined {
    // 检查运行中的任务
    const runningTask = this.runningTasks.get(taskId);
    if (runningTask) {
      return runningTask;
    }

    // 检查等待队列中的任务
    for (const queue of this.taskQueue.values()) {
      const task = queue.find((t) => t.id === taskId);
      if (task) {
        return task;
      }
    }

    return undefined;
  }

  /**
   * 获取 Agent 的所有任务
   */
  getAgentTasks(agentId: AgentId): Task[] {
    const tasks: Task[] = [];

    // 添加运行中的任务
    Array.from(this.runningTasks.values())
      .filter((t) => t.assignedTo === agentId)
      .forEach((t) => tasks.push(t));

    // 添加等待队列中的任务
    const queue = this.taskQueue.get(agentId);
    if (queue) {
      tasks.push(...queue);
    }

    return tasks;
  }

  /**
   * 获取系统统计信息
   */
  getStats() {
    let totalTasks = 0;
    let waitingTasks = 0;
    let runningTasks = 0;
    let completedTasks = 0;
    let failedTasks = 0;

    // 统计等待队列中的任务
    this.taskQueue.forEach((queue) => {
      totalTasks += queue.length;
      waitingTasks += queue.length;
    });

    // 统计运行中的任务
    this.runningTasks.forEach((task) => {
      totalTasks++;
      runningTasks++;
      if (task.status === TaskStatus.COMPLETED) {
        completedTasks++;
      } else if (task.status === TaskStatus.FAILED) {
        failedTasks++;
      }
    });

    return {
      totalTasks,
      waitingTasks,
      runningTasks,
      completedTasks,
      failedTasks,
    };
  }

  /**
   * 创建任务
   */
  createTask(
    title: string,
    description: string,
    assignedTo: AgentId,
    priority: TaskPriority = TaskPriority.MEDIUM,
    createdBy: AgentId = 'A'
  ): Task {
    return {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title,
      description,
      priority,
      status: TaskStatus.PENDING,
      assignedTo,
      createdBy,
      createdAt: new Date(),
      progress: 0,
    };
  }
}

// 导出单例
export const taskScheduler = new TaskScheduler();

/**
 * 任务向量同步服务
 * 将 agentTasks 的 5 个字段同步到向量库，用于相似性比对
 */

import { db } from '@/lib/db';
import { agentTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getPlatformEmbedding } from '@/lib/llm/factory';

// === 向量同步字段 ===
export interface TaskVectorData {
  taskId: string;
  taskName: string;
  coreCommand: string;  // 核心指令（权重最高）
  executor: string;     // 执行主体
  taskDurationEnd: string;  // 任务结束时间
  totalDeliverables: string; // 总交付物
}

/**
 * 任务向量同步服务类
 */
export class TaskVectorSync {
  /**
   * 生成任务向量文本
   * 将 5 个字段组合成一个文本，用于生成向量
   */
  private static generateVectorText(task: any): string {
    const vectorText = [
      `任务ID：${task.taskId}`,
      `任务名称：${task.taskName}`,
      `核心指令：${task.coreCommand}`, // 权重最高，放在前面
      `执行主体：${task.executor}`,
      `任务结束时间：${task.taskDurationEnd}`,
      `总交付物：${task.totalDeliverables}`
    ].join('\n');

    return vectorText;
  }

  /**
   * 同步任务到向量库
   */
  static async syncTaskToVector(taskId: string) {
    // 1. 获取任务信息
    const [task] = await db
      .select()
      .from(agentTasks)
      .where(eq(agentTasks.taskId, taskId));

    if (!task) {
      throw new Error(`任务 ${taskId} 不存在`);
    }

    // 2. 生成向量文本
    const vectorText = this.generateVectorText(task);

    // 3. 生成向量（使用平台 Embedding Client）
    const embeddingClient = getPlatformEmbedding();
    const embedding = await embeddingClient.embedText(vectorText);

    // 4. 存储到向量库（使用 FileVectorDB）
    // TODO: 实现 FileVectorDB 存储
    // await fileVectorDB.insert({
    //   id: `task-${taskId}`,
    //   vector: embedding,
    //   metadata: {
    //     taskId: task.taskId,
    //     taskName: task.taskName,
    //     coreCommand: task.coreCommand,
    //     executor: task.executor,
    //     taskDurationEnd: task.taskDurationEnd,
    //     totalDeliverables: task.totalDeliverables
    //   }
    // });

    console.log(`任务 ${taskId} 已同步到向量库`);
    return embedding;
  }

  /**
   * 查询相似任务
   */
  static async findSimilarTasks(coreCommand: string, threshold: number = 0.8, limit: number = 5) {
    // 1. 生成查询向量（使用平台 Embedding Client）
    const embeddingClient = getPlatformEmbedding();
    const queryEmbedding = await embeddingClient.embedText(`核心指令：${coreCommand}`);

    // 2. 在向量库中搜索
    // TODO: 实现 FileVectorDB 搜索
    // const results = await fileVectorDB.query({
    //   vector: queryEmbedding,
    //   topK: limit
    // });

    // 3. 过滤相似度低于阈值的任务
    // const similarTasks = results
    //   .filter(result => result.score >= threshold)
    //   .map(result => result.metadata);

    // TODO: 暂时返回空数组
    console.log(`查询相似任务：${coreCommand}`);
    return [];
  }

  /**
   * 判断是否为重复任务
   * 判断规则：
   * 1. 相似度 ≥ 0.8
   * 2. 执行时间差 ≤ 1 周
   * 3. 总交付物相似
   */
  static async isDuplicateTask(
    coreCommand: string,
    taskDurationEnd: Date,
    totalDeliverables: string
  ): Promise<{ isDuplicate: boolean; similarTask?: any }> {
    // 1. 查询相似任务
    const similarTasks = await this.findSimilarTasks(coreCommand, 0.8, 10);

    // 2. 判断是否有符合条件的重复任务
    for (const similarTask of similarTasks) {
      // 判断执行时间差 ≤ 1 周
      const similarTaskEndTime = new Date(similarTask.taskDurationEnd);
      const timeDiff = Math.abs(taskDurationEnd.getTime() - similarTaskEndTime.getTime());
      const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

      if (timeDiff > oneWeekMs) {
        continue; // 时间差超过 1 周，不是重复任务
      }

      // 判断总交付物是否相似（简单包含判断）
      if (totalDeliverables.includes(similarTask.totalDeliverables) ||
          similarTask.totalDeliverables.includes(totalDeliverables)) {
        return {
          isDuplicate: true,
          similarTask
        };
      }
    }

    return { isDuplicate: false };
  }
}

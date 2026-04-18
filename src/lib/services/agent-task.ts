/**
 * Agent 任务管理服务
 * 负责Agent间任务的创建、执行、跟踪和反馈
 */

import { eq, and, desc } from 'drizzle-orm';
import { getDatabase, schema } from '../db';
import { agentTasks } from '../db/schema';
import { generateComplianceCheckPrompt, generateComplianceTaskMetadata } from '../agents/prompts/compliance-check';
import { callLLM } from '../agent-llm';
import { isWritingAgent } from '@/lib/agents/agent-registry';
import { ComplianceResultFormatter } from '../utils/compliance-result-formatter';

export class AgentTaskService {
  /**
   * 创建任务
   */
  async createTask(params: {
    fromAgentId: string;
    toAgentId: string;
    command: string;
    commandType?: string;
    priority?: string;
    metadata?: Record<string, any>;
  }) {
    const db = getDatabase();
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    // 从 metadata 中提取任务名称（如果有）
    const taskName = params.metadata?.taskName || `任务 ${taskId}`;
    const acceptanceCriteria = params.metadata?.acceptanceCriteria || '待补充';
    const totalDeliverables = params.metadata?.totalDeliverables || '0';

    const [task] = await db
      .insert(agentTasks)
      .values({
        taskId,
        taskName,
        coreCommand: params.command,
        executor: params.toAgentId, // 接收方即执行方
        acceptanceCriteria,
        taskType: 'master', // 这是总任务
        splitStatus: 'splitting', // 🔥 修改：初始状态为 splitting
        splitStartTime: now, // 🔥 新增：设置拆解开始时间
        taskDurationStart: now,
        taskDurationEnd: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), // 默认3天后
        totalDeliverables,
        taskPriority: params.priority || 'normal',
        taskStatus: 'pending',
        creator: params.fromAgentId,
        updater: 'TS',
        fromAgentId: params.fromAgentId,
        toAgentId: params.toAgentId,
        commandType: params.commandType || 'instruction',
        metadata: params.metadata || {},
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return task;
  }

  /**
   * 获取任务
   */
  async getTask(taskId: string) {
    const db = getDatabase();
    const [task] = await db
      .select()
      .from(agentTasks)
      .where(eq(agentTasks.taskId, taskId));

    return task;
  }

  /**
   * 获取Agent的所有待执行任务
   */
  async getPendingTasks(agentId: string) {
    const db = getDatabase();
    const tasks = await db
      .select()
      .from(agentTasks)
      .where(
        and(
          eq(agentTasks.toAgentId, agentId),
          eq(agentTasks.status, 'pending')
        )
      )
      .orderBy(desc(agentTasks.priority));

    return tasks;
  }

  /**
   * 获取Agent正在执行的任务
   */
  async getInProgressTasks(agentId: string) {
    const db = getDatabase();
    const tasks = await db
      .select()
      .from(agentTasks)
      .where(
        and(
          eq(agentTasks.toAgentId, agentId),
          eq(agentTasks.status, 'in_progress')
        )
      );

    return tasks;
  }

  /**
   * 获取Agent下达的所有任务
   */
  async getAgentTasks(agentId: string, options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    console.log('getAgentTasks called with:', { agentId, options });
    const db = getDatabase();
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;
    console.log('Using limit:', limit, 'offset:', offset);
    console.log('agentTasks table:', agentTasks);
    console.log('fromAgentId column:', agentTasks.fromAgentId);
    console.log('createdAt column:', agentTasks.createdAt);

    try {
      const tasks = await db
        .select()
        .from(agentTasks)
        .where(eq(agentTasks.fromAgentId, agentId))
        .orderBy(agentTasks.createdAt)
        .limit(limit)
        .offset(offset);

      console.log('Query result:', tasks);
      return tasks;
    } catch (error) {
      console.error('Query error:', error);
      throw error;
    }
  }

  /**
   * 更新任务状态为执行中
   */
  async startTask(taskId: string) {
    const db = getDatabase();
    const [task] = await db
      .update(agentTasks)
      .set({
        status: 'in_progress',
        updatedAt: new Date(),
      })
      .where(eq(agentTasks.taskId, taskId))
      .returning();

    return task;
  }

  /**
   * 完成任务并提交结果
   * 🔥 如果是 insurance-d 完成的文章任务，自动触发 Agent B 进行合规校验
   */
  async completeTask(taskId: string, result: string) {
    const db = getDatabase();
    const [task] = await db
      .update(agentTasks)
      .set({
        status: 'completed',
        result,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(agentTasks.taskId, taskId))
      .returning();

    // 🔥 检查是否需要触发 Agent B 合规校验（写作类 Agent）
    const _isWritingAgentTask = task && isWritingAgent(task.executor);
    if (_isWritingAgentTask && task.metadata?.taskType === 'article_creation') {
      console.log(`🔍 检测到 ${task.executor} 完成文章任务，准备触发 Agent B 合规校验`);
      await this.triggerComplianceCheck(task, result);
    }

    return task;
  }

  /**
   * 🔥 触发 Agent B 合规校验
   */
  private async triggerComplianceCheck(originalTask: any, result: string) {
    try {
      console.log('🚀 触发 Agent B 合规校验');

      // 解析文章内容
      let articleTitle = '';
      let articleContent = '';

      try {
        const resultData = JSON.parse(result);
        
        // 新信封格式：result.content + result.articleTitle
        if (resultData.result && typeof resultData.result === 'object' && resultData.result.content) {
          articleTitle = resultData.result.articleTitle || resultData.articleTitle || originalTask.taskName;
          articleContent = resultData.result.content;
        } else {
          // 旧格式兼容
          articleTitle = resultData.title || resultData.articleTitle || originalTask.taskName;
          articleContent = resultData.content || resultData.articleContent || result;
        }
      } catch {
        // 如果不是 JSON，直接使用 result
        articleTitle = originalTask.taskName;
        articleContent = result;
      }

      // 策略3：result_text 兜底（extractResultTextFromResultData 已处理，最可靠）
      if (!articleContent && originalTask.resultText) {
        articleContent = originalTask.resultText;
        articleTitle = articleTitle || originalTask.articleTitle || '';
      }

      console.log(`📄 文章标题: ${articleTitle}`);
      console.log(`📄 文章内容长度: ${articleContent.length} 字符`);

      // 生成合规校验提示词
      const prompt = generateComplianceCheckPrompt({
        articleTitle,
        articleContent,
        taskId: originalTask.taskId,
        originalCommand: originalTask.coreCommand,
        executorType: originalTask.executor, // 🔥 传递写作 Agent 类型
      });

      console.log('📋 生成合规校验提示词完成');

      // 调用 LLM 进行合规校验
      const llmResponse = await callLLM({
        agentId: 'B', // Agent B 执行合规校验
        messages: [
          {
            role: 'system',
            content: '你是架构师B（技术支撑），负责对保险文章进行合规性校验。你需要严格按照规定格式输出校验结果。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3, // 使用较低的 temperature，提高准确性
      });

      console.log('✅ LLM 合规校验完成');
      console.log(`📊 校验结果: ${llmResponse.substring(0, 200)}...`);

      // 解析校验结果
      const checkResult = JSON.parse(llmResponse);

      // 🔥 新增：生成简洁的自然语言摘要
      const formattedSummary = ComplianceResultFormatter.format(checkResult);
      console.log('📝 格式化摘要生成完成');

      // 🔥 创建 Agent B 的合规校验任务（记录）
      const complianceTaskId = `compliance-${originalTask.taskId}-${Date.now()}`;
      const now = new Date();

      await db.insert(agentTasks).values({
        taskId: complianceTaskId,
        taskName: `合规校验：${articleTitle}`,
        coreCommand: `对 ${originalTask.executor || 'insurance-d'} 完成的文章进行合规性校验`,
        executor: 'B',
        acceptanceCriteria: '完成合规性校验并返回详细的校验结果',
        taskType: 'compliance_check', // 🔥 合规校验任务类型
        splitStatus: 'completed',
        taskDurationStart: now,
        taskDurationEnd: now,
        totalDeliverables: '1份合规校验报告',
        taskPriority: 'high', // 🔥 高优先级
        taskStatus: 'completed', // 立即完成，因为已经在上面调用 LLM 了
        creator: 'TS', // 系统创建
        updater: 'B',
        fromAgentId: originalTask.executor || 'insurance-d',
        toAgentId: 'B',
        commandType: 'compliance_check',
        result: llmResponse, // 校验结果
        metadata: {
          ...generateComplianceTaskMetadata({
            originalTaskId: originalTask.taskId,
            articleTitle,
            articleContent,
          }),
          complianceResult: checkResult,
          isCompliant: checkResult.isCompliant,
          complianceScore: checkResult.score,
          originalTaskId: originalTask.taskId,
          // 🔥 新增：保存格式化后的摘要
          formattedSummary: formattedSummary,
        },
        createdAt: now,
        updatedAt: now,
        completedAt: now,
      });

      console.log(`✅ 合规校验任务已创建: ${complianceTaskId}`);
      console.log(`📊 合规评分: ${checkResult.score}`);
      console.log(`✅ 是否合规: ${checkResult.isCompliant ? '是' : '否'}`);

      // 🔥 如果合规评分低于 60 分，触发异常通知
      if (checkResult.score < 60) {
        console.warn(`⚠️ 文章合规评分过低: ${checkResult.score}，触发异常通知`);
        // 这里可以添加触发异常通知的逻辑
        // 例如：调用 agentNotifications 表插入通知
      }

      return complianceTaskId;
    } catch (error) {
      console.error('❌ 触发 Agent B 合规校验失败:', error);
      throw error;
    }
  }

  /**
   * 标记任务失败
   */
  async failTask(taskId: string, result: string) {
    const db = getDatabase();
    const [task] = await db
      .update(agentTasks)
      .set({
        status: 'failed',
        result,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(agentTasks.taskId, taskId))
      .returning();

    return task;
  }

  /**
   * 获取任务统计
   */
  async getTaskStats(agentId: string) {
    const db = getDatabase();
    const tasks = await db
      .select()
      .from(agentTasks)
      .where(eq(agentTasks.fromAgentId, agentId));

    const stats = {
      total: tasks.length,
      pending: 0,
      inProgress: 0,
      completed: 0,
      failed: 0,
    };

    tasks.forEach((task) => {
      if (task.status === 'pending') stats.pending++;
      else if (task.status === 'in_progress') stats.inProgress++;
      else if (task.status === 'completed') stats.completed++;
      else if (task.status === 'failed') stats.failed++;
    });

    return stats;
  }

  /**
   * 获取Agent的未完成任务（待执行+执行中）
   */
  async getUncompletedTasks(agentId: string) {
    const db = getDatabase();
    const tasks = await db
      .select()
      .from(agentTasks)
      .where(
        and(
          eq(agentTasks.toAgentId, agentId),
          eq(agentTasks.status, 'in_progress')
        )
      )
      .orderBy(desc(agentTasks.createdAt));

    return tasks;
  }
}

// 导出单例
export const agentTask = new AgentTaskService();

/**
 * 指令执行结果管理服务
 * 负责管理各 Agent 对指令的执行结果反馈
 */

import { eq, and, desc, gte, lte, lt, sql } from 'drizzle-orm';
import { getDatabase, schema } from '../db';
import {
  CreateCommandResultParams,
  UpdateCommandResultParams,
  QueryCommandResultsParams,
  CommandResultStats,
  ExecutionStatus,
} from '../types/command-result';
import { generateComplianceCheckPrompt, generateComplianceTaskMetadata } from '../agents/prompts/compliance-check';
import { callLLM } from '../agent-llm';
import { isWritingAgent } from '@/lib/agents/agent-registry';
import { createNotification } from './notification-service-v3';
import { checkDuplicateDailyTaskSimple, checkDuplicateTaskSimple } from './duplicate-detection';

export class CommandResultService {
  /**
   * 创建指令执行结果
   */
  async createResult(params: CreateCommandResultParams) {
    const now = new Date();
    const resultId = `result_${Date.now()}_${params.fromAgentId}`;

    // 🔥 使用带防重功能的方法创建 daily_task
    console.log(`🔍 [createResult] 准备创建 daily_task: taskId=${params.taskId}`);
    
    const result = await this.createDailyTaskWithDuplicateCheck({
      taskId: params.taskId,
      commandId: params.commandId || resultId,
      relatedTaskId: params.taskId,
      taskTitle: params.originalCommand?.substring(0, 100) || `任务 ${params.taskId}`,
      taskDescription: params.originalCommand || `指令执行结果`,
      executor: params.toAgentId || params.fromAgentId || 'unknown',
      fromAgentId: params.fromAgentId,
      toAgentId: params.toAgentId,
      originalCommand: params.originalCommand || `指令 ${params.taskId}`,
      executionStatus: params.executionStatus || 'in_progress',
      executionResult: params.executionResult,
      outputData: params.outputData || {},
      metrics: params.metrics || {},
      attachments: params.attachments || [],
      metadata: {
        resultId,
        source: 'command-result',
        createdAt: now.toISOString(),
      },
    });

    if (result.isDuplicate) {
      console.log(`⚠️ [createResult] 检测到重复任务，跳过创建: taskId=${params.taskId}`);
      // 返回已存在的任务信息（需要重新查询）
      const db = getDatabase();
      const [existingTask] = await db
        .select()
        .from(schema.dailyTask)
        .where(eq(schema.dailyTask.taskId, params.taskId))
        .limit(1);
      
      if (existingTask) {
        return existingTask;
      }
    }

    console.log(`✅ [createResult] 创建执行结果成功: taskId=${params.taskId}`);
    return result.data;
  }

  /**
   * 更新指令执行结果
   */
  async updateResult(params: UpdateCommandResultParams) {
    const db = getDatabase();

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (params.executionStatus !== undefined) {
      updateData.executionStatus = params.executionStatus;
    }

    if (params.executionResult !== undefined) {
      updateData.executionResult = params.executionResult;
    }

    if (params.outputData !== undefined) {
      updateData.outputData = params.outputData;
    }

    if (params.metrics !== undefined) {
      updateData.metrics = params.metrics;
    }

    if (params.attachments !== undefined) {
      updateData.attachments = params.attachments;
    }

    if (params.completedAt !== undefined) {
      // 如果是字符串，转换为 Date 对象
      updateData.completedAt = typeof params.completedAt === 'string'
        ? new Date(params.completedAt)
        : params.completedAt;
    } else if (params.executionStatus === 'completed' || params.executionStatus === 'failed') {
      // 如果状态变为完成或失败，自动设置完成时间
      updateData.completedAt = new Date();
    }

    const [result] = await db
      .update(schema.dailyTask)
      .set(updateData)
      .where(eq(schema.dailyTask.resultId, params.resultId))
      .returning();

    console.log(`✅ 更新执行结果: ${params.resultId}`);

    // 🔥 触发 Agent B 合规校验
    // 检查条件：
    // 1. 状态变为 completed
    // 2. 执行者是写作类 Agent
    // 3. 包含文章内容（通过 metadata.taskType 判断）
    const _isWritingAgentResult = isWritingAgent(result.toAgentId);
    if (
      params.executionStatus === 'completed' &&
      _isWritingAgentResult &&
      (result.metadata?.taskType === 'article_creation' || result.metadata?.taskType === 'article')
    ) {
      console.log(`🔍 检测到 ${result.toAgentId} 完成文章任务，准备触发 Agent B 合规校验`);
      await this.triggerComplianceCheck(result);
    }

    return result;
  }

  /**
   * 🔥 触发 Agent B 合规校验（在 commandResultService 中）
   */
  private async triggerComplianceCheck(originalResult: any) {
    const db = getDatabase();
    try {
      console.log('🚀 触发 Agent B 合规校验');

      // 解析文章内容（统一使用 ArticleOutputEnvelope 格式提取）
      let articleTitle = '';
      let articleContent = '';

      try {
        // 策略1：从 outputData 中提取（优先使用信封格式）
        if (originalResult.outputData && typeof originalResult.outputData === 'object') {
          const outputData = originalResult.outputData;
          
          // 新信封格式：outputData.result.content
          if (outputData.result && typeof outputData.result === 'object') {
            const envelope = outputData.result;
            // isCompleted=false 时 result 是 { error: "..." }，跳过
            if (envelope.error) {
              console.log('[ComplianceCheck] outputData.result 含 error 字段，跳过');
            } else if (typeof envelope.content === 'string' && envelope.content.trim().length > 0) {
              articleTitle = envelope.articleTitle || outputData.articleTitle || '';
              articleContent = envelope.content;
            }
          } else {
            // 旧格式兼容
            articleTitle = outputData.title || outputData.articleTitle || originalResult.taskName || originalResult.commandContent?.substring(0, 50);
            articleContent = outputData.content || outputData.articleContent || '';
          }
        }

        // 策略2：从 executionResult 中提取
        if (!articleContent && originalResult.executionResult) {
          try {
            const resultData = JSON.parse(originalResult.executionResult);
            
            // 新信封格式：result.content
            if (resultData.result && typeof resultData.result === 'object') {
              const envelope = resultData.result;
              // isCompleted=false 时跳过
              if (envelope.error) {
                console.log('[ComplianceCheck] executionResult.result 含 error 字段，跳过');
              } else if (typeof envelope.content === 'string' && envelope.content.trim().length > 0) {
                articleTitle = envelope.articleTitle || resultData.articleTitle || '';
                articleContent = envelope.content;
              }
            } else {
              // 旧格式兼容
              articleTitle = articleTitle || resultData.title || resultData.articleTitle;
              articleContent = resultData.content || resultData.articleContent || '';
            }
          } catch {
            // executionResult 不是 JSON，直接使用
            articleContent = originalResult.executionResult;
          }
        }

        // 策略3：从 result_text 字段直接获取（最可靠，已由 extractResultTextFromResultData 处理）
        if (!articleContent && originalResult.resultText) {
          articleContent = originalResult.resultText;
          articleTitle = articleTitle || originalResult.articleTitle || '';
        }
      } catch (error) {
        console.warn('解析文章内容时出错，使用默认值:', error);
        articleTitle = originalResult.commandContent?.substring(0, 50) || '未命名文章';
        articleContent = originalResult.executionResult || '';
      }

      if (!articleContent) {
        console.warn('⚠️ 无法提取文章内容，跳过合规校验');
        return;
      }

      console.log(`📄 文章标题: ${articleTitle}`);
      console.log(`📄 文章内容长度: ${articleContent.length} 字符`);

      // 生成合规校验提示词
      const prompt = generateComplianceCheckPrompt({
        articleTitle,
        articleContent,
        taskId: originalResult.resultId || originalResult.taskId || 'unknown',
        originalCommand: originalResult.originalCommand || originalResult.commandContent || '',
      });

      console.log('📋 生成合规校验提示词完成');

      // 调用 LLM 进行合规校验（使用新的 callLLM 函数）
      const llmResponse = await callLLM(
        'B', // Agent B 执行合规校验
        articleTitle + articleContent, // 上下文（用于检索相关记忆）
        '你是架构师B（技术支撑），负责对保险文章进行合规性校验。你需要严格按照规定格式输出校验结果。', // 系统 prompt
        prompt, // 用户 prompt
        {
          temperature: 0.3, // 使用较低的 temperature，提高准确性
          maxMemories: 3, // 加载 3 条相关记忆
          memoryTypes: ['knowledge', 'experience'], // 只加载知识和经验类型的记忆
        }
      );

      console.log('✅ LLM 合规校验完成');
      console.log(`📊 校验结果: ${llmResponse.substring(0, 200)}...`);

      // 解析校验结果
      const checkResult = JSON.parse(llmResponse);

      // 🔥 将校验结果保存到 dailyTask 的 metadata 中
      await db
        .update(schema.dailyTask)
        .set({
          metadata: {
            ...(originalResult.metadata || {}),
            complianceCheck: {
              checkedAt: new Date().toISOString(),
              checker: 'Agent B',
              isCompliant: checkResult.isCompliant,
              score: checkResult.score,
              summary: checkResult.summary,
              issues: checkResult.issues,
              recommendations: checkResult.recommendations,
              rawResponse: llmResponse,
            },
          },
          updatedAt: new Date(),
        })
        .where(eq(schema.dailyTask.resultId, originalResult.resultId));

      console.log(`✅ 合规校验结果已保存到 dailyTask`);
      console.log(`📊 合规评分: ${checkResult.score}`);
      console.log(`✅ 是否合规: ${checkResult.isCompliant ? '是' : '否'}`);

      // 🔥 如果合规评分低于 60 分，标记为需要人工介入
      if (checkResult.score < 60) {
        console.warn(`⚠️ 文章合规评分过低: ${checkResult.score}，标记为需要人工介入`);
        await db
          .update(schema.dailyTask)
          .set({
            requiresIntervention: true,
            updatedAt: new Date(),
          })
          .where(eq(schema.dailyTask.resultId, originalResult.resultId));
      }

      return checkResult;
    } catch (error) {
      console.error('❌ 触发 Agent B 合规校验失败:', error);
      // 不抛出错误，避免影响正常的结果提交流程
      return null;
    }
  }

  /**
   * 获取单个执行结果
   */
  async getResult(resultId: string) {
    const db = getDatabase();

    const [result] = await db
      .select()
      .from(schema.dailyTask)
      .where(eq(schema.dailyTask.resultId, resultId));

    return result;
  }

  /**
   * 查询执行结果列表
   */
  async getResults(params: QueryCommandResultsParams = {}) {
    const db = getDatabase();

    let query = db.select().from(schema.dailyTask);

    // 添加过滤条件
    const conditions = [];

    if (params.toAgentId) {
      conditions.push(eq(schema.dailyTask.toAgentId, params.toAgentId));
    }

    if (params.fromAgentId) {
      conditions.push(eq(schema.dailyTask.fromAgentId, params.fromAgentId));
    }

    if (params.taskId) {
      conditions.push(eq(schema.dailyTask.taskId, params.taskId));
    }

    if (params.executionStatus) {
      conditions.push(eq(schema.dailyTask.executionStatus, params.executionStatus));
    }

    if (params.startDate) {
      conditions.push(gte(schema.dailyTask.createdAt, params.startDate));
    }

    if (params.endDate) {
      conditions.push(lte(schema.dailyTask.createdAt, params.endDate));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // 排序（最新的在前面）
    query = query.orderBy(desc(schema.dailyTask.createdAt));

    // 分页
    if (params.limit) {
      query = query.limit(params.limit);
    }

    if (params.offset) {
      query = query.offset(params.offset);
    }

    const results = await query;
    return results;
  }

  /**
   * 获取统计信息
   */
  async getStats(params?: { toAgentId?: string; startDate?: Date; endDate?: Date }) {
    const db = getDatabase();

    // === 现有统计（执行结果） ===
    let query = db
      .select({
        total: sql<number>`count(*)`,
        pending: sql<number>`count(*) filter (where execution_status = 'pending')`,
        inProgress: sql<number>`count(*) filter (where execution_status = 'in_progress')`,
        completed: sql<number>`count(*) filter (where execution_status = 'completed')`,
        failed: sql<number>`count(*) filter (where execution_status = 'failed')`,
        blocked: sql<number>`count(*) filter (where execution_status = 'blocked')`,

        // === 新增：介入相关统计 ===
        requiresIntervention: sql<number>`count(*) filter (where requires_intervention = true)`,
        reportCount: sql<number>`coalesce(sum(report_count), 0)`,
      })
      .from(schema.dailyTask);

    // 添加过滤条件
    const conditions = [];

    if (params?.toAgentId) {
      conditions.push(eq(schema.dailyTask.toAgentId, params.toAgentId));
    }

    if (params?.startDate) {
      conditions.push(gte(schema.dailyTask.createdAt, params.startDate));
    }

    if (params?.endDate) {
      conditions.push(lte(schema.dailyTask.createdAt, params.endDate));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const [resultStats] = await query;

    // === 新增：上报报告统计 ===
    let reportQuery = db
      .select({
        pendingReports: sql<number>`count(*) filter (where status = 'pending')`,
        reviewedReports: sql<number>`count(*) filter (where status = 'reviewed')`,
        processingReports: sql<number>`count(*) filter (where status = 'processing')`,
        processedReports: sql<number>`count(*) filter (where status = 'processed')`,
        dismissedReports: sql<number>`count(*) filter (where status = 'dismissed')`,
      })
      .from(schema.agentReports);

    // 添加过滤条件（如果需要关联到特定的 toAgentId）
    if (params?.toAgentId) {
      reportQuery = reportQuery
        .innerJoin(
          schema.dailyTask,
          eq(schema.agentReports.commandResultId, schema.dailyTask.id)
        )
        .where(eq(schema.dailyTask.toAgentId, params.toAgentId));
    }

    const [reportStats] = await reportQuery;

    // === 新增：超时相关统计 ===
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 统计超时子任务数（>30分钟未更新的进行中子任务）
    const timeoutSubtasksResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.agentSubTasks)
      .where(
        and(
          eq(schema.agentSubTasks.status, 'in_progress'),
          lt(schema.agentSubTasks.updatedAt, thirtyMinutesAgo)
        )
      );

    const timeoutSubtasks = Number(timeoutSubtasksResult[0]?.count || 0);

    // 统计超长任务数（>1天未创建的进行中任务）
    const longRunningTasksResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.dailyTask);

    let longRunningQuery = longRunningTasksResult;

    // 应用过滤条件
    if (conditions.length > 0) {
      longRunningQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(schema.dailyTask)
        .where(
          and(
            eq(schema.dailyTask.executionStatus, 'in_progress'),
            lt(schema.dailyTask.createdAt, oneDayAgo),
            ...conditions
          )
        );
    } else {
      longRunningQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(schema.dailyTask)
        .where(
          and(
            eq(schema.dailyTask.executionStatus, 'in_progress'),
            lt(schema.dailyTask.createdAt, oneDayAgo)
          )
        );
    }

    const longRunningTasksResultFinal = await longRunningQuery;
    const longRunningTasks = Number(longRunningTasksResultFinal[0]?.count || 0);

    return {
      // === 现有字段 ===
      total: Number(resultStats.total),
      pending: Number(resultStats.pending),
      inProgress: Number(resultStats.inProgress),
      completed: Number(resultStats.completed),
      failed: Number(resultStats.failed),
      blocked: Number(resultStats.blocked),

      // === 新增：介入相关统计 ===
      requiresIntervention: Number(resultStats.requiresIntervention),
      reportCount: Number(resultStats.reportCount),

      // === 新增：上报报告统计 ===
      pendingReports: Number(reportStats.pendingReports),
      reviewedReports: Number(reportStats.reviewedReports),
      processingReports: Number(reportStats.processingReports),
      processedReports: Number(reportStats.processedReports),
      dismissedReports: Number(reportStats.dismissedReports),

      // === 新增：超时相关统计 ===
      timeoutSubtasks,
      longRunningTasks,

      // === 保留 ===
      byAgent: {} as Record<string, number>,
    };
  }

  /**
   * 删除执行结果
   */
  async deleteResult(resultId: string) {
    const db = getDatabase();

    const [result] = await db
      .delete(schema.dailyTask)
      .where(eq(schema.dailyTask.resultId, resultId))
      .returning();

    console.log(`🗑️  删除执行结果: ${resultId}`);
    return result;
  }

  /**
   * 批量创建执行结果
   */
  async createBatchResults(params: CreateCommandResultParams[]) {
    const db = getDatabase();

    const results = await db
      .insert(schema.dailyTask)
      .values(
        params.map((p) => ({
          resultId: `result_${Date.now()}_${p.fromAgentId}_${Math.random().toString(36).substr(2, 9)}`,
          taskId: p.taskId,
          commandId: p.commandId,
          fromAgentId: p.fromAgentId,
          toAgentId: p.toAgentId,
          originalCommand: p.originalCommand,
          executionStatus: p.executionStatus,
          executionResult: p.executionResult,
          outputData: p.outputData || {},
          metrics: p.metrics || {},
          attachments: p.attachments || [],
          createdAt: new Date(),
          updatedAt: new Date(),
        }))
      )
      .returning();

    console.log(`✅ 批量创建 ${results.length} 个执行结果`);
  }

  /**
   * 创建 daily_task 记录（带去重检查和弹框提示）
   * @param params 创建参数
   * @returns 创建结果，包含是否重复、重复任务信息等
   */
  async createDailyTaskWithDuplicateCheck(params: {
    taskId: string;
    commandId: string;
    relatedTaskId: string;
    taskTitle: string;
    taskDescription: string;
    executor: string;
    fromAgentId: string;
    toAgentId: string;
    originalCommand: string;
    executionStatus: string;
    executionDate?: string;
    executionDeadlineStart?: Date;
    executionDeadlineEnd?: Date;
    deliverables?: string;
    taskPriority?: string;
    executionResult?: string;
    outputData?: Record<string, any>;
    metrics?: Record<string, any>;
    attachments?: Array<{name: string, url: string, type: string}>;
    metadata?: Record<string, any>;
    commandPriority?: string;
    commandContent?: string;
    splitter?: string;
    entryUser?: string;
    // 🔥 新增：用户观点和素材
    userOpinion?: string | null;
    materialIds?: string[];
    // 🔥 Phase 6 多用户：工作空间归属
    workspaceId?: string;
  }): Promise<{
    success: boolean;
    isDuplicate: boolean;
    data?: any;
    duplicateTaskInfo?: {
      taskId: string;
      createdAt: Date;
      executor: string;
    };
  }> {
    const db = getDatabase();
    const now = new Date();

    // 🔥 第一步：业务层面主动检测（使用 duplicate-detection）
    console.log(`🔍 开始业务层面重复检测: ${params.taskId}`);
    
    try {
      const duplicateCheck = await checkDuplicateDailyTaskSimple({
        executor: params.executor,
        originalCommand: params.originalCommand,
        excludeTaskId: params.taskId,
        timeWindowDays: 7, // 7天时间窗口
      });

      if (duplicateCheck.isDuplicate) {
        console.log(`⚠️ 业务层面检测到重复任务: ${params.taskId}`);
        console.log(`📋 重复任务数量: ${duplicateCheck.duplicateTasks.length}`);

        // 取第一个重复任务作为示例
        const firstDuplicate = duplicateCheck.duplicateTasks[0];
        const duplicateInfo = firstDuplicate ? {
          taskId: firstDuplicate.taskId,
          createdAt: firstDuplicate.createdAt,
          executor: firstDuplicate.executor,
        } : undefined;

        // 创建重复通知给 Agent A
        await createNotification({
          agentId: 'A',
          type: 'duplicate_task_warning',
          title: `⚠️ 检测到重复任务: ${params.taskTitle}`,
          content: {
            fromAgentId: 'system',
            toAgentId: 'A',
            message: duplicateCheck.warningMessage || '检测到重复任务，已跳过创建',
            duplicateTask: duplicateInfo,
            duplicateTasks: duplicateCheck.duplicateTasks, // 所有重复任务
            newTask: {
              taskId: params.taskId,
              taskTitle: params.taskTitle,
              executor: params.executor,
            },
          },
          relatedTaskId: params.taskId,
          fromAgentId: 'system',
          priority: 'normal',
          metadata: {
            taskId: params.taskId,
            duplicateTaskId: duplicateInfo?.taskId,
            warningType: 'duplicate_task',
            detectionLevel: 'business', // 标记为业务层面检测
            splitPopupStatus: null, // 🔥 确保弹框显示
          },
        });

        // 查询已存在的完整任务信息
        let existingTask = null;
        if (firstDuplicate) {
          const [task] = await db
            .select()
            .from(schema.dailyTask)
            .where(eq(schema.dailyTask.taskId, firstDuplicate.taskId))
            .limit(1);
          existingTask = task;
        }

        console.log(`✅ 已创建重复任务通知（业务层面检测）: ${params.taskId}`);

        return {
          success: true,
          isDuplicate: true,
          duplicateTaskInfo: duplicateInfo,
          data: existingTask || firstDuplicate,
        };
      }

      console.log(`✅ 业务层面未检测到重复，继续插入`);
    } catch (detectionError) {
      console.warn(`⚠️ 业务层面重复检测失败，继续插入（兜底）:`, detectionError);
      // 检测失败不阻断，继续尝试插入
    }

    // 构建插入数据
    const insertData = {
      taskId: params.taskId,
      commandId: params.commandId,
      relatedTaskId: params.relatedTaskId,
      taskTitle: params.taskTitle,
      taskDescription: params.taskDescription,
      executor: params.executor,
      fromAgentId: params.fromAgentId,
      toAgentId: params.toAgentId,
      originalCommand: params.originalCommand,
      executionStatus: params.executionStatus,
      executionResult: params.executionResult,
      executionDate: params.executionDate || now.toISOString().split('T')[0],
      executionDeadlineStart: params.executionDeadlineStart || now,
      executionDeadlineEnd: params.executionDeadlineEnd || now,
      deliverables: params.deliverables || '0',
      taskPriority: params.taskPriority || 'normal',
      outputData: params.outputData || {},
      metrics: params.metrics || {},
      attachments: params.attachments || [],
      metadata: params.metadata || {},
      // 🔥 新增：用户观点和素材
      userOpinion: params.userOpinion || null,
      materialIds: params.materialIds || [],
      // 🔥 Phase 6 多用户：工作空间归属
      workspaceId: params.workspaceId || null,
      createdAt: now,
      updatedAt: now,
      // 必填字段默认值
      splitter: 'agent B',
      entryUser: 'TS',
      taskType: 'daily',
      dependencies: {},
      sortOrder: 0,
      completedSubTasks: 0,
      subTaskCount: 0,
      questionStatus: 'none',
      tsAwakeningCount: 0,
      awakeningCount: 0,
      reportCount: 0,
      requiresIntervention: false,
      dialogueRounds: 0,
      dialogueStatus: 'none',
    };

    try {
      // 尝试插入
      const [result] = await db
        .insert(schema.dailyTask)
        .values(insertData)
        .returning();

      console.log(`✅ 创建 daily_task 成功: ${params.taskId}`);
      return {
        success: true,
        isDuplicate: false,
        data: result,
      };
    } catch (error: any) {
      // 检查是否是唯一约束冲突
      const isUniqueViolation = 
        error.code === '23505' || // PostgreSQL unique violation
        error.message?.includes('unique constraint') ||
        error.message?.includes('already exists');

      if (isUniqueViolation) {
        console.log(`⚠️ 检测到重复任务: ${params.taskId}`);

        // 查询已存在的任务信息
        const existingTask = await db
          .select()
          .from(schema.dailyTask)
          .where(eq(schema.dailyTask.taskId, params.taskId))
          .limit(1);

        // 创建重复通知给 Agent A
        const duplicateInfo = existingTask[0] ? {
          taskId: existingTask[0].taskId,
          createdAt: existingTask[0].createdAt,
          executor: existingTask[0].executor,
        } : undefined;

        await createNotification({
          agentId: 'A',
          type: 'duplicate_task_warning',
          title: `⚠️ 检测到重复任务: ${params.taskTitle}`,
          content: {
            fromAgentId: 'system',
            toAgentId: 'A',
            message: '检测到重复任务，已跳过创建',
            duplicateTask: duplicateInfo,
            newTask: {
              taskId: params.taskId,
              taskTitle: params.taskTitle,
              executor: params.executor,
            },
          },
          relatedTaskId: params.taskId,
          fromAgentId: 'system',
          priority: 'normal',
          metadata: {
            taskId: params.taskId,
            duplicateTaskId: duplicateInfo?.taskId,
            warningType: 'duplicate_task',
            detectionLevel: 'database', // 标记为数据库层面检测
            splitPopupStatus: null, // 🔥 确保弹框显示
          },
        });

        console.log(`✅ 已创建重复任务通知: ${params.taskId}`);

        return {
          success: true,
          isDuplicate: true,
          duplicateTaskInfo,
          data: existingTask[0],
        };
      }

      // 其他错误，重新抛出
      console.error(`❌ 创建 daily_task 失败:`, error);
      throw error;
    }
  }

  /**
   * 获取待处理的执行结果（对于 Agent A）
   */
  async getPendingResults(toAgentId: string) {
    return this.getResults({
      toAgentId,
      executionStatus: 'pending',
      limit: 50,
    });
  }

  /**
   * 获取进行中的执行结果
   */
  async getInProgressResults(toAgentId: string) {
    return this.getResults({
      toAgentId,
      executionStatus: 'in_progress',
      limit: 50,
    });
  }
}

/**
 * 🔥 创建 agent_tasks 表任务（带防重功能）
 * 公共方法，用于统一处理 agent_tasks 表插入，包含两层去重：
 * 1. 业务层面主动检测：插入前先调用 checkDuplicateTaskSimple
 * 2. 数据库层面被动防御：捕获唯一约束异常作为兜底
 * 
 * 重复时会创建通知给 Agent A 弹框提示
 */
export async function createAgentTaskWithDuplicateCheck(params: {
  taskId: string;
  taskName?: string;
  coreCommand: string;
  executor: string;
  fromAgentId: string;
  toAgentId: string;
  acceptanceCriteria?: string;
  taskType?: string;
  splitStatus?: string;
  taskDurationStart?: Date;
  taskDurationEnd?: Date;
  totalDeliverables?: string;
  taskPriority?: string;
  taskStatus?: string;
  creator?: string;
  updater?: string;
  metadata?: Record<string, any>;
  timeWindowDays?: number;
  // 🔥 新增：用户观点和素材
  userOpinion?: string | null;
  materialIds?: string[];
  // 🔥 Phase 6 多用户：工作空间归属
  workspaceId?: string;
}) {
  const db = getDatabase();
  const now = new Date();

  console.log(`🔍 [agentTasks 防重] 开始插入任务: ${params.taskId}`);

  // ========== 第一层：业务层面主动检测 ==========
  try {
    const duplicateCheck = await checkDuplicateTaskSimple({
      executor: params.executor,
      coreCommand: params.coreCommand,
      excludeTaskId: params.taskId,
      timeWindowDays: params.timeWindowDays || 7,
    });

    if (duplicateCheck.isDuplicate) {
      console.log(`⚠️ [agentTasks 防重] 业务层面检测到重复: ${params.taskId}`);

      // 查询已存在的任务信息
      const duplicateInfo = duplicateCheck.duplicateTasks?.[0] ? {
        taskId: duplicateCheck.duplicateTasks[0].taskId,
        createdAt: duplicateCheck.duplicateTasks[0].createdAt,
        executor: duplicateCheck.duplicateTasks[0].executor,
      } : undefined;

      // 创建重复通知给 Agent A
      await createNotification({
        agentId: 'A',
        type: 'duplicate_task_warning',
        title: `⚠️ 检测到重复任务: ${params.taskName || params.taskId}`,
        content: {
          fromAgentId: 'system',
          toAgentId: 'A',
          message: duplicateCheck.warningMessage || '检测到重复任务，已跳过创建',
          duplicateTask: duplicateInfo,
          newTask: {
            taskId: params.taskId,
            taskName: params.taskName || params.taskId,
            executor: params.executor,
          },
        },
        relatedTaskId: params.taskId,
        fromAgentId: 'system',
        priority: 'normal',
        metadata: {
          taskId: params.taskId,
          duplicateTaskId: duplicateInfo?.taskId,
          warningType: 'duplicate_task',
          detectionLevel: 'business', // 标记为业务层面检测
          splitPopupStatus: null, // 🔥 确保弹框显示
        },
      });

      console.log(`✅ [agentTasks 防重] 已创建重复任务通知（业务层面检测）: ${params.taskId}`);

      // 查询已存在的完整任务信息
      let existingTask = null;
      if (duplicateCheck.duplicateTasks?.[0]) {
        const tasks = await db
          .select()
          .from(schema.agentTasks)
          .where(eq(schema.agentTasks.taskId, duplicateCheck.duplicateTasks[0].taskId))
          .limit(1);
        existingTask = tasks?.[0] || null;
      }

      return {
        success: true,
        isDuplicate: true,
        duplicateTaskInfo: duplicateInfo,
        duplicateTasks: duplicateCheck.duplicateTasks, // 🔥 新增：供 API 路由使用
        data: existingTask || duplicateCheck.duplicateTasks?.[0],
      };
    }

    console.log(`✅ [agentTasks 防重] 业务层面未检测到重复，继续插入`);
  } catch (detectionError) {
    console.warn(`⚠️ [agentTasks 防重] 业务层面重复检测失败，继续插入（兜底）:`, detectionError);
    // 检测失败不阻断，继续尝试插入
  }

  // ========== 第二层：数据库层面被动防御 ==========
  const insertData = {
    taskId: params.taskId,
    taskName: params.taskName || `任务 ${params.taskId}`,
    coreCommand: params.coreCommand,
    executor: params.executor,
    acceptanceCriteria: params.acceptanceCriteria || '待补充',
    taskType: params.taskType || 'master',
    splitStatus: params.splitStatus || 'pending',
    taskDurationStart: params.taskDurationStart || now,
    taskDurationEnd: params.taskDurationEnd || now,
    totalDeliverables: params.totalDeliverables || '0',
    taskPriority: params.taskPriority || 'normal',
    taskStatus: params.taskStatus || 'pending',
    creator: params.creator || params.fromAgentId,
    updater: params.updater || params.fromAgentId,
    fromAgentId: params.fromAgentId,
    toAgentId: params.toAgentId,
    commandType: 'instruction',
    metadata: params.metadata || {},
    // 🔥 新增：用户观点和素材
    userOpinion: params.userOpinion || null,
    materialIds: params.materialIds || [],
    // 🔥 Phase 6 多用户：工作空间归属
    workspaceId: params.workspaceId || null,
    createdAt: now,
    updatedAt: now,
  };

  try {
    // 尝试插入
    const [result] = await db
      .insert(schema.agentTasks)
      .values(insertData)
      .returning();

    console.log(`✅ [agentTasks 防重] 创建任务成功: ${params.taskId}`);
    return {
      success: true,
      isDuplicate: false,
      data: result,
    };
  } catch (error: any) {
    // 检查是否是唯一约束冲突
    const isUniqueViolation = 
      error.code === '23505' || // PostgreSQL unique violation
      error.message?.includes('unique constraint') ||
      error.message?.includes('already exists');

    if (isUniqueViolation) {
      console.log(`⚠️ [agentTasks 防重] 数据库层面检测到重复: ${params.taskId}`);

      // 查询已存在的任务信息
      const existingTask = await db
        .select()
        .from(schema.agentTasks)
        .where(eq(schema.agentTasks.taskId, params.taskId))
        .limit(1);

      const duplicateInfo = existingTask[0] ? {
        taskId: existingTask[0].taskId,
        createdAt: existingTask[0].createdAt,
        executor: existingTask[0].executor,
      } : undefined;

      // 创建重复通知给 Agent A
      await createNotification({
        agentId: 'A',
        type: 'duplicate_task_warning',
        title: `⚠️ 检测到重复任务: ${params.taskName || params.taskId}`,
        content: {
          fromAgentId: 'system',
          toAgentId: 'A',
          message: '检测到重复任务，已跳过创建',
          duplicateTask: duplicateInfo,
          newTask: {
            taskId: params.taskId,
            taskName: params.taskName || params.taskId,
            executor: params.executor,
          },
        },
        relatedTaskId: params.taskId,
        fromAgentId: 'system',
        priority: 'normal',
        metadata: {
          taskId: params.taskId,
          duplicateTaskId: duplicateInfo?.taskId,
          warningType: 'duplicate_task',
          detectionLevel: 'database', // 标记为数据库层面检测
          splitPopupStatus: null, // 🔥 确保弹框显示
        },
      });

      console.log(`✅ [agentTasks 防重] 已创建重复任务通知: ${params.taskId}`);

      return {
        success: true,
        isDuplicate: true,
        duplicateTaskInfo: duplicateInfo,
        duplicateTasks: existingTask[0] ? [existingTask[0]] : [], // 🔥 新增：供 API 路由使用
        data: existingTask[0],
      };
    }

    // 其他错误，重新抛出
    console.error(`❌ [agentTasks 防重] 创建任务失败:`, error);
    throw error;
  }
}

// 创建单例实例
export const commandResultService = new CommandResultService();

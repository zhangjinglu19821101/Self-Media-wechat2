import { db } from '@/lib/db';
import { agentTasks, dailyTask } from '@/lib/db/schema';
import { eq, and, gt } from 'drizzle-orm';

/**
 * 计算两个字符串的相似度（基于Levenshtein编辑距离）
 * @param str1 字符串1
 * @param str2 字符串2
 * @returns 相似度 0-1，1表示完全相同
 */
function calculateSimilarity(str1: string, str2: string): number {
  // 空字符串处理
  if (!str1 || !str2) return 0;
  
  // 归一化：转小写、去除多余空白
  const s1 = str1.toLowerCase().replace(/\s+/g, ' ').trim();
  const s2 = str2.toLowerCase().replace(/\s+/g, ' ').trim();
  
  // 完全相同
  if (s1 === s2) return 1;
  
  // 计算Levenshtein编辑距离
  const m = s1.length;
  const n = s2.length;
  
  // 创建距离矩阵
  const dp: number[][] = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));
  
  // 初始化第一行和第一列
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  // 填充距离矩阵
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // 删除
        dp[i][j - 1] + 1,      // 插入
        dp[i - 1][j - 1] + cost // 替换
      );
    }
  }
  
  // 计算相似度：1 - (编辑距离 / 最大长度)
  const maxLength = Math.max(m, n);
  const distance = dp[m][n];
  const similarity = 1 - (distance / maxLength);
  
  return Math.max(0, Math.min(1, similarity));
}

/**
 * 指令重复检测服务
 * 提供简单的重复检测功能（无需向量库）
 */

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateTasks: DuplicateTask[];
  warningMessage?: string;
}

export interface DuplicateTask {
  taskId: string;
  taskName: string;
  coreCommand: string;
  executor: string;
  taskDurationEnd: Date;
  totalDeliverables: string;
  createdAt: Date;
  taskStatus: string;
  similarity: number; // 相似度（简单计算）
}

/**
 * 检测重复任务（简化版）
 *
 * 判断规则：
 * 1. 执行主体相同（executor）
 * 2. 指令内容完全匹配（coreCommand）
 * 3. 时间窗口：最近 7 天内
 * 4. 任务状态不是 'failed'（失败任务不算重复）
 */
export async function checkDuplicateTaskSimple(params: {
  executor: string;
  coreCommand: string;
  excludeTaskId?: string; // 排除当前任务（更新场景）
  timeWindowDays?: number; // 时间窗口（天），默认 7 天
}): Promise<DuplicateCheckResult> {
  const { executor, coreCommand, excludeTaskId, timeWindowDays = 7 } = params;

  // 计算时间窗口
  const timeWindowMs = timeWindowDays * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(Date.now() - timeWindowMs);

  // 查询相似任务（先不匹配内容，在内存中做模糊匹配）
  console.log(`🔍 [agentTasks 防重] 查询参数:`, { executor, coreCommand, cutoffDate });
  
  let query = db
    .select()
    .from(agentTasks)
    .where(
      and(
        eq(agentTasks.executor, executor),
        gt(agentTasks.createdAt, cutoffDate) // 用 created_at 做时间窗口
      )
    );

  const tasks = await query;
  console.log(`🔍 [agentTasks 防重] 查询到 ${tasks.length} 个任务`);

  // 在内存中做模糊匹配
  const duplicateTasks: DuplicateTask[] = tasks
    .filter(task => {
      // 排除失败任务
      if (task.taskStatus === 'failed') return false;
      // 排除当前任务
      if (excludeTaskId && task.taskId === excludeTaskId) return false;
      // 内容相似度匹配（70%以上相似度）
      const taskCoreCommand = task.coreCommand || '';
      const similarity = calculateSimilarity(taskCoreCommand, coreCommand);
      return similarity >= 0.7; // 🔥 相似度 ≥ 70% 即认为重复
    })
    .map(task => {
      const similarity = calculateSimilarity(task.coreCommand || '', coreCommand);
      return {
        taskId: task.taskId,
        taskName: task.taskName,
        coreCommand: task.coreCommand,
        executor: task.executor,
        taskDurationEnd: task.taskDurationEnd,
        totalDeliverables: task.totalDeliverables,
        createdAt: task.createdAt,
        taskStatus: task.taskStatus,
        similarity: similarity, // 🔥 真正的相似度值
      };
    });

  const isDuplicate = duplicateTasks.length > 0;

  // 生成警告消息
  let warningMessage: string | undefined;
  if (isDuplicate) {
    const count = duplicateTasks.length;
    const taskNames = duplicateTasks.map(t => t.taskName).join('、');
    warningMessage = `检测到 ${count} 个相似任务：${taskNames}。请确认是否需要重复创建。`;
  }

  return {
    isDuplicate,
    duplicateTasks,
    warningMessage,
  };
}

/**
 * 检测重复任务（针对 dailyTask 表）
 *
 * 判断规则：
 * 1. 执行主体相同（executor）
 * 2. 指令内容完全匹配（originalCommand / taskDescription）
 * 3. 时间窗口：最近 7 天内
 * 4. 任务状态不是 'failed'（失败任务不算重复）
 */
export async function checkDuplicateDailyTaskSimple(params: {
  executor: string;
  originalCommand: string;
  excludeTaskId?: string; // 排除当前任务（更新场景）
  timeWindowDays?: number; // 时间窗口（天），默认 7 天
}): Promise<{
  isDuplicate: boolean;
  duplicateTasks: Array<{
    taskId: string;
    taskTitle: string;
    originalCommand: string;
    executor: string;
    createdAt: Date;
    executionStatus: string;
    similarity: number;
  }>;
  warningMessage?: string;
}> {
  const { executor, originalCommand, excludeTaskId, timeWindowDays = 7 } = params;

  // 计算时间窗口
  const timeWindowMs = timeWindowDays * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(Date.now() - timeWindowMs);

  // 查询相似任务（dailyTask 表）
  let query = db
    .select()
    .from(dailyTask)
    .where(
      and(
        eq(dailyTask.executor, executor),
        gt(dailyTask.createdAt, cutoffDate) // 时间窗口内
      )
    );

  const tasks = await query;

  // 在内存中过滤内容匹配的任务
  const duplicateTasks = tasks
    .filter(task => {
      // 排除失败任务
      if (task.executionStatus === 'failed') return false;
      // 排除当前任务
      if (excludeTaskId && (task.taskId === excludeTaskId || task.id === excludeTaskId)) return false;
      // 内容相似度匹配（70%以上相似度）
      const taskContent = task.originalCommand || task.taskDescription || '';
      const similarity = calculateSimilarity(taskContent, originalCommand);
      return similarity >= 0.7; // 🔥 相似度 ≥ 70% 即认为重复
    })
    .map(task => {
      const taskContent = task.originalCommand || task.taskDescription || '';
      const similarity = calculateSimilarity(taskContent, originalCommand);
      return {
        taskId: task.taskId || task.id,
        taskTitle: task.taskTitle || task.taskName || '',
        originalCommand: task.originalCommand || task.taskDescription || '',
        executor: task.executor,
        createdAt: task.createdAt,
        executionStatus: task.executionStatus,
        similarity: similarity, // 🔥 真正的相似度值
      };
    });

  const isDuplicate = duplicateTasks.length > 0;

  // 生成警告消息
  let warningMessage: string | undefined;
  if (isDuplicate) {
    const count = duplicateTasks.length;
    const taskNames = duplicateTasks.map(t => t.taskTitle || t.taskId).join('、');
    warningMessage = `检测到 ${count} 个相似任务：${taskNames}。请确认是否需要重复创建。`;
  }

  return {
    isDuplicate,
    duplicateTasks,
    warningMessage,
  };
}

/**
 * 检测重复任务（模糊匹配版）
 *
 * 判断规则：
 * 1. 执行主体相同（executor）
 * 2. 指令内容相似（相似度 ≥ 0.8）
 * 3. 时间窗口：最近 7 天内
 * 4. 任务状态不是 'failed'
 */
export async function checkDuplicateTaskFuzzy(params: {
  executor: string;
  coreCommand: string;
  excludeTaskId?: string;
  timeWindowDays?: number;
  similarityThreshold?: number; // 相似度阈值，默认 0.8
}): Promise<DuplicateCheckResult> {
  const {
    executor,
    coreCommand,
    excludeTaskId,
    timeWindowDays = 7,
    similarityThreshold = 0.8
  } = params;

  // 计算时间窗口
  const timeWindowMs = timeWindowDays * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(Date.now() - timeWindowMs);

  // 查询所有同执行主体的任务（时间窗口内）
  let query = db
    .select()
    .from(agentTasks)
    .where(
      and(
        eq(agentTasks.executor, executor),
        gt(agentTasks.taskDurationEnd, cutoffDate)
      )
    );

  const tasks = await query;

  // 计算相似度并过滤
  const duplicateTasks: DuplicateTask[] = tasks
    .filter(task => task.taskStatus !== 'failed' && task.taskId !== excludeTaskId)
    .map(task => ({
      taskId: task.taskId,
      taskName: task.taskName,
      coreCommand: task.coreCommand,
      executor: task.executor,
      taskDurationEnd: task.taskDurationEnd,
      totalDeliverables: task.totalDeliverables,
      createdAt: task.createdAt,
      taskStatus: task.taskStatus,
      similarity: calculateTextSimilarity(coreCommand, task.coreCommand),
    }))
    .filter(result => result.similarity >= similarityThreshold);

  const isDuplicate = duplicateTasks.length > 0;

  // 生成警告消息
  let warningMessage: string | undefined;
  if (isDuplicate) {
    const count = duplicateTasks.length;
    const taskNames = duplicateTasks.map(t => `${t.taskName} (相似度: ${(t.similarity * 100).toFixed(0)}%)`).join('、');
    warningMessage = `检测到 ${count} 个相似任务（相似度 ≥ ${(similarityThreshold * 100).toFixed(0)}%）：${taskNames}。请确认是否需要重复创建。`;
  }

  return {
    isDuplicate,
    duplicateTasks,
    warningMessage,
  };
}

/**
 * 计算文本相似度（Jaccard 相似度）
 * 简单实现，不考虑词序和语义
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  // 移除标点和空格，转小写
  const normalize = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]/g, ' ') // 保留中文字符
      .split(/\s+/)
      .filter(word => word.length > 0);
  };

  const set1 = new Set(normalize(text1));
  const set2 = new Set(normalize(text2));

  // 计算交集和并集
  const intersection = new Set([...set1].filter(word => set2.has(word)));
  const union = new Set([...set1, ...set2]);

  // Jaccard 相似度 = |交集| / |并集|
  const similarity = union.size > 0 ? intersection.size / union.size : 0;

  return similarity;
}

/**
 * 检测 dailyTask 重复
 *
 * 判断规则：
 * 1. 执行主体相同（executor）
 * 2. 指令内容完全匹配（commandContent）
 * 3. 时间窗口：最近 7 天内
 */
export async function checkDuplicateCommandResult(params: {
  executor: string;
  commandContent: string;
  excludeCommandId?: string;
  timeWindowDays?: number;
}): Promise<DuplicateCheckResult> {
  const { executor, commandContent, excludeCommandId, timeWindowDays = 7 } = params;

  const { dailyTask } = await import('@/lib/db/schema');
  const timeWindowMs = timeWindowDays * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(Date.now() - timeWindowMs);

  let query = db
    .select()
    .from(dailyTask)
    .where(
      and(
        eq(dailyTask.executor, executor),
        eq(dailyTask.commandContent, commandContent),
        gt(dailyTask.executionDeadlineEnd, cutoffDate)
      )
    );

  const tasks = await query;

  const duplicateTasks: DuplicateTask[] = tasks
    .filter(task => task.commandId !== excludeCommandId)
    .map(task => ({
      taskId: task.commandId,
      taskName: task.taskName || task.commandContent,
      coreCommand: task.commandContent,
      executor: task.executor,
      taskDurationEnd: task.executionDeadlineEnd,
      totalDeliverables: task.deliverables,
      createdAt: task.createdAt,
      taskStatus: task.executionStatus,
      similarity: 1.0,
    }));

  const isDuplicate = duplicateTasks.length > 0;

  let warningMessage: string | undefined;
  if (isDuplicate) {
    const count = duplicateTasks.length;
    warningMessage = `检测到 ${count} 个重复指令。请确认是否需要重复创建。`;
  }

  return {
    isDuplicate,
    duplicateTasks,
    warningMessage,
  };
}

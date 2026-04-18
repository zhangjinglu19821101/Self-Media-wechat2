/**
 * 任务状态检测器
 */

import { db } from '@/lib/db';
import { dailyTask, agentSubTasks } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * 检查任务是否卡在某个子任务超过 1 小时
 * @param task 任务信息
 * @returns 是否卡住
 */
export async function isTaskStuck(task: any): Promise<boolean> {
  // 条件 1：任务正在执行
  if (task.executionStatus !== 'in_progress') {
    return false;
  }
  
  // 条件 2：有子任务
  if (!task.subTaskCount || task.subTaskCount === 0) {
    return false;
  }
  
  // 条件 3：当前正在执行的子任务
  const currentSubTask = await db
    .select()
    .from(agentSubTasks)
    .where(
      and(
        eq(agentSubTasks.commandResultId, task.id),
        eq(agentSubTasks.status, 'in_progress')
      )
    )
    .then(rows => rows[0]);
  
  if (!currentSubTask) {
    return false;
  }
  
  // 条件 4：子任务开始时间超过 1 小时
  if (!currentSubTask.startedAt) {
    return false;
  }
  
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const startedAt = new Date(currentSubTask.startedAt);
  
  if (startedAt < oneHourAgo) {
    console.log(`⚠️ 任务 ${task.id} 卡住了，子任务 ${currentSubTask.taskTitle} 已运行超过 1 小时`);
    return true;
  }
  
  return false;
}

/**
 * 检查 executor 回复是否有问题
 * @param agentId Agent ID
 * @param response 回复内容
 * @returns 是否有问题
 */
export async function checkExecutorResponse(
  agentId: string,
  response: string
): Promise<{ hasProblem: boolean; problem?: string }> {
  // 方法 1：通过关键字检测
  const problemKeywords = ['有问题', '无法执行', '缺少', '不知道', '不确定', '不清楚'];
  
  for (const keyword of problemKeywords) {
    if (response.includes(keyword)) {
      return { hasProblem: true, problem: response };
    }
  }
  
  // 方法 2：通过 LLM 判断（如果关键字检测不到）
  // TODO: 集成 LLM 调用
  
  return { hasProblem: false };
}

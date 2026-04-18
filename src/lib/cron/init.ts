/**
 * 启动定时任务
 * 在应用启动时调用，启动所有定时任务
 */

import { startAllCronJobs } from '@/lib/cron';

/**
 * 初始化定时任务
 */
export function initializeScheduledTasks() {
  console.log('[Init] 初始化定时任务...');
  startAllCronJobs();
  console.log('[Init] 定时任务初始化完成');
}

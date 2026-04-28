/**
 * 定时任务索引文件
 * 导出所有定时任务
 */

// 导出调度器
export {
  startCronJob,
  stopCronJob,
  startAllCronJobs,
  stopAllCronJobs,
  triggerCronJob,
  getCronJobsStatus,
  CRON_JOBS,
} from './scheduler';

/**
 * 手动触发执行 in_progress 子任务
 * 连接层函数：定时任务 → SubtaskExecutionEngine
 * 
 * 🔒 并发控制：引擎内部使用组级并行锁，不同 commandResultId 的组可同时执行
 * 每次调用都会检查是否有新的可执行组，不会因为已有组在执行而跳过
 */
export async function manuallyExecuteInProgressSubtasks() {
  const { SubtaskExecutionEngine } = await import('@/lib/services/subtask-execution-engine');
  
  const status = SubtaskExecutionEngine.getExecutionStatus();
  if (status.executingGroups >= status.maxParallelGroups) {
    console.log('⏭️ [并发控制] 已达最大并行组数，跳过本次执行:', {
      executingGroups: status.executingGroups,
      maxParallelGroups: status.maxParallelGroups,
    });
    return;
  }
  
  console.log('🔔 [手动触发] 开始执行 in_progress 子任务...', {
    currentExecutingGroups: status.executingGroups,
    maxParallelGroups: status.maxParallelGroups,
  });
  
  const engine = new SubtaskExecutionEngine();
  await engine.execute();
  
  console.log('✅ [手动触发] in_progress 子任务执行完成');
}

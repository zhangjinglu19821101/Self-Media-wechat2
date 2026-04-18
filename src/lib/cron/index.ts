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
 * 🔒 并发控制：委托给引擎的进程级锁（单一锁机制，避免双重锁竞态）
 */
export async function manuallyExecuteInProgressSubtasks() {
  // 🔒 委托查询引擎的锁状态（单一权威来源）
  const { SubtaskExecutionEngine } = await import('@/lib/services/subtask-execution-engine');
  
  if (SubtaskExecutionEngine.isCurrentlyExecuting()) {
    const status = SubtaskExecutionEngine.getExecutionStatus();
    console.log('⏭️ [并发控制] 引擎已在运行中，跳过本次执行:', {
      startTime: status.startTime?.toISOString(),
      runningDurationMs: status.runningDurationMs,
    });
    return;
  }
  
  console.log('🔔 [手动触发] 开始执行 in_progress 子任务...');
  
  const engine = new SubtaskExecutionEngine();
  await engine.execute();
  
  console.log('✅ [手动触发] in_progress 子任务执行完成');
}

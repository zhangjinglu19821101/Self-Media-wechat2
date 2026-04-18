/**
 * 定时任务调度器
 * 负责启动和管理所有定时任务
 */

import cron from 'node-cron';

/**
 * 🔴🔴🔴 【关键修复】使用全局变量存储定时任务状态
 * 防止 Next.js 热更新导致定时任务重复注册
 * 全局变量在模块热更新后仍然存在
 */
declare global {
  // eslint-disable-next-line no-var
  var __activeCronTasks: Map<string, any> | undefined;
  // eslint-disable-next-line no-var
  var __cronEndpointLocks: Map<string, boolean> | undefined;
  // eslint-disable-next-line no-var
  var __cronSchedulerInitialized: boolean | undefined; // 🔴 新增：防止重复初始化
}

// 初始化全局变量（只在首次初始化）
if (typeof global.__activeCronTasks === 'undefined') {
  global.__activeCronTasks = new Map<string, any>();
}
if (typeof global.__cronEndpointLocks === 'undefined') {
  global.__cronEndpointLocks = new Map<string, boolean>();
}
// 🔴 初始化标记（只在首次初始化）
if (typeof global.__cronSchedulerInitialized === 'undefined') {
  global.__cronSchedulerInitialized = false;
}

/**
 * 内存锁：防止定时任务重叠执行
 */
const endpointLocks = global.__cronEndpointLocks;

/**
 * 定时任务配置
 */
export const CRON_JOBS = {
  // 每 2 分钟执行 in_progress 子任务（使用新的 SubtaskExecutionEngine）
  EXECUTE_IN_PROGRESS_SUBTASKS: {
    name: 'execute-in-progress-subtasks',
    schedule: '*/2 * * * *', // 每 2 分钟执行一次（符合设计文档）
    endpoint: '/api/cron/execute-in-progress-subtasks',
    description: '执行 in_progress 状态的子任务',
  },
  // 每天 0 点 1 分监控超时任务
  MONITOR_SUBTASKS_TIMEOUT: {
    name: 'monitor-subtasks-timeout',
    schedule: '1 0 * * *', // 每天 0 点 1 分执行一次
    endpoint: '/api/cron/monitor-subtasks-timeout',
    description: '监控超时任务并触发反馈流程',
  },
  // 每天 0 点 2 分上报未解决问题
  ESCALATE_UNRESOLVED_ISSUES: {
    name: 'escalate-unresolved-issues',
    schedule: '2 0 * * *', // 每天 0 点 2 分执行一次
    endpoint: '/api/cron/escalate-unresolved-issues',
    description: '上报未解决的问题给 Agent A',
  },
};

/**
 * 存储已启动的定时任务
 */
const activeTasks = global.__activeCronTasks;

/**
 * 调用执行函数（直接调用，避免 Next.js fetch 导致的多次请求问题）
 * 
 * ⚠️ 在 Next.js 开发模式下，使用 fetch('http://localhost:5000/...') 会触发 webpack 编译，
 *    导致同一个请求被处理多次。本函数直接调用执行逻辑，避免这个问题。
 */
async function callEndpoint(endpoint: string): Promise<void> {
  // 1. 检查锁：如果该端点正在执行中，跳过本次调用
  if (endpointLocks.get(endpoint)) {
    console.log(`⏭️  定时任务跳过 [${endpoint}]: 前一次执行尚未完成`);
    return;
  }

  // 2. 加锁：标记该端点开始执行
  endpointLocks.set(endpoint, true);
  console.log(`🔒 定时任务开始执行 [${endpoint}]`);

  try {
    // 🔴 根据端点直接调用对应的执行函数
    // 这样可以避免 Next.js fetch 导致的多次请求问题
    if (endpoint === '/api/cron/execute-in-progress-subtasks') {
      // 动态导入避免循环依赖
      const { manuallyExecuteInProgressSubtasks } = await import('@/lib/cron');
      await manuallyExecuteInProgressSubtasks();
      console.log(`✅ 定时任务执行成功 [${endpoint}]`);
    } else {
      // 其他端点暂时使用 HTTP fetch（这些端点使用频率较低）
      console.log(`⚠️ 端点 [${endpoint}] 暂不支持直接调用，使用 HTTP fetch`);
      const response = await fetch(`http://localhost:5000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const error = await response.text();
        console.error(`❌ 定时任务调用失败 [${endpoint}]: ${error}`);
      } else {
        console.log(`✅ 定时任务执行成功 [${endpoint}]`);
      }
    }
  } catch (error) {
    console.error(`❌ 定时任务调用异常 [${endpoint}]:`, error);
  } finally {
    // 3. 释放锁：无论成功失败，都释放锁
    endpointLocks.set(endpoint, false);
    console.log(`🔓 定时任务执行结束 [${endpoint}]`);
  }
}

/**
 * 启动单个定时任务
 */
export function startCronJob(jobKey: keyof typeof CRON_JOBS): boolean {
  const job = CRON_JOBS[jobKey];

  if (activeTasks.has(jobKey)) {
    console.log(`⚠️ 定时任务 [${job.name}] 已经启动，跳过`);
    return false;
  }

  try {
    const task = cron.schedule(
      job.schedule,
      () => {
        console.log(`🔄 执行定时任务: ${job.name} (${job.schedule})`);
        callEndpoint(job.endpoint);
      },
      {
        timezone: 'Asia/Shanghai',
      }
    );

    task.start();
    activeTasks.set(jobKey, task);

    console.log(`✅ 定时任务已启动: ${job.name}`);
    console.log(`   - 调度: ${job.schedule}`);
    console.log(`   - 端点: ${job.endpoint}`);
    console.log(`   - 描述: ${job.description}`);

    return true;
  } catch (error) {
    console.error(`❌ 定时任务启动失败 [${job.name}]:`, error);
    return false;
  }
}

/**
 * 停止单个定时任务
 */
export function stopCronJob(jobKey: keyof typeof CRON_JOBS): boolean {
  const task = activeTasks.get(jobKey);

  if (!task) {
    console.log(`⚠️ 定时任务 [${jobKey}] 未运行，无需停止`);
    return false;
  }

  task.stop();
  activeTasks.delete(jobKey);

  console.log(`✅ 定时任务已停止: ${CRON_JOBS[jobKey].name}`);

  return true;
}

/**
 * 启动所有定时任务
 */
export function startAllCronJobs(): void {
  // 🔴🔴🔴 【关键修复】检查是否已经初始化过，防止重复启动
  if (global.__cronSchedulerInitialized) {
    console.log('⚠️ 定时任务调度器已经初始化过，跳过重复启动');
    return;
  }
  
  // 🔴 设置初始化标记
  global.__cronSchedulerInitialized = true;
  
  console.log('🚀 启动所有定时任务...');

  // 检查环境变量
  const enableCronJobs = process.env.ENABLE_CRON_JOBS !== 'false';

  if (!enableCronJobs) {
    console.log('⚠️ 定时任务已禁用 (ENABLE_CRON_JOBS=false)');
    return;
  }

  // 启动所有定时任务
  Object.keys(CRON_JOBS).forEach((key) => {
    startCronJob(key as keyof typeof CRON_JOBS);
  });

  console.log(`✅ 已启动 ${activeTasks.size} 个定时任务`);
}

/**
 * 停止所有定时任务
 */
export function stopAllCronJobs(): void {
  console.log('🛑 停止所有定时任务...');

  activeTasks.forEach((task, key) => {
    task.stop();
    console.log(`✅ 已停止: ${CRON_JOBS[key as keyof typeof CRON_JOBS].name}`);
  });

  activeTasks.clear();
}

/**
 * 获取所有定时任务状态
 */
export function getCronJobsStatus() {
  const status: Record<string, any> = {};

  Object.entries(CRON_JOBS).forEach(([key, job]) => {
    status[key] = {
      name: job.name,
      schedule: job.schedule,
      endpoint: job.endpoint,
      description: job.description,
      active: activeTasks.has(key),
    };
  });

  return status;
}

/**
 * 手动触发定时任务
 */
export async function triggerCronJob(jobKey: keyof typeof CRON_JOBS): Promise<any> {
  const job = CRON_JOBS[jobKey];

  console.log(`🔔 手动触发定时任务: ${job.name}`);

  try {
    const response = await fetch(`http://localhost:5000${job.endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }

    const data = await response.json();
    console.log(`✅ 手动触发成功 [${job.name}]:`, data.message || 'OK');

    return data;
  } catch (error) {
    console.error(`❌ 手动触发失败 [${job.name}]:`, error);
    throw error;
  }
}

// 在模块加载时自动启动（仅在生产环境或启用时）
// 暂时禁用自动启动
// if (process.env.AUTO_START_CRON_JOBS !== 'false') {
//   // 延迟启动，确保服务已就绪
//   setTimeout(() => {
//     startAllCronJobs();
//   }, 5000);
// }

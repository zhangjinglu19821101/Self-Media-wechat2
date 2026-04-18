
/**
 * 🔴 拆解流程常量定义
 * 
 * 统一管理拆解流程相关的常量
 */

// 拆解执行者
export const SPLIT_EXECUTORS = {
  AGENT_B: 'Agent B',
  INSURANCE_D: 'insurance-d'
} as const;

export type SplitExecutor = typeof SPLIT_EXECUTORS[keyof typeof SPLIT_EXECUTORS];

// 状态常量
export const DAILY_TASK_STATUS = {
  PENDING: 'pending',
  SPLIT_COMPLETED: 'split_completed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed'
} as const;

export type DailyTaskStatus = typeof DAILY_TASK_STATUS[keyof typeof DAILY_TASK_STATUS];

export const SUB_TASK_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed'
} as const;

export type SubTaskStatus = typeof SUB_TASK_STATUS[keyof typeof SUB_TASK_STATUS];

// API 路径
export const API_PATHS = {
  SPLIT_CONFIRM: '/api/split/confirm',
  // 保留旧的 API 路径用于向后兼容
  DAILY_TASKS_CONFIRM_SPLIT: '/api/daily-tasks/confirm-split',
  AGENT_SUB_TASKS_CONFIRM_SPLIT_FIX: '/api/agent-sub-tasks/confirm-split-fix'
} as const;

// 日志前缀
export const LOG_PREFIXES = {
  SPLIT_FLOW: '🔴🔴🔴 [统一拆解确认]',
  SAVE_DAILY_TASK: '✅ [保存到 daily_task 表]',
  SAVE_SUB_TASK: '✅ [保存到 agent_sub_tasks 表]'
} as const;

// 错误消息
export const ERROR_MESSAGES = {
  MISSING_PARAMS: '缺少必填参数：splitResult 和 taskId',
  SAVE_DAILY_TASK_FAILED: '保存到 daily_task 表失败',
  SAVE_SUB_TASK_FAILED: '保存到 agent_sub_tasks 表失败',
  NO_SUBTASKS: '没有解析到有效的子任务',
  DAILY_TASK_NOT_FOUND: '未找到 daily_task 记录',
  ALREADY_SPLIT_COMPLETED: '该任务已经拆解完成',
  ALREADY_HAS_SUBTASKS: '该任务已经有子任务了'
} as const;


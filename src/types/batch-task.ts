/**
 * 批量任务相关类型定义
 */

/**
 * 重复检测结果
 */
export interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateTasks: Array<{
    taskId: string;
    coreCommand: string;
    executor: string;
    createdAt: string;
    taskStatus?: string;
    similarity?: number;
  }>;
  warningMessage?: string;
}

/**
 * 批量任务结果
 */
export interface BatchTaskResult {
  index: number;
  command: string;
  status: 'created' | 'duplicate' | 'error';
  task?: any;
  duplicateCheck?: DuplicateCheckResult;
  error?: string;
}

/**
 * 批量任务汇总
 */
export interface BatchTaskSummary {
  total: number;
  created: number;
  duplicates: number;
  errors: number;
}

/**
 * 批量任务请求
 */
export interface BatchTaskRequest {
  commands: Array<{
    fromAgentId: string;
    toAgentId: string;
    command: string;
    commandType?: 'task' | 'instruction';
    priority?: 'low' | 'normal' | 'high';
  }>;
  checkDuplicate?: boolean;
  duplicateCheckMode?: 'simple' | 'fuzzy';
}

/**
 * 批量任务响应
 */
export interface BatchTaskResponse {
  success: boolean;
  results: BatchTaskResult[];
  summary: BatchTaskSummary;
  error?: string;
}

/**
 * 指令输入
 */
export interface CommandInput {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  command: string;
  commandType: 'task' | 'instruction';
  priority: 'low' | 'normal' | 'high';
}

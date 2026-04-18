
/**
 * 🔴 拆解流程类型定义
 * 
 * 统一管理拆解流程相关的类型
 */

import { SplitExecutor, DailyTaskStatus, SubTaskStatus } from '@/constants/split-flow';

// 子任务类型
export interface SubTask {
  taskName?: string;
  title?: string;
  name?: string;
  taskDescription?: string;
  description?: string;
  content?: string;
  executor?: string;
  taskType?: string;
  priority?: string;
  deadline?: string;
  estimatedHours?: string;
  commandContent?: string;
  acceptanceCriteria?: string;
  id?: string;
  [key: string]: any;
}

// 拆解结果类型
export interface SplitResult {
  taskTitle?: string;
  taskDescription?: string;
  subtasks?: SubTask[];
  subTasks?: SubTask[];
  [key: string]: any;
}

// 统一拆解确认请求类型
export interface SplitConfirmRequest {
  taskId: string;
  splitResult: SplitResult;
  notificationId?: string;
  splitExecutor?: SplitExecutor;
}

// 统一拆解确认响应类型
export interface SplitConfirmResponse {
  success: boolean;
  message?: string;
  error?: string;
  code?: string;
  data?: {
    dailyTaskId?: string;
    subTaskCount?: number;
    insertedIds?: string[];
    totalTasks?: number;
  };
}

// daily_task 表行类型
export interface DailyTaskRow {
  id: string;
  task_id: string;
  task_title?: string;
  task_description?: string;
  executor?: string;
  execution_date?: string;
  execution_status?: DailyTaskStatus;
  sub_task_count?: number;
  completed_sub_tasks_description?: string;
  metadata?: any;
  created_at: Date;
  updated_at: Date;
}

// agent_sub_tasks 表行类型
export interface AgentSubTaskRow {
  id: string;
  command_result_id: string;
  from_parents_executor?: string;
  task_title?: string;
  task_description?: string;
  status?: SubTaskStatus;
  order_index?: number;
  execution_date?: string;
  execution_result?: any;
  metadata?: any;
  created_at: Date;
  updated_at: Date;
}


/**
 * 指令执行结果反馈类型定义
 */

/**
 * 执行状态
 */
export type ExecutionStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked';

/**
 * 指令执行结果
 */
export interface CommandResult {
  id: string;
  resultId?: string;
  commandId?: string;
  taskId?: string;
  relatedTaskId?: string;
  commandContent?: string;
  executor?: string;
  executionStatus: ExecutionStatus;
  executionResult?: string;
  outputData?: Record<string, any>;
  metrics?: ExecutionMetrics;
  attachments?: Attachment[];
  fromAgentId: string;
  toAgentId: string;
  originalCommand?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  // 可选的其他字段
  commandPriority?: string;
  executionDeadlineStart?: Date;
  executionDeadlineEnd?: Date;
  deliverables?: string;
  statusProof?: string;
  helpRecord?: string;
  auditOpinion?: string;
  splitter?: string;
  entryUser?: string;
  remarks?: string;
  lastTsCheckTime?: Date;
  lastTSAwakeningTime?: Date;
  tsAwakeningCount?: number;
  lastInspectionTime?: Date;
  lastConsultTime?: Date;
  awakeningCount?: number;
  taskType?: string;
  executionDate?: string;
  rejectionReason?: string;
  dependencies?: Record<string, any>;
  sortOrder?: number;
  scenarioType?: string;
  taskName?: string;
  triggerSource?: string;
  retryStatus?: string;
  metadata?: Record<string, any>;
  completedSubTasks?: number;
  completedSubTasksDescription?: string;
  subTaskCount?: number;
  questionStatus?: string;
  lastCheckedAt?: Date;
  lastInspectedAt?: Date;
  dialogueSessionId?: string;
  dialogueRounds?: number;
  dialogueStatus?: string;
  lastDialogueAt?: Date;
}

/**
 * 指标数据
 */
export interface ExecutionMetrics {
  duration?: number; // 执行耗时（秒）
  progress?: number; // 完成度（0-100）
  efficiency?: number; // 效率评分（0-100）
  quality?: number; // 质量评分（0-100）
  satisfaction?: number; // 满意度评分（0-100）
  [key: string]: any; // 其他自定义指标
}

/**
 * 附件信息
 */
export interface Attachment {
  name: string;
  url: string;
  type: string;
  size?: number;
}

/**
 * 创建指令执行结果
 */
export interface CreateCommandResultParams {
  taskId: string;
  commandId?: string;
  fromAgentId: string;
  toAgentId: string;
  originalCommand: string;
  executionStatus: ExecutionStatus;
  executionResult?: string;
  outputData?: Record<string, any>;
  metrics?: ExecutionMetrics;
  attachments?: Attachment[];
}

/**
 * 更新指令执行结果
 */
export interface UpdateCommandResultParams {
  resultId: string;
  executionStatus?: ExecutionStatus;
  executionResult?: string;
  outputData?: Record<string, any>;
  metrics?: ExecutionMetrics;
  attachments?: Attachment[];
  completedAt?: Date;
}

/**
 * 查询指令执行结果
 */
export interface QueryCommandResultsParams {
  toAgentId?: string;
  fromAgentId?: string;
  taskId?: string;
  executionStatus?: ExecutionStatus;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * 指令执行结果统计
 */
export interface CommandResultStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  failed: number;
  blocked: number;
  byAgent: Record<string, number>;
}

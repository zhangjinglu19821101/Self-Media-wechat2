/**
 * 工作流程类型定义
 * 定义多 Agent 协作的闭环工作流程
 */

import { AgentId, TaskPriority, TaskStatus } from './agent-types';

/**
 * 工作流程阶段
 */
export enum WorkflowStage {
  /** 阶段1：战略制定与下达 */
  STRATEGY_PLANNING = 'strategy_planning',
  /** 阶段2：任务执行与数据记录 */
  EXECUTION = 'execution',
  /** 阶段3：反馈报告 */
  REPORTING = 'reporting',
  /** 阶段4：经验提取与规则转化 */
  EXPERIENCE_EXTRACTION = 'experience_extraction',
  /** 阶段5：迭代方案制定 */
  ITERATION_PROPOSAL = 'iteration_proposal',
  /** 阶段6：规则迭代分级评估（优化新增） */
  RISK_ASSESSMENT = 'risk_assessment',
  /** 阶段7：快速通道判断（优化新增） */
  FAST_TRACK_CHECK = 'fast_track_check',
  /** 阶段8：分级调研（优化新增） */
  GRADED_RESEARCH = 'graded_research',
  /** 阶段9：权重评估与审批（优化新增） */
  WEIGHT_ASSESSMENT = 'weight_assessment',
  /** 阶段10：审核决策 */
  DECISION_MAKING = 'decision_making',
  /** 阶段11：规则落地 */
  IMPLEMENTATION = 'implementation',
  /** 阶段12：动态验收周期跟踪（优化新增） */
  ACCEPTANCE_TRACKING = 'acceptance_tracking',
  /** 阶段13：验收报告提交 */
  ACCEPTANCE_REPORT = 'acceptance_report',
  /** 阶段14：验收结果同步 */
  ACCEPTANCE_SYNC = 'acceptance_sync',
  /** 阶段15：质量数据收集（优化新增） */
  QUALITY_DATA_COLLECTION = 'quality_data_collection',
  /** 阶段16：月度复盘（优化新增） */
  MONTHLY_REVIEW = 'monthly_review',
}

/**
 * 工作流程步骤
 */
export interface WorkflowStep {
  id: string;
  stage: WorkflowStage;
  name: string;
  description: string;
  fromAgent?: AgentId; // 发起者
  toAgent?: AgentId[]; // 接收者
  order: number; // 步骤顺序
  required: boolean; // 是否必须
  estimatedDuration: number; // 预估时长（分钟）
  requiresHumanConfirmation?: boolean; // 是否需要人类确认
  confirmationMessage?: string; // 确认时的提示信息
}

/**
 * 工作流程模板（16步闭环 - 优化扩展版）
 */
export const WORKFLOW_TEMPLATE: WorkflowStep[] = [
  // === 基础流程 ===
  {
    id: 'step-1',
    stage: WorkflowStage.STRATEGY_PLANNING,
    name: '战略制定与下达',
    description: 'A 制定战略计划，向 B/C/D 下达可执行任务',
    fromAgent: 'A',
    toAgent: ['B', 'C', 'D'],
    order: 1,
    required: true,
    estimatedDuration: 30,
    requiresHumanConfirmation: true,
    confirmationMessage: 'Agent A 已完成战略制定，请确认战略计划是否可以下达给 B/C/D 执行？',
  },
  {
    id: 'step-2',
    stage: WorkflowStage.EXECUTION,
    name: '任务执行',
    description: 'C/D 执行任务，记录数据',
    fromAgent: 'A',
    toAgent: ['C', 'D'],
    order: 2,
    required: true,
    estimatedDuration: 120,
  },
  {
    id: 'step-3',
    stage: WorkflowStage.REPORTING,
    name: '反馈报告',
    description: 'C/D 提交反馈报告给 A 和 B',
    fromAgent: 'C',
    toAgent: ['A', 'B'],
    order: 3,
    required: true,
    estimatedDuration: 60,
  },
  {
    id: 'step-4',
    stage: WorkflowStage.EXPERIENCE_EXTRACTION,
    name: '经验提取',
    description: 'B 提取经验，转化为量化规则',
    fromAgent: 'B',
    toAgent: ['B'],
    order: 4,
    required: true,
    estimatedDuration: 90,
    requiresHumanConfirmation: true,
    confirmationMessage: 'Agent B 已提取经验并形成量化规则，请确认规则是否合理？',
  },
  {
    id: 'step-5',
    stage: WorkflowStage.ITERATION_PROPOSAL,
    name: '迭代方案',
    description: 'B 提交迭代方案给 A',
    fromAgent: 'B',
    toAgent: ['A'],
    order: 5,
    required: true,
    estimatedDuration: 60,
    requiresHumanConfirmation: true,
    confirmationMessage: 'Agent B 已制定迭代方案，请确认方案是否可以提交给 A 审核？',
  },
  
  // === 优化新增阶段 ===
  {
    id: 'step-6',
    stage: WorkflowStage.RISK_ASSESSMENT,
    name: '规则迭代分级评估',
    description: 'A 评估规则风险等级（红色级/黄色级/绿色级）',
    fromAgent: 'A',
    toAgent: ['A'],
    order: 6,
    required: true,
    estimatedDuration: 15,
  },
  {
    id: 'step-7',
    stage: WorkflowStage.FAST_TRACK_CHECK,
    name: '快速通道判断',
    description: 'A 判断是否触发快速通道（Bug修复/业务紧急/监管要求）',
    fromAgent: 'A',
    toAgent: ['A'],
    order: 7,
    required: false, // 可选步骤
    estimatedDuration: 10,
  },
  {
    id: 'step-8',
    stage: WorkflowStage.GRADED_RESEARCH,
    name: '分级调研',
    description: 'B 根据风险等级执行分级调研（红色级全员/黄色级相关/绿色级简化/快速通道关键问题确认）',
    fromAgent: 'B',
    toAgent: ['C', 'D', 'insurance-c', 'insurance-d'],
    order: 8,
    required: true,
    estimatedDuration: 120, // 灵活：快速通道4小时，绿色级0.5天，黄色级1-2天，红色级2-3天
    requiresHumanConfirmation: true,
    confirmationMessage: 'Agent B 已完成分级调研，请确认调研结果是否可以提交给 A 审核？',
  },
  {
    id: 'step-9',
    stage: WorkflowStage.WEIGHT_ASSESSMENT,
    name: '权重评估与审批',
    description: 'A 识别调研结果权重（一票否决/重大风险/建议优化）并决策',
    fromAgent: 'A',
    toAgent: ['A'],
    order: 9,
    required: true,
    estimatedDuration: 30,
    requiresHumanConfirmation: true,
    confirmationMessage: 'Agent A 已完成权重评估和审批决策，请确认是否可以继续？',
  },
  
  // === 基础流程继续 ===
  {
    id: 'step-10',
    stage: WorkflowStage.DECISION_MAKING,
    name: '审核决策',
    description: 'A 下达落地指令（标注风险等级、验收周期、快速通道标识）',
    fromAgent: 'A',
    toAgent: ['B'],
    order: 10,
    required: true,
    estimatedDuration: 15,
    requiresHumanConfirmation: true,
    confirmationMessage: 'Agent A 已下达落地指令，请确认是否可以开始落地实施？',
  },
  {
    id: 'step-11',
    stage: WorkflowStage.IMPLEMENTATION,
    name: '规则落地',
    description: 'B 落地规则到成长中台/插件，配置权限',
    fromAgent: 'B',
    toAgent: ['B'],
    order: 11,
    required: true,
    estimatedDuration: 180,
  },
  
  // === 优化新增验收跟踪 ===
  {
    id: 'step-12',
    stage: WorkflowStage.ACCEPTANCE_TRACKING,
    name: '动态验收周期跟踪',
    description: 'B 跟踪验收数据，根据波动建议调整验收周期（快速通道密集监控）',
    fromAgent: 'B',
    toAgent: ['C', 'D', 'insurance-c', 'insurance-d'],
    order: 12,
    required: true,
    estimatedDuration: 360, // 灵活：快速通道1周期+72小时密集监控，标准3周期
  },
  
  {
    id: 'step-13',
    stage: WorkflowStage.ACCEPTANCE_REPORT,
    name: '验收报告提交',
    description: 'B 提交验收报告给 A（快速通道24小时内提交初步报告）',
    fromAgent: 'B',
    toAgent: ['A'],
    order: 13,
    required: true,
    estimatedDuration: 60,
  },
  {
    id: 'step-14',
    stage: WorkflowStage.ACCEPTANCE_SYNC,
    name: '验收结果同步',
    description: 'A 审批验收结果，同步核心结论至董事长 + 对应 Agent',
    fromAgent: 'A',
    toAgent: ['A', 'B', 'C', 'D'],
    order: 14,
    required: true,
    estimatedDuration: 30,
  },
  
  // === 优化新增质量跟踪 ===
  {
    id: 'step-15',
    stage: WorkflowStage.QUALITY_DATA_COLLECTION,
    name: '质量数据收集',
    description: 'B 收集本次调研数据，更新调研质量指标（真实度、准确性、采纳率）',
    fromAgent: 'B',
    toAgent: ['B'],
    order: 15,
    required: true,
    estimatedDuration: 15,
  },
  {
    id: 'step-16',
    stage: WorkflowStage.MONTHLY_REVIEW,
    name: '月度复盘',
    description: 'B 生成《调研质量分析报告》提交至 A（每月执行）',
    fromAgent: 'B',
    toAgent: ['A'],
    order: 16,
    required: false, // 每月执行一次，非每次都执行
    estimatedDuration: 60,
  },
];

/**
 * 工作流程状态
 */
export enum WorkflowStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * 工作流程
 */
export interface Workflow {
  id: string;
  title: string;
  description: string;
  status: WorkflowStatus;
  currentStep: number; // 当前步骤（1-10）
  steps: WorkflowStepExecution[];
  startedAt: Date;
  completedAt?: Date;
  metadata?: {
    initiator?: AgentId;
    priority?: TaskPriority;
    tags?: string[];
  };
}

/**
 * 工作流程步骤执行状态
 */
export interface WorkflowStepExecution {
  stepId: string;
  status: TaskStatus;
  assignedTo: AgentId;
  startedAt?: Date;
  completedAt?: Date;
  result?: string;
  feedback?: string;
  attachments?: string[]; // 报告、数据文件等
}

/**
 * 工作流程触发请求
 */
export interface WorkflowTriggerRequest {
  title: string;
  description: string;
  initiator: AgentId;
  priority?: TaskPriority;
  tags?: string[];
  initialTasks?: {
    agent: AgentId;
    task: string;
  }[];
}

/**
 * 工作流程更新请求
 */
export interface WorkflowUpdateRequest {
  workflowId: string;
  stepId: string;
  action: 'start' | 'complete' | 'fail' | 'pause' | 'resume';
  result?: string;
  feedback?: string;
  attachments?: string[];
}

/**
 * 工作流程查询
 */
export interface WorkflowQuery {
  status?: WorkflowStatus;
  initiator?: AgentId;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * 工作流程统计
 */
export interface WorkflowStats {
  total: number;
  byStatus: {
    [key in WorkflowStatus]?: number;
  };
  byStage: {
    [key in WorkflowStage]?: number;
  };
  averageDuration: number;
  successRate: number;
}

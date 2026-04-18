/**
 * Agent 类型定义
 * 定义多 Agent 系统中所有 Agent 的数据结构和接口
 */

/**
 * Agent ID 类型
 */
export type AgentId = 'A' | 'B' | 'C' | 'D' | 'insurance-c' | 'insurance-d' | 'insurance-xiaohongshu' | 'insurance-zhihu' | 'insurance-toutiao';

/**
 * 任务优先级
 */
export enum TaskPriority {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  URGENT = 4,
}

/**
 * 任务状态
 */
export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Agent 状态
 */
export enum AgentStatus {
  IDLE = 'idle',
  BUSY = 'busy',
  OFFLINE = 'offline',
}

/**
 * 技能类型
 */
export interface Skill {
  id: string;
  name: string;
  level: number; // 1-100
  description: string;
  experience: number; // 经验值
  maxExperience: number; // 升级所需经验
}

/**
 * Agent 定义
 */
export interface Agent {
  id: AgentId;
  name: string;
  role: string;
  description: string;
  status: AgentStatus;
  skills: Skill[];
  // 并发控制
  maxConcurrentTasks: number;
  currentTasks: number;
  // 自主定时任务
  scheduledTasks: ScheduledTask[];
  // 通信配置
  canSendTo: AgentId[]; // 可以发送消息的目标 Agent
  canReceiveFrom: AgentId[]; // 可以接收消息的源 Agent
  // 时间配置
  createdAt: Date;
  lastActiveAt: Date;
}

/**
 * 定时任务
 */
export interface ScheduledTask {
  id: string;
  agentId: AgentId;
  name: string;
  description: string;
  // Cron 表达式或简单配置
  schedule: {
    type: 'interval' | 'cron';
    value: string;
  };
  lastRun: Date | null;
  nextRun: Date;
  enabled: boolean;
}

/**
 * 消息类型
 */
export enum MessageType {
  TASK_ASSIGNMENT = 'task_assignment',
  TASK_UPDATE = 'task_update',
  TASK_RESULT = 'task_result',
  QUERY = 'query',
  RESPONSE = 'response',
  STATUS_UPDATE = 'status_update',
  EMERGENCY = 'emergency',
}

/**
 * 消息
 */
export interface Message {
  id: string;
  from: AgentId;
  to: AgentId;
  type: MessageType;
  content: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  priority: TaskPriority;
}

/**
 * 任务定义
 */
export interface Task {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedTo: AgentId;
  createdBy: AgentId;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  progress: number; // 0-100
  result?: string;
  error?: string;
  dependencies?: string[]; // 依赖的任务 ID
}

/**
 * Agent 能力评估结果
 */
export interface AgentCapability {
  agentId: AgentId;
  totalScore: number; // 0-100
  skillScores: {
    [skillId: string]: number;
  };
  recentPerformance: {
    tasksCompleted: number;
    averageTime: number; // 毫秒
    successRate: number; // 0-1
  };
  recommendations: string[];
}

/**
 * 任务队列配置
 */
export interface TaskQueueConfig {
  agentId: AgentId;
  maxConcurrent: number;
  currentRunning: number;
  waitingQueue: Task[];
}

/**
 * 系统统计信息
 */
export interface SystemStats {
  totalAgents: number;
  activeAgents: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageTaskDuration: number;
  agentUtilization: {
    [agentId: string]: number; // 利用率 0-1
  };
}

// ============================================================================
// 优化方案新增类型定义
// ============================================================================

/**
 * 规则迭代风险等级
 */
export enum RiskLevel {
  RED = 'red',      // 红色级：高风险
  YELLOW = 'yellow', // 黄色级：中风险
  GREEN = 'green',   // 绿色级：低风险
}

/**
 * 快速通道类型
 */
export enum FastTrackType {
  BUG_FIX = 'bug_fix',           // Bug修复
  URGENT_BUSINESS = 'urgent_business', // 业务紧急
  REGULATORY = 'regulatory',     // 监管要求
}

/**
 * 快速通道标识
 */
export interface FastTrackInfo {
  enabled: boolean;              // 是否启用快速通道
  type?: FastTrackType;          // 快速通道类型
  reason?: string;               // 快速通道原因
  deadline?: Date;               // 截止日期（监管要求）
  approvedBy: AgentId;           // 审批人（Agent A）
  approvedAt: Date;              // 审批时间
}

/**
 * 调研结果权重等级
 */
export enum ResearchWeight {
  VETO = 'veto',              // 一票否决项
  MAJOR_RISK = 'major_risk',  // 重大风险项
  OPTIMIZATION = 'optimization', // 建议优化项
}

/**
 * 调研报告权重评估结果
 */
export interface ResearchWeightAssessment {
  weight: ResearchWeight;
  vetoItems: string[];        // 一票否决项清单
  majorRisks: string[];       // 重大风险项清单
  optimizationItems: string[]; // 建议优化项清单
  rejectionRate: number;      // 反对率 0-100
  costIncrease: number;       // 成本增加百分比 0-100
  finalDecision: 'approve' | 'reject' | 'defer'; // 最终决策
  decisionReason: string;     // 决策原因
}

/**
 * 调研质量指标
 */
export interface ResearchQualityMetrics {
  feedbackAuthenticity: number;  // 调研反馈真实度 0-100，目标≥70%
  predictionAccuracy: number;    // 调研预测准确性 0-100，目标≥80%
  adoptionRate: number;          // 决策采纳率 0-100，目标≥60%
  vetoAdoptionRate: number;      // 一票否决采纳率 0-100，目标100%
  majorRiskAdoptionRate: number; // 重大风险采纳率 0-100，目标≥80%
  optimizationAdoptionRate: number; // 优化建议采纳率 0-100，目标≥40%
}

/**
 * 调研报告数据
 */
export interface ResearchReport {
  id: string;
  ruleIterationId: string;      // 规则迭代ID
  riskLevel: RiskLevel;         // 风险等级
  researchScope: AgentId[];     // 调研范围（哪些Agent）
  researchDepth: string;        // 调研深度（详细/标准/简化）
  researchDuration: number;     // 调研耗时（小时）
  painPoints: string[];         // 痛点
  scenarios: string[];          // 场景
  risks: string[];              // 风险
  feasibility: string;          // 可行性
  feedbackFromAgents: Map<AgentId, {
    content: string;
    duration: number;           // 反馈耗时（小时）
    timestamp: Date;
  }>;
  weightAssessment?: ResearchWeightAssessment; // 权重评估结果
  qualityMetrics?: ResearchQualityMetrics;     // 质量指标
  createdAt: Date;
  submittedAt: Date;
}

/**
 * 动态验收周期
 */
export interface AcceptancePeriod {
  ruleIterationId: string;      // 规则迭代ID
  initialPeriods: number;       // 初始周期数（默认3）
  adjustedPeriods: number;      // 调整后的周期数
  currentPeriod: number;        // 当前周期
  adjustmentReason: string;     // 调整原因
  adjustmentHistory: Array<{
    fromPeriod: number;
    toPeriod: number;
    reason: string;
    dataStability: number;      // 数据稳定性（波动百分比）
    approved: boolean;
    approvedBy: AgentId;
    approvedAt: Date;
  }>;
  monitoringData: {
    leakageRate: number[];      // 拆解漏项率历史
    executionEfficiency: number[]; // 执行效率历史
    errorRate: number[];        // 错误率历史
    satisfactionScore: number[]; // 执行层满意度历史
  };
  finalDecision: 'pass' | 'fail' | 'pending';
}

/**
 * 月度复盘报告
 */
export interface MonthlyReviewReport {
  id: string;
  year: number;
  month: number;
  reportPeriod: {
    start: Date;
    end: Date;
  };
  summary: {
    totalResearchCount: number;
    redLevelCount: number;
    yellowLevelCount: number;
    greenLevelCount: number;
    fastTrackCount: number;
  };
  qualityMetrics: ResearchQualityMetrics;
  lowQualityIterations: Array<{
    ruleIterationId: string;
    ruleTitle: string;
    reason: string;
  }>;
  improvementSuggestions: string[];
  nextMonthGoals: {
    targetAuthenticity: number;
    targetAccuracy: number;
    targetAdoptionRate: number;
  };
  submittedBy: AgentId;         // 提交人（Agent B）
  submittedAt: Date;
  reviewedBy?: AgentId;         // 审批人（Agent A）
  reviewedAt?: Date;
  status: 'pending' | 'approved' | 'rejected';
}

/**
 * 快速通道执行记录
 */
export interface FastTrackExecution {
  id: string;
  ruleIterationId: string;
  fastTrackInfo: FastTrackInfo;
  execution: {
    researchDuration: number;   // 调研耗时（小时）
    monitoringInterval: number; // 监控间隔（小时）
    initialReportAt: Date;      // 初步验收报告提交时间
    finalReportAt?: Date;       // 最终报告提交时间
  };
  monitoringData: Array<{
    timestamp: Date;
    metrics: Record<string, number>;
  }>;
  issues: Array<{
    timestamp: Date;
    description: string;
    resolved: boolean;
    actionTaken: string;
  }>;
  rollback?: {
    timestamp: Date;
    reason: string;
  };
  summary: string;              // 执行总结
  completedAt?: Date;
}

/**
 * 规则迭代方案
 */
export interface RuleIterationProposal {
  id: string;
  title: string;
  description: string;
  proposedBy: AgentId;          // 提出人（Agent B）
  riskLevel?: RiskLevel;        // 风险等级（由A评估）
  fastTrackInfo?: FastTrackInfo; // 快速通道信息（由A标注）
  researchReport?: ResearchReport; // 调研报告
  weightAssessment?: ResearchWeightAssessment; // 权重评估
  acceptancePeriod?: AcceptancePeriod; // 验收周期
  status: 'pending' | 'researching' | 'reviewing' | 'approved' | 'implementing' | 'validating' | 'completed' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

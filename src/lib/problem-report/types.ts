/**
 * 问题上报与处理系统
 * 用于 Agent C、D 等执行任务时上报困难，由架构师（Agent B）处理
 */

// 问题类型
export type ProblemType = 
  | 'technical'      // 技术困难
  | 'data'          // 数据问题
  | 'resource'      // 资源不足
  | 'permission'    // 权限问题
  | 'external'      // 外部依赖问题
  | 'unknown';      // 未知问题

// 问题优先级
export type ProblemPriority = 
  | 'critical'  // 紧急：阻塞任务执行，需要立即处理
  | 'high'      // 高：严重影响任务进度
  | 'normal'    // 普通：可以稍后处理
  | 'low';      // 低：非关键问题

// 问题状态
export type ProblemStatus = 
  | 'pending'     // 待处理：已上报，等待架构师处理
  | 'analyzing'   // 分析中：架构师正在分析
  | 'auto_solving'// 自动解决中：架构师正在自动解决
  | 'human_review'// 人类审核：需要人类介入
  | 'solved'      // 已解决：问题已解决
  | 'closed';     // 已关闭：问题已关闭

// 问题处理方式
export type ProblemSolutionType = 
  | 'automatic'   // 自动解决
  | 'manual';     // 人工介入

/**
 * 问题上报数据结构
 */
export interface ProblemReport {
  id?: string;
  fromAgentId: string;           // 上报的 Agent ID（C、D 等）
  fromAgentName: string;         // 上报的 Agent 名称
  problemType: ProblemType;      // 问题类型
  priority: ProblemPriority;     // 优先级
  title: string;                 // 问题标题
  description: string;           // 问题描述
  context?: {                    // 上下文信息
    taskId?: string;            // 关联的任务 ID
    commandId?: string;         // 关联的指令 ID
    sessionId?: string;         // 关联的会话 ID
    currentStep?: string;       // 当前执行步骤
    errorDetails?: string;      // 错误详情
    logs?: string[];            // 相关日志
  };
  suggestedSolution?: string;    // 建议的解决方案（由上报 Agent 提供）
  status: ProblemStatus;         // 问题状态
  solutionType?: ProblemSolutionType; // 解决方式
  assignedTo?: string;           // 分配给谁（架构师 B 或人类）
  solution?: string;             // 解决方案描述
  solutionLogs?: string[];       // 解决过程日志
  createdAt: Date;               // 创建时间
  updatedAt?: Date;              // 更新时间
  resolvedAt?: Date;             // 解决时间
  humanInterventionNeeded?: boolean; // 是否需要人类介入
}

/**
 * 问题处理结果
 */
export interface ProblemSolutionResult {
  problemId: string;
  success: boolean;
  solution: string;
  solutionType: ProblemSolutionType;
  humanInterventionNeeded: boolean;
  message: string;
  nextSteps?: string[];
}

/**
 * 架构师配置（手脚能力）
 */
export interface ArchitectCapabilities {
  // 技术支持能力
  canFixTechnicalIssues: boolean;      // 是否能修复技术问题
  canDebugCode: boolean;               // 是否能调试代码
  canOptimizePerformance: boolean;     // 是否能优化性能
  
  // 数据支持能力
  canFixDataIssues: boolean;           // 是否能修复数据问题
  canMigrateData: boolean;             // 是否能迁移数据
  canValidateData: boolean;            // 是否能验证数据
  
  // 资源管理能力
  canAllocateResources: boolean;       // 是否能分配资源
  canMonitorResources: boolean;        // 是否能监控资源
  
  // 权限管理能力
  canRequestPermissions: boolean;      // 是否能申请权限
  canCheckPermissions: boolean;        // 是否能检查权限
  
  // 外部依赖管理
  canHandleExternalDeps: boolean;      // 是否能处理外部依赖
  
  // 人类介入触发条件
  humanInterventionTriggers: {
    criticalIssues: boolean;           // 紧急问题是否需要人类介入
    complexProblems: boolean;          // 复杂问题是否需要人类介入
    resourceShortage: boolean;         // 资源短缺是否需要人类介入
    externalBlockers: boolean;         // 外部阻塞是否需要人类介入
  };
}

/**
 * 默认架构师配置
 */
export const DEFAULT_ARCHITECT_CAPABILITIES: ArchitectCapabilities = {
  // 技术支持能力
  canFixTechnicalIssues: true,
  canDebugCode: true,
  canOptimizePerformance: true,
  
  // 数据支持能力
  canFixDataIssues: true,
  canMigrateData: true,
  canValidateData: true,
  
  // 资源管理能力
  canAllocateResources: true,
  canMonitorResources: true,
  
  // 权限管理能力
  canRequestPermissions: true,
  canCheckPermissions: true,
  
  // 外部依赖管理
  canHandleExternalDeps: true,
  
  // 人类介入触发条件
  humanInterventionTriggers: {
    criticalIssues: true,
    complexProblems: true,
    resourceShortage: true,
    externalBlockers: true,
  },
};

/**
 * 问题类型中文映射
 */
export const PROBLEM_TYPE_MAP: Record<ProblemType, string> = {
  technical: '技术困难',
  data: '数据问题',
  resource: '资源不足',
  permission: '权限问题',
  external: '外部依赖问题',
  unknown: '未知问题',
};

/**
 * 优先级中文映射
 */
export const PROBLEM_PRIORITY_MAP: Record<ProblemPriority, string> = {
  critical: '紧急',
  high: '高',
  normal: '普通',
  low: '低',
};

/**
 * 状态中文映射
 */
export const PROBLEM_STATUS_MAP: Record<ProblemStatus, string> = {
  pending: '待处理',
  analyzing: '分析中',
  auto_solving: '自动解决中',
  human_review: '人类审核',
  solved: '已解决',
  closed: '已关闭',
};

/**
 * 优先级颜色映射
 */
export const PROBLEM_PRIORITY_COLOR: Record<ProblemPriority, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  normal: 'bg-blue-500',
  low: 'bg-gray-500',
};

/**
 * 状态颜色映射
 */
export const PROBLEM_STATUS_COLOR: Record<ProblemStatus, string> = {
  pending: 'bg-yellow-500',
  analyzing: 'bg-blue-500',
  auto_solving: 'bg-purple-500',
  human_review: 'bg-red-500',
  solved: 'bg-green-500',
  closed: 'bg-gray-500',
};

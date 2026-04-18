/**
 * 规则系统类型定义
 * 定义规则、规则库、任务拆解等相关数据结构
 */

import { AgentId } from './agent-types';

/**
 * 规则分类
 */
export enum RuleCategory {
  CONTENT = 'content', // 内容类
  OPERATION = 'operation', // 运营类
  TECHNOLOGY = 'technology', // 技术类
  COMPLIANCE = 'compliance', // 合规类
  SECURITY = 'security', // 安全类
}

/**
 * 规则状态
 */
export enum RuleStatus {
  DRAFT = 'draft', // 草稿
  PUBLISHED = 'published', // 已发布
  DEPRECATED = 'deprecated', // 已废弃
}

/**
 * 规则适用范围
 */
export enum RuleScope {
  UNIVERSAL = 'universal', // 通用（所有赛道）
  AI = 'ai', // AI赛道
  INSURANCE = 'insurance', // 保险赛道
}

/**
 * 规则实体
 */
export interface Rule {
  id: string;
  name: string;
  description: string;
  category: RuleCategory;
  status: RuleStatus;
  scope: RuleScope;
  version: string;

  // 核心四要素
  scopeDescription: string; // 适用范围描述
  decompositionActions: string[]; // 拆解动作列表
  judgmentCriteria: string; // 判定标准
  landingCarrier: string; // 落地载体（引擎/插件名称）

  // 元数据
  createdBy: AgentId;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;

  // 关联信息
  relatedExperienceIds: string[]; // 关联的经验ID
  tags: string[]; // 标签

  // 统计数据
  usageCount: number; // 使用次数
  successRate: number; // 成功率（0-100）
}

/**
 * 规则库
 */
export interface RuleLibrary {
  id: string;
  name: string;
  description: string;
  type: RuleScope; // 类型（通用/AI/保险）
  createdBy: AgentId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 规则过滤器
 */
export interface RuleFilter {
  category?: RuleCategory;
  status?: RuleStatus;
  scope?: RuleScope;
  createdBy?: AgentId;
  tags?: string[];
  keyword?: string;
}

/**
 * 任务实体
 */
export interface Task {
  id: string;
  type: string; // 任务类型（内容类/运营类）
  description: string;
  targetScope: RuleScope; // 目标赛道
  requirements: string[]; // 任务要求
  priority: 'high' | 'medium' | 'low';
  createdBy: AgentId;
  createdAt: Date;
  deadline?: Date;
}

/**
 * 子任务实体
 */
export interface SubTask {
  id: string;
  parentTaskId: string;
  name: string;
  description: string;
  executor: AgentId; // 执行者
  estimatedDuration: number; // 预计耗时（分钟）
  completionCriteria: string; // 完成标准
  dependencies: string[]; // 依赖的其他子任务ID
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  order: number; // 执行顺序
}

/**
 * 任务拆解结果
 */
export interface DecompositionResult {
  taskId: string;
  ruleId?: string; // 使用的规则ID
  subTasks: SubTask[];
  totalEstimatedDuration: number; // 总预计耗时（分钟）
  decomposedBy: AgentId;
  decomposedAt: Date;
  confidence: number; // 拆解置信度（0-100）
  warnings?: string[]; // 警告信息
}

/**
 * 引擎状态
 */
export interface EngineStatus {
  status: 'running' | 'stopped' | 'error';
  loadedRuleCount: number;
  lastReloadAt?: Date;
  uptime: number; // 运行时长（秒）
  errorMessage?: string;
}

/**
 * 引擎配置
 */
export interface EngineConfig {
  id: string;
  name: string;
  description: string;
  type: 'universal' | 'ai' | 'insurance';
  enabled: boolean;
  config: Record<string, any>;
}

/**
 * 插件配置
 */
export interface PluginConfig {
  id: string;
  name: string;
  description: string;
  type: 'ai' | 'insurance';
  enabled: boolean;
  dependencies: string[]; // 依赖的规则ID
  config: Record<string, any>;
}

/**
 * 权限操作类型
 */
export enum PermissionAction {
  READ = 'read',
  WRITE = 'write',
  EXECUTE = 'execute',
  DELETE = 'delete',
}

/**
 * 权限实体
 */
export interface Permission {
  id: string;
  agentId: AgentId;
  ruleId?: string; // 规则ID（为空表示所有规则）
  ruleLibraryId?: string; // 规则库ID
  action: PermissionAction;
  grantedBy: AgentId;
  grantedAt: Date;
  expiresAt?: Date; // 过期时间
}

/**
 * 规则使用统计
 */
export interface RuleUsageStats {
  ruleId: string;
  ruleName: string;
  totalUsageCount: number;
  successCount: number;
  failCount: number;
  successRate: number;
  lastUsedAt: Date;
  usedByAgents: {
    agentId: AgentId;
    usageCount: number;
  }[];
}

// 导出AgentId供其他文件使用
export type { AgentId } from './agent-types';

/**
 * 分支1智能化类型定义
 */

import type { DomainRule, DomainCase, DomainTerminology, CapabilityList } from '@/lib/db/schema';

// ==========================================
// insurance-d 输出类型
// ==========================================

/**
 * insurance-d 任务分析结果
 */
export interface InsuranceDAnalysisResult {
  /** 是否需要调用 MCP */
  isNeedMcp: boolean;
  
  /** 补全后的创作任务描述（含创作决策） */
  problem: string;
  
  /** 保险创作场景标签（如"医疗险科普-公众号发布"） */
  domainScene: string;
  
  /** 建议调用的 MCP 能力类型 */
  capabilityType: string;
  
  /** 创作决策建议（体现决策权） */
  creationSuggestion: string;
}

// ==========================================
// Agent B 输出类型
// ==========================================

/**
 * Agent B 参数生成结果
 */
export interface AgentBParamResult {
  /** MCP 调用地址（或工具名称/动作名称，如 search/webSearch） */
  apiAddress: string;
  
  /** 结构化 MCP 参数（贴合保险领域） */
  params: Record<string, any>;
  
  /** MCP 调用风险提示 */
  riskTips: string;
  
  /** 智能体领域能力提升建议 */
  capabilityUpgradeSuggestion: string;
}

// ==========================================
// 领域知识聚合类型
// ==========================================

/**
 * 领域知识聚合
 */
export interface DomainKnowledge {
  /** 业务规则 */
  rules: DomainRule[];
  
  /** 历史案例 */
  cases: DomainCase[];
  
  /** 领域术语 */
  terminology: DomainTerminology[];
  
  /** 参数模板（从 capability_list 获取） */
  paramTemplate?: Record<string, any>;
  
  /** 能力信息（从 capability_list 获取） */
  capabilityInfo?: CapabilityList;
}

// ==========================================
// 分支1执行结果类型
// ==========================================

/**
 * 分支1执行结果
 */
export interface Branch1ExecutionResult {
  /** 是否成功 */
  success: boolean;
  
  /** 执行模式 */
  executionMode: 'direct' | 'on_site';
  
  /** insurance-d 分析结果 */
  insuranceDAnalysis?: InsuranceDAnalysisResult;
  
  /** Agent B 参数结果 */
  agentBParams?: AgentBParamResult;
  
  /** MCP 执行结果 */
  mcpResult?: any;
  
  /** 错误信息 */
  error?: string;
  
  /** 能力提升建议 */
  capabilityUpgradeSuggestion?: string;
}

// ==========================================
// Prompt 构建类型
// ==========================================

/**
 * insurance-d Prompt 构建参数
 */
export interface InsuranceDPromptOptions {
  /** 任务内容 */
  taskContent: string;
  
  /** 领域知识 */
  domainKnowledge: DomainKnowledge;
  
  /** 能力类型列表（可选） */
  capabilityTypes?: string[];
}

/**
 * Agent B Prompt 构建参数
 */
export interface AgentBPromptOptions {
  /** insurance-d 分析结果 */
  insuranceDResult: InsuranceDAnalysisResult;
  
  /** 能力列表 */
  capabilityList: CapabilityList[];
  
  /** 领域知识 */
  domainKnowledge: DomainKnowledge;
  
  /** solution_num */
  solutionNum: number;
}

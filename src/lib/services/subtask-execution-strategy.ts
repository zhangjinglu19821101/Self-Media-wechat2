
/**
 * 子任务执行策略接口
 * 
 * 定义子任务执行的策略接口，支持 Mock 和真实实现两种策略
 */

import type { ArticleMetadata } from '@/lib/types/article-metadata';

/**
 * 执行策略接口
 */
export interface SubtaskExecutionStrategy {
  /**
   * 策略名称
   */
  readonly name: string;

  /**
   * 是否为 Mock 策略
   */
  readonly isMock: boolean;

  /**
   * 执行步骤
   */
  executeStep(task: SubtaskExecutionContext): Promise<StepExecutionResult>;

  /**
   * 生成动态的 stepOutput
   */
  generateStepOutput(task: SubtaskExecutionContext): string;

  /**
   * 生成动态的 wechatData
   */
  generateWechatData(task: SubtaskExecutionContext): any;
}

/**
 * 子任务执行上下文
 */
export interface SubtaskExecutionContext {
  id: string;
  taskTitle: string;
  taskDescription?: string;
  orderIndex: number;
  fromParentsExecutor: string;
  metadata?: Record<string, any>;
  articleMetadata?: ArticleMetadata | null;
}

/**
 * 步骤执行结果
 */
export interface StepExecutionResult {
  success: boolean;
  stepOutput: string;
  wechatData?: any;
  articleMetadata: ArticleMetadata;
  executionResult: string;
  mockNote?: string;
}

/**
 * 执行策略类型
 */
export type ExecutionStrategyType = 'mock' | 'real';


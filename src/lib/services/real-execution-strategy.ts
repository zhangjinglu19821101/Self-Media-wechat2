
/**
 * 真实子任务执行策略（占位）
 * 
 * 提供真实实现，需要集成 MCP SDK 等真实能力
 * ⚠️ 注意：这是占位实现，需要根据实际需求完善
 */

import { 
  SubtaskExecutionStrategy, 
  SubtaskExecutionContext, 
  StepExecutionResult 
} from './subtask-execution-strategy';
import { 
  createInitialArticleMetadata, 
  updateArticleMetadataStep,
  type ArticleMetadata 
} from '@/lib/types/article-metadata';

/**
 * 真实执行策略实现（占位）
 */
export class RealExecutionStrategy implements SubtaskExecutionStrategy {
  readonly name = 'real';
  readonly isMock = false;

  /**
   * 执行步骤（真实实现 - 占位）
   */
  async executeStep(task: SubtaskExecutionContext): Promise<StepExecutionResult> {
    console.log(`[RealStrategy] 执行步骤: order_index = ${task.orderIndex}, taskTitle = ${task.taskTitle}`);
    console.warn(`[RealStrategy] ⚠️ 真实实现尚未完成，当前使用临时 Mock 逻辑`);

    // ⚠️ 临时：使用 Mock 逻辑，真实实现需要集成 MCP SDK
    // TODO: 实现真实的 MCP 调用逻辑
    throw new Error('真实执行策略尚未实现，需要集成 MCP SDK');
  }

  /**
   * 根据任务内容生成动态的 stepOutput（真实实现 - 占位）
   */
  generateStepOutput(task: SubtaskExecutionContext): string {
    throw new Error('真实执行策略尚未实现');
  }

  /**
   * 根据任务内容生成动态的 wechatData（真实实现 - 占位）
   */
  generateWechatData(task: SubtaskExecutionContext): any {
    throw new Error('真实执行策略尚未实现');
  }
}


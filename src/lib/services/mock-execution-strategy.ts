
/**
 * Mock 子任务执行策略
 * 
 * 提供 Mock 实现，根据任务内容生成动态的 mock 数据
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
 * Mock 执行策略实现
 */
export class MockExecutionStrategy implements SubtaskExecutionStrategy {
  readonly name = 'mock';
  readonly isMock = true;

  /**
   * 执行步骤
   */
  async executeStep(task: SubtaskExecutionContext): Promise<StepExecutionResult> {
    console.log(`[MockStrategy] 执行步骤: order_index = ${task.orderIndex}, taskTitle = ${task.taskTitle}`);

    // 1. 获取或初始化 article_metadata
    let currentMetadata: ArticleMetadata;
    if (task.articleMetadata) {
      currentMetadata = task.articleMetadata as ArticleMetadata;
    } else {
      currentMetadata = createInitialArticleMetadata({
        articleTitle: task.taskTitle,
        creatorAgent: task.fromParentsExecutor,
        taskType: task.metadata?.taskType || 'general_task',
        totalSteps: 3,
      });
    }

    // 2. 模拟 1 秒延迟
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 3. 生成动态输出
    const stepOutput = this.generateStepOutput(task);
    const wechatData = this.generateWechatData(task);

    // 4. 构建完整的 article_metadata
    const updatedMetadata = updateArticleMetadataStep(currentMetadata, {
      stepNo: task.orderIndex,
      stepStatus: 'success',
      stepOutput: stepOutput,
      confirmStatus: '已确认',
      wechatData: wechatData,
    });

    console.log(`[MockStrategy] 更新 article_metadata:`, JSON.stringify(updatedMetadata, null, 2));

    // 5. 构建 executionResult
    const executionResult = JSON.stringify({
      stepOutput: stepOutput,
      articleMetadata: updatedMetadata,
      completedAt: new Date().toISOString(),
      status: 'success',
      mockNote: '此为 Mock 数据，真实逻辑需要集成 MCP 调用'
    });

    return {
      success: true,
      stepOutput,
      wechatData,
      articleMetadata: updatedMetadata,
      executionResult,
      mockNote: '此为 Mock 数据，真实逻辑需要集成 MCP 调用'
    };
  }

  /**
   * 根据任务内容生成动态的 stepOutput
   */
  generateStepOutput(task: SubtaskExecutionContext): string {
    const taskTitle = task.taskTitle || '';
    const metadata = task.metadata || {};
    const mcpCapability = metadata.mcpCapability || '';

    if (mcpCapability === 'web_search') {
      const searchQuery = metadata.searchQuery || '相关资讯';
      return `网页搜索完成：\n\n搜索关键词：${searchQuery}\n搜索结果：\n1. 找到 15 篇相关文章\n2. 提取关键信息 23 条\n3. 生成摘要：\n   - 最新趋势分析\n   - 市场数据对比\n   - 专家观点汇总`;
    }

    if (mcpCapability === 'compliance_check') {
      const contentToCheck = metadata.contentToCheck || '文章内容';
      return `合规校验完成：\n\n检查内容：${contentToCheck.substring(0, 50)}...\n检查结果：\n1. 发现 2 处绝对化用语\n2. 发现 1 处违规承诺\n3. 修改建议：\n   - 将"最好"改为"优秀"\n   - 将"保本保息"改为"稳健收益"\n   - 增加风险提示`;
    }

    if (mcpCapability === 'wechat_public') {
      const articleSummary = metadata.articleSummary || '文章摘要';
      return `微信公众号上传完成：\n\n文章摘要：${articleSummary.substring(0, 50)}...\n上传结果：\n1. 生成标题建议 5 个\n2. 生成封面建议 3 个\n3. 已上传到草稿箱\n4. 草稿链接：https://mp.weixin.qq.com/draft/xxx`;
    }

    // 默认返回
    return `任务执行完成：\n\n任务名称：${taskTitle}\n执行结果：\n1. 任务已按要求完成\n2. 输出数据已生成\n3. 可进行下一步操作`;
  }

  /**
   * 根据任务内容生成动态的 wechatData
   */
  generateWechatData(task: SubtaskExecutionContext): any {
    const taskTitle = task.taskTitle || '';
    return {
      title_idea_set: [
        `《${taskTitle} - 完整攻略》`,
        `《${taskTitle} - 实用指南》`,
        `《${taskTitle} - 深度解析》`,
      ],
      topics: [taskTitle, '实用技巧', '经验分享'],
      user_pain_point: [
        '不知道如何开始',
        '缺乏相关经验',
        '担心效果不好',
      ],
      hot_spot: [
        taskTitle,
        '最新方法',
        '成功案例',
      ],
    };
  }
}


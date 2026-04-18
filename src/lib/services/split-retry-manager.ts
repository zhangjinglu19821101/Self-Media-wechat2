/**
 * 拆解任务重试管理器
 * 负责处理 Agent B 拆解结果格式错误时的重试逻辑
 */

import { db } from '@/lib/db';
import { agentTasks, splitFailures } from '@/lib/db/schema';
import { conversationHistory } from '@/lib/services/conversation-history';
import { JsonParserEnhancer } from '@/lib/utils/json-parser-enhancer';
import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { getPlatformLLM } from '@/lib/llm/factory';
import { eq } from 'drizzle-orm';

interface RetryConfig {
  maxRetries: number;
  delayMs: number;
  taskId: string;
  conversationId: string;
  toAgentId: string;
  fromAgentId: string;
  originalCommand: string;
  agentSystemPrompt: string;
}

interface RetryResult {
  success: boolean;
  data?: any;
  attempts: number;
  error?: string;
  failureId?: string; // 🔥 新增：异常ID（如果失败）
}

/**
 * 拆解任务重试管理器
 */
export class SplitRetryManager {
  private static readonly MAX_RETRIES = 10;
  private static readonly DELAY_MS = 2000; // 2秒延迟

  /**
   * 处理 Agent B 的拆解响应（带重试机制）
   */
  static async handleSplitResponse(
    responseContent: string,
    taskId: string,
    conversationId: string,
    toAgentId: string,
    fromAgentId: string,
    originalCommand: string,
    agentSystemPrompt: string
  ): Promise<RetryResult> {
    console.log(`🔄 开始处理拆解响应，带重试机制（最多 ${this.MAX_RETRIES} 次）`);

    const config: RetryConfig = {
      maxRetries: this.MAX_RETRIES,
      delayMs: this.DELAY_MS,
      taskId,
      conversationId,
      toAgentId,
      fromAgentId,
      originalCommand,
      agentSystemPrompt,
    };

    return this.retryWithAgent(responseContent, config);
  }

  /**
   * 带重试机制的解析和纠正流程
   */
  private static async retryWithAgent(
    initialResponse: string,
    config: RetryConfig,
    attempt: number = 1
  ): Promise<RetryResult> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔄 拆解结果解析尝试 ${attempt}/${config.maxRetries}`);
    console.log(`${'='.repeat(60)}`);

    // 1. 尝试解析 JSON
    const parseResult = JsonParserEnhancer.parseSplitResult(initialResponse);

    // 记录警告信息
    if (parseResult.warnings && parseResult.warnings.length > 0) {
      console.log(`⚠️ 解析警告：`);
      parseResult.warnings.forEach(w => console.log(`   - ${w}`));
    }

    // 2. 如果解析成功，保存结果
    if (parseResult.success && parseResult.data) {
      console.log(`✅ 第 ${attempt} 次尝试：解析成功`);
      
      try {
        await this.saveSplitResult(config.taskId, parseResult.data);
        
        return {
          success: true,
          data: parseResult.data,
          attempts: attempt,
        };
      } catch (error) {
        console.error(`❌ 保存拆解结果失败:`, error);
        return {
          success: false,
          attempts: attempt,
          error: `保存拆解结果失败: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    // 3. 如果解析失败，检查是否还有重试机会
    if (attempt >= config.maxRetries) {
      console.log(`❌ 已达到最大重试次数 (${config.maxRetries})，解析失败`);
      
      // 🔥 新增：插入异常补偿表
      try {
        const failureId = await this.insertExceptionRecord(config, parseResult.error || '未知错误');
        console.log(`✅ 异常记录已插入补偿表: ${failureId}`);
        
        return {
          success: false,
          attempts: attempt,
          error: `达到最大重试次数，最后错误：${parseResult.error}`,
          failureId,
        };
      } catch (error) {
        console.error('❌ 插入异常补偿表失败:', error);
        
        return {
          success: false,
          attempts: attempt,
          error: `达到最大重试次数，最后错误：${parseResult.error}，插入异常补偿表失败`,
        };
      }
    }

    // 4. 生成纠正提示
    const feedback = JsonParserEnhancer.generateFormatErrorFeedback(
      parseResult.error || '未知错误',
      parseResult.warnings || []
    );

    console.log(`\n📝 生成格式纠正提示（${attempt}/${config.maxRetries}）：`);
    console.log(feedback.substring(0, 200) + '...');

    // 5. 将纠正提示添加到对话历史
    await conversationHistory.addMessage({
      conversationId: config.conversationId,
      role: 'user',
      content: feedback,
      metadata: {
        isRetry: true,
        attempt,
        maxRetries: config.maxRetries,
        originalError: parseResult.error,
      },
    });

    console.log(`✅ 纠正提示已添加到对话历史`);

    // 6. 调用 LLM 获取纠正后的响应
    console.log(`\n🤖 调用 LLM 获取纠正后的响应（${attempt}/${config.maxRetries}）...`);
    
    try {
      const newResponse = await this.getCorrectedResponse(
        config.conversationId,
        config.agentSystemPrompt,
        feedback
      );

      console.log(`✅ Agent B 返回纠正后的响应（${newResponse.length} 字符）`);

      // 7. 保存纠正响应到对话历史
      await conversationHistory.addMessage({
        conversationId: config.conversationId,
        role: 'assistant',
        content: newResponse,
        metadata: {
          isRetryResponse: true,
          attempt,
        },
      });

      console.log(`✅ 纠正响应已保存到对话历史`);

      // 8. 递归调用，继续重试
      await this.delay(config.delayMs);
      return this.retryWithAgent(newResponse, config, attempt + 1);
    } catch (error) {
      console.error(`❌ 获取纠正响应失败:`, error);
      
      return {
        success: false,
        attempts: attempt,
        error: `获取纠正响应失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 获取 Agent B 纠正后的响应
   */
  private static async getCorrectedResponse(
    conversationId: string,
    systemPrompt: string,
    feedback: string
  ): Promise<string> {
    // 获取对话历史
    const messages = await conversationHistory.getConversationMessages(conversationId);
    
    // 构建 LLM 消息列表
    const llmMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...messages.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      })),
    ];

    console.log(`📋 消息列表长度: ${llmMessages.length}`);

    // 调用 LLM（后台任务，无 workspaceId，直接使用平台 Key）
    const client = getPlatformLLM();

    let responseContent = '';
    const llmStream = client.stream(llmMessages, {
      temperature: 0.3, // 降低温度，使输出更稳定
    });

    let chunkCount = 0;
    for await (const chunk of llmStream) {
      if (chunk.content) {
        const text = chunk.content.toString();
        responseContent += text;
        chunkCount++;
        if (chunkCount % 20 === 0) {
          console.log(`📝 纠正响应片段 ${chunkCount}:`, text.substring(0, 30));
        }
      }
    }

    console.log(`✅ Agent B 纠正响应完成: ${chunkCount} 个片段, ${responseContent.length} 字符`);

    return responseContent;
  }

  /**
   * 保存拆解结果到数据库
   */
  private static async saveSplitResult(
    taskId: string,
    splitResult: any
  ): Promise<void> {
    const response = await fetch(`http://localhost:5000/api/tasks/${taskId}/split`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-token': process.env.INTERNAL_API_TOKEN || 'internal-svc-token-2025-07',
      },
      body: JSON.stringify(splitResult),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`保存拆解结果失败: ${errorText}`);
    }

    const result = await response.json();
    console.log(`✅ 拆解结果已保存:`, result.message);
  }

  /**
   * 延迟函数
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 插入异常补偿记录
   */
  private static async insertExceptionRecord(
    config: RetryConfig,
    failureReason: string
  ): Promise<string> {
    // 获取任务信息
    const [task] = await db
      .select()
      .from(agentTasks)
      .where(eq(agentTasks.taskId, config.taskId));

    if (!task) {
      throw new Error(`任务 ${config.taskId} 不存在`);
    }

    // 获取对话历史（用于记录 Agent B 的响应）
    const messages = await conversationHistory.getConversationMessages(config.conversationId);
    const agentBResponses = messages
      .filter(m => m.role === 'assistant')
      .map((m, index) => ({
        attempt: index + 1,
        content: m.content.substring(0, 500), // 限制长度
        error: m.metadata?.error || '',
        timestamp: m.createdAt || new Date().toISOString(),
      }));

    // 生成异常ID
    const failureId = `failure-${config.taskId}-${Date.now()}`;

    // 插入异常补偿记录
    const [failureRecord] = await db
      .insert(splitFailures)
      .values({
        failureId,
        taskId: config.taskId,
        taskName: task.taskName,
        coreCommand: task.coreCommand,
        failureReason,
        retryCount: config.maxRetries,
        agentBResponses,
        exceptionStatus: 'pending',
        exceptionPriority: task.taskPriority === 'urgent' ? 'urgent' : 'normal',
        fromAgentId: config.fromAgentId,
        toAgentId: config.toAgentId,
        conversationId: config.conversationId,
        assignedTo: config.fromAgentId, // 默认分配给发送方（Agent A）
        assignedAt: new Date(),
      })
      .returning();

    // 更新任务状态为 exception_pending
    await db
      .update(agentTasks)
      .set({
        taskStatus: 'exception_pending',
        metadata: {
          ...(task.metadata || {}),
          failureId,
          exceptionInsertedAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(eq(agentTasks.taskId, config.taskId));

    console.log(`✅ 异常记录已插入，任务状态已更新为 exception_pending`);

    return failureId;
  }

  /**
   * 重置任务的重试计数（用于外部调用）
   */
  static async resetRetryCount(taskId: string): Promise<void> {
    await db
      .update(agentTasks)
      .set({
        metadata: {
          retryCount: 0,
          retryHistory: [],
        },
        updatedAt: new Date(),
      })
      .where(eq(agentTasks.taskId, taskId));
    
    console.log(`✅ 任务 ${taskId} 的重试计数已重置`);
  }
}

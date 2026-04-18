/**
 * 反馈管理服务
 * 负责 Agent 对指令的异议、疑问和建议的管理
 */

import { db } from '@/lib/db';
import { agentFeedbacks, type AgentFeedback, type NewAgentFeedback } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export class FeedbackManager {
  /**
   * 创建新的反馈
   */
  static async createFeedback(data: NewAgentFeedback): Promise<AgentFeedback> {
    const feedbackId = `feedback-${data.fromAgentId}-to-${data.toAgentId}-${Date.now()}`;
    const [feedback] = await db
      .insert(agentFeedbacks)
      .values({
        ...data,
        feedbackId,
      })
      .returning();

    console.log(`✅ 反馈已创建: feedbackId=${feedback.feedbackId}, from=${feedback.fromAgentId}, to=${feedback.toAgentId}`);
    return feedback;
  }

  /**
   * 更新反馈状态
   */
  static async updateFeedbackStatus(
    feedbackId: string,
    status: 'pending' | 'processing' | 'resolved' | 'rejected',
    resolution?: string,
    resolvedCommand?: string
  ): Promise<AgentFeedback | null> {
    const updates: any = {
      status,
      updatedAt: new Date(),
    };

    if (resolution) {
      updates.resolution = resolution;
    }

    if (resolvedCommand) {
      updates.resolvedCommand = resolvedCommand;
    }

    if (status === 'resolved' || status === 'rejected') {
      updates.resolvedAt = new Date();
    }

    const [feedback] = await db
      .update(agentFeedbacks)
      .set(updates)
      .where(eq(agentFeedbacks.feedbackId, feedbackId))
      .returning();

    if (feedback) {
      console.log(`✅ 反馈状态已更新: feedbackId=${feedbackId}, status=${status}`);
    }

    return feedback;
  }

  /**
   * 获取反馈详情
   */
  static async getFeedback(feedbackId: string): Promise<AgentFeedback | null> {
    const [feedback] = await db
      .select()
      .from(agentFeedbacks)
      .where(eq(agentFeedbacks.feedbackId, feedbackId));

    return feedback || null;
  }

  /**
   * 获取发送方Agent的所有反馈
   */
  static async getFeedbacksByFromAgent(fromAgentId: string): Promise<AgentFeedback[]> {
    const feedbacks = await db
      .select()
      .from(agentFeedbacks)
      .where(eq(agentFeedbacks.fromAgentId, fromAgentId))
      .orderBy(desc(agentFeedbacks.createdAt));

    return feedbacks;
  }

  /**
   * 获取接收方Agent的所有反馈（用于Agent A查看）
   */
  static async getFeedbacksByToAgent(toAgentId: string): Promise<AgentFeedback[]> {
    const feedbacks = await db
      .select()
      .from(agentFeedbacks)
      .where(eq(agentFeedbacks.toAgentId, toAgentId))
      .orderBy(desc(agentFeedbacks.createdAt));

    return feedbacks;
  }

  /**
   * 获取待处理的反馈
   */
  static async getPendingFeedbacks(toAgentId: string): Promise<AgentFeedback[]> {
    const feedbacks = await db
      .select()
      .from(agentFeedbacks)
      .where(
        and(
          eq(agentFeedbacks.toAgentId, toAgentId),
          eq(agentFeedbacks.status, 'pending')
        )
      )
      .orderBy(desc(agentFeedbacks.createdAt));

    return feedbacks;
  }

  /**
   * 获取任务相关的所有反馈
   */
  static async getFeedbacksByTask(taskId: string): Promise<AgentFeedback[]> {
    const feedbacks = await db
      .select()
      .from(agentFeedbacks)
      .where(eq(agentFeedbacks.taskId, taskId))
      .orderBy(desc(agentFeedbacks.createdAt));

    return feedbacks;
  }

  /**
   * 获取反馈统计
   */
  static async getFeedbackStats(toAgentId: string): Promise<{
    total: number;
    pending: number;
    processing: number;
    resolved: number;
    rejected: number;
  }> {
    const feedbacks = await this.getFeedbacksByToAgent(toAgentId);

    return {
      total: feedbacks.length,
      pending: feedbacks.filter(f => f.status === 'pending').length,
      processing: feedbacks.filter(f => f.status === 'processing').length,
      resolved: feedbacks.filter(f => f.status === 'resolved').length,
      rejected: feedbacks.filter(f => f.status === 'rejected').length,
    };
  }
}

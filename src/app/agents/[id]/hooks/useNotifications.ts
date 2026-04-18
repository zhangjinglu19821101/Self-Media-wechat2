'use client';

import { useState, useEffect, useCallback } from 'react';

interface Feedback {
  feedbackId: string;
  taskId: string;
  fromAgent: string;
  command: any;
  result: string | null;
  completedAt: Date | null;
  commandType: string;
  priority: any;
}

interface FeedbackStats {
  total: number;
  pending: number;
  resolved: number;
  rejected: number;
}

interface UseNotificationsOptions {
  agentId: string;
}

export function useNotifications({ agentId }: UseNotificationsOptions) {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStats | null>(null);

  // 加载反馈列表
  const loadFeedbacks = useCallback(async () => {
    try {
      const response = await fetch(`/api/feedback?toAgentId=${agentId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setFeedbacks(data.data.feedbacks);
          setFeedbackStats(data.data.stats);
        }
      }
    } catch (e) {
      console.error('加载反馈失败:', e);
    }
  }, [agentId]);

  // 处理反馈
  const handleResolveFeedback = useCallback(async (
    feedbackId: string,
    resolution: string,
    resolvedCommand: string
  ) => {
    try {
      const response = await fetch(`/api/feedback/${feedbackId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'resolved',
          resolution,
          resolvedCommand,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // 刷新反馈列表
          await loadFeedbacks();
          alert('反馈已处理，新指令已下发');
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('处理反馈失败:', error);
      alert('操作失败，请重试');
      return false;
    }
  }, [loadFeedbacks]);

  // 驳回反馈
  const handleRejectFeedback = useCallback(async (
    feedbackId: string,
    resolution: string
  ) => {
    try {
      const response = await fetch(`/api/feedback/${feedbackId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'rejected',
          resolution,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // 刷新反馈列表
          await loadFeedbacks();
          alert('反馈已驳回');
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('驳回反馈失败:', error);
      alert('操作失败，请重试');
      return false;
    }
  }, [loadFeedbacks]);

  // 初始加载反馈
  useEffect(() => {
    // 仅 Agent A 需要加载反馈
    if (agentId !== 'A') return;

    loadFeedbacks();

    // 🔥 优化：使用页面可见性 API 替代定时轮询
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadFeedbacks();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [agentId, loadFeedbacks]);

  return {
    feedbacks,
    feedbackStats,
    loadFeedbacks,
    handleResolveFeedback,
    handleRejectFeedback,
  };
}

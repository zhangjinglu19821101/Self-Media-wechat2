/**
 * useFeedback - 反馈处理 Hook
 *
 * 职责：
 * 1. 管理反馈列表状态
 * 2. 处理反馈的解决和驳回
 * 3. 管理反馈统计信息
 * 4. 定时加载反馈列表
 */

import { useState, useEffect, useCallback } from 'react';

export interface Feedback {
  feedbackId: string;
  fromAgentId: string;
  toAgentId: string;
  message: string;
  status: 'pending' | 'resolved' | 'rejected';
  createdAt: string;
  updatedAt: string;
  resolution?: string;
  resolvedCommand?: string;
}

export interface FeedbackStats {
  total: number;
  pending: number;
  resolved: number;
  rejected: number;
}

export interface UseFeedbackOptions {
  agentId: string;
  pollingInterval?: number; // 轮询间隔（毫秒），默认 30 秒
  autoLoad?: boolean; // 是否自动加载，默认 true
  onFeedbackResolved?: (feedback: Feedback) => void;
  onFeedbackRejected?: (feedback: Feedback) => void;
}

export function useFeedback(options: UseFeedbackOptions) {
  const { agentId, pollingInterval = 30000, autoLoad = true, onFeedbackResolved, onFeedbackRejected } = options;

  // ========== 状态 ==========
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ========== 加载反馈列表 ==========
  const loadFeedbacks = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      // 获取目标 Agent ID（固定为 A，因为反馈都是发送给 Agent A 的）
      const response = await fetch(`/api/feedback?toAgentId=A`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setFeedbacks(data.data.feedbacks);
        setFeedbackStats(data.data.stats);
      } else {
        throw new Error(data.error || '加载反馈失败');
      }
    } catch (err: any) {
      console.error('加载反馈失败:', err);
      setError(err.message || '加载反馈失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // ========== 解决反馈 ==========
  const handleResolveFeedback = useCallback(async (
    feedbackId: string,
    resolution: string,
    resolvedCommand: string
  ) => {
    setLoading(true);
    setError('');

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

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        // 刷新反馈列表
        await loadFeedbacks();
        
        // 调用回调
        const resolvedFeedback = data.data.feedback;
        if (onFeedbackResolved) {
          onFeedbackResolved(resolvedFeedback);
        }

        return { success: true, feedback: resolvedFeedback };
      } else {
        throw new Error(data.error || '处理反馈失败');
      }
    } catch (err: any) {
      console.error('解决反馈失败:', err);
      setError(err.message || '解决反馈失败');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [loadFeedbacks, onFeedbackResolved]);

  // ========== 驳回反馈 ==========
  const handleRejectFeedback = useCallback(async (
    feedbackId: string,
    resolution: string
  ) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/feedback/${feedbackId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'rejected',
          resolution,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        // 刷新反馈列表
        await loadFeedbacks();
        
        // 调用回调
        const rejectedFeedback = data.data.feedback;
        if (onFeedbackRejected) {
          onFeedbackRejected(rejectedFeedback);
        }

        return { success: true, feedback: rejectedFeedback };
      } else {
        throw new Error(data.error || '驳回反馈失败');
      }
    } catch (err: any) {
      console.error('驳回反馈失败:', err);
      setError(err.message || '驳回反馈失败');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [loadFeedbacks, onFeedbackRejected]);

  // ========== 删除反馈 ==========
  const handleDeleteFeedback = useCallback(async (feedbackId: string) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/feedback/${feedbackId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        // 刷新反馈列表
        await loadFeedbacks();
        return { success: true };
      } else {
        throw new Error(data.error || '删除反馈失败');
      }
    } catch (err: any) {
      console.error('删除反馈失败:', err);
      setError(err.message || '删除反馈失败');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [loadFeedbacks]);

  // ========== 自动加载和页面可见性刷新 ==========
  useEffect(() => {
    if (!autoLoad) return;

    // 立即加载一次
    loadFeedbacks();

    // 🔥 优化：使用页面可见性 API 替代定时轮询
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadFeedbacks();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 清理
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [autoLoad, loadFeedbacks]);

  return {
    // ========== 状态 ==========
    feedbacks,
    feedbackStats,
    loading,
    error,

    // ========== 操作方法 ==========
    loadFeedbacks,
    handleResolveFeedback,
    handleRejectFeedback,
    handleDeleteFeedback,

    // ========== 辅助方法 ==========
    setFeedbacks,
    setFeedbackStats,
  };
}

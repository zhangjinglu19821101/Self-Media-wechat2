'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { Message } from 'ai';
import { isWritingAgent } from '@/lib/agents/agent-registry';

/**
 * 拆解操作结果类型
 */
export interface SplitActionResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * useSplitActions Hook
 * 
 * 处理拆解确认和拒绝的逻辑
 */
export function useSplitActions(
  agentId: string,
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
  splitActions: {
    resetSplitState: () => void;
    showNextNotificationFromQueue: () => void;
    closeDialogByButton: () => void;
    setShowSplitResultConfirm: (value: boolean) => void;
    setRejectReason: (value: string) => void;
    currentNotificationId: string;
    splitResultTaskId: string;
    splitResult: any;
    splitExecutor: string;
  }
) {
  // 状态
  const [showRejectReasonDialog, setShowRejectReasonDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isSubmittingReject, setIsSubmittingReject] = useState(false);

  const {
    resetSplitState,
    showNextNotificationFromQueue,
    closeDialogByButton,
    setShowSplitResultConfirm,
    currentNotificationId,
    splitResultTaskId,
    splitResult,
    splitExecutor,
  } = splitActions;

  /**
   * 确认拆解结果
   */
  const handleSplitResultConfirm = useCallback(async (
    taskId: string,
    splitResult: any,
    splitExecutor: string
  ) => {
    if (!taskId || !splitResult) {
      toast.error('缺少必要参数');
      return;
    }

    setIsConfirming(true);
    console.log(`📝 [确认拆解] 开始确认拆解结果...`);
    console.log(`📝 [确认拆解] taskId: ${taskId}`);
    console.log(`📝 [确认拆解] splitExecutor: ${splitExecutor}`);

    try {
      // 根据 executor 选择不同的 API
      const apiEndpoint = isWritingAgent(splitExecutor) || splitExecutor === 'insurance-c'
        ? '/api/agents/insurance-d/confirm-split'
        : '/api/agents/confirm-split';

      console.log(`📝 [确认拆解] API 端点: ${apiEndpoint}`);

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          splitResult,
        }),
      });

      const result = await response.json();
      console.log(`📝 [确认拆解] API 响应:`, result);

      if (!result.success) {
        throw new Error(result.error || '确认失败');
      }

      // 成功处理
      toast.success('✅ 拆解结果已确认');
      
      // 添加成功消息
      const successMessage: Message = {
        id: `split_confirm_${Date.now()}`,
        role: 'assistant',
        content: `✅ **拆解结果已确认**

**任务 ID:** ${taskId}
**执行主体:** ${splitExecutor}

拆解结果已保存到 agent_sub_tasks 表。`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, successMessage]);

      // 关闭弹框
      closeDialogByButton();
      
      // 重置状态
      resetSplitState();
      
      // 显示下一个通知
      showNextNotificationFromQueue();

    } catch (error) {
      console.error('❌ [确认拆解] 失败:', error);
      toast.error(`确认失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsConfirming(false);
    }
  }, [setMessages, closeDialogByButton, resetSplitState, showNextNotificationFromQueue]);

  /**
   * 提交拒绝原因（完整逻辑）
   */
  const handleSubmitRejectReason = useCallback(async () => {
    console.log('🔧 [拆解拒绝] ===== 开始处理拒绝 =====');
    console.log('🔧 [拆解拒绝] 处理拒绝...');

    // 前置检查
    if (!rejectReason.trim()) {
      console.error('❌ [拆解拒绝] 拒绝原因为空，不允许提交');
      toast.error('请输入拒绝原因');
      return;
    }

    if (isSubmittingReject) {
      console.error('❌ [拆解拒绝] 正在提交中，不允许重复提交');
      return;
    }

    // 检查必要的状态变量
    if (!currentNotificationId || !splitResultTaskId) {
      console.error('❌ [拆解拒绝] 缺少必要的状态变量');
      console.error(`  - currentNotificationId: ${currentNotificationId}`);
      console.error(`  - splitResultTaskId: ${splitResultTaskId}`);
      toast.error('系统错误：缺少必要的状态信息，请刷新页面重试');
      return;
    }

    console.log('🔧 [拆解拒绝] 前置检查通过，准备提交...');
    setIsSubmittingReject(true);
    
    console.log(`🔧 [拆解拒绝] 准备请求参数:`);
    console.log(`  - notificationId: ${currentNotificationId}`);
    console.log(`  - taskId: ${splitResultTaskId}`);
    console.log(`  - rejectionReason: ${rejectReason}`);

    try {
      console.log('🔧 [拆解拒绝] 开始发起 fetch 请求...');

      // 统一使用 /api/commands/reject 接口
      const apiUrl = '/api/commands/reject';
      console.log(`🔧 [拆解拒绝] 请求 URL: ${apiUrl}`);

      const requestStartTime = Date.now();

      // 调用拒绝 API（后端会同步触发重新拆解，等待返回）
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationId: currentNotificationId,
          taskId: splitResultTaskId,
          rejectionReason: rejectReason,
          splitResult: splitResult,
        }),
      });
        
      const requestEndTime = Date.now();
      const elapsed = requestEndTime - requestStartTime;
      console.log(`🔧 [拆解拒绝] 请求耗时: ${elapsed}ms`);
      console.log(`🔧 [拆解拒绝] 响应状态: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        console.log(`🔧 [拆解拒绝] 响应不成功 (status: ${response.status})`);
        const errorText = await response.text();
        console.log(`🔧 [拆解拒绝] 错误响应: ${errorText}`);
        throw new Error(`拒绝失败: ${errorText}`);
      }

      console.log('🔧 [拆解拒绝] 开始解析响应 JSON...');
      const result = await response.json();
      console.log(`✅ [拆解拒绝] 解析成功`);
      console.log(`✅ [拆解拒绝] 响应数据:`, result);

      // 拒绝成功后，更新通知 metadata，标记为 rejected
      if (currentNotificationId) {
        try {
          console.log(`📝 [Agent B 拒绝] 更新通知状态为 rejected: ${currentNotificationId}`);
          await fetch('/api/notifications/update-metadata', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              notificationId: currentNotificationId,
              metadata: {
                splitPopupStatus: 'rejected',
                rejectedAt: new Date().toISOString(),
                rejectionReason: rejectReason,
              },
            }),
          });
          console.log(`✅ [Agent B 拒绝] 通知状态已更新为 rejected`);
        } catch (error) {
          console.error('❌ [Agent B 拒绝] 更新通知状态失败:', error);
        }
      }

      // 处理异步拆解和同步拆解的不同提示
      if (result.data?.asyncSplit) {
        toast.success(`✅ 已拒绝拆解，正在后台重新拆解任务，请稍候...`, {
          duration: 5000,
          description: '新的拆解结果将通过 WebSocket 实时推送',
        });
      } else {
        toast.success(`✅ 已拒绝拆解，并重新拆解生成 ${result.data?.retryResult?.splitResult?.subtasks?.length || '新'} 个子任务`);
      }

      // 添加结果消息
      let resultContent = '';
      if (result.data?.asyncSplit) {
        resultContent = `❌ **拆解结果已拒绝**

**拒绝原因：**
${rejectReason}

**处理结果：**
- ✅ 已拒绝当前的拆解结果
- 🔄 正在后台重新拆解任务...
- 📡 新的拆解结果将通过 WebSocket 实时推送

请稍候，Agent B 正在根据您的反馈重新拆解任务。`;
      } else {
        resultContent = `❌ **拆解结果已拒绝**

**拒绝原因：**
${rejectReason}

**处理结果：**
- 已重新拆解任务，生成 ${result.data?.retryResult?.splitResult?.subtasks?.length || '新'} 个子任务

**新的子任务列表：**
${result.data?.retryResult?.splitResult?.subtasks?.map((st: any) => `- ${st.name || st.title} → ${st.executor}`).join('\n') || '生成中...'}

Agent B 将根据您的反馈重新拆解任务，请等待新的拆解结果通知。`;
      }

      const resultMessage: Message = {
        id: `split_reject_${Date.now()}`,
        role: 'assistant',
        content: resultContent,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, resultMessage]);

      // 立即关闭拒绝对话框和拆解结果确认对话框
      console.log('🔧 [Agent B 拒绝] 立即关闭弹框...');
      setShowRejectReasonDialog(false);
      setShowSplitResultConfirm(false);
      console.log(`🔧 [Agent B 拒绝] 已关闭弹框`);

      // 显示成功提示
      if (result.data?.asyncSplit) {
        toast.success('✅ 已拒绝拆解，正在后台重新拆解任务...', {
          duration: 5000,
          description: '新的拆解结果将通过 WebSocket 实时推送',
        });
      }
      
      // 清空所有相关状态
      resetSplitState();
      setRejectReason('');
      console.log('🔧 [Agent B 拒绝] 已清空所有相关状态');

      // 立即处理队列中的下一个通知（如果有）
      console.log(`🔍 [Agent B 拒绝后队列] 检查队列中的待显示通知...`);
      showNextNotificationFromQueue();

    } catch (error) {
      console.error('❌ [Agent B 拆解] 拒绝失败');
      console.error('❌ [Agent B 拆解] 错误对象:', error);

      // 详细错误日志
      if (error instanceof Error) {
        console.error('❌ [Agent B 拆解] 错误名称:', error.name);
        console.error('❌ [Agent B 拆解] 错误消息:', error.message);
        console.error('❌ [Agent B 拆解] 错误堆栈:', error.stack);
      }

      // 区分超时错误和其他错误
      const isTimeout = error instanceof Error && error.name === 'AbortError';
      console.log(`🔧 [Agent B 拆解] 是否超时: ${isTimeout}`);

      const errorMessage = isTimeout
        ? '请求超时，请检查网络连接或稍后重试'
        : `拒绝失败: ${error instanceof Error ? error.message : String(error)}`;

      console.log(`🔧 [Agent B 拆解] 显示错误提示: ${errorMessage}`);
      toast.error(errorMessage);

      console.log('🔧 [Agent B 拆解] 恢复拒绝原因对话框');
      // 延迟恢复对话框，确保 isSubmittingReject 状态已重置
      setTimeout(() => {
        console.log('🔧 [Agent B 拆解] 延迟恢复对话框');
        setShowRejectReasonDialog(true);
      }, 50);
    } finally {
      // 无论成功还是失败，都要恢复按钮状态
      console.log('🔧 [Agent B 拒绝] finally 块执行，设置 isSubmittingReject = false');
      setIsSubmittingReject(false);
    }
  }, [
    rejectReason,
    isSubmittingReject,
    currentNotificationId,
    splitResultTaskId,
    splitResult,
    setMessages,
    setShowSplitResultConfirm,
    resetSplitState,
    showNextNotificationFromQueue,
    setRejectReason
  ]);

  /**
   * 拒绝拆解结果（简化版本）
   */
  const handleSplitResultReject = useCallback(async (
    taskId: string,
    splitResult: any,
    splitExecutor: string,
    reason: string
  ) => {
    // 这个函数保留用于兼容性，实际逻辑在 handleSubmitRejectReason 中
    console.log('❌ handleSplitResultReject 被调用，请使用 handleSubmitRejectReason');
    toast.error('请使用拒绝原因对话框');
  }, []);

  /**
   * 打开拒绝对话框
   */
  const openRejectDialog = useCallback(() => {
    setShowRejectReasonDialog(true);
  }, []);

  /**
   * 关闭拒绝对话框
   */
  const closeRejectDialog = useCallback(() => {
    setShowRejectReasonDialog(false);
    setRejectReason('');
  }, [setRejectReason]);

  return {
    // 状态
    showRejectReasonDialog,
    setShowRejectReasonDialog,
    rejectReason,
    setRejectReason,
    isConfirming,
    isRejecting,
    isSubmittingReject,

    // 方法
    handleSplitResultConfirm,
    handleSplitResultReject,
    handleSubmitRejectReason,
    openRejectDialog,
    closeRejectDialog,
  };
}

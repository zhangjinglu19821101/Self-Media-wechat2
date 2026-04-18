'use client';

import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';

interface UseTaskResultsOptions {
  agentId: string;
  sessionId: string;
  messages: any[];
  setMessages: (messages: any[] | ((prev: any[]) => any[])) => void;
  setShowSplitResultConfirm: (show: boolean) => void;
  setSplitResult: (result: any) => void;
  setSplitResultTaskId: (taskId: string) => void;
  setCurrentNotificationId: (notificationId: string) => void;
  setSplitExecutor: (executor: string) => void;
  pendingSplitNotificationsRef: React.MutableRefObject<any[]>;
  displayedCountRef: React.MutableRefObject<number>;
  processedTaskResultsRef: React.MutableRefObject<Set<string>>;
}

export function useTaskResults({
  agentId,
  sessionId,
  messages,
  setMessages,
  setShowSplitResultConfirm,
  setSplitResult,
  setSplitResultTaskId,
  setCurrentNotificationId,
  setSplitExecutor,
  pendingSplitNotificationsRef,
  displayedCountRef,
  processedTaskResultsRef,
}: UseTaskResultsOptions) {
  const [receivedTaskResults, setReceivedTaskResults] = useState<any[]>([]);
  const [pendingCommands, setPendingCommands] = useState<any[]>([]);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelCommandTaskId, setCancelCommandTaskId] = useState<string>('');
  const [cancelReason, setCancelReason] = useState('');
  const [showClearConfirmDialog, setShowClearConfirmDialog] = useState(false);

  // 处理取消指令
  const handleCancelCommand = useCallback(async () => {
    if (!cancelCommandTaskId || !cancelReason.trim()) {
      return;
    }

    console.log('🔥 用户取消指令:', cancelCommandTaskId);
    console.log('🔥 取消原因:', cancelReason);

    try {
      const response = await fetch(`/api/commands/${cancelCommandTaskId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: cancelReason,
          cancelledBy: agentId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          toast.success('✅ 指令已取消');

          // 移除待处理指令
          setPendingCommands(prev => prev.filter(cmd => cmd.taskId !== cancelCommandTaskId));

          // 添加取消消息到对话框
          const cancelMessage: any = {
            id: `cancel_${Date.now()}`,
            role: 'assistant',
            content: `✅ **指令已取消**

**任务 ID**: ${cancelCommandTaskId}

**取消原因**: ${cancelReason}`,
            timestamp: new Date(),
          };

          setMessages(prev => [...prev, cancelMessage]);
        } else {
          toast.error(`❌ 取消失败: ${data.error}`);
        }
      } else {
        toast.error('❌ 取消失败，请重试');
      }
    } catch (error) {
      console.error('❌ 取消指令时出错:', error);
      toast.error('❌ 取消失败，请重试');
    } finally {
      setShowCancelDialog(false);
      setCancelCommandTaskId('');
      setCancelReason('');
    }
  }, [cancelCommandTaskId, cancelReason, agentId, setMessages]);

  // 确认清空历史
  const confirmClearHistory = useCallback(async () => {
    try {
      console.log('🗑️ 清空历史指令...');

      // 1. 调用后端 API 删除数据库中的历史记录
      await fetch(`/api/agents/${agentId}/history?sessionId=${sessionId}`, {
        method: 'DELETE',
      });

      // 2. 清空对话框消息
      setMessages([]);

      // 3. 清空待处理指令列表
      setPendingCommands([]);

      // 4. 清空接收到的任务结果
      setReceivedTaskResults([]);

      // 5. 清空拆解结果相关状态
      setShowSplitResultConfirm(false);
      setSplitResult(null);
      setSplitResultTaskId('');
      setCurrentNotificationId('');

      // 6. 清空拒绝原因
      // 注意：这里不能直接访问 setRejectReason，因为它是从 useSplitDialogs hook 传入的
      // 这个逻辑应该在 page.tsx 中处理

      // 7. 清空已处理的任务结果记录
      processedTaskResultsRef.current.clear();
      console.log('🧹 已清空已处理的任务结果记录');

      // 8. 重新生成 sessionId
      if (typeof window !== 'undefined') {
        const storageKey = `agent_${agentId}_sessionId`;
        const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem(storageKey, newSessionId);
        console.log(`✅ 已生成新的 sessionId: ${newSessionId}`);
      }

      toast.success('历史记录已清空');
      setShowClearConfirmDialog(false);

      // 返回 true 表示清空成功，page.tsx 可以根据返回值重新加载欢迎消息
      return true;
    } catch (error) {
      console.error('❌ 清空历史记录时出错:', error);
      toast.error('清空失败，请重试');
      return false;
    }
  }, [
    agentId,
    sessionId,
    setMessages,
    setShowSplitResultConfirm,
    setSplitResult,
    setSplitResultTaskId,
    setCurrentNotificationId,
    processedTaskResultsRef,
  ]);

  return {
    receivedTaskResults,
    setReceivedTaskResults,
    pendingCommands,
    setPendingCommands,
    showCancelDialog,
    setShowCancelDialog,
    cancelCommandTaskId,
    setCancelCommandTaskId,
    cancelReason,
    setCancelReason,
    showClearConfirmDialog,
    setShowClearConfirmDialog,
    handleCancelCommand,
    confirmClearHistory,
  };
}

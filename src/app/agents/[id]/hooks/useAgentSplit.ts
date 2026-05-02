/**
 * useAgentSplit - Agent 拆解流程管理 Hook
 *
 * 职责：
 * 1. 管理拆解结果相关的状态
 * 2. 处理拆解结果的确认、拒绝、放弃操作
 * 3. 管理拆解结果弹框的显示和隐藏
 * 4. 处理拆解任务的队列管理
 */

import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';

export interface SplitResult {
  subtasks?: Array<{
    taskTitle: string;
    commandContent: string;
    executor: string;
    taskType: string;
    priority: string;
    deadline: string;
    estimatedHours: string;
    acceptanceCriteria: string;
    id?: string;
  }>;
  subTasks?: Array<{
    taskTitle: string;
    commandContent: string;
    executor: string;
    taskType: string;
    priority: string;
    deadline: string;
    estimatedHours: string;
    acceptanceCriteria: string;
    id?: string;
  }>;
  productTags?: string[]; // 🔥 新增：产品标签
  totalDeliverables?: string;
  timeFrame?: string;
  summary?: string;
}

export interface UseAgentSplitOptions {
  agentId: string;
  onSplitConfirmed?: (result: SplitResult) => void;
  onSplitRejected?: (reason: string) => void;
  onSplitAbandoned?: () => void;
}

export function useAgentSplit(options: UseAgentSplitOptions) {
  const { agentId, onSplitConfirmed, onSplitRejected, onSplitAbandoned } = options;

  // ========== 拆解对话框状态 ==========
  const [showSplitResultConfirm, setShowSplitResultConfirm] = useState(false);
  const [splitResult, setSplitResult] = useState<SplitResult | null>(null);
  const [isProcessingSplitResult, setIsProcessingSplitResult] = useState(false);
  const [splitExecutor, setSplitExecutor] = useState('Agent B');
  const [isSplitResultDialogMinimized, setIsSplitResultDialogMinimized] = useState(false);

  // ========== 拆解任务相关状态 ==========
  const [splitResultTaskId, setSplitResultTaskId] = useState('');
  const [currentNotificationId, setCurrentNotificationId] = useState<string>('');

  // ========== 拒绝相关状态 ==========
  const [showRejectReasonDialog, setShowRejectReasonDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmittingReject, setIsSubmittingReject] = useState(false);

  // ========== Refs ==========
  const submitLockRef = useRef(false);
  const isClosingByButtonRef = useRef(false);
  const sentSplitTaskIdsRef = useRef<Set<string>>(new Set());
  const displayedCountRef = useRef(0);
  const pendingSplitNotificationsRef = useRef<any[]>([]);

  // ========== 处理拆解结果确认 ==========
  const handleSplitResultConfirm = useCallback(async () => {
    // 强制检查锁，防止重复点击
    if (submitLockRef.current) {
      console.log('⚠️ 请求正在进行中，忽略重复点击');
      return;
    }
    
    // 立即加锁（同步操作）
    submitLockRef.current = true;
    
    console.log('✅ 用户确认拆解结果');
    
    // 标记为通过按钮关闭，避免触发 Dialog 的 onOpenChange 回调
    isClosingByButtonRef.current = true;
    
    setShowSplitResultConfirm(false);
    setIsProcessingSplitResult(true);

    try {
      // 同时支持 subtasks（小写）和 subTasks（大写）两种写法
      const subTasks = splitResult?.subtasks || splitResult?.subTasks;
      if (splitResult && subTasks && subTasks.length > 0) {
        console.log('🔍 [Agent B 拆解] 直接向 Agent 发送指令...');

        // 步骤 0：先保存拆解结果到 daily_task 表
        console.log('💾 开始保存拆解结果到 daily_task 表...');
        try {
          const saveResponse = await fetch('/api/daily-tasks/confirm-split', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              taskId: splitResultTaskId,
              splitResult: splitResult,
            }),
          });

          if (saveResponse.ok) {
            const saveResult = await saveResponse.json();
            console.log(`✅ 拆解结果已保存到 daily_task 表:`, saveResult);
            toast.success(`已保存 ${saveResult.data?.totalTasks || splitResult.subTasks?.length || 0} 条任务记录`);
          } else {
            const errorText = await saveResponse.text();
            console.error('❌ 保存拆解结果失败:', errorText);
            toast.error('保存拆解结果失败');
          }
        } catch (error) {
          console.error('❌ 保存拆解结果时出错:', error);
          toast.error('保存拆解结果时出错');
        }

        // 步骤 1：去重检查：检查拆解任务是否已发送过
        const alreadySentCount = subTasks.filter((st: any) => st.id && sentSplitTaskIdsRef.current.has(st.id)).length;
        if (alreadySentCount > 0) {
          console.warn(`⚠️ 检测到 ${alreadySentCount} 个子任务已发送过，已跳过`);
          alert(`⚠️ 有 ${alreadySentCount} 个子任务已发送过，已自动跳过`);
        }

        console.log(`📤 准备发送 ${subTasks.length} 条子任务指令`);

        // TODO: 这里需要调用 sendCommandToAgent 函数
        // 由于该函数依赖于外部上下文，需要在页面中传入
        console.log('📤 子任务发送逻辑待实现（需要传入 sendCommandToAgent 函数）');
      }
      
      // 更新通知 metadata，标记为 confirmed
      if (currentNotificationId) {
        try {
          await fetch('/api/notifications/update-metadata', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              notificationId: currentNotificationId,
              metadata: {
                splitPopupStatus: 'confirmed',
                confirmedAt: new Date().toISOString(),
              },
            }),
          });
        } catch (error) {
          console.error('❌ 更新通知状态失败:', error);
        }
      }

      // 显示队列中的下一个拆解结果
      setTimeout(() => {
        console.log(`🔍 [确认后队列] 检查队列中的待显示通知...`);
        if (pendingSplitNotificationsRef.current.length > 0) {
          const nextNotification = pendingSplitNotificationsRef.current.shift();
          console.log(`🎉 [确认后队列] 找到下一个通知: ${nextNotification?.notification?.notificationId}`);
          
          if (nextNotification) {
            const { notification, jsonData, taskIdToUse, displayExecutor } = nextNotification;
            
            // 更新通知状态
            fetch('/api/notifications/update-metadata', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                notificationId: notification.notificationId,
                metadata: {
                  splitPopupStatus: 'popup_shown',
                  popupShownAt: new Date().toISOString(),
                },
              }),
            });
            
            console.log(`🎉 [确认后队列] 准备显示下一个弹框...`);
            setShowSplitResultConfirm(true);
            setSplitResultTaskId(taskIdToUse);
            setCurrentNotificationId(notification.notificationId || '');
            setSplitResult(jsonData);
            setSplitExecutor(displayExecutor);
          }
        } else {
          console.log(`📋 [确认后队列] 队列为空，没有待显示的通知`);
        }
      }, 1000);

      // 调用回调
      if (onSplitConfirmed && splitResult) {
        onSplitConfirmed(splitResult);
      }
    } catch (error) {
      console.error('❌ 发送子任务时出错:', error);
      toast.error('发送子任务失败');
    } finally {
      // 确保无论成功或失败都重置状态
      setIsProcessingSplitResult(false);
      submitLockRef.current = false;
    }
  }, [splitResult, splitResultTaskId, currentNotificationId, onSplitConfirmed]);

  // ========== 处理拒绝原因提交 ==========
  const handleSubmitRejectReason = useCallback(async () => {
    console.log('🔧 [Agent B 拒绝] ===== 开始处理拒绝 =====');

    // 前置检查
    if (!rejectReason.trim()) {
      console.error('❌ [Agent B 拒绝] 拒绝原因为空，不允许提交');
      return;
    }

    if (isSubmittingReject) {
      console.error('❌ [Agent B 拒绝] 正在提交中，不允许重复提交');
      return;
    }

    console.log('🔧 [Agent B 拒绝] 设置 isSubmittingReject = true');
    setIsSubmittingReject(true);

    try {
      // 调用 Agent B 拒绝 API
      const response = await fetch('/api/agents/b/reject-split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationId: currentNotificationId,
          taskId: splitResultTaskId,
          rejectionReason: rejectReason,
          splitResult: splitResult, // 🔥 传递上次拆解结果
          retry: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`拒绝失败: ${errorText}`);
      }

      const result = await response.json();
      console.log(`✅ [Agent B 拆解] 拒绝成功:`, result);

      // 更新通知 metadata，标记为 rejected
      if (currentNotificationId) {
        try {
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
        } catch (error) {
          console.error('❌ [Agent B 拒绝] 更新通知状态失败:', error);
        }
      }

      // 显示成功提示
      if (result.data?.asyncSplit) {
        toast.success('✅ 已拒绝拆解，正在后台重新拆解任务...', {
          duration: 5000,
          description: '新的拆解结果将通过 WebSocket 实时推送',
        });
      } else {
        toast.success(`✅ 已拒绝拆解，并重新拆解生成 ${result.data?.retryResult?.splitResult?.subtasks?.length || '新'} 个子任务`);
      }

      // 关闭弹框
      setShowRejectReasonDialog(false);
      setShowSplitResultConfirm(false);

      // 清空状态
      setSplitResult(null);
      setSplitResultTaskId('');
      setSplitExecutor('Agent B');
      setCurrentNotificationId('');
      setRejectReason('');
      displayedCountRef.current = 0;

      // 调用回调
      if (onSplitRejected) {
        onSplitRejected(rejectReason);
      }

      // 处理队列中的下一个通知
      setTimeout(() => {
        console.log(`🔍 [Agent B 拒绝后队列] 检查队列中的待显示通知...`);
        if (pendingSplitNotificationsRef.current.length > 0) {
          const nextNotification = pendingSplitNotificationsRef.current.shift();
          
          if (nextNotification) {
            const { notification, jsonData, taskIdToUse, displayExecutor } = nextNotification;
            
            fetch('/api/notifications/update-metadata', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                notificationId: notification.notificationId,
                metadata: {
                  splitPopupStatus: 'popup_shown',
                  popupShownAt: new Date().toISOString(),
                },
              }),
            });
            
            setShowSplitResultConfirm(true);
            setSplitResultTaskId(taskIdToUse);
            setCurrentNotificationId(notification.notificationId || '');
            setSplitResult(jsonData);
            setSplitExecutor(displayExecutor);
            displayedCountRef.current++;
          }
        }
      }, 1000);
    } catch (error) {
      console.error('❌ [Agent B 拆解] 拒绝失败:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(errorMessage);
      setShowRejectReasonDialog(true);
    } finally {
      setTimeout(() => {
        setIsSubmittingReject(false);
      }, 50);
    }
  }, [rejectReason, isSubmittingReject, currentNotificationId, splitResultTaskId, onSplitRejected]);

  // ========== 处理拆解结果拒绝 ==========
  const handleSplitResultReject = useCallback(() => {
    console.log('❌ 用户拒绝拆解结果');
    setShowRejectReasonDialog(true);
  }, []);

  // ========== 处理拆解结果放弃 ==========
  const handleSplitResultAbandon = useCallback(() => {
    console.log('🔥 用户放弃拆解结果');
    isClosingByButtonRef.current = true;
    setShowSplitResultConfirm(false);
    setSplitResult(null);
    setSplitResultTaskId('');
    setSplitExecutor('Agent B');
    setCurrentNotificationId('');
    
    if (onSplitAbandoned) {
      onSplitAbandoned();
    }
  }, [onSplitAbandoned]);

  // ========== 处理拆解结果对话框关闭 ==========
  const handleSplitResultDialogClose = useCallback((open: boolean) => {
    if (!open && !isClosingByButtonRef.current) {
      console.log('🔥 用户通过其他方式关闭了拆解结果对话框');
    }
    isClosingByButtonRef.current = false;
  }, []);

  // ========== 切换弹框最小化状态 ==========
  const toggleSplitResultDialogMinimize = useCallback(() => {
    setIsSplitResultDialogMinimized(prev => !prev);
  }, []);

  // ========== 显示拆解结果弹框 ==========
  const showSplitResult = useCallback((
    result: SplitResult,
    taskId: string,
    notificationId: string,
    executor: string = 'Agent B'
  ) => {
    setSplitResult(result);
    setSplitResultTaskId(taskId);
    setCurrentNotificationId(notificationId);
    setSplitExecutor(executor);
    setShowSplitResultConfirm(true);
  }, []);

  // ========== 添加到待显示队列 ==========
  const addToPendingQueue = useCallback((
    notification: any,
    jsonData: SplitResult,
    taskId: string,
    executor: string
  ) => {
    pendingSplitNotificationsRef.current.push({
      notification,
      jsonData,
      taskIdToUse: taskId,
      displayExecutor: executor,
    });
  }, []);

  return {
    // ========== 状态 ==========
    showSplitResultConfirm,
    showRejectReasonDialog,
    isSplitResultDialogMinimized,
    splitResult,
    splitExecutor,
    splitResultTaskId,
    currentNotificationId,
    rejectReason,
    isSubmittingReject,
    isProcessingSplitResult,

    // ========== 设置状态的方法 ==========
    setShowSplitResultConfirm,
    setShowRejectReasonDialog,
    setSplitResult,
    setSplitExecutor,
    setSplitResultTaskId,
    setCurrentNotificationId,
    setRejectReason,
    setIsSplitResultDialogMinimized,

    // ========== 事件处理方法 ==========
    handleSplitResultConfirm,
    handleSubmitRejectReason,
    handleSplitResultReject,
    handleSplitResultAbandon,
    handleSplitResultDialogClose,
    toggleSplitResultDialogMinimize,

    // ========== 辅助方法 ==========
    showSplitResult,
    addToPendingQueue,

    // ========== Refs (只读) ==========
    refs: {
      submitLockRef,
      isClosingByButtonRef,
      sentSplitTaskIdsRef,
      displayedCountRef,
      pendingSplitNotificationsRef,
    },
  };
}

'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import { isWritingAgent } from '@/lib/agents/agent-registry';
import type { Message } from 'ai';
import { useSplitNotifications, type SplitNotification } from './use-split-notifications';
import { useSplitActions } from './use-split-actions';
import { mapExecutorId } from '@/lib/utils/agent-mapper';

/**
 * useAgentSplit Hook
 * 
 * 整合所有拆解相关的逻辑，提供统一的接口
 */
export function useAgentSplit(
  agentId: string,
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
) {
  // 使用拆解通知管理
  const splitNotifications = useSplitNotifications();
  
  // 使用拆解操作（确认/拒绝）
  const splitActions = useSplitActions(
    agentId,
    setMessages,
    {
      resetSplitState: splitNotifications.resetSplitState,
      showNextNotificationFromQueue: splitNotifications.showNextNotificationFromQueue,
      closeDialogByButton: splitNotifications.closeDialogByButton,
      setShowSplitResultConfirm: splitNotifications.setShowSplitResultConfirm,
      setRejectReason: splitActions.setRejectReason,
    }
  );

  // insurance-d 相关状态
  const [showInsuranceDSplitDialog, setShowInsuranceDSplitDialog] = [false, () => {}];
  const [selectedDailyTaskForSplit, setSelectedDailyTaskForSplit] = [null, () => {}];
  const [insuranceDSplitResult, setInsuranceDSplitResult] = [null, () => {}];

  /**
   * 处理新的拆解结果通知
   */
  const handleNewSplitNotification = useCallback((
    notification: any,
    agentIdParam: string
  ) => {
    console.log(`🔍 [拆解通知] 收到新的拆解结果通知`);

    const notificationId = notification.notificationId || notification.id;
    if (!notificationId) {
      console.warn(`⚠️ [拆解通知] 通知缺少 notificationId，跳过`);
      return;
    }

    // 解析通知中的拆解结果
    const { jsonData, actualTaskId } = splitNotifications.parseSplitResultFromNotification(notification);

    if (!splitNotifications.isJsonDataValid(jsonData)) {
      console.log(`⚠️ [拆解通知] 通知中没有有效的拆解结果，跳过`);
      return;
    }

    // 检查通知是否已经被处理过
    const popupStatus = notification.metadata?.splitPopupStatus;
    if (['rejected', 'confirmed', 'skipped', 'popup_shown'].includes(popupStatus)) {
      console.log(`⚠️ [拆解通知] 通知已被处理（${popupStatus}），跳过弹框`);
      return;
    }

    // 如果是 'viewed_not_confirmed' 状态，记录日志并继续处理
    if (popupStatus === 'viewed_not_confirmed') {
      console.log(`🔄 [拆解通知] 通知 ${notificationId} 状态为 viewed_not_confirmed，重新弹窗`);
    }

    console.log(`✅ [拆解通知] 处理新的拆解结果: ${notificationId}`);

    // 判断拆解执行者
    let displayExecutor = 'Agent B';
    if (jsonData.subTasks && jsonData.subTasks.length > 0) {
      const firstExecutor = jsonData.subTasks[0]?.executor;
      const mappedExecutor = mapExecutorId(firstExecutor);
      if (isWritingAgent(mappedExecutor) || mappedExecutor === 'insurance-c') {
        displayExecutor = mappedExecutor;
      }
    }

    // 创建通知对象
    const splitNotification: SplitNotification = {
      notification,
      jsonData,
      taskIdToUse: actualTaskId,
      displayExecutor,
    };

    // 添加到队列
    splitNotifications.addNotificationToQueue(splitNotification);

    // 如果当前没有显示弹框，立即显示
    if (!splitNotifications.showSplitResultConfirm) {
      splitNotifications.showNextNotificationFromQueue();
    }
  }, [splitNotifications]);

  /**
   * 处理确认后队列（用户点击确认按钮后
   */
  const handleAfterConfirm = useCallback(() => {
    console.log(`🎉 [确认后] 处理确认后队列...`);
    splitNotifications.showNextNotificationFromQueue();
  }, [splitNotifications]);

  /**
   * 处理拒绝后队列（用户点击拒绝按钮后）
   */
  const handleAfterReject = useCallback(() => {
    console.log(`🎉 [拒绝后] 处理拒绝后队列...`);
    splitNotifications.showNextNotificationFromQueue();
  }, [splitNotifications]);

  /**
   * 处理放弃后队列（用户点击放弃按钮后）
   */
  const handleAfterAbandon = useCallback(() => {
    console.log(`🎉 [放弃后] 处理放弃后队列...`);
    splitNotifications.showNextNotificationFromQueue();
  }, [splitNotifications]);

  return {
    // 拆解通知相关
    ...splitNotifications,
    
    // 拆解操作相关
    ...splitActions,

    // insurance-d 相关
    showInsuranceDSplitDialog,
    setShowInsuranceDSplitDialog,
    selectedDailyTaskForSplit,
    setSelectedDailyTaskForSplit,
    insuranceDSplitResult,
    setInsuranceDSplitResult,

    // 整合方法
    handleNewSplitNotification,
    handleAfterConfirm,
    handleAfterReject,
    handleAfterAbandon,
  };
}

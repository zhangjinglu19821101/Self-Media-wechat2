'use client';

import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { mapExecutorId } from '@/lib/utils/agent-mapper';
import { isWritingAgent } from '@/lib/agents/agent-registry';

/**
 * 拆解结果通知类型
 */
export interface SplitNotification {
  notification: any;
  jsonData: any;
  taskIdToUse: string;
  displayExecutor: string;
}

/**
 * useSplitNotifications Hook
 * 
 * 处理拆解结果通知的逻辑，包括：
 * - 通知队列管理
 * - 弹框状态管理
 * - 通知元数据更新
 */
export function useSplitNotifications() {
  // 状态
  const [showSplitResultConfirm, setShowSplitResultConfirm] = useState(false);
  const [splitResult, setSplitResult] = useState<any>(null);
  const [splitResultTaskId, setSplitResultTaskId] = useState('');
  const [currentNotificationId, setCurrentNotificationId] = useState('');
  const [currentNotification, setCurrentNotification] = useState<any>(null);
  const [splitExecutor, setSplitExecutor] = useState('Agent B');
  const [isSplitResultDialogMinimized, setIsSplitResultDialogMinimized] = useState(false);

  // Refs
  const pendingSplitNotificationsRef = useRef<SplitNotification[]>([]);
  const displayedCountRef = useRef(0);
  const isClosingByButtonRef = useRef(false);

  /**
   * 检查 jsonData 是否有效
   */
  const isJsonDataValid = useCallback((jsonData: any): boolean => {
    return !!(jsonData && (jsonData.subtasks || jsonData.subTasks));
  }, []);

  /**
   * 更新通知元数据
   */
  const updateNotificationMetadata = useCallback(async (
    notificationId: string,
    metadata: Record<string, any>
  ) => {
    if (!notificationId) return;
    
    try {
      await fetch('/api/notifications/update-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationId,
          metadata,
        }),
      });
    } catch (error) {
      console.error('❌ [通知] 更新元数据失败:', error);
    }
  }, []);

  /**
   * 添加通知到队列
   */
  const addNotificationToQueue = useCallback((notification: SplitNotification) => {
    pendingSplitNotificationsRef.current.push(notification);
    console.log(`📋 [队列] 添加通知到队列，当前队列长度: ${pendingSplitNotificationsRef.current.length}`);
  }, []);

  /**
   * 从队列中取出下一个通知并显示
   */
  const showNextNotificationFromQueue = useCallback(() => {
    if (pendingSplitNotificationsRef.current.length === 0) {
      console.log(`📋 [队列] 队列为空，没有待显示的通知`);
      return;
    }

    const nextNotification = pendingSplitNotificationsRef.current.shift();
    if (!nextNotification) return;

    const { notification, jsonData, taskIdToUse, displayExecutor } = nextNotification;

    // 检查 jsonData 是否有效
    if (!isJsonDataValid(jsonData)) {
      console.log(`⚠️ [队列] jsonData 无效，跳过此通知:`, {
        hasJsonData: !!jsonData,
        hasSubtasks: !!(jsonData?.subtasks || jsonData?.subTasks),
        jsonDataType: typeof jsonData,
      });
      return;
    }

    // 更新通知状态
    if (notification.notificationId) {
      updateNotificationMetadata(notification.notificationId, {
        splitPopupStatus: 'popup_shown',
        popupShownAt: new Date().toISOString(),
      });
    }

    // 显示弹框
    console.log(`🎉 [队列] 准备显示弹框...`);
    setShowSplitResultConfirm(true);
    setSplitResultTaskId(taskIdToUse);
    setCurrentNotificationId(notification.notificationId || '');
    setCurrentNotification(notification);
    setSplitResult(jsonData);
    setSplitExecutor(displayExecutor);

    // 增加显示计数
    displayedCountRef.current++;
    console.log(`📊 [队列] 显示计数: ${displayedCountRef.current}/2`);
  }, [isJsonDataValid, updateNotificationMetadata]);

  /**
   * 处理弹框关闭（用户未确认）
   */
  const handleDialogClose = useCallback((open: boolean) => {
    if (!open && !isClosingByButtonRef.current) {
      console.log('🔥 用户通过其他方式关闭了拆解结果对话框');
      
      // 用户关闭弹框但未确认，设置状态为 'viewed_not_confirmed'
      if (currentNotificationId) {
        console.log(`📝 [弹框关闭] 更新通知 ${currentNotificationId} 状态为 viewed_not_confirmed`);
        updateNotificationMetadata(currentNotificationId, {
          splitPopupStatus: 'viewed_not_confirmed',
          lastViewedAt: new Date().toISOString(),
        }).catch(error => {
          console.error('❌ [弹框关闭] 更新通知状态失败:', error);
        });
      }
    }
    isClosingByButtonRef.current = false;
  }, [currentNotificationId, updateNotificationMetadata]);

  /**
   * 关闭弹框（通过按钮）
   */
  const closeDialogByButton = useCallback(() => {
    isClosingByButtonRef.current = true;
    setShowSplitResultConfirm(false);
  }, []);

  /**
   * 重置所有拆解相关状态
   */
  const resetSplitState = useCallback(() => {
    setSplitResult(null);
    setSplitResultTaskId('');
    setSplitExecutor('Agent B');
    setCurrentNotificationId('');
    setCurrentNotification(null);
    displayedCountRef.current = 0;
    console.log('🔧 已重置所有拆解相关状态');
  }, []);

  /**
   * 从通知中解析拆解结果
   */
  const parseSplitResultFromNotification = useCallback((notification: any) => {
    let jsonData = null;
    let actualTaskId = notification.taskId;

    // 尝试解析 content 或 result
    if (notification.content?.splitResult) {
      try {
        jsonData = typeof notification.content.splitResult === 'string'
          ? JSON.parse(notification.content.splitResult)
          : notification.content.splitResult;
      } catch (e) {
        console.warn('⚠️ 解析 content.splitResult 失败:', e);
      }
    } else if (notification.result) {
      try {
        jsonData = typeof notification.result === 'string'
          ? JSON.parse(notification.result)
          : notification.result;
      } catch (e) {
        console.warn('⚠️ 解析 result 失败:', e);
      }
    } else if (notification.content?.result) {
      try {
        jsonData = typeof notification.content.result === 'string'
          ? JSON.parse(notification.content.result)
          : notification.content.result;
      } catch (e) {
        console.warn('⚠️ 解析 content.result 失败:', e);
      }
    }

    // 如果是 insurance-d 拆解，从 metadata.dailyTaskIds[0] 获取真正的 UUID
    if (jsonData && jsonData.subTasks && jsonData.subTasks.length > 0) {
      const firstExecutor = jsonData.subTasks[0]?.executor;
      const mappedExecutor = mapExecutorId(firstExecutor);
      if (isWritingAgent(mappedExecutor) || mappedExecutor === 'insurance-c') {
        try {
          const meta = typeof notification.metadata === 'string'
            ? JSON.parse(notification.metadata)
            : notification.metadata;
          if (meta?.dailyTaskIds && Array.isArray(meta.dailyTaskIds) && meta.dailyTaskIds.length > 0) {
            actualTaskId = meta.dailyTaskIds[0];
            console.log(`🔥 [insurance-d] 从 metadata.dailyTaskIds 获取 UUID: ${actualTaskId}`);
          } else {
            console.warn(`⚠️ [insurance-d] metadata.dailyTaskIds 不存在或为空，使用 fallback`);
            actualTaskId = notification.metadata?.dailyTaskId || notification.relatedTaskId || notification.taskId;
          }
        } catch (e) {
          console.error(`❌ [insurance-d] 解析 metadata 失败:`, e);
          actualTaskId = notification.metadata?.dailyTaskId || notification.relatedTaskId || notification.taskId;
        }
      }
    }

    return { jsonData, actualTaskId };
  }, []);

  return {
    // 状态
    showSplitResultConfirm,
    setShowSplitResultConfirm,
    splitResult,
    setSplitResult,
    splitResultTaskId,
    setSplitResultTaskId,
    currentNotificationId,
    setCurrentNotificationId,
    currentNotification,
    setCurrentNotification,
    splitExecutor,
    setSplitExecutor,
    isSplitResultDialogMinimized,
    setIsSplitResultDialogMinimized,

    // Refs（用于内部逻辑）
    pendingSplitNotificationsRef,
    displayedCountRef,

    // 方法
    isJsonDataValid,
    updateNotificationMetadata,
    addNotificationToQueue,
    showNextNotificationFromQueue,
    handleDialogClose,
    closeDialogByButton,
    resetSplitState,
    parseSplitResultFromNotification,
  };
}

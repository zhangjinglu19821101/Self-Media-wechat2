/**
 * Agent WebSocket Hook
 * 使用 HTTP 轮询获取实时通知
 *
 * 🔥 使用 HTTP 轮询替代 SSE，因为 SSE 连接不稳定
 * 每 15 秒查询一次通知 API，获取最新的任务结果（降低频率，避免弹框反复弹出）
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { AgentId } from '../lib/agent-types';

export interface WSMessage {
  type: 'new_command' | 'task_result' | 'system_notification' | 'duplicate_task_warning';
  fromAgentId?: string;
  toAgentId?: string;
  command?: string;
  commandType?: 'instruction' | 'task' | 'report' | 'urgent';
  priority?: 'high' | 'normal' | 'low';
  timestamp?: string;
  message?: string;
  data?: any;
  taskId?: string;
  result?: string | Record<string, any>; // 🔥 修复：支持字符串和对象类型
  status?: string;
  notificationId?: string; // 🔥 新增：通知 ID
  metadata?: Record<string, any>; // 🔥 新增：元数据
}

export interface WSStatus {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  lastMessage: WSMessage | null;
}

export interface CommandNotification {
  fromAgentId: string;
  toAgentId: string;
  command: string;
  commandType: 'instruction' | 'task' | 'report' | 'urgent';
  priority: 'high' | 'normal' | 'low';
  timestamp: string;
  data?: any;
}

export function useAgentWebSocket(agentId: AgentId) {
  const [status, setStatus] = useState<WSStatus>({
    connected: false,
    connecting: false,
    error: null,
    lastMessage: null,
  });
  const [commands, setCommands] = useState<CommandNotification[]>([]);
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastNotificationTimestampRef = useRef<number>(0); // 🔥 初始化为 0，确保首次轮询能获取所有通知
  const processedNotificationsRef = useRef<Set<string>>(new Set()); // 🔥 避免重复处理通知

  /**
   * 处理重复任务警告
   */
  const handleDuplicateTaskWarning = useCallback((notification: any) => {
    console.log(`⚠️ 收到重复任务警告:`, notification);
    
    // 显示 Toast 通知
    toast.warning(
      notification.title || '⚠️ 检测到重复任务',
      {
        description: notification.content?.message || '系统检测到相似任务已存在，已跳过创建',
        duration: 8000,
      }
    );
  }, []);

  /**
   * 处理新指令
   */
  const handleNewCommand = useCallback((command: CommandNotification) => {
    console.log(`📢 New command received for Agent ${agentId}:`, command);

    // 添加到指令列表
    setCommands(prev => [command, ...prev]);

    // 显示通知
    const priorityLabel = {
      high: '【紧急】',
      normal: '',
      low: '【低优先级】',
    };

    const typeLabel = {
      instruction: '指令',
      task: '任务',
      report: '报告',
      urgent: '紧急指令',
    };

    const fromAgentNames: Record<string, string> = {
      A: '总裁',
      B: '技术负责人',
      C: 'AI运营总监',
      D: 'AI内容负责人',
      'insurance-c': '保险运营总监',
      'insurance-d': '保险内容负责人',
    };

    toast.success(
      `${priorityLabel[command.priority]}收到来自 ${fromAgentNames[command.fromAgentId] || command.fromAgentId} 的${typeLabel[command.commandType]}`,
      {
        description: command.command.substring(0, 100) + (command.command.length > 100 ? '...' : ''),
        duration: 5000,
        action: {
          label: '查看',
          onClick: () => {
            window.location.href = `/agents/${agentId}/commands`;
          },
        },
      }
    );
  }, [agentId]);

  /**
   * 处理任务结果
   */
  const handleTaskResult = useCallback((message: any) => {
    console.log(`📢 Task result received for Agent ${agentId}:`, message);

    const fromAgentNames: Record<string, string> = {
      A: '总裁',
      B: '技术负责人',
      C: 'AI运营总监',
      D: 'AI内容负责人',
      'insurance-c': '保险运营总监',
      'insurance-d': '保险内容负责人',
    };

    const statusLabel = {
      completed: '已完成',
      failed: '执行失败',
      in_progress: '执行中',
      pending: '待处理',
    };

    const fromAgentName = fromAgentNames[message.fromAgentId] || message.fromAgentId;
    const taskStatus = statusLabel[message.status as keyof typeof statusLabel] || message.status;
    
    // 🔥 修复：处理 JSON 对象和字符串格式的 result
    let resultPreview = '无详细结果';
    if (message.result) {
      if (typeof message.result === 'string') {
        resultPreview = message.result.substring(0, 150) + (message.result.length > 150 ? '...' : '');
      } else if (typeof message.result === 'object') {
        // 如果是 JSON 对象，提取 summary 或 subTasks 信息
        if (message.result.summary) {
          resultPreview = message.result.summary;
        } else if (message.result.subTasks && Array.isArray(message.result.subTasks)) {
          resultPreview = `包含 ${message.result.subTasks.length} 个子任务`;
        } else {
          resultPreview = JSON.stringify(message.result).substring(0, 150) + '...';
        }
      }
    }

    toast.success(
      `✅ ${fromAgentName} 已完成任务（${taskStatus}）`,
      {
        description: resultPreview,
        duration: 10000,
        action: {
          label: '在执行结果面板查看',
          onClick: () => {
            console.log('查看任务详情:', message.taskId);
          },
        },
      }
    );
  }, [agentId]);

  /**
   * 处理全局调度唤醒指令
   */
  const handleGlobalScheduleWakeUp = useCallback(async (notification: any) => {
    console.log(`⏰ 处理全局调度唤醒指令:`, notification);

    const commandContent = notification.command || notification.message || '执行定时任务';
    const taskId = notification.taskId || `schedule-${Date.now()}`;

    // 显示通知
    toast.success(
      `⏰ 收到全局调度任务`,
      {
        description: commandContent.substring(0, 100) + (commandContent.length > 100 ? '...' : ''),
        duration: 8000,
      }
    );

    // 自动调用 /api/commands/send 执行任务
    try {
      console.log(`🚀 自动调用 /api/commands/send 执行任务: ${commandContent}`);

      const response = await fetch('/api/commands/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromAgentId: 'A',  // 模拟Agent A发送
          toAgentId: agentId,  // 当前Agent接收
          command: commandContent,
          commandType: 'instruction',
          priority: 'normal',
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log(`✅ 全局调度任务已提交执行:`, result);
        toast.success(
          `✅ 定时任务已启动`,
          {
            description: '任务正在执行中...',
            duration: 5000,
          }
        );
      } else {
        console.error(`❌ 定时任务执行失败:`, result);
        toast.error(
          `❌ 定时任务执行失败`,
          {
            description: result.message || '未知错误',
            duration: 5000,
          }
        );
      }
    } catch (error) {
      console.error(`❌ 调用 /api/commands/send 失败:`, error);
      toast.error(
        `❌ 定时任务启动失败`,
        {
          description: '网络错误或服务异常',
          duration: 5000,
        }
      );
    }
  }, [agentId]);

  /**
   * 轮询通知
   */
  const pollNotifications = useCallback(async () => {
    try {
      // 🔥 修改：不使用时间戳过滤，查询所有未读通知
      const response = await fetch(`/api/agents/${agentId}/notifications`);
      const data = await response.json();

      if (data.success && data.data.notifications.length > 0) {
        console.log(`📨 轮询收到 ${data.data.notifications.length} 条通知`);

        // 处理每个通知
        for (const notification of data.data.notifications) {
          // 🔥 避免重复处理通知（使用 notificationId）
          if (processedNotificationsRef.current.has(notification.notificationId)) {
            continue;
          }
          processedNotificationsRef.current.add(notification.notificationId);

          setStatus(prev => ({ ...prev, lastMessage: notification }));

          // 处理不同类型的消息
          switch (notification.type) {
            case 'new_command':
              console.log(`🎯 处理新指令: from=${notification.fromAgentId}, to=${notification.toAgentId}`);
              handleNewCommand(notification as CommandNotification);
              break;

            case 'task_result':
              console.log(`✅ 处理任务结果: from=${notification.fromAgentId}, to=${notification.toAgentId}, taskId=${notification.taskId}`);
              handleTaskResult(notification);
              break;

            case 'system_notification':
              console.log(`📢 系统通知:`, notification.message);
              if (notification.message) {
                toast.info(notification.message);
              }
              break;

            case 'global_schedule_wake_up':
              console.log(`⏰ 全局调度唤醒指令: ${notification.message}`);
              handleGlobalScheduleWakeUp(notification);
              break;

            case 'duplicate_task_warning':
              console.log(`⚠️ 处理重复任务警告:`, notification);
              handleDuplicateTaskWarning(notification);
              break;
          }

          // 🔥 更新最后的时间戳（用于排序，不用于过滤）
          const notificationTime = new Date(notification.timestamp).getTime();
          if (notificationTime > lastNotificationTimestampRef.current) {
            lastNotificationTimestampRef.current = notificationTime;
          }

          // 🔥 根据通知类型决定是否标记为已读
          // - new_command: 立即标记为已读（只显示 Toast）
          // - system_notification: 立即标记为已读（只显示 Toast）
          // - duplicate_task_warning: 立即标记为已读（显示弹框）
          // - task_result: 不标记为已读（等待用户通过弹框操作）
          if (notification.type === 'new_command' || 
              notification.type === 'system_notification' ||
              notification.type === 'duplicate_task_warning') {
            try {
              await fetch(`/api/agents/${agentId}/notifications/read`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  notificationId: notification.notificationId,
                }),
              });
              console.log(`✅ 通知 ${notification.notificationId} 已标记为已读（类型: ${notification.type}）`);
            } catch (error) {
              console.error('标记通知为已读失败:', error);
            }
          } else if (notification.type === 'task_result') {
            console.log(`⏭️  task_result 类型通知 ${notification.notificationId} 保持未读状态，等待用户操作`);
          }
        }
      }
    } catch (error) {
      console.error(`轮询通知失败 Agent ${agentId}:`, error);
    }
  }, [agentId, handleNewCommand, handleTaskResult, handleDuplicateTaskWarning]);

  /**
   * 连接（启动轮询）
   */
  const connect = useCallback(() => {
    if (pollingTimerRef.current) {
      console.log(`轮询已在运行，无需重新启动`);
      return;
    }

    setStatus(prev => ({ ...prev, connecting: true, error: null }));
    console.log(`🔄 启动 HTTP 轮询 for Agent ${agentId}`);

    // 立即执行一次
    pollNotifications().then(() => {
      setStatus(prev => ({ ...prev, connected: true, connecting: false }));
    });

    // 每 15 秒轮询一次（降低频率，避免弹框反复弹出）
    pollingTimerRef.current = setInterval(() => {
      pollNotifications();
    }, 15000);
  }, [agentId, pollNotifications]);

  /**
   * 断开（停止轮询）
   */
  const disconnect = useCallback(() => {
    console.log(`🛑 停止 HTTP 轮询 for Agent ${agentId}`);

    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }

    setStatus(prev => ({
      ...prev,
      connected: false,
      connecting: false,
    }));
  }, [agentId]);

  /**
   * 清除指定指令
   */
  const clearCommand = useCallback((index: number) => {
    setCommands(prev => prev.filter((_, i) => i !== index));
  }, []);

  /**
   * 清除所有指令
   */
  const clearAllCommands = useCallback(() => {
    setCommands([]);
  }, []);

  // 组件挂载时启动轮询
  useEffect(() => {
    console.log(`🔄 useAgentWebSocket useEffect triggered for Agent ${agentId}`);

    // 启动轮询
    connect();

    // 组件卸载时停止轮询
    return () => {
      console.log(`🛑 useAgentWebSocket cleanup for Agent ${agentId}`);
      disconnect();
    };
    // 只依赖 agentId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  return {
    status,
    commands,
    lastMessage: status.lastMessage, // 🔥 添加 lastMessage 到返回值
    connect,
    disconnect,
    clearCommand,
    clearAllCommands,
  };
}

'use client';

/**
 * 浏览器通知 Hook
 * 
 * 功能：
 * - 请求通知权限
 * - 显示桌面通知
 * - 轮询已触发的提醒
 */

import { useEffect, useCallback, useState } from 'react';
import type { NotifyMethod } from '@/lib/db/schema/reminders';

interface Reminder {
  id: string;
  content: string;
  remindAt: string;
  repeatMode: string;
  notifyMethods: NotifyMethod[];
}

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  onClick?: () => void;
}

export function useBrowserNotification() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported('Notification' in window);
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  /**
   * 请求通知权限
   */
  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      console.warn('[Notification] 浏览器不支持通知');
      return false;
    }

    const result = await Notification.requestPermission();
    setPermission(result);
    return result === 'granted';
  }, [isSupported]);

  /**
   * 显示桌面通知
   */
  const showNotification = useCallback((options: NotificationOptions) => {
    if (!isSupported || permission !== 'granted') {
      console.warn('[Notification] 无通知权限');
      return null;
    }

    const notification = new Notification(options.title, {
      body: options.body,
      icon: options.icon || '/favicon.ico',
      tag: options.tag,
    });

    if (options.onClick) {
      notification.onclick = () => {
        options.onClick?.();
        notification.close();
      };
    }

    return notification;
  }, [isSupported, permission]);

  return {
    isSupported,
    permission,
    requestPermission,
    showNotification,
  };
}

/**
 * 提醒轮询 Hook
 * 
 * 轮询已触发的提醒，并显示桌面通知
 */
export function useReminderNotification() {
  const { isSupported, permission, requestPermission, showNotification } = useBrowserNotification();
  const [triggeredReminders, setTriggeredReminders] = useState<Reminder[]>([]);

  /**
   * 轮询已触发的提醒
   */
  const pollTriggeredReminders = useCallback(async () => {
    try {
      const workspaceId = localStorage.getItem('currentWorkspaceId') || '';
      const res = await fetch('/api/reminders/triggered', {
        headers: { 'x-workspace-id': workspaceId },
      });

      // 未登录时跳过轮询，避免跟随重定向导致 JSON 解析失败
      if (res.status === 307 || res.url?.includes('/login')) {
        return;
      }

      // 非 JSON 响应时跳过
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return;
      }

      const data = await res.json();

      if (data.success && data.data.length > 0) {
        setTriggeredReminders(data.data);

        // 显示桌面通知（仅限浏览器通知方式）
        if (permission === 'granted') {
          data.data.forEach((reminder: Reminder) => {
            if (reminder.notifyMethods.includes('browser')) {
              showNotification({
                title: '⏰ 提醒',
                body: reminder.content,
                tag: `reminder-${reminder.id}`,
                onClick: () => {
                  window.location.href = '/reminders';
                },
              });
            }
          });
        }
      }
    } catch (error) {
      // 忽略轮询错误，避免刷屏
    }
  }, [permission, showNotification]);

  useEffect(() => {
    // 自动请求权限
    if (isSupported && permission === 'default') {
      requestPermission();
    }

    // 每 30 秒轮询一次
    pollTriggeredReminders();
    const interval = setInterval(pollTriggeredReminders, 30000);

    return () => clearInterval(interval);
  }, [isSupported, permission, requestPermission, pollTriggeredReminders]);

  return {
    triggeredReminders,
    requestPermission,
  };
}

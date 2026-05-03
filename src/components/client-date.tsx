'use client';

import { useState, useEffect } from 'react';

interface ClientDateProps {
  date: string | Date | number | null | undefined;
  format?: 'full' | 'date' | 'time' | 'datetime' | 'short' | 'task';
  className?: string;
  fallback?: string;
}

/**
 * 安全的客户端日期格式化组件
 * 
 * 解决 hydration 错误：服务端和客户端时区不同导致日期格式不匹配
 * 
 * @param date - 日期字符串、Date 对象或时间戳
 * @param format - 格式类型：
 *   - full：完整格式（年月日 时分秒）
 *   - date：仅日期（年月日）
 *   - time：仅时间（时分）
 *   - datetime：日期时间（月日 时分）
 *   - short：短格式（月日）
 *   - task：任务完成时间格式（月日 时分）
 * @param fallback - 当日期为空时的显示文本
 */
export function ClientDate({ date, format = 'datetime', className, fallback = '-' }: ClientDateProps) {
  const [formatted, setFormatted] = useState<string>('');

  useEffect(() => {
    if (!date) {
      setFormatted(fallback);
      return;
    }

    const d = typeof date === 'number' ? new Date(date) : new Date(date);
    
    // 检查日期是否有效
    if (isNaN(d.getTime())) {
      setFormatted(fallback);
      return;
    }

    switch (format) {
      case 'full':
        setFormatted(d.toLocaleString('zh-CN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }));
        break;
      case 'date':
        setFormatted(d.toLocaleDateString('zh-CN', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }));
        break;
      case 'time':
        setFormatted(d.toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
        }));
        break;
      case 'short':
        setFormatted(d.toLocaleDateString('zh-CN', {
          month: 'short',
          day: 'numeric',
        }));
        break;
      case 'task':
        setFormatted(d.toLocaleString('zh-CN', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }));
        break;
      case 'datetime':
      default:
        setFormatted(d.toLocaleString('zh-CN', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }));
        break;
    }
  }, [date, format, fallback]);

  // 服务端渲染空字符串，避免 hydration 不匹配
  if (!formatted) {
    return <span className={className}>&nbsp;</span>;
  }

  return <span className={className}>{formatted}</span>;
}

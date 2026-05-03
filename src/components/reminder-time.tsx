'use client';

import { useState, useEffect } from 'react';

interface ReminderTimeProps {
  dateStr: string;
  className?: string;
}

/**
 * 安全的提醒时间格式化组件
 * 
 * 解决 hydration 错误：服务端和客户端时间可能不同
 */
export function ReminderTime({ dateStr, className }: ReminderTimeProps) {
  const [formatted, setFormatted] = useState<string>('');

  useEffect(() => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      setFormatted(`逾期 ${Math.abs(diffDays)} 天`);
    } else if (diffDays === 0) {
      setFormatted('今天');
    } else if (diffDays === 1) {
      setFormatted('明天');
    } else if (diffDays <= 7) {
      setFormatted(`${diffDays} 天后`);
    } else {
      setFormatted(date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }));
    }
  }, [dateStr]);

  // 服务端渲染空字符串，避免 hydration 不匹配
  if (!formatted) {
    return <span className={className}>&nbsp;</span>;
  }

  return <span className={className}>{formatted}</span>;
}

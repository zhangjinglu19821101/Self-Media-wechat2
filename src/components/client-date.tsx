'use client';

import { useEffect, useState } from 'react';

interface ClientDateProps {
  date: Date | string;
  format?: 'date' | 'datetime' | 'time';
  className?: string;
}

export function ClientDate({ date, format = 'date', className = '' }: ClientDateProps) {
  const [formattedDate, setFormattedDate] = useState<string>('');
  
  useEffect(() => {
    // 仅在客户端渲染，避免 hydration 不匹配
    const d = typeof date === 'string' ? new Date(date) : date;
    
    if (format === 'time') {
      setFormattedDate(d.toLocaleTimeString());
    } else if (format === 'datetime') {
      setFormattedDate(d.toLocaleString());
    } else {
      setFormattedDate(d.toLocaleDateString());
    }
  }, [date, format]);
  
  // 服务端显示空字符串，客户端显示格式化日期
  return (
    <span className={className}>
      {formattedDate}
    </span>
  );
}
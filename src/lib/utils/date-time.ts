/**
 * 时间格式化工具函数
 * 所有时间统一使用北京时间（UTC+8）
 * 
 * 🚨 🔴 重要规范（强制要求）：
 * 1. 所有数据库时间字段必须使用 getCurrentBeijingTime() 函数
 * 2. 禁止直接使用 new Date() 设置数据库字段
 * 3. 所有时间相关操作统一使用此文件中的工具函数
 * 
 * @docs /AI_DEVELOPMENT_GUIDELINES.md
 */

/**
 * 将时间转换为北京时间并格式化
 * @param date - 日期对象或时间字符串
 * @param format - 格式化选项
 * @returns 格式化后的时间字符串
 */
export function formatBeijingTime(
  date: Date | string | number | undefined | null,
  format: 'full' | 'date' | 'time' | 'datetime' | 'short' = 'datetime'
): string {
  if (!date) return '';

  const dateObj = typeof date === 'string' || typeof date === 'number'
    ? new Date(date)
    : date;

  // dateObj 已经是本地时区时间，不需要手动加 8 小时
  // new Date() 会自动处理 UTC 到本地时区的转换
  const beijingTime = dateObj;

  const year = beijingTime.getFullYear();
  const month = String(beijingTime.getMonth() + 1).padStart(2, '0');
  const day = String(beijingTime.getDate()).padStart(2, '0');
  const hours = String(beijingTime.getHours()).padStart(2, '0');
  const minutes = String(beijingTime.getMinutes()).padStart(2, '0');
  const seconds = String(beijingTime.getSeconds()).padStart(2, '0');

  const dateStr = `${year}-${month}-${day}`;
  const timeStr = `${hours}:${minutes}:${seconds}`;

  switch (format) {
    case 'full':
      return `${year}年${beijingTime.getMonth() + 1}月${beijingTime.getDate()}日 ${hours}时${minutes}分${seconds}秒`;
    case 'date':
      return dateStr;
    case 'time':
      return timeStr;
    case 'datetime':
      return `${dateStr} ${timeStr}`;
    case 'short':
      return `${month}-${day} ${hours}:${minutes}`;
    default:
      return `${dateStr} ${timeStr}`;
  }
}

/**
 * 将时间转换为相对时间（如：3分钟前、1小时前）
 * @param date - 日期对象或时间字符串
 * @returns 相对时间字符串
 */
export function formatRelativeTime(date: Date | string | number | undefined | null): string {
  if (!date) return '';

  const dateObj = typeof date === 'string' || typeof date === 'number'
    ? new Date(date)
    : date;

  const now = new Date();
  const diff = now.getTime() - dateObj.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return '刚刚';
  } else if (minutes < 60) {
    return `${minutes}分钟前`;
  } else if (hours < 24) {
    return `${hours}小时前`;
  } else if (days < 7) {
    return `${days}天前`;
  } else {
    return formatBeijingTime(date, 'short');
  }
}

/**
 * 获取当前北京时间
 * 
 * 🚨 🔴 强制要求：所有数据库时间字段必须使用此函数！
 * 
 * 常见用途：
 * - 设置 startedAt, updatedAt, completedAt, createdAt 等字段
 * - 任何需要记录当前时间的数据库操作
 * 
 * 正确示例：
 * ```typescript
 * import { getCurrentBeijingTime } from '@/lib/utils/date-time';
 * 
 * await db.update(agentSubTasks).set({
 *   startedAt: getCurrentBeijingTime(),  // ✅ 正确
 *   updatedAt: getCurrentBeijingTime(),  // ✅ 正确
 * });
 * ```
 * 
 * 错误示例（禁止）：
 * ```typescript
 * await db.update(agentSubTasks).set({
 *   startedAt: new Date(),  // ❌ 禁止！必须用 getCurrentBeijingTime()
 * });
 * ```
 * 
 * @returns 当前北京时间
 */
export function getCurrentBeijingTime(): Date {
  // new Date() 返回的是本地时间，如果服务器时区是 UTC+8，则已经是北京时间
  return new Date();
}

/**
 * 格式化任务截止时间
 * @param date - 日期对象或时间字符串
 * @returns 格式化后的截止时间字符串
 */
export function formatDeadline(date: Date | string | number | undefined | null): string {
  if (!date) return '';

  const beijingTime = formatBeijingTime(date, 'full');
  const now = new Date();
  const dateObj = typeof date === 'string' || typeof date === 'number'
    ? new Date(date)
    : date;

  const diff = dateObj.getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days < 0) {
    return `${beijingTime}（已超期）`;
  } else if (days === 0) {
    return `${beijingTime}（今天截止）`;
  } else if (days === 1) {
    return `${beijingTime}（明天截止）`;
  } else {
    return `${beijingTime}（还剩 ${days} 天）`;
  }
}

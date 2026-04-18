/**
 * 会话 ID 生成器
 */

/**
 * 生成会话 ID
 * @param type 会话类型：'autocheck' | 'inspection' | 'consultation'
 * @param sender 发送方
 * @param receiver 接收方（可选）
 * @returns 会话 ID
 * 
 * @example
 * generateSessionId('autocheck', 'insurance-d')
 * // "session-20240210-autocheck-insurance-d-a1b2"
 * 
 * generateSessionId('inspection', 'B', 'insurance-d')
 * // "session-20240210-inspection-B-insurance-d-c3d4"
 */
export function generateSessionId(
  type: 'autocheck' | 'inspection' | 'consultation' | 'task_assignment',
  sender: string,
  receiver?: string
): string {
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const receiverPart = receiver ? `-${receiver}` : '';
  const random = Math.random().toString(36).substring(2, 6);
  
  return `session-${date}-${type}-${sender}${receiverPart}-${random}`;
}

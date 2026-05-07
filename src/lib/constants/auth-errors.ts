/**
 * 认证错误码与消息常量
 * 
 * 前后端共用，确保错误提示一致性
 */

/**
 * 认证错误码（与后端 CredentialsSignin.code 对应）
 */
export const AUTH_ERROR_CODES = {
  USER_NOT_FOUND: 'user_not_found',
  ACCOUNT_DISABLED: 'account_disabled',
  ACCOUNT_LOCKED: 'account_locked',
  INVALID_PASSWORD: 'invalid_password',
  EMAIL_INVALID: 'email_invalid',
} as const;

export type AuthErrorCode = typeof AUTH_ERROR_CODES[keyof typeof AUTH_ERROR_CODES];

/**
 * 错误码 → 用户可见提示
 */
export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  [AUTH_ERROR_CODES.USER_NOT_FOUND]: '该邮箱未注册',
  [AUTH_ERROR_CODES.ACCOUNT_DISABLED]: '账号已被禁用，请联系管理员',
  [AUTH_ERROR_CODES.ACCOUNT_LOCKED]: '账号已被锁定，连续登录失败次数过多，请30分钟后再试或联系管理员解锁',
  [AUTH_ERROR_CODES.INVALID_PASSWORD]: '密码不正确',
  [AUTH_ERROR_CODES.EMAIL_INVALID]: '请输入有效的邮箱地址',
  // NextAuth 内置错误
  Configuration: '系统配置错误，请联系管理员',
};

/**
 * 根据错误码获取用户可见提示
 */
export function getAuthErrorMessage(code: string | undefined): string {
  if (!code) return '登录失败，请稍后重试';
  return AUTH_ERROR_MESSAGES[code] || '登录失败，请稍后重试';
}

/**
 * 验证邮箱格式
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

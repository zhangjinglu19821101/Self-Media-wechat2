/**
 * 密码工具函数
 * 
 * 提供 hash/verify/强度校验等能力
 */

import { hash, compare } from 'bcryptjs';

const SALT_ROUNDS = 12;

/**
 * 对密码进行哈希
 */
export async function hashPassword(password: string): Promise<string> {
  return hash(password, SALT_ROUNDS);
}

/**
 * 验证密码是否匹配
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return compare(password, hashedPassword);
}

/**
 * 密码强度校验
 * 
 * 规则：
 * - 至少 8 个字符
 * - 包含至少一个字母
 * - 包含至少一个数字
 */
export function validatePasswordStrength(password: string): { valid: boolean; message: string } {
  if (password.length < 8) {
    return { valid: false, message: '密码至少需要 8 个字符' };
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, message: '密码需要包含至少一个字母' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: '密码需要包含至少一个数字' };
  }
  return { valid: true, message: '' };
}

/**
 * 邮箱格式校验
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

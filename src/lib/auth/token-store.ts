/**
 * Bearer Token 存储服务
 *
 * 为 App/小程序 WebView 提供 Bearer Token 认证能力：
 * - Web 浏览器：localStorage 存储
 * - 小程序 WebView：localStorage 存储（WebView 内可用 localStorage）
 * - 小程序原生：通过 wx.setStorageSync 存储（需在小程序端自行实现）
 *
 * Token 生命周期：
 * 1. 登录成功 → setTokens(accessToken, refreshToken, expiresIn)
 * 2. 每次请求 → getAccessToken() 注入 Authorization Header
 * 3. Access Token 过期 → 401 → 自动用 Refresh Token 刷新
 * 4. Refresh Token 过期 → 清除 Token → 跳转登录
 */

'use client';

const ACCESS_TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';
const TOKEN_EXPIRES_KEY = 'auth_token_expires_at';
const USER_ID_KEY = 'auth_user_id';
const WORKSPACE_ID_KEY = 'auth_workspace_id';

/** Token 对 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // 秒
}

/** 存储的认证信息 */
export interface StoredAuthInfo {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // 毫秒时间戳
  userId: string;
  workspaceId: string;
}

// ==================== 环境检测 ====================

/**
 * 检测当前是否运行在微信小程序 WebView 中
 *
 * 微信小程序 WebView 的 User-Agent 包含 "miniProgram" 或 "MicroMessenger"
 * 但更可靠的判断是通过 window.__wxjs_environment
 */
export function isMiniProgram(): boolean {
  if (typeof window === 'undefined') return false;

  // 方式1：微信 JSSDK 注入的环境变量（最可靠）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wxEnv = (window as any).__wxjs_environment;
  if (wxEnv === 'miniprogram') return true;

  // 方式2：UA 检测（备用）
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('miniprogram')) return true;

  // 方式3：URL 参数标记（WebView 加载时通过参数注入）
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('env') === 'miniprogram') return true;

  return false;
}

/**
 * 检测当前是否使用 Bearer Token 认证模式
 *
 * 判断逻辑：localStorage 中有 accessToken → Bearer 模式
 * 无 accessToken → Cookie Session 模式（NextAuth）
 */
export function isBearerAuthMode(): boolean {
  return !!getAccessToken();
}

// ==================== Token 存储 ====================

/** 存储 Access Token */
export function setAccessToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

/** 获取 Access Token */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

/** 存储 Refresh Token */
export function setRefreshToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

/** 获取 Refresh Token */
export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/** 设置 Token 过期时间 */
export function setTokenExpiresAt(expiresIn: number): void {
  if (typeof window === 'undefined') return;
  const expiresAt = Date.now() + expiresIn * 1000;
  localStorage.setItem(TOKEN_EXPIRES_KEY, String(expiresAt));
}

/** 获取 Token 过期时间（毫秒时间戳） */
export function getTokenExpiresAt(): number | null {
  if (typeof window === 'undefined') return null;
  const val = localStorage.getItem(TOKEN_EXPIRES_KEY);
  return val ? Number(val) : null;
}

/** 存储用户 ID */
export function setAuthUserId(userId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_ID_KEY, userId);
}

/** 获取用户 ID */
export function getAuthUserId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(USER_ID_KEY);
}

/** 存储 workspaceId（Bearer 模式下替代 getCurrentWorkspaceId） */
export function setAuthWorkspaceId(workspaceId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(WORKSPACE_ID_KEY, workspaceId);
  // 同步到通用 workspaceId 存储，确保与 Cookie 模式兼容
  localStorage.setItem('current-workspace-id', workspaceId);
}

/** 获取 workspaceId */
export function getAuthWorkspaceId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(WORKSPACE_ID_KEY);
}

/** 一次性存储完整 Token 对 + 用户信息 */
export function setTokens(tokenPair: TokenPair, userId: string, workspaceId: string): void {
  setAccessToken(tokenPair.accessToken);
  setRefreshToken(tokenPair.refreshToken);
  setTokenExpiresAt(tokenPair.expiresIn);
  setAuthUserId(userId);
  setAuthWorkspaceId(workspaceId);
}

/** 清除所有 Token 和认证信息 */
export function clearTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRES_KEY);
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(WORKSPACE_ID_KEY);
}

/** Access Token 是否即将过期（提前 60 秒视为过期） */
export function isAccessTokenExpired(): boolean {
  const expiresAt = getTokenExpiresAt();
  if (!expiresAt) return true;
  return Date.now() >= expiresAt - 60 * 1000; // 提前 60 秒
}

/** 获取完整的认证信息 */
export function getStoredAuthInfo(): StoredAuthInfo | null {
  const accessToken = getAccessToken();
  const refreshToken = getRefreshToken();
  const expiresAt = getTokenExpiresAt();
  const userId = getAuthUserId();
  const workspaceId = getAuthWorkspaceId();

  if (!accessToken || !refreshToken || !expiresAt || !userId || !workspaceId) {
    return null;
  }

  return { accessToken, refreshToken, expiresAt, userId, workspaceId };
}

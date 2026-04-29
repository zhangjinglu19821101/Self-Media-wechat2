/**
 * 带认证和 Workspace 隔离的 Fetch 封装
 * 
 * 所有前端 API 调用应使用此模块，确保：
 * 1. 自动携带 x-workspace-id 请求头
 * 2. Bearer Token 模式：自动注入 Authorization Header + 401 自动刷新
 * 3. Cookie Session 模式：依赖 NextAuth Cookie，401 跳转登录页
 * 4. 统一处理 API Key 缺失（跳转配置页面 + toast 提示）
 * 5. 统一错误处理和类型安全
 * 
 * 双轨认证逻辑：
 * - localStorage 有 accessToken → Bearer Token 模式（App/小程序）
 * - localStorage 无 accessToken → Cookie Session 模式（Web 浏览器）
 */

'use client';

import { toast } from 'sonner';
import {
  getAccessToken,
  getRefreshToken,
  isBearerAuthMode,
  isMiniProgram,
  clearTokens,
  setTokens,
  setAuthUserId,
  setAuthWorkspaceId,
  type TokenPair,
} from '@/lib/auth/token-store';

const WORKSPACE_STORAGE_KEY = 'current-workspace-id';

/** API 错误类型 */
export class ApiError extends Error {
  status: number;
  code?: string;
  detail?: unknown;

  constructor(status: number, message: string, code?: string, detail?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

/** 通用 API 响应格式 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/** 获取当前 workspaceId（从 localStorage） */
export function getCurrentWorkspaceId(): string {
  if (typeof window === 'undefined') return 'default-workspace';
  return localStorage.getItem(WORKSPACE_STORAGE_KEY) || 'default-workspace';
}

/** 设置当前 workspaceId（同步到 localStorage） */
export function setCurrentWorkspaceId(id: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(WORKSPACE_STORAGE_KEY, id);
  // 触发自定义事件，让其他组件感知变化
  window.dispatchEvent(new CustomEvent('workspace-changed', { detail: { workspaceId: id } }));
}

// ==================== Token 刷新机制 ====================

/** 刷新锁：防止并发请求同时触发多次刷新 */
let refreshPromise: Promise<boolean> | null = null;

/**
 * 使用 Refresh Token 刷新 Access Token
 * 
 * @returns true=刷新成功，false=刷新失败
 */
async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await fetch('/api/auth/token/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return false;

    const result = await response.json();
    if (!result.success || !result.data?.accessToken) return false;

    // 更新存储的 Token
    const tokenPair: TokenPair = {
      accessToken: result.data.accessToken,
      refreshToken: result.data.refreshToken || refreshToken, // 服务端可能不返回新 refreshToken
      expiresIn: result.data.expiresIn || 3600,
    };
    setTokens(tokenPair, result.data.userId || '', result.data.workspaceId || getCurrentWorkspaceId());

    return true;
  } catch (error) {
    console.error('[API] Token 刷新失败:', error);
    return false;
  }
}

/**
 * 带锁的 Token 刷新
 * 多个并发 401 只触发一次刷新
 */
async function refreshWithLock(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = refreshAccessToken().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

// ==================== 401 处理分流 ====================

/**
 * 认证失败后的处理（按认证模式分流）
 * - Bearer Token 模式：尝试刷新 Token → 失败则清除 Token + 跳转小程序登录或 Web 登录
 * - Cookie Session 模式：直接跳转 /login
 */
async function handleAuthFailure(): Promise<never> {
  if (isBearerAuthMode()) {
    // Bearer Token 模式：尝试刷新
    const refreshed = await refreshWithLock();
    if (refreshed) {
      // 刷新成功，让调用方重试原始请求
      throw new ApiError(401, 'Token 已刷新，请重试', 'TOKEN_REFRESHED');
    }

    // 刷新失败，清除 Token
    clearTokens();

    if (isMiniProgram()) {
      // 小程序环境：通知小程序端重新登录
      // WebView 通过 postMessage 与小程序通信
      try {
        // @ts-expect-error wx 是微信 JSSDK 注入的全局对象
        if (typeof wx !== 'undefined' && wx.miniProgram) {
          // @ts-expect-error wx.miniProgram.postMessage 是微信 JSSDK 方法
          wx.miniProgram.postMessage({ type: 'auth_expired', action: 'relogin' });
          // @ts-expect-error wx.miniProgram.reLaunch 是微信 JSSDK 方法
          wx.miniProgram.reLaunch({ url: '/pages/login/login' });
        }
      } catch {
        // 降级：跳转到 Web 登录页
        window.location.href = `/login?reason=token_expired&env=miniprogram`;
      }
    } else {
      // Web/App 环境：跳转登录页
      const currentPath = window.location.pathname;
      if (!currentPath.startsWith('/login') && !currentPath.startsWith('/register')) {
        window.location.href = `/login?reason=token_expired&callbackUrl=${encodeURIComponent(currentPath)}`;
      }
    }

    throw new ApiError(401, '登录已过期，请重新登录', 'TOKEN_EXPIRED');
  }

  // Cookie Session 模式：跳转登录页
  if (typeof window !== 'undefined') {
    const currentPath = window.location.pathname;
    if (!currentPath.startsWith('/login') && !currentPath.startsWith('/register')) {
      window.location.href = `/login?callbackUrl=${encodeURIComponent(currentPath)}`;
    }
  }
  throw new ApiError(401, '未登录或登录已过期', 'UNAUTHORIZED');
}

// ==================== 核心 Fetch 封装 ====================

/** 构建带认证和 workspace 的请求头 */
function buildHeaders(customHeaders?: HeadersInit): HeadersInit {
  const headers: Record<string, string> = {};

  // Bearer Token 模式：注入 Authorization Header
  if (isBearerAuthMode()) {
    const token = getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  // 自动注入 workspaceId
  const wsId = getCurrentWorkspaceId();
  if (wsId) {
    headers['x-workspace-id'] = wsId;
  }

  // 合并自定义 header
  if (customHeaders) {
    if (customHeaders instanceof Headers) {
      customHeaders.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(customHeaders)) {
      for (const [key, value] of customHeaders) {
        headers[key] = value;
      }
    } else {
      Object.assign(headers, customHeaders);
    }
  }

  return headers;
}

/**
 * 处理响应：支持 401 自动刷新 + Token 模式分流
 * 
 * @param response 原始 Response
 * @param retryFn 刷新 Token 后的重试函数（仅 Bearer 模式使用）
 */
async function handleResponse<T>(response: Response, retryFn?: () => Promise<Response>): Promise<T> {
  if (response.status === 401) {
    if (isBearerAuthMode()) {
      // Bearer Token 模式：尝试刷新 Token 并重试
      const refreshed = await refreshWithLock();
      if (refreshed && retryFn) {
        // 刷新成功，用新 Token 重试原始请求
        const retryResponse = await retryFn();
        if (retryResponse.ok) {
          try {
            return await retryResponse.json() as T;
          } catch {
            return undefined as T;
          }
        }
        // 重试仍然失败，走常规错误处理
        return handleResponse<T>(retryResponse); // 不再传 retryFn 避免无限重试
      }
    }

    // Cookie 模式 / Bearer 刷新失败：统一处理
    return handleAuthFailure();
  }

  // 尝试解析 JSON
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    if (!response.ok) {
      throw new ApiError(response.status, response.statusText);
    }
    return undefined as T;
  }

  // 🔥 检测 API Key 缺失 → 自动跳转到配置页面
  if ((data as Record<string, unknown>)?.code === 'API_KEY_MISSING') {
    if (typeof window !== 'undefined') {
      const redirectUrl = ((data as Record<string, unknown>)?.redirectUrl as string) || '/settings/api-keys';
      const currentPath = window.location.pathname + window.location.search;
      // 避免重复跳转
      if (!currentPath.startsWith('/settings/api-keys')) {
        // 保存当前路径，配置完成后可返回
        try {
          sessionStorage.setItem('apiKeyMissingReturnUrl', currentPath);
        } catch { /* sessionStorage 不可用时忽略 */ }
        // 友好提示
        toast.error('未配置 API Key，正在跳转到配置页面...', { duration: 3000 });
        console.warn('[API] 检测到 API Key 未配置，跳转配置页面:', redirectUrl);
        // 延迟跳转，让用户看到 toast
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 800);
      }
    }
    throw new ApiError(
      response.status,
      (data as Record<string, unknown>)?.error as string || '未配置 API Key',
      'API_KEY_MISSING',
      data
    );
  }

  if (!response.ok) {
    const errMsg = (data as Record<string, unknown>)?.error as string || response.statusText;
    const errCode = (data as Record<string, unknown>)?.code as string;
    throw new ApiError(response.status, errMsg, errCode, data);
  }

  return data as T;
}

/** 带认证和 workspace 的 fetch GET */
export async function apiGet<T = unknown>(url: string, options?: {
  headers?: HeadersInit;
  cache?: RequestCache;
  tags?: string[];
  signal?: AbortSignal;
}): Promise<T> {
  const headers = buildHeaders(options?.headers);

  const makeRequest = () => fetch(url, {
    method: 'GET',
    headers: buildHeaders(options?.headers), // 重建以获取新 Token
    cache: options?.cache,
    next: options?.tags ? { tags: options.tags } : undefined,
    signal: options?.signal,
  });

  const response = await makeRequest();
  return handleResponse<T>(response, makeRequest);
}

/**
 * 检测 API 响应是否为 API Key 缺失错误，如果是则自动跳转配置页面
 * 
 * 适用于使用原生 fetch 的场景（非 apiGet/apiPost）：
 * 
 *   const res = await fetch('/api/agents/b/ai-split', { method: 'POST', ... });
 *   const data = await res.json();
 *   if (checkApiKeyMissing(data)) return; // 已自动跳转，中断后续逻辑
 */
export function checkApiKeyMissing(data: unknown): boolean {
  if (
    typeof data === 'object' &&
    data !== null &&
    (data as Record<string, unknown>).code === 'API_KEY_MISSING'
  ) {
    if (typeof window !== 'undefined') {
      const redirectUrl = ((data as Record<string, unknown>).redirectUrl as string) || '/settings/api-keys';
      const currentPath = window.location.pathname + window.location.search;
      if (!currentPath.startsWith('/settings/api-keys')) {
        try {
          sessionStorage.setItem('apiKeyMissingReturnUrl', currentPath);
        } catch { /* ignore */ }
        toast.error('未配置 API Key，正在跳转到配置页面...', { duration: 3000 });
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 800);
      }
    }
    return true;
  }
  return false;
}

/** 带认证和 workspace 的 fetch POST */
export async function apiPost<T = unknown>(url: string, body?: unknown, options?: {
  headers?: HeadersInit;
  signal?: AbortSignal;
}): Promise<T> {
  const makeRequest = () => {
    const headers = buildHeaders(options?.headers) as Record<string, string>;
    headers['Content-Type'] = 'application/json';
    return fetch(url, {
      method: 'POST',
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: options?.signal,
    });
  };

  const response = await makeRequest();
  return handleResponse<T>(response, makeRequest);
}

/** 带认证和 workspace 的 fetch PUT */
export async function apiPut<T = unknown>(url: string, body?: unknown, options?: {
  headers?: HeadersInit;
}): Promise<T> {
  const makeRequest = () => {
    const headers = buildHeaders(options?.headers) as Record<string, string>;
    headers['Content-Type'] = 'application/json';
    return fetch(url, {
      method: 'PUT',
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  const response = await makeRequest();
  return handleResponse<T>(response, makeRequest);
}

/** 带认证和 workspace 的 fetch PATCH */
export async function apiPatch<T = unknown>(url: string, body?: unknown, options?: {
  headers?: HeadersInit;
}): Promise<T> {
  const makeRequest = () => {
    const headers = buildHeaders(options?.headers) as Record<string, string>;
    headers['Content-Type'] = 'application/json';
    return fetch(url, {
      method: 'PATCH',
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  const response = await makeRequest();
  return handleResponse<T>(response, makeRequest);
}

/** 带认证和 workspace 的 fetch DELETE */
export async function apiDelete<T = unknown>(url: string, options?: {
  headers?: HeadersInit;
}): Promise<T> {
  const makeRequest = () => fetch(url, {
    method: 'DELETE',
    headers: buildHeaders(options?.headers),
  });

  const response = await makeRequest();
  return handleResponse<T>(response, makeRequest);
}

/** 兼容原生 fetch 签名的封装（自动注入 workspaceId + Bearer Token + 401 处理） */
export async function apiFetch<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const makeRequest = () => fetch(url, {
    ...init,
    headers: buildHeaders(init?.headers as HeadersInit | undefined),
  });

  const response = await makeRequest();
  return handleResponse<T>(response, makeRequest);
}

// ==================== Bearer Token 登录辅助 ====================

/** 通过微信小程序 code 登录（Bearer Token 模式） */
export async function loginWithWechatCode(code: string): Promise<{
  success: boolean;
  userId?: string;
  workspaceId?: string;
}> {
  try {
    const response = await fetch('/api/auth/wechat/miniprogram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || '微信登录失败');
    }

    // 存储 Token
    const tokenPair: TokenPair = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresIn: data.expiresIn || 3600,
    };
    setTokens(tokenPair, data.userId, data.workspaceId);

    return { success: true, userId: data.userId, workspaceId: data.workspaceId };
  } catch (error) {
    console.error('[API] 微信小程序登录失败:', error);
    clearTokens();
    return { success: false };
  }
}

/** Bearer Token 模式退出登录 */
export async function logoutBearer(): Promise<void> {
  try {
    // 通知服务端吊销 Token
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      await fetch('/api/auth/token/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => { /* 退出登录请求失败不影响本地清理 */ });
    }
  } finally {
    clearTokens();
    if (isMiniProgram()) {
      try {
        // @ts-expect-error wx 是微信 JSSDK 注入的全局对象
        if (typeof wx !== 'undefined' && wx.miniProgram) {
          // @ts-expect-error wx.miniProgram.reLaunch 是微信 JSSDK 方法
          wx.miniProgram.reLaunch({ url: '/pages/login/login' });
        }
      } catch {
        window.location.href = '/login';
      }
    } else {
      window.location.href = '/login';
    }
  }
}

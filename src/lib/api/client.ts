/**
 * 带认证和 Workspace 隔离的 Fetch 封装
 * 
 * 所有前端 API 调用应使用此模块，确保：
 * 1. 自动携带 x-workspace-id 请求头
 * 2. 统一处理 401 认证失败（跳转登录）
 * 3. 统一处理 API Key 缺失（跳转配置页面 + toast 提示）
 * 4. 统一错误处理和类型安全
 */

'use client';

import { toast } from 'sonner';

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

/** 构建带认证和 workspace 的请求头 */
function buildHeaders(customHeaders?: HeadersInit): HeadersInit {
  const headers: Record<string, string> = {};

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

/** 处理响应：401 跳转登录，403+API_KEY_MISSING 跳转 Key 配置，其他错误抛出 ApiError */
async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    // 未认证，跳转登录页
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      if (!currentPath.startsWith('/login') && !currentPath.startsWith('/register')) {
        window.location.href = `/login?callbackUrl=${encodeURIComponent(currentPath)}`;
      }
    }
    throw new ApiError(401, '未登录或登录已过期', 'UNAUTHORIZED');
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
}): Promise<T> {
  const headers = buildHeaders(options?.headers);

  const response = await fetch(url, {
    method: 'GET',
    headers,
    cache: options?.cache,
    next: options?.tags ? { tags: options.tags } : undefined,
  });

  return handleResponse<T>(response);
}

/**
 * 检测 API 响应是否为 API Key 缺失错误，如果是则自动跳转配置页面
 * 
 * 适用于使用原生 fetch 的场景（非 apiGet/apiPost）：
 * 
 *   const res = await fetch('/api/agents/b/ai-split', { method: 'POST', ... });
 *   const data = await res.json();
 *   if (checkApiKeyMissing(data)) return; // 已自动跳转，中断后续逻辑
 * 
 * 或者配合 try-catch 使用：
 *   try {
 *     const res = await fetch(...);
 *     if (!res.ok) {
 *       const data = await res.json();
 *       if (checkApiKeyMissing(data)) return;
 *       throw new Error(data.error);
 *     }
 *   } catch (err) { ... }
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
}): Promise<T> {
  const headers = buildHeaders(options?.headers) as Record<string, string>;
  headers['Content-Type'] = 'application/json';

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  return handleResponse<T>(response);
}

/** 带认证和 workspace 的 fetch PUT */
export async function apiPut<T = unknown>(url: string, body?: unknown, options?: {
  headers?: HeadersInit;
}): Promise<T> {
  const headers = buildHeaders(options?.headers) as Record<string, string>;
  headers['Content-Type'] = 'application/json';

  const response = await fetch(url, {
    method: 'PUT',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  return handleResponse<T>(response);
}

/** 带认证和 workspace 的 fetch PATCH */
export async function apiPatch<T = unknown>(url: string, body?: unknown, options?: {
  headers?: HeadersInit;
}): Promise<T> {
  const headers = buildHeaders(options?.headers) as Record<string, string>;
  headers['Content-Type'] = 'application/json';

  const response = await fetch(url, {
    method: 'PATCH',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  return handleResponse<T>(response);
}

/** 带认证和 workspace 的 fetch DELETE */
export async function apiDelete<T = unknown>(url: string, options?: {
  headers?: HeadersInit;
}): Promise<T> {
  const headers = buildHeaders(options?.headers);

  const response = await fetch(url, {
    method: 'DELETE',
    headers,
  });

  return handleResponse<T>(response);
}

/** 兼容原生 fetch 签名的封装（自动注入 workspaceId + 401 处理） */
export async function apiFetch<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const headers = buildHeaders(init?.headers as HeadersInit | undefined);

  const response = await fetch(url, {
    ...init,
    headers,
  });

  return handleResponse<T>(response);
}

/**
 * API 请求上下文工具
 * 
 * 从请求中提取认证信息和 workspaceId
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { extractWorkspaceId, getDefaultWorkspaceId } from '@/lib/db/tenant';

/**
 * 内部 API 调用 Token
 * 
 * 后端内部（Agent、Cron、MCP 等）通过 fetch 调用自身 API 时，
 * 不携带 NextAuth session cookie，需要通过 x-internal-token 识别。
 * 
 * 环境变量优先，兜底使用内置值（仅限本机内部调用）
 */
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN || 'internal-svc-token-2025-07';

/**
 * 获取当前认证用户的 accountId
 * 如果未登录返回 null
 */
export async function getAccountId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id || null;
}

/**
 * 获取当前用户的系统级角色
 * 返回 'super_admin' 或 'normal'
 */
export async function getAccountRole(): Promise<string> {
  const session = await auth();
  return (session?.user as any)?.role || 'normal';
}

/**
 * 检查当前用户是否为超级管理员
 */
export async function isSuperAdmin(): Promise<boolean> {
  const role = await getAccountRole();
  return role === 'super_admin';
}

/**
 * 获取当前工作空间 ID
 * 
 * 优先级：
 * 1. 请求头 x-workspace-id
 * 2. URL 参数 workspaceId
 * 3. 用户的默认个人工作空间
 * 4. 兜底 'default-workspace'
 */
export async function getWorkspaceId(request?: NextRequest): Promise<string> {
  // 1. 从请求中提取
  if (request) {
    const wsId = extractWorkspaceId(request);
    if (wsId) return wsId;
  }

  // 2. 从 session 获取用户默认 workspace
  const session = await auth();
  if (session?.user?.id) {
    const defaultWsId = await getDefaultWorkspaceId(session.user.id);
    if (defaultWsId) return defaultWsId;
  }

  // 3. 兜底
  return 'default-workspace';
}

/**
 * 获取认证上下文（accountId + workspaceId + role）
 * 如果未认证，返回 null
 */
export async function getAuthContext(request?: NextRequest): Promise<{
  accountId: string;
  workspaceId: string;
  role: string;
  isSuperAdmin: boolean;
} | null> {
  const accountId = await getAccountId();
  if (!accountId) return null;

  const workspaceId = await getWorkspaceId(request);
  const role = await getAccountRole();

  return { 
    accountId, 
    workspaceId, 
    role,
    isSuperAdmin: role === 'super_admin',
  };
}

/**
 * 判断是否为后端内部调用
 * 通过检查 x-internal-token 请求头
 */
export function isInternalCall(request: NextRequest): boolean {
  const token = request.headers.get('x-internal-token');
  return token === INTERNAL_API_TOKEN;
}

/**
 * 获取内部 API 调用需要的请求头
 * 
 * 供后端内部 fetch 调用时使用，确保：
 * 1. 携带 x-internal-token 绕过 requireAuth 认证
 * 2. 携带 x-workspace-id 确保数据隔离
 * 
 * @example
 * const headers = getInternalHeaders(workspaceId);
 * await fetch('http://localhost:5000/api/search', { headers });
 */
export function getInternalHeaders(workspaceId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'x-internal-token': INTERNAL_API_TOKEN,
    'Content-Type': 'application/json',
  };
  if (workspaceId) {
    headers['x-workspace-id'] = workspaceId;
  }
  return headers;
}

/**
 * 认证守卫：要求用户已登录
 * 返回认证上下文，未登录则返回 401 响应
 * 
 * 支持两种认证方式：
 * 1. 正常用户认证（NextAuth session）
 * 2. 内部调用认证（x-internal-token 请求头）
 * 
 * @example
 * const authResult = await requireAuth(request);
 * if (authResult instanceof NextResponse) return authResult; // 401
 * const { accountId, workspaceId } = authResult;
 */
export async function requireAuth(request: NextRequest): Promise<
  | { accountId: string; workspaceId: string }
  | NextResponse
> {
  // 内部调用检测：后端服务（Cron、Agent、MCP等）通过 x-internal-token 绕过 session 认证
  if (isInternalCall(request)) {
    const workspaceId = extractWorkspaceId(request) || 'default-workspace';
    return { accountId: 'system', workspaceId };
  }

  const ctx = await getAuthContext(request);
  if (!ctx) {
    return NextResponse.json(
      { error: '未登录或登录已过期', code: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }
  return ctx;
}

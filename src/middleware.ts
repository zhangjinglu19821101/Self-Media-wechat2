/**
 * 全局认证中间件
 * 
 * 重要：不使用 auth() 包装器，避免干扰 NextAuth 的 CSRF 处理流程
 * 
 * 规则：
 * - NextAuth 路径（/api/auth/*）：完全放行，不做任何处理
 * - 公开路径：/login, /register, /api/db/* 等
 * - 内部调用：x-internal-token 请求头识别，绕过 session 检查
 * - Bearer Token：Authorization: Bearer <accessToken>，App/小程序认证
 * - Cookie Session：NextAuth session cookie，Web 浏览器认证
 * - 其余所有路径需认证
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 公开路径（不需要认证）
const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/api/auth',          // NextAuth 内部路径 - 必须完全放行（含 /api/auth/wechat 小程序登录）
  '/api/db',            // 数据库迁移
  '/api/health',        // 健康检查
  '/api/system/health', // 🔴 P0 修复：系统健康检查端点（负载均衡器探测用）
  '/api/cron',          // 定时任务（内部调用）
  '/api/agents/receipt',// Agent 回调
  '/api/cache',         // 缓存统计（开发用）
  '/api/check-',        // 检查类 API（开发调试用）
  '/api/clear-',        // 清理类 API（开发调试用）
  '/api/capability',    // 能力列表（公共）
  '/api/cases/init',    // 案例初始化（一次性导入）
  '/api/cases/recommend', // 案例推荐（内部调用）
  '/api/xiaohongshu-preview', // 小红书预览数据 API（Playwright 截图用）
  '/xiaohongshu-preview', // 小红书预览页面（Agent T MCP 截图用）
];

/**
 * 内部 API 调用 Token（与 auth/context.ts 保持一致）
 */
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN || 'internal-svc-token-2025-07';

/**
 * JWT 签名密钥（与 TokenService 共用）
 */
const JWT_SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || '';

/**
 * 验证 Bearer Access Token（轻量级同步验证，不依赖数据库）
 * 
 * 使用 jose 或 jsonwebtoken 的同步验证。
 * 为了在 Edge Middleware 中可用，使用 Web Crypto API 手动验证。
 * 
 * @returns 解码后的 payload，无效返回 null
 */
async function verifyAccessToken(token: string): Promise<{
  sub: string;
  wid: string;
  role: string;
  type: string;
} | null> {
  try {
    // 使用 Web Crypto API 验证 JWT（Edge Runtime 兼容）
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // 解码 header 获取算法
    const headerJson = atob(parts[0]);
    const header = JSON.parse(headerJson);
    if (header.alg !== 'HS256') return null;

    // 验证签名
    const encoder = new TextEncoder();
    const keyData = encoder.encode(JWT_SECRET);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    const signatureInput = encoder.encode(`${parts[0]}.${parts[1]}`);
    const signatureBytes = Uint8Array.from(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

    const valid = await crypto.subtle.verify('HMAC', key, signatureBytes, signatureInput);
    if (!valid) return null;

    // 解码 payload
    const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(payloadJson);

    // 检查类型和过期
    if (payload.type !== 'access') return null;
    if (!payload.sub || !payload.wid) return null;
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;

    return payload;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 公开路径放行（不检查任何认证信息）
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // 内部调用检测：后端服务通过 x-internal-token 绕过 session 认证
  const internalToken = request.headers.get('x-internal-token');
  if (internalToken === INTERNAL_API_TOKEN) {
    return NextResponse.next();
  }

  // 🔴 新增：Bearer Token 检测（App/小程序认证）
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const accessToken = authHeader.slice(7);
    const payload = await verifyAccessToken(accessToken);

    if (payload) {
      // Token 有效，注入上下文 Header 供下游 API 使用
      const response = NextResponse.next();
      response.headers.set('x-account-id', payload.sub);
      response.headers.set('x-workspace-id', payload.wid);
      response.headers.set('x-auth-method', 'bearer');
      response.headers.set('x-account-role', payload.role || 'normal');
      return response;
    }

    // Token 无效/过期
    if (pathname.startsWith('/api')) {
      return NextResponse.json(
        { error: 'Token 已过期或无效', code: 'TOKEN_EXPIRED' },
        { status: 401 },
      );
    }
    // 页面路径：跳转登录（App 场景通常不会访问页面路径）
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 检查 NextAuth session cookie
  // NextAuth v5 在 HTTPS 环境下使用 __Secure- 前缀，HTTP 下不加前缀
  // 需要同时检查两种情况
  const sessionToken = 
    request.cookies.get('__Secure-authjs.session-token')?.value ||
    request.cookies.get('authjs.session-token')?.value ||
    request.cookies.get('__Secure-next-auth.session-token')?.value ||
    request.cookies.get('next-auth.session-token')?.value;

  const isLoggedIn = !!sessionToken;

  // API 路径需认证
  if (pathname.startsWith('/api') && !isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 });
  }

  // 页面路径需认证（未登录跳转 /login）
  if (!isLoggedIn && !pathname.startsWith('/_next') && !pathname.startsWith('/favicon')) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径，除了：
     * - /api/auth/* (NextAuth 内部路径，由 middleware 函数内放行，但 matcher 也排除以避免任何干扰)
     * - /_next/static (静态资源)
     * - /_next/image (图片优化)
     * - /favicon.ico (网站图标)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
};

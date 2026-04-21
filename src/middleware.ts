/**
 * 全局认证中间件
 * 
 * 重要：不使用 auth() 包装器，避免干扰 NextAuth 的 CSRF 处理流程
 * 
 * 规则：
 * - NextAuth 路径（/api/auth/*）：完全放行，不做任何处理
 * - 公开路径：/login, /register, /api/db/* 等
 * - 内部调用：x-internal-token 请求头识别，绕过 session 检查
 * - 其余所有路径需认证
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 公开路径（不需要认证）
const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/api/auth',          // NextAuth 内部路径 - 必须完全放行
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

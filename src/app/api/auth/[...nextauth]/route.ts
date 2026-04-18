/**
 * NextAuth API 路由处理器
 * 
 * 处理 /api/auth/* 的所有请求
 * 
 * 职责：修正 x-forwarded-proto 头，让 NextAuth 的 createActionURL()
 * 构建正确的 URL（影响 redirect URL 等）。
 * 
 * 沙箱环境：浏览器 HTTP 访问，Origin 是 http:// → 保持 x-forwarded-proto: http
 * 公网环境：浏览器 HTTPS 访问，Origin 是 https:// → 修正 x-forwarded-proto: https
 * 
 * Cookie 安全策略由 src/lib/auth/index.ts 中的 lazy init 动态控制，
 * 不依赖 x-forwarded-proto 头。
 */

import { NextRequest } from 'next/server';
import { handlers } from '@/lib/auth';

function fixForwardedProto(request: NextRequest): NextRequest {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  // 判断浏览器实际连接协议
  const isBrowserHttps =
    (origin && origin.startsWith('https://')) ||
    (!origin && referer && referer.startsWith('https://'));

  const currentProto = request.headers.get('x-forwarded-proto');
  const targetProto = isBrowserHttps ? 'https' : 'http';

  // 只有需要修正时才创建新请求
  if (currentProto !== targetProto) {
    const headers = new Headers(request.headers);
    headers.set('x-forwarded-proto', targetProto);
    return new NextRequest(new URL(request.url), {
      method: request.method,
      headers,
      body: request.body,
    });
  }

  return request;
}

export async function GET(request: NextRequest) {
  return handlers.GET(fixForwardedProto(request));
}

export async function POST(request: NextRequest) {
  return handlers.POST(fixForwardedProto(request));
}

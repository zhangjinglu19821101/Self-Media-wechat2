/**
 * API 路由统一错误处理 — 识别 ApiKeyMissingError 并返回专用错误码
 * 
 * 使用方式：
 *   import { handleRouteError } from '@/lib/api/route-error-handler';
 *   
 *   try {
 *     const { client } = await createUserLLMClient(workspaceId);
 *     // ... 业务逻辑
 *   } catch (error) {
 *     return handleRouteError(error);
 *   }
 * 
 * 返回格式：
 *   - ApiKeyMissingError → 403 { error: '...', code: 'API_KEY_MISSING' }
 *   - 其他错误 → 500 { error: '...' }
 */

import { NextResponse } from 'next/server';
import { isApiKeyMissingError } from '@/lib/errors/api-key-missing';

export function handleRouteError(error: unknown, fallbackMessage = '服务器内部错误'): NextResponse {
  if (isApiKeyMissingError(error)) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        code: 'API_KEY_MISSING',
        redirectUrl: '/settings/api-keys',
      },
      { status: 403 }
    );
  }

  // 其他错误
  const message = error instanceof Error ? error.message : fallbackMessage;
  console.error('[API Error]', message, error instanceof Error ? error.stack : '');
  
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status: 500 }
  );
}

/**
 * 判断响应是否为 API Key 缺失错误
 * 前端 client.ts 使用
 */
export function isApiKeyMissingResponse(data: unknown): data is {
  success: false;
  error: string;
  code: 'API_KEY_MISSING';
  redirectUrl: string;
} {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as Record<string, unknown>).code === 'API_KEY_MISSING'
  );
}

/**
 * GET /api/user-api-keys — 获取当前工作空间的 API Key 列表（脱敏）
 * POST /api/user-api-keys — 创建新的 API Key
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getWorkspaceId } from '@/lib/auth/context';
import { userApiKeyService, UserApiKeyService } from '@/lib/services/user-api-key-service';
import type { LLMProvider } from '@/lib/db/schema/user-api-keys';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const workspaceId = await getWorkspaceId(request);
    const keys = await userApiKeyService.list(workspaceId);

    // 脱敏：移除加密字段，只返回展示信息
    const maskedKeys = keys.map(k => ({
      id: k.id,
      provider: k.provider,
      keySuffix: k.keySuffix,
      maskedKey: UserApiKeyService.maskKey(k),
      status: k.status,
      displayName: k.displayName,
      lastVerifiedAt: k.lastVerifiedAt,
      lastVerifyError: k.lastVerifyError,
      createdAt: k.createdAt,
      updatedAt: k.updatedAt,
    }));

    return NextResponse.json({ keys: maskedKeys });
  } catch (error: any) {
    console.error('[user-api-keys] GET 错误:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const workspaceId = await getWorkspaceId(request);
    const body = await request.json();
    const { provider = 'doubao', apiKey, displayName } = body;

    // 输入校验
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
      return NextResponse.json({ error: 'API Key 格式无效' }, { status: 400 });
    }

    if (provider !== 'doubao') {
      return NextResponse.json({ error: '当前仅支持豆包（doubao）Provider' }, { status: 400 });
    }

    const result = await userApiKeyService.create(
      workspaceId,
      provider as LLMProvider,
      apiKey.trim(),
      displayName
    );

    // 使 LLM 客户端缓存失效，下次调用时使用新 Key
    const { invalidateClientCache } = await import('@/lib/llm/factory');
    invalidateClientCache(workspaceId);

    return NextResponse.json({
      id: result.id,
      provider: result.provider,
      keySuffix: result.keySuffix,
      maskedKey: UserApiKeyService.maskKey(result),
      status: result.status,
      displayName: result.displayName,
      createdAt: result.createdAt,
    }, { status: 201 });
  } catch (error: any) {
    console.error('[user-api-keys] POST 错误:', error);
    
    if (error.message?.includes('已存在活跃')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

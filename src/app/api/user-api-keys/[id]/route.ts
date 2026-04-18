/**
 * GET /api/user-api-keys/[id] — 获取单个 Key 详情（脱敏）
 * PUT /api/user-api-keys/[id] — 更新 Key（状态/显示名）
 * DELETE /api/user-api-keys/[id] — 删除 Key
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getWorkspaceId } from '@/lib/auth/context';
import { userApiKeyService, UserApiKeyService } from '@/lib/services/user-api-key-service';
import type { ApiKeyStatus } from '@/lib/db/schema/user-api-keys';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;
    const workspaceId = await getWorkspaceId(request);
    const key = await userApiKeyService.getById(id, workspaceId);

    if (!key) {
      return NextResponse.json({ error: 'Key 不存在' }, { status: 404 });
    }

    return NextResponse.json({
      id: key.id,
      provider: key.provider,
      keySuffix: key.keySuffix,
      maskedKey: UserApiKeyService.maskKey(key),
      status: key.status,
      displayName: key.displayName,
      lastVerifiedAt: key.lastVerifiedAt,
      lastVerifyError: key.lastVerifyError,
      createdAt: key.createdAt,
      updatedAt: key.updatedAt,
    });
  } catch (error: any) {
    console.error('[user-api-keys/[id]] GET 错误:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;
    const workspaceId = await getWorkspaceId(request);
    const body = await request.json();
    const { status, displayName } = body;

    // 校验：至少要有一个更新字段
    if (!status && displayName === undefined) {
      return NextResponse.json({ error: '请提供要更新的字段（status 或 displayName）' }, { status: 400 });
    }

    let updated = false;

    // 更新状态
    if (status) {
      const validStatuses: ApiKeyStatus[] = ['active', 'disabled'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: '无效的状态值' }, { status: 400 });
      }

      const result = await userApiKeyService.updateStatus(id, workspaceId, status);
      if (!result) {
        return NextResponse.json({ error: 'Key 不存在' }, { status: 404 });
      }
      updated = true;
    }

    // 更新显示名称
    if (displayName !== undefined) {
      if (typeof displayName !== 'string' || displayName.length > 100) {
        return NextResponse.json({ error: '显示名称长度不能超过 100 字符' }, { status: 400 });
      }

      const result = await userApiKeyService.updateDisplayName(id, workspaceId, displayName.trim());
      if (!result && !updated) {
        return NextResponse.json({ error: 'Key 不存在' }, { status: 404 });
      }
      updated = true;
    }

    // 使 LLM 客户端缓存失效（状态变更时）
    if (status) {
      const { invalidateClientCache } = await import('@/lib/llm/factory');
      invalidateClientCache(workspaceId);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[user-api-keys/[id]] PUT 错误:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;
    const workspaceId = await getWorkspaceId(request);
    const deleted = await userApiKeyService.delete(id, workspaceId);

    if (!deleted) {
      return NextResponse.json({ error: 'Key 不存在' }, { status: 404 });
    }

    // 使缓存失效
    const { invalidateClientCache } = await import('@/lib/llm/factory');
    invalidateClientCache(workspaceId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[user-api-keys/[id]] DELETE 错误:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

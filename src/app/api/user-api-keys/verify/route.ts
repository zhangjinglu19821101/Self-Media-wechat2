/**
 * POST /api/user-api-keys/verify — 验证 API Key 有效性
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getWorkspaceId } from '@/lib/auth/context';
import { userApiKeyService } from '@/lib/services/user-api-key-service';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const workspaceId = await getWorkspaceId(request);
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: '缺少 Key ID' }, { status: 400 });
    }

    const result = await userApiKeyService.verify(id, workspaceId);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[user-api-keys/verify] POST 错误:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

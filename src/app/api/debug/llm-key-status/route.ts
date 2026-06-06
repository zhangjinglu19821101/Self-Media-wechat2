/**
 * LLM Key 状态诊断 API
 * 帮助用户诊断"余额不足"错误是来自哪个 Key
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/index';
import { workspaces } from '@/lib/db/schema/auth';
import { userApiKeys } from '@/lib/db/schema/user-api-keys';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get('workspaceId');
    const listAll = url.searchParams.get('all') === 'true';

    // 如果请求列出所有 workspace
    if (listAll) {
      const allWorkspaces = await db
        .select({
          id: workspaces.id,
          name: workspaces.name,
          llmKeySource: workspaces.llmKeySource,
        })
        .from(workspaces)
        .limit(20);

      const allKeys = await db
        .select({
          id: userApiKeys.id,
          workspaceId: userApiKeys.workspaceId,
          provider: userApiKeys.provider,
          isActive: userApiKeys.isActive,
        })
        .from(userApiKeys)
        .where(eq(userApiKeys.isActive, true))
        .limit(20);

      const hasPlatformKey = !!process.env.COZE_API_KEY;

      return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        platformKeyConfigured: hasPlatformKey,
        workspaces: allWorkspaces,
        userApiKeys: allKeys,
        summary: {
          workspacesCount: allWorkspaces.length,
          userApiKeysCount: allKeys.length,
        },
      });
    }

    // 必须提供 workspaceId
    if (!workspaceId) {
      return NextResponse.json({
        error: '请提供 workspaceId 参数，或使用 ?all=true 列出所有 workspace',
        usage: '/api/debug/llm-key-status?workspaceId=xxx 或 /api/debug/llm-key-status?all=true',
      }, { status: 400 });
    }

    // 1. 查询 workspace 配置
    const workspace = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (!workspace[0]) {
      return NextResponse.json({ error: '未找到 workspace', workspaceId }, { status: 404 });
    }

    const ws = workspace[0];
    const llmKeySource = ws.llmKeySource || 'platform_credits';

    // 2. 查询用户配置的 API Keys
    const userKeys = await db
      .select({
        id: userApiKeys.id,
        provider: userApiKeys.provider,
        isActive: userApiKeys.isActive,
        createdAt: userApiKeys.createdAt,
        lastUsedAt: userApiKeys.lastUsedAt,
      })
      .from(userApiKeys)
      .where(eq(userApiKeys.workspaceId, workspaceId));

    // 3. 判断实际使用的 Key 来源
    let actualKeySource: string;
    let keyDetails: Record<string, unknown> = {};

    if (llmKeySource === 'user_key') {
      const activeKey = userKeys.find(k => k.isActive && k.provider === 'doubao');
      if (activeKey) {
        actualKeySource = 'user_key';
        keyDetails = {
          provider: activeKey.provider,
          lastUsed: activeKey.lastUsedAt,
          message: '使用用户配置的豆包 API Key',
        };
      } else {
        actualKeySource = 'platform_fallback';
        keyDetails = {
          message: 'llmKeySource 设置为 user_key，但未找到有效的用户 Key，降级使用平台 Key',
        };
      }
    } else {
      actualKeySource = 'platform_credits';
      keyDetails = {
        message: '使用平台积分（平台默认 API Key）',
      };
    }

    // 4. 返回诊断信息
    return NextResponse.json({
      workspace: {
        id: ws.id,
        name: ws.name,
        llmKeySource: ws.llmKeySource,
      },
      actualKeySource,
      keyDetails,
      userApiKeys: userKeys,
      diagnosis: {
        explanation: actualKeySource === 'user_key'
          ? '当前使用的是您自己配置的豆包 API Key。如果提示"余额不足"，请检查您的豆包账户余额。'
          : actualKeySource === 'platform_fallback'
            ? '您设置了使用用户 Key，但未找到有效的用户 Key，系统降级使用平台 Key。请先配置有效的用户 Key。'
            : '当前使用的是平台默认 API Key（平台积分）。如果提示"余额不足"，请联系平台管理员或切换到用户自带 Key。',
        suggestions: actualKeySource === 'user_key'
          ? ['检查您的豆包 API Key 余额', '在设置页面重新配置 API Key', '切换到平台积分模式']
          : actualKeySource === 'platform_fallback'
            ? ['在设置页面配置有效的豆包 API Key', '或切换到平台积分模式']
            : ['配置您自己的豆包 API Key（BYOK 模式）', '联系平台管理员充值平台积分'],
      },
    });
  } catch (error) {
    console.error('[LLM Key Status] 查询失败:', error);
    return NextResponse.json(
      { error: '查询失败', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

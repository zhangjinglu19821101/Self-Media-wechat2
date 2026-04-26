/**
 * WebSocket 连接认证
 * 
 * 支持两种连接模式：
 * 1. Agent 连接（后端内部）：ws://host:5001/agent/{agentId}
 * 2. 用户连接（前端浏览器/App/小程序）：ws://host:5001/user?token={sessionToken|accessToken}&workspaceId={wsId}
 * 
 * Agent 连接使用白名单验证（内部服务可信）
 * 用户连接支持两种 Token：
 * - NextAuth Session Token（Web 浏览器）
 * - Bearer Access Token（App/小程序）
 */

import { db } from '@/lib/db';
import { workspaces, workspaceMembers } from '@/lib/db/schema/auth';
import { eq, and } from 'drizzle-orm';
import { AgentId } from '@/lib/agent-types';
import { decode } from 'next-auth/jwt';
import { tokenService } from '@/lib/auth/token-service';

/** 合法的 Agent ID 列表（内部服务白名单） */
const VALID_AGENT_IDS: AgentId[] = ['A', 'B', 'C', 'D', 'insurance-c', 'insurance-d', 'insurance-xiaohongshu', 'insurance-zhihu', 'insurance-toutiao', 'deai-optimizer'];

/** WS 认证结果 */
export interface WSAuthResult {
  /** 连接类型：agent 或 user */
  connectionType: 'agent' | 'user';
  /** Agent ID（agent 连接时） */
  agentId?: AgentId;
  /** 用户 Account ID（user 连接时） */
  accountId?: string;
  /** Session ID（user 连接时） */
  sessionId?: string;
  /** Workspace ID（user 连接时） */
  workspaceId?: string;
  /** 认证方式（user 连接时） */
  authMethod?: 'nextauth' | 'bearer';
}

/**
 * 认证 Agent 连接
 * Agent 使用白名单验证（内部服务可信）
 */
export function authenticateAgent(agentId: string): WSAuthResult | null {
  if (!VALID_AGENT_IDS.includes(agentId as AgentId)) {
    return null;
  }

  return {
    connectionType: 'agent',
    agentId: agentId as AgentId,
  };
}

/**
 * 认证用户 WebSocket 连接
 * 
 * 验证流程（双 Token 策略）：
 * 1. 先尝试 Bearer Access Token（App/小程序）
 * 2. 失败则降级到 NextAuth JWT Session Token（Web 浏览器）
 * 
 * 前端连接方式：
 * - Web 浏览器: new WebSocket(`wss://host/user?token=${sessionToken}&workspaceId=${wsId}`);
 * - App/小程序: new WebSocket(`wss://host/user?token=${accessToken}&workspaceId=${wsId}`);
 */
export async function authenticateUser(
  token: string | null,
  workspaceId?: string
): Promise<WSAuthResult | null> {
  if (!token) return null;

  // 🔴 新增：先尝试 Bearer Access Token
  try {
    const accessPayload = tokenService.verifyAccessToken(token);
    if (accessPayload && accessPayload.type === 'access') {
      // Access Token 验证成功
      const accountId = accessPayload.sub;
      const wsId = accessPayload.wid || workspaceId;

      // 如果指定了 workspaceId（非 JWT 中的），验证用户权限
      if (workspaceId && workspaceId !== accessPayload.wid) {
        const members = await db
          .select()
          .from(workspaceMembers)
          .where(
            and(
              eq(workspaceMembers.workspaceId, workspaceId),
              eq(workspaceMembers.accountId, accountId),
              eq(workspaceMembers.status, 'active')
            )
          )
          .limit(1);

        if (members.length === 0) return null;
      }

      return {
        connectionType: 'user',
        accountId,
        workspaceId: wsId || workspaceId || 'default-workspace',
        authMethod: 'bearer',
      };
    }
  } catch {
    // 不是有效的 Access Token，降级到 NextAuth
  }

  // 原有逻辑：NextAuth JWT Session Token 验证
  try {
    const decoded = await decode({
      token,
      secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || '',
    });

    if (!decoded?.sub) {
      console.warn('[WS Auth] JWT decode 失败或 sub 为空');
      return null;
    }

    const accountId = decoded.sub as string;

    // 如果指定了 workspaceId，验证用户是否有权限
    if (workspaceId) {
      const members = await db
        .select()
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, workspaceId),
            eq(workspaceMembers.accountId, accountId),
            eq(workspaceMembers.status, 'active')
          )
        )
        .limit(1);

      if (members.length === 0) {
        return null;
      }
    } else {
      // 未指定 workspaceId，使用用户默认个人 workspace
      const personalWorkspaces = await db
        .select()
        .from(workspaces)
        .where(
          and(
            eq(workspaces.ownerAccountId, accountId),
            eq(workspaces.type, 'personal')
          )
        )
        .limit(1);

      workspaceId = personalWorkspaces[0]?.id || 'default-workspace';
    }

    return {
      connectionType: 'user',
      accountId,
      sessionId: decoded.jti || undefined,
      workspaceId,
      authMethod: 'nextauth',
    };
  } catch (error) {
    console.error('[WS Auth] 用户认证失败:', error);
    return null;
  }
}

/**
 * 统一 WebSocket 连接认证入口
 * 
 * 根据 URL 路径区分连接类型：
 * - /agent/{agentId} → Agent 连接（白名单验证）
 * - /user?token=xxx&workspaceId=xxx → 用户连接（Token 验证）
 * - 其他 → 拒绝连接
 */
export async function authenticateWebSocket(
  urlPath: string,
  queryParams: URLSearchParams
): Promise<WSAuthResult | null> {
  // Agent 连接
  if (urlPath.startsWith('/agent/')) {
    const agentId = urlPath.split('/agent/')[1]?.split('/')[0];
    if (!agentId) return null;
    return authenticateAgent(agentId);
  }

  // 用户连接
  if (urlPath.startsWith('/user')) {
    const token = queryParams.get('token');
    const workspaceId = queryParams.get('workspaceId') || undefined;
    return authenticateUser(token, workspaceId);
  }

  // 未知路径
  return null;
}

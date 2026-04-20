/**
 * WebSocket 连接认证
 * 
 * 支持两种连接模式：
 * 1. Agent 连接（后端内部）：ws://host:5001/agent/{agentId}
 * 2. 用户连接（前端浏览器）：ws://host:5001/user?token={sessionToken}&workspaceId={wsId}
 * 
 * Agent 连接使用白名单验证（内部服务可信）
 * 用户连接使用 NextAuth JWT 验证（解析 session token 获取用户身份）
 */

import { db } from '@/lib/db';
import { workspaces, workspaceMembers } from '@/lib/db/schema/auth';
import { eq, and } from 'drizzle-orm';
import { AgentId } from '@/lib/agent-types';
import { decode } from 'next-auth/jwt';

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
 * 验证流程（使用 NextAuth JWT 策略）：
 * 1. 解析 URL 中的 token 参数（即 next-auth.session-token cookie 值）
 * 2. 使用 NextAuth JWT decode 验证 token 有效性
 * 3. 从 JWT payload 中提取 accountId（sub 字段）
 * 4. 如果提供了 workspaceId，验证用户是否有权限访问
 * 
 * 前端连接方式：
 *   const ws = new WebSocket(`wss://host/user?token=${sessionToken}&workspaceId=${wsId}`);
 */
export async function authenticateUser(
  token: string | null,
  workspaceId?: string
): Promise<WSAuthResult | null> {
  if (!token) return null;

  try {
    // 使用 NextAuth JWT decode 验证 token
    // NextAuth 使用 strategy: 'jwt'，token 存储在客户端 cookie 中
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
        // 用户不属于该 workspace
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

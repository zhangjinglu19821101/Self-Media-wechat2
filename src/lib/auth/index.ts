/**
 * NextAuth v5 认证配置
 * 
 * 使用 Credentials Provider（邮箱+密码）
 * JWT Session 策略
 * 
 * 关键：使用 lazy initialization 根据请求动态决定 useSecureCookies
 * - 沙箱环境 HTTP：useSecureCookies=false，非 Secure cookie，HTTP 可用
 * - 公网环境 HTTPS：useSecureCookies=true，Secure cookie，HTTPS 安全
 * 
 * 原理：NextAuth 根据 useSecureCookies 决定 cookie 前缀和 Secure 标记。
 * 浏览器不会在 HTTP 连接上发送 Secure cookie，所以沙箱 HTTP 环境
 * 必须用非 Secure cookie，否则 CSRF 验证必失败。
 */

import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { db } from '@/lib/db';
import { accounts, workspaceMembers, workspaces } from '@/lib/db/schema/auth';
import { eq, and, sql } from 'drizzle-orm';
import { verifyPassword } from '@/lib/auth/password';
import { AUTH_ERROR_CODES } from '@/lib/constants/auth-errors';

// 自定义 CredentialsSignin 子类，支持传递错误码到前端
class AuthCredentialsError extends CredentialsSignin {
  constructor(code: string) {
    super();
    this.code = code;
  }
}

/**
 * 判断请求是否来自 HTTPS 连接
 * 
 * NextAuth 内部通过 createActionURL() 构建 URL，
 * 该函数读取 x-forwarded-proto 头决定协议。
 * 但在沙箱环境中，代理设置了不一致的头（x-forwarded-proto: http
 * 而 x-forwarded-protocol: https），Next.js 可能误判为 HTTPS。
 * 
 * 这里通过浏览器实际发送的 Origin 头来判断真实协议，最可靠。
 */
function isSecureRequest(request: Request | undefined): boolean {
  if (!request) return true; // 无请求时默认 HTTPS（SSR 场景）
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  // 浏览器发 HTTPS 请求时 Origin 一定是 https://
  if (origin) return origin.startsWith('https://');
  // 无 Origin 时看 Referer（GET 请求可能没有 Origin）
  if (referer) return referer.startsWith('https://');
  // 都没有时（如 curl），默认 HTTPS（生产环境安全优先）
  return true;
}

export const { handlers, auth, signIn, signOut } = NextAuth((request) => {
  const useSecureCookies = isSecureRequest(request);

  return {
    providers: [
      Credentials({
        name: 'credentials',
        credentials: {
          email: { label: 'Email', type: 'email' },
          password: { label: 'Password', type: 'password' },
        },
        async authorize(credentials) {
          if (!credentials?.email || !credentials?.password) {
            throw new AuthCredentialsError(AUTH_ERROR_CODES.INVALID_PASSWORD);
          }

          const email = (credentials.email as string).trim().toLowerCase();
          const password = credentials.password as string;

          // 查找账户
          const [account] = await db.select()
            .from(accounts)
            .where(eq(accounts.email, email))
            .limit(1);

          if (!account) {
            throw new AuthCredentialsError(AUTH_ERROR_CODES.USER_NOT_FOUND);
          }

          // 检查账号状态
          if (account.status === 'disabled') {
            throw new AuthCredentialsError(AUTH_ERROR_CODES.ACCOUNT_DISABLED);
          }

          // 检查锁定
          if (account.lockedUntil && new Date(account.lockedUntil) > new Date()) {
            throw new AuthCredentialsError(AUTH_ERROR_CODES.ACCOUNT_LOCKED);
          }

          // 验证密码
          const isValid = await verifyPassword(password, account.passwordHash);
          if (!isValid) {
            // 增加失败计数
            const newAttempts = (account.failedLoginAttempts || 0) + 1;
            const updateData: Record<string, any> = {
              failedLoginAttempts: newAttempts,
              updatedAt: new Date(),
            };
            // 连续5次失败锁定30分钟
            if (newAttempts >= 5) {
              updateData.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
            }
            await db.update(accounts).set(updateData).where(eq(accounts.id, account.id));

            // 如果达到锁定阈值，提示锁定
            if (newAttempts >= 5) {
              throw new AuthCredentialsError(AUTH_ERROR_CODES.ACCOUNT_LOCKED);
            }
            throw new AuthCredentialsError(AUTH_ERROR_CODES.INVALID_PASSWORD);
          }

          // 登录成功：重置失败计数，更新最后登录时间
          await db.update(accounts).set({
            failedLoginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: new Date(),
            updatedAt: new Date(),
          }).where(eq(accounts.id, account.id));

          return {
            id: account.id,
            email: account.email,
            name: account.name,
            image: account.avatarUrl,
            role: account.role || 'normal',
          };
        },
      }),
    ],
    callbacks: {
      async jwt({ token, user }: any) {
        if (user) {
          token.id = user.id;
          token.email = user.email;
          token.role = user.role || 'normal';
        }
        return token;
      },
      async session({ session, token }: any) {
        if (session.user) {
          session.user.id = token.id as string;
          (session.user as any).role = token.role as string;
        }
        return session;
      },
    },
    pages: {
      signIn: '/login',
      error: '/login',
    },
    session: {
      strategy: 'jwt' as const,
      maxAge: 7 * 24 * 60 * 60, // 7 天
    },
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
    trustHost: true,
    useSecureCookies,
  };
});

/**
 * 获取用户可访问的所有 workspace
 */
export async function getUserWorkspaces(accountId: string) {
  // 1. 自己拥有的 workspace
  const owned = await db.select({
    id: workspaces.id,
    name: workspaces.name,
    slug: workspaces.slug,
    type: workspaces.type,
    role: sql<string>`'owner'`.as('role'),
  })
    .from(workspaces)
    .where(eq(workspaces.ownerAccountId, accountId));

  // 2. 自己参与的 workspace
  const memberOf = await db.select({
    id: workspaces.id,
    name: workspaces.name,
    slug: workspaces.slug,
    type: workspaces.type,
    role: workspaceMembers.role,
  })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(
      and(
        eq(workspaceMembers.accountId, accountId),
        eq(workspaceMembers.status, 'active'),
      )
    );

  // 合并去重（owned 可能和 memberOf 重叠）
  const map = new Map<string, { id: string; name: string; slug: string; type: string; role: string }>();
  for (const ws of [...owned, ...memberOf]) {
    if (!map.has(ws.id)) {
      map.set(ws.id, ws);
    }
  }

  return Array.from(map.values());
}

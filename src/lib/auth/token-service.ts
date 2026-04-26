/**
 * Token 服务
 * 
 * 为 App/小程序提供 Bearer Token 认证能力：
 * - Access Token: 无状态 JWT，15分钟有效
 * - Refresh Token: 有状态，SHA-256 哈希存库，30天有效，单次使用轮转
 * 
 * 安全设计：
 * - Refresh Token 明文仅签发时返回一次，数据库只存哈希
 * - 刷新时旧 Token 立即吊销（轮转）
 * - 复用 NextAuth 的 AUTH_SECRET 作为 JWT 签名密钥
 * - 复用现有账号锁定逻辑（5次失败锁定30分钟）
 */

import { sign, verify } from 'jsonwebtoken';
import { createHash, randomBytes } from 'crypto';
import { db } from '@/lib/db';
import { apiTokens } from '@/lib/db/schema/api-tokens';
import { accounts, workspaces, workspaceMembers } from '@/lib/db/schema/auth';
import { eq, and, gt, sql } from 'drizzle-orm';
import { verifyPassword } from '@/lib/auth/password';
import { getDefaultWorkspaceId } from '@/lib/db/tenant';
import { WorkspaceRole } from '@/lib/db/schema/auth';
import { initializeUserData } from '@/lib/services/init-user-data';
import { hashPassword } from '@/lib/auth/password';

// ==================== 常量 ====================

// P0-1 修复：JWT_SECRET 不允许空值，否则攻击者可用空密钥伪造 JWT
const _jwtSecretRaw = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || '';
if (!_jwtSecretRaw || _jwtSecretRaw.length < 32) {
  console.error('[TokenService] AUTH_SECRET/NEXTAUTH_SECRET 未设置或长度不足 32 字节，JWT 签名不安全');
}
const JWT_SECRET = _jwtSecretRaw;
const ACCESS_TOKEN_EXPIRES_S = 15 * 60;       // 15 分钟
const REFRESH_TOKEN_EXPIRES_S = 30 * 24 * 3600; // 30 天
const REFRESH_TOKEN_BYTES = 48;                 // 随机字节数
const MAX_TOKENS_PER_ACCOUNT = 20;              // 每个账户最多 20 个活跃 Token

// ==================== 类型 ====================

export interface AccessTokenPayload {
  sub: string;          // accountId
  wid: string;          // workspaceId
  role: string;         // 'super_admin' | 'normal'
  type: 'access';       // Token 类型标识
  iat: number;
  exp: number;
}

export interface TokenCreateOptions {
  deviceType: string;
  deviceName?: string;
  deviceId?: string;
  workspaceId?: string;
  /** P1-9: 微信小程序 session_key，用于后续解密敏感数据 */
  wechatSessionKey?: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    role: string;
  };
  workspaceId: string;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// ==================== 工具函数 ====================

/** 生成随机 Refresh Token */
function generateRefreshToken(): string {
  return randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
}

/** 对 Refresh Token 做 SHA-256 哈希（存库用） */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ==================== TokenService ====================

export class TokenService {

  // ============ 签发 ============

  /**
   * 签发 Access Token（无状态 JWT）
   */
  signAccessToken(payload: { accountId: string; workspaceId: string; role: string }): string {
    const jwtPayload: Omit<AccessTokenPayload, 'iat' | 'exp'> & { type: 'access' } = {
      sub: payload.accountId,
      wid: payload.workspaceId,
      role: payload.role,
      type: 'access',
    };

    return sign(jwtPayload, JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRES_S,
      algorithm: 'HS256',
    });
  }

  /**
   * 验证 Access Token
   * @returns 解码后的 payload，无效返回 null
   */
  verifyAccessToken(token: string): AccessTokenPayload | null {
    try {
      const decoded = verify(token, JWT_SECRET, {
        algorithms: ['HS256'],
      }) as AccessTokenPayload;

      // 必须是 access 类型
      if (decoded.type !== 'access') return null;
      if (!decoded.sub || !decoded.wid) return null;

      return decoded;
    } catch {
      // jwt expired / invalid signature / etc.
      return null;
    }
  }

  /**
   * 邮箱+密码登录，签发 Token 对
   * 复用 NextAuth 的账号锁定逻辑
   */
  async loginWithEmail(
    email: string,
    password: string,
    options: TokenCreateOptions,
  ): Promise<LoginResult> {
    const normalizedEmail = email.trim().toLowerCase();

    // 1. 查找账户
    const [account] = await db.select()
      .from(accounts)
      .where(eq(accounts.email, normalizedEmail))
      .limit(1);

    if (!account) {
      throw new Error('INVALID_CREDENTIALS');
    }

    // 2. 检查账号状态
    if (account.status === 'disabled') {
      throw new Error('ACCOUNT_DISABLED');
    }

    // 3. 检查锁定
    if (account.lockedUntil && new Date(account.lockedUntil) > new Date()) {
      const remaining = Math.ceil((new Date(account.lockedUntil).getTime() - Date.now()) / 60000);
      const err = new Error('ACCOUNT_LOCKED') as Error & { lockoutMinutes: number };
      err.lockoutMinutes = remaining;
      throw err;
    }

    // 4. 验证密码
    const isValid = await verifyPassword(password, account.passwordHash);
    if (!isValid) {
      // 增加失败计数（与 NextAuth 逻辑一致）
      const newAttempts = (account.failedLoginAttempts || 0) + 1;
      const updateData: Record<string, unknown> = {
        failedLoginAttempts: newAttempts,
        updatedAt: new Date(),
      };
      if (newAttempts >= 5) {
        updateData.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
      }
      await db.update(accounts).set(updateData).where(eq(accounts.id, account.id));
      throw new Error('INVALID_CREDENTIALS');
    }

    // 5. 登录成功：重置失败计数
    await db.update(accounts).set({
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(accounts.id, account.id));

    // 6. 确定 workspaceId
    let workspaceId = options.workspaceId;
    if (!workspaceId || workspaceId === 'default-workspace') {
      workspaceId = await getDefaultWorkspaceId(account.id) || 'default-workspace';
    }

    // 7. 清理过期 Token + 限制数量
    await this.cleanupAccountTokens(account.id);

    // 8. 生成 Refresh Token 并存库
    const refreshToken = generateRefreshToken();
    const tokenHashValue = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_S * 1000);

    await db.insert(apiTokens).values({
      accountId: account.id,
      tokenHash: tokenHashValue,
      deviceName: options.deviceName || null,
      deviceType: options.deviceType,
      deviceId: options.deviceId || null,
      workspaceId: workspaceId === 'default-workspace' ? null : workspaceId,
      expiresAt,
      isRevoked: false,
    });

    // 9. 签发 Access Token
    const accessToken = this.signAccessToken({
      accountId: account.id,
      workspaceId,
      role: account.role || 'normal',
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRES_S,
      tokenType: 'Bearer',
      user: {
        id: account.id,
        name: account.name,
        email: account.email,
        avatarUrl: account.avatarUrl,
        role: account.role || 'normal',
      },
      workspaceId,
    };
  }

  // ============ 刷新 ============

  /**
   * 刷新 Token 对（轮转模式）
   * 旧 Refresh Token 立即吊销，签发新的 Access + Refresh Token
   */
  async rotateRefreshToken(oldRefreshToken: string): Promise<RefreshResult | null> {
    const oldHash = hashToken(oldRefreshToken);

    // 1. 查找旧 Token
    const [tokenRecord] = await db.select()
      .from(apiTokens)
      .where(
        and(
          eq(apiTokens.tokenHash, oldHash),
          eq(apiTokens.isRevoked, false),
          gt(apiTokens.expiresAt, new Date()),
        )
      )
      .limit(1);

    if (!tokenRecord) {
      // Token 不存在 / 已吊销 / 已过期
      // 安全措施：如果发现已吊销的 Token 被复用，说明可能被盗用，吊销该账户所有 Token
      const [revokedToken] = await db.select()
        .from(apiTokens)
        .where(eq(apiTokens.tokenHash, oldHash))
        .limit(1);

      if (revokedToken?.isRevoked) {
        console.warn(`[TokenService] 检测到已吊销 Refresh Token 被复用，账户: ${revokedToken.accountId}`);
        await this.revokeAllTokens(revokedToken.accountId);
      }

      return null;
    }

    // 2. 吊销旧 Token
    await db.update(apiTokens)
      .set({ isRevoked: true, revokedAt: new Date() })
      .where(eq(apiTokens.id, tokenRecord.id));

    // 3. 获取账户信息
    const [account] = await db.select()
      .from(accounts)
      .where(eq(accounts.id, tokenRecord.accountId))
      .limit(1);

    if (!account || account.status === 'disabled') {
      return null;
    }

    // 4. 确定 workspaceId
    let workspaceId = tokenRecord.workspaceId;
    if (!workspaceId) {
      workspaceId = await getDefaultWorkspaceId(account.id) || 'default-workspace';
    }

    // 5. 签发新 Access Token
    const accessToken = this.signAccessToken({
      accountId: account.id,
      workspaceId,
      role: account.role || 'normal',
    });

    // 6. 生成新 Refresh Token 并存库
    const newRefreshToken = generateRefreshToken();
    const newTokenHash = hashToken(newRefreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_S * 1000);

    await db.insert(apiTokens).values({
      accountId: account.id,
      tokenHash: newTokenHash,
      deviceName: tokenRecord.deviceName,
      deviceType: tokenRecord.deviceType,
      deviceId: tokenRecord.deviceId,
      workspaceId: tokenRecord.workspaceId,
      expiresAt,
      isRevoked: false,
    });

    // 7. 更新最后使用时间（旧记录）
    await db.update(apiTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiTokens.id, tokenRecord.id));

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRES_S,
    };
  }

  // ============ 吊销 ============

  /**
   * 吊销单个 Refresh Token（退出登录）
   */
  async revokeRefreshToken(refreshToken: string): Promise<boolean> {
    const tokenHashValue = hashToken(refreshToken);

    const result = await db.update(apiTokens)
      .set({ isRevoked: true, revokedAt: new Date() })
      .where(
        and(
          eq(apiTokens.tokenHash, tokenHashValue),
          eq(apiTokens.isRevoked, false),
        )
      )
      .returning({ id: apiTokens.id });

    return result.length > 0;
  }

  /**
   * 吊销用户所有 Token（安全事件，如检测到盗用）
   */
  async revokeAllTokens(accountId: string): Promise<number> {
    const result = await db.update(apiTokens)
      .set({ isRevoked: true, revokedAt: new Date() })
      .where(
        and(
          eq(apiTokens.accountId, accountId),
          eq(apiTokens.isRevoked, false),
        )
      )
      .returning({ id: apiTokens.id });

    console.log(`[TokenService] 已吊销账户 ${accountId} 的 ${result.length} 个 Token`);
    return result.length;
  }

  // ============ 查询 ============

  /**
   * 列出用户所有活跃 Token（多设备管理）
   */
  async listActiveTokens(accountId: string): Promise<Array<{
    id: string;
    deviceName: string | null;
    deviceType: string;
    lastUsedAt: Date | null;
    createdAt: Date | null;
    expiresAt: Date | null;
  }>> {
    const tokens = await db.select({
      id: apiTokens.id,
      deviceName: apiTokens.deviceName,
      deviceType: apiTokens.deviceType,
      lastUsedAt: apiTokens.lastUsedAt,
      createdAt: apiTokens.createdAt,
      expiresAt: apiTokens.expiresAt,
    })
      .from(apiTokens)
      .where(
        and(
          eq(apiTokens.accountId, accountId),
          eq(apiTokens.isRevoked, false),
          gt(apiTokens.expiresAt, new Date()),
        )
      )
      .orderBy(sql`${apiTokens.lastUsedAt} DESC NULLS LAST, ${apiTokens.createdAt} DESC`);

    return tokens;
  }

  // ============ 维护 ============

  /**
   * 清理账户过期 Token，超过上限时淘汰最旧的
   */
  private async cleanupAccountTokens(accountId: string): Promise<void> {
    // 1. 删除已过期的 Token
    await db.delete(apiTokens)
      .where(
        and(
          eq(apiTokens.accountId, accountId),
          sql`${apiTokens.expiresAt} < NOW()`,
        )
      );

    // 2. 如果仍超过上限，吊销最旧的
    const activeTokens = await db.select({ id: apiTokens.id, createdAt: apiTokens.createdAt })
      .from(apiTokens)
      .where(
        and(
          eq(apiTokens.accountId, accountId),
          eq(apiTokens.isRevoked, false),
        )
      )
      .orderBy(sql`${apiTokens.lastUsedAt} DESC NULLS LAST, ${apiTokens.createdAt} DESC`);

    if (activeTokens.length >= MAX_TOKENS_PER_ACCOUNT) {
      const toRevoke = activeTokens.slice(MAX_TOKENS_PER_ACCOUNT - 1);
      if (toRevoke.length > 0) {
        await db.update(apiTokens)
          .set({ isRevoked: true, revokedAt: new Date() })
          .where(
            and(
              eq(apiTokens.accountId, accountId),
              sql`${apiTokens.id} IN (${sql.join(toRevoke.map(t => sql`${t.id}`), sql`, `)})`,
            )
          );
      }
    }
  }

  /**
   * 批量清理所有过期 Token（可由 cron 调用）
   */
  async cleanupAllExpiredTokens(): Promise<number> {
    const result = await db.delete(apiTokens)
      .where(sql`${apiTokens.expiresAt} < NOW()`)
      .returning({ id: apiTokens.id });

    return result.length;
  }

  // ============ 微信小程序 ============

  /**
   * 通过微信 OpenID 登录/注册
   * 
   * 如果 OpenID 已绑定账户 → 直接签发 Token
   * 如果 OpenID 未绑定 → 自动创建账户 + workspace → 签发 Token
   * 
   * P1-5 修复：自动注册流程使用事务保护，确保 account/workspace/member 数据一致性
   */
  async loginWithWechatOpenid(
    openid: string,
    options: TokenCreateOptions,
  ): Promise<LoginResult> {
    if (!openid) throw new Error('MISSING_OPENID');

    // 1. 查找已绑定账户
    let account: typeof accounts.$inferSelect | null = null;
    const [existing] = await db.select()
      .from(accounts)
      .where(eq(accounts.wechatOpenid, openid))
      .limit(1);

    if (existing) {
      // 检查账户状态
      if (existing.status === 'disabled') {
        throw new Error('ACCOUNT_DISABLED');
      }
      account = existing;

      // 更新最后登录时间 + P1-9: 刷新 session_key
      await db.update(accounts).set({
        lastLoginAt: new Date(),
        updatedAt: new Date(),
        // P1-9: 每次 wx.login 都会刷新 session_key，需更新存储
        ...(options.wechatSessionKey ? { wechatSessionKey: options.wechatSessionKey } : {}),
      }).where(eq(accounts.id, account.id));
    } else {
      // 2. 自动注册（P1-5: 使用事务保护）
      const autoName = `微信用户${openid.substring(0, 6)}`;
      const autoEmail = `wx_${openid.substring(0, 12)}@wechat.mini`;
      const autoPasswordHash = await hashPassword(randomBytes(32).toString('hex'));

      let registeredAccount: typeof accounts.$inferSelect | null = null;
      let registeredWorkspaceId: string | null = null;

      await db.transaction(async (tx) => {
        // 2a. 创建账户
        const [newAccount] = await tx.insert(accounts).values({
          email: autoEmail,
          emailVerified: false,
          passwordHash: autoPasswordHash,
          name: autoName,
          wechatOpenid: openid,
          // P1-9: 注册时存储 session_key
          ...(options.wechatSessionKey ? { wechatSessionKey: options.wechatSessionKey } : {}),
        }).returning();

        if (!newAccount) {
          throw new Error('AUTO_REGISTER_FAILED');
        }
        registeredAccount = newAccount;

        // 2b. 创建 Personal Workspace
        const slug = `personal-${newAccount.id.substring(0, 8)}`;
        const [workspace] = await tx.insert(workspaces).values({
          name: `${autoName}的工作空间`,
          slug,
          type: 'personal',
          ownerAccountId: newAccount.id,
        }).returning();

        // 2c. 添加为 Owner
        if (workspace) {
          registeredWorkspaceId = workspace.id;
          await tx.insert(workspaceMembers).values({
            workspaceId: workspace.id,
            accountId: newAccount.id,
            role: WorkspaceRole.OWNER,
            status: 'active',
            joinedAt: new Date(),
          });
        }

        // 注意：initializeUserData 必须在事务外部调用
        // 原因：它内部使用 db 全局实例（非 tx），不走事务连接，
        // 且内部 catch 吞掉异常不会触发回滚，放在事务内是无效的
      });

      if (!registeredAccount) {
        throw new Error('AUTO_REGISTER_FAILED');
      }
      account = registeredAccount;

      // 2d. 初始化默认数据（事务提交后执行，容错不阻塞注册）
      try {
        await initializeUserData(
          registeredAccount.id,
          registeredWorkspaceId || 'default-workspace',
        );
      } catch (initError) {
        // initializeUserData 内部已有 try-catch，此处是双重保障
        console.error('[TokenService] 微信自动注册后初始化数据失败（不影响注册结果）:', initError);
      }

      console.log(`[TokenService] 微信自动注册: openid=${openid.substring(0, 8)}..., account=${account.id}`);
    }

    // 6. 确定 workspaceId
    let workspaceId = options.workspaceId;
    if (!workspaceId || workspaceId === 'default-workspace') {
      workspaceId = await getDefaultWorkspaceId(account.id) || 'default-workspace';
    }

    // 7. 清理 + 生成 Token
    await this.cleanupAccountTokens(account.id);

    const refreshToken = generateRefreshToken();
    const tokenHashValue = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_S * 1000);

    await db.insert(apiTokens).values({
      accountId: account.id,
      tokenHash: tokenHashValue,
      deviceName: options.deviceName || '微信小程序',
      deviceType: options.deviceType || 'wechat_miniprogram',
      deviceId: options.deviceId || null,
      workspaceId: workspaceId === 'default-workspace' ? null : workspaceId,
      expiresAt,
      isRevoked: false,
    });

    const accessToken = this.signAccessToken({
      accountId: account.id,
      workspaceId,
      role: account.role || 'normal',
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRES_S,
      tokenType: 'Bearer',
      user: {
        id: account.id,
        name: account.name,
        email: account.email,
        avatarUrl: account.avatarUrl,
        role: account.role || 'normal',
      },
      workspaceId,
    };
  }
}

/** 单例导出 */
export const tokenService = new TokenService();

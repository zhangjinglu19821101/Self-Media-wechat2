/**
 * 用户 API Key 管理服务
 * 
 * 职责：
 * 1. AES-256-GCM 加密存储用户 API Key（不存明文）
 * 2. CRUD 操作（按 workspaceId 隔离）
 * 3. Key 有效性验证（调用 list models 接口）
 * 4. 脱敏展示（仅显示后 4 位）
 */

import { db } from '@/lib/db';
import { userApiKeys, type UserApiKey, type LLMProvider, type ApiKeyStatus } from '@/lib/db/schema/user-api-keys';
import { eq, and, desc } from 'drizzle-orm';
import crypto from 'crypto';

// ==================== 加密常量 ====================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM 推荐的 IV 长度
const TAG_LENGTH = 16; // GCM 认证标签长度

/**
 * 获取加密密钥（从环境变量读取，32 字节 = 256 位）
 */
function getEncryptionKey(): Buffer {
  const keyStr = process.env.COZE_ENCRYPTION_KEY;
  if (!keyStr) {
    throw new Error('[UserApiKeyService] 缺少环境变量 COZE_ENCRYPTION_KEY，请设置 32 字节的十六进制密钥');
  }
  return Buffer.from(keyStr, 'hex');
}

// ==================== 加密/解密工具函数 ====================

export interface EncryptedResult {
  encryptedKey: string; // base64 编码的密文
  iv: string;           // base64 编码的 IV
  tag: string;          // base64 编码的认证标签
}

/**
 * 加密 API Key（AES-256-GCM）
 * @param plainText 明文 API Key
 * @returns 加密结果（密文 + IV + Tag）
 */
function encryptApiKey(plainText: string): EncryptedResult {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const tag = cipher.getAuthTag();

  return {
    encryptedKey: encrypted,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

/**
 * 解密 API Key
 * @param encryptedData 加密数据
 * @returns 明文 API Key
 */
function decryptApiKey(encryptedData: EncryptedResult): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(encryptedData.iv, 'base64');
  const tag = Buffer.from(encryptedData.tag, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encryptedData.encryptedKey, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// ==================== 服务类 ====================

class UserApiKeyService {
  private static instance: UserApiKeyService | null = null;

  static getInstance(): UserApiKeyService {
    if (!UserApiKeyService.instance) {
      UserApiKeyService.instance = new UserApiKeyService();
    }
    return UserApiKeyService.instance;
  }

  /**
   * 创建新的 API Key 记录
   * @param workspaceId 工作空间 ID
   * @param provider Provider 类型
   * @param apiKey 明文 API Key（将被加密存储）
   * @param displayName 显示名称（可选）
   * @returns 创建后的记录（不含明文）
   */
  async create(
    workspaceId: string,
    provider: LLMProvider,
    apiKey: string,
    displayName?: string
  ): Promise<UserApiKey> {
    // 1. 输入校验
    if (!apiKey || apiKey.trim().length < 10) {
      throw new Error('API Key 格式无效，长度不足');
    }

    // 2. 检查同 workspace 同 provider 是否已有 active key
    const existing = await this.getActiveKey(workspaceId);
    if (existing) {
      throw new Error(`已存在活跃的 ${provider} API Key，请先禁用后再添加新 Key`);
    }

    // 3. 加密
    const encrypted = encryptApiKey(apiKey.trim());

    // 4. 提取后缀用于脱敏展示
    const suffix = apiKey.slice(-4);

    // 5. 插入数据库
    const [result] = await db.insert(userApiKeys).values({
      workspaceId,
      provider,
      encryptedKey: encrypted.encryptedKey,
      keyIv: encrypted.iv,
      keyTag: encrypted.tag,
      keySuffix: suffix,
      status: 'active',
      displayName: displayName || `${provider} API Key`,
    }).returning();

    console.log('[UserApiKeyService] ✅ API Key 创建成功', {
      id: result.id,
      workspaceId,
      provider,
      maskedKey: `****${suffix}`,
    });

    return result;
  }

  /**
   * 获取工作空间的所有 API Key 列表（脱敏）
   */
  async list(workspaceId: string): Promise<UserApiKey[]> {
    const keys = await db.select()
      .from(userApiKeys)
      .where(eq(userApiKeys.workspaceId, workspaceId))
      .orderBy(desc(userApiKeys.createdAt));

    return keys;
  }

  /**
   * 获取单个 Key 详情（脱敏）
   */
  async getById(id: string, workspaceId: string): Promise<UserApiKey | null> {
    const [key] = await db.select()
      .from(userApiKeys)
      .where(and(
        eq(userApiKeys.id, id),
        eq(userApiKeys.workspaceId, workspaceId),
      ));

    return key ?? null;
  }

  /**
   * 获取工作空间的活跃 API Key（解密返回明文，仅供内部使用）
   * ⚠️ 返回值包含明文 Key，调用方需谨慎处理
   */
  async getActiveKeyDecrypted(workspaceId: string): Promise<{
    id: string;
    apiKey: string;
    provider: LLMProvider;
  } | null> {
    const [key] = await db.select()
      .from(userApiKeys)
      .where(and(
        eq(userApiKeys.workspaceId, workspaceId),
        eq(userApiKeys.status, 'active'),
      ))
      .orderBy(desc(userApiKeys.lastVerifiedAt))
      .limit(1);

    if (!key) return null;

    try {
      const apiKey = decryptApiKey({
        encryptedKey: key.encryptedKey,
        iv: key.keyIv,
        tag: key.keyTag,
      });

      return {
        id: key.id,
        apiKey,
        provider: key.provider as LLMProvider,
      };
    } catch (error) {
      console.error('[UserApiKeyService] ⚠️ 解密失败:', error instanceof Error ? error.message : String(error));
      // 标记为 invalid
      await this.markInvalid(key.id);
      return null;
    }
  }

  /**
   * 获取工作空间的活跃 Key（不解密，用于判断是否存在）
   */
  async getActiveKey(workspaceId: string): Promise<UserApiKey | null> {
    const [key] = await db.select()
      .from(userApiKeys)
      .where(and(
        eq(userApiKeys.workspaceId, workspaceId),
        eq(userApiKeys.status, 'active'),
      ))
      .limit(1);

    return key ?? null;
  }

  /**
   * 更新 Key 状态
   */
  async updateStatus(id: string, workspaceId: string, status: ApiKeyStatus): Promise<UserApiKey | null> {
    const [result] = await db.update(userApiKeys)
      .set({ status, updatedAt: new Date() })
      .where(and(
        eq(userApiKeys.id, id),
        eq(userApiKeys.workspaceId, workspaceId),
      ))
      .returning();

    return result ?? null;
  }

  /**
   * 更新 Key 显示名称
   */
  async updateDisplayName(id: string, workspaceId: string, displayName: string): Promise<UserApiKey | null> {
    const [result] = await db.update(userApiKeys)
      .set({ displayName, updatedAt: new Date() })
      .where(and(
        eq(userApiKeys.id, id),
        eq(userApiKeys.workspaceId, workspaceId),
      ))
      .returning();

    return result ?? null;
  }

  /**
   * 删除 API Key
   */
  async delete(id: string, workspaceId: string): Promise<boolean> {
    const result = await db.delete(userApiKeys)
      .where(and(
        eq(userApiKeys.id, id),
        eq(userApiKeys.workspaceId, workspaceId),
      ))
      .returning({ id: userApiKeys.id });

    return result.length > 0;
  }

  /**
   * 验证 API Key 有效性（调用 list models 接口）
   * @param id Key ID
   * @param workspaceId 工作空间 ID
   * @returns 验证结果
   */
  async verify(id: string, workspaceId: string): Promise<{
    valid: boolean;
    error?: string;
  }> {
    const keyRecord = await this.getById(id, workspaceId);
    if (!keyRecord) {
      return { valid: false, error: 'Key 不存在' };
    }

    try {
      // ⚠️ P0修复：解密指定 id 的 Key，而非 getActiveKeyDecrypted（后者可能返回其他活跃 Key）
      let apiKey: string;
      try {
        const encryptedData = {
          encryptedKey: keyRecord.encryptedKey,
          iv: keyRecord.keyIv,
          tag: keyRecord.keyTag,
        };
        apiKey = decryptApiKey(encryptedData);
      } catch (decryptErr) {
        console.error('[UserApiKeyService] ⚠️ 解密失败:', decryptErr instanceof Error ? decryptErr.message : String(decryptErr));
        return { valid: false, error: '无法解密 Key' };
      }

      // 调用豆包 API 的 models 接口验证 Key 有效性
      const baseUrl = process.env.COZE_API_BASE_URL || process.env.LLM_API_URL || 'https://ark.cn-beijing.volces.com/api/v3';
      const response = await fetch(`${baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000), // 10 秒超时
      });

      if (response.ok) {
        // 更新最后验证时间
        await db.update(userApiKeys)
          .set({
            lastVerifiedAt: new Date(),
            lastVerifyError: null,
            status: 'active',
            updatedAt: new Date(),
          })
          .where(eq(userApiKeys.id, id));

        console.log('[UserApiKeyService] ✅ Key 验证通过', { id });
        return { valid: true };
      } else {
        const errorText = await response.text();
        const errorMsg = response.status === 401 ? 'API Key 无效或已过期' : `验证失败 (${response.status})`;

        await db.update(userApiKeys)
          .set({
            lastVerifiedAt: new Date(),
            lastVerifyError: errorMsg,
            updatedAt: new Date(),
          })
          .where(eq(userApiKeys.id, id));

        console.warn('[UserApiKeyService] ⚠️ Key 验证失败', { id, status: response.status, error: errorMsg.slice(0, 200) });
        return { valid: false, error: errorMsg };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[UserApiKeyService] ❌ Key 验证异常:', errorMsg);

      await db.update(userApiKeys)
        .set({
          lastVerifiedAt: new Date(),
          lastVerifyError: `网络错误: ${errorMsg.slice(0, 100)}`,
          updatedAt: new Date(),
        })
        .where(eq(userApiKeys.id, id));

      return { valid: false, error: `网络错误: ${errorMsg}` };
    }
  }

  /**
   * 标记 Key 为无效
   */
  private async markInvalid(id: string): Promise<void> {
    await db.update(userApiKeys)
      .set({
        status: 'invalid',
        updatedAt: new Date(),
      })
      .where(eq(userApiKeys.id, id));
  }

  /**
   * 脱敏展示 Key（仅显示后 4 位）
   */
  static maskKey(keyRecord: UserApiKey): string {
    if (keyRecord.keySuffix) {
      return `****${keyRecord.keySuffix}`;
    }
    return '****';
  }
}

// 导出单例
export const userApiKeyService = UserApiKeyService.getInstance();

// 同时导出类（用于静态方法调用，如 maskKey）
export { UserApiKeyService };

// 导出工具函数供其他模块使用
export { decryptApiKey };

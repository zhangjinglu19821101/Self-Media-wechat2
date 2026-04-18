/**
 * LLM 客户端工厂 — 平台积分 / 自有 Key 二选一
 * 
 * 超管在 /admin 为每个 workspace 设置 llmKeySource：
 * - 'platform_credits'（默认）→ 使用平台积分，费用由平台承担
 * - 'user_key' → 使用用户配置的 API Key，费用由用户承担；没配就报错
 * 
 * 不存在降级，二选一，没有中间态。
 */

import { LLMClient, Config, EmbeddingClient } from 'coze-coding-dev-sdk';
import { userApiKeyService } from '@/lib/services/user-api-key-service';
import { ApiKeyMissingError } from '@/lib/errors/api-key-missing';
import { db } from '@/lib/db';
import { workspaces } from '@/lib/db/schema/auth';
import { eq } from 'drizzle-orm';

// ==================== 缓存层 ====================

const MAX_CACHE_SIZE = 100;
const CACHE_TTL_MS = 5 * 60 * 1000;
const KEY_SOURCE_CACHE_TTL_MS = 2 * 60 * 1000;

/** LLM Client 实例缓存 */
const clientCache = new Map<string, { client: LLMClient; keyId: string; createdAt: number }>();

/** Embedding Client 实例缓存 */
const embeddingCache = new Map<string, { client: EmbeddingClient; keyId: string; createdAt: number }>();

/** workspace llmKeySource 缓存 */
const keySourceCache = new Map<string, { source: string; createdAt: number }>();

/**
 * 查询 workspace 的 llmKeySource（带 2 分钟缓存）
 */
async function getWorkspaceKeySource(workspaceId: string): Promise<string> {
  const cached = keySourceCache.get(workspaceId);
  if (cached && Date.now() - cached.createdAt < KEY_SOURCE_CACHE_TTL_MS) {
    return cached.source;
  }

  try {
    const rows = await db.select({ llmKeySource: workspaces.llmKeySource })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    const source = rows[0]?.llmKeySource || 'platform_credits';
    keySourceCache.set(workspaceId, { source, createdAt: Date.now() });
    return source;
  } catch (error) {
    console.warn('[LLM Factory] 查询 llmKeySource 失败，默认平台积分:', error instanceof Error ? error.message : String(error));
    return 'platform_credits';
  }
}

/** 清理过期缓存 + LRU 淘汰 */
function cleanExpiredCache(): void {
  const now = Date.now();
  for (const cache of [clientCache, embeddingCache]) {
    for (const [key, val] of cache.entries()) {
      if (now - val.createdAt > CACHE_TTL_MS) cache.delete(key);
    }
    if (cache.size > MAX_CACHE_SIZE) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      for (const [key, val] of cache.entries()) {
        if (val.createdAt < oldestTime) { oldestTime = val.createdAt; oldestKey = key; }
      }
      if (oldestKey) cache.delete(oldestKey);
    }
  }
}

// ==================== 平台默认 Client ====================

let platformLLMClient: LLMClient | null = null;
let platformEmbeddingClient: EmbeddingClient | null = null;

function getPlatformLLMClient(options?: { timeout?: number }): LLMClient {
  if (!platformLLMClient) {
    platformLLMClient = new LLMClient(new Config({ timeout: options?.timeout }));
  }
  return platformLLMClient;
}

function getPlatformEmbeddingClient(): EmbeddingClient {
  if (!platformEmbeddingClient) {
    platformEmbeddingClient = new EmbeddingClient();
  }
  return platformEmbeddingClient;
}

// ==================== 工厂方法 ====================

export interface CreateUserClientOptions {
  /** 请求超时（毫秒） */
  timeout?: number;
}

export interface UserClientResult {
  client: LLMClient;
  isUserKey: boolean;
  source: string;
}

export interface UserEmbeddingResult {
  client: EmbeddingClient;
  isUserKey: boolean;
  source: string;
}

/**
 * 创建用户级 LLM 客户端
 * 
 * 逻辑：
 * 1. 查 workspace.llmKeySource
 * 2. platform_credits → 返回平台 Client
 * 3. user_key → 查用户 Key → 有则用，无则报错
 */
export async function createUserLLMClient(
  workspaceId: string | undefined | null,
  options?: CreateUserClientOptions
): Promise<UserClientResult> {
  const timeout = options?.timeout;
  cleanExpiredCache();

  if (!workspaceId) {
    throw new ApiKeyMissingError('无法识别用户身份，请重新登录');
  }

  // 🔥 查 workspace 策略
  const keySource = await getWorkspaceKeySource(workspaceId);

  if (keySource === 'platform_credits') {
    return { client: getPlatformLLMClient({ timeout }), isUserKey: false, source: 'platform-credits' };
  }

  // keySource === 'user_key' → 必须有用户 Key

  // 检查缓存
  const cached = clientCache.get(workspaceId);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
    return { client: cached.client, isUserKey: true, source: `user-key-cached-${cached.keyId.slice(0, 8)}` };
  }

  // 查用户 Key
  const userKey = await userApiKeyService.getActiveKeyDecrypted(workspaceId);
  if (!userKey) {
    throw new ApiKeyMissingError('您的工作空间配置了使用自有 API Key，但尚未配置，请前往设置页面添加');
  }

  const client = new LLMClient(new Config({ apiKey: userKey.apiKey, timeout }));
  clientCache.set(workspaceId, { client, keyId: userKey.id, createdAt: Date.now() });

  console.log('[LLM Factory] 使用用户 API Key', {
    workspaceId,
    keyId: userKey.id.slice(0, 8),
    maskedKey: `****${userKey.apiKey.slice(-4)}`,
  });

  return { client, isUserKey: true, source: `user-key-${userKey.id.slice(0, 8)}` };
}

/**
 * 创建用户级 Embedding 客户端（逻辑同上）
 */
export async function createUserEmbeddingClient(
  workspaceId: string | undefined | null,
  _options?: CreateUserClientOptions
): Promise<UserEmbeddingResult> {
  cleanExpiredCache();

  if (!workspaceId) {
    throw new ApiKeyMissingError('无法识别用户身份，请重新登录');
  }

  const keySource = await getWorkspaceKeySource(workspaceId);

  if (keySource === 'platform_credits') {
    return { client: getPlatformEmbeddingClient(), isUserKey: false, source: 'platform-credits-embedding' };
  }

  // keySource === 'user_key'
  const cached = embeddingCache.get(workspaceId);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
    return { client: cached.client, isUserKey: true, source: `user-embedding-cached-${cached.keyId.slice(0, 8)}` };
  }

  const userKey = await userApiKeyService.getActiveKeyDecrypted(workspaceId);
  if (!userKey) {
    throw new ApiKeyMissingError('您的工作空间配置了使用自有 API Key，但尚未配置');
  }

  const client = new EmbeddingClient(new Config({ apiKey: userKey.apiKey }));
  embeddingCache.set(workspaceId, { client, keyId: userKey.id, createdAt: Date.now() });

  return { client, isUserKey: true, source: `user-embedding-${userKey.id.slice(0, 8)}` };
}

// ==================== 缓存管理 ====================

export function invalidateClientCache(workspaceId: string): void {
  clientCache.delete(workspaceId);
  embeddingCache.delete(workspaceId);
  keySourceCache.delete(workspaceId);
}

export function invalidateAllClientCache(): void {
  clientCache.clear();
  embeddingCache.clear();
  keySourceCache.clear();
}

// ==================== 兼容便捷方法 ====================

/** 获取平台默认 LLM Client（用于无需按 workspace 隔离的场景） */
export function getPlatformLLM(): LLMClient {
  return getPlatformLLMClient();
}

/** 获取平台默认 Embedding Client */
export function getPlatformEmbedding(): EmbeddingClient {
  return getPlatformEmbeddingClient();
}

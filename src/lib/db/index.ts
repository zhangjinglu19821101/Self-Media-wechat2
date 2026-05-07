/**
 * 数据库连接和操作服务
 * 
 * Schema 隔离设计：
 * 1. 根据 COZE_PROJECT_ENV 自动选择 schema（DEV → dev_schema, PROD → public）
 * 2. 通过 PostgreSQL Startup Message 的 connection.options 参数设置 search_path
 * 3. 同一数据库实例内实现开发/生产数据完全隔离
 * 
 * 生产可靠性加固：
 * - 连接池参数调优
 * - getDatabase() 单例防泄漏
 * - 健康检查 + 优雅关闭
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { sql } from 'drizzle-orm';

// ==================== Schema 隔离配置 ====================

/**
 * 根据 COZE_PROJECT_ENV 决定使用哪个 schema
 * - COZE_PROJECT_ENV=PROD → public（生产数据）
 * - COZE_PROJECT_ENV=DEV 或未设置 → dev_schema（开发/测试数据）
 * 
 * 🔴 P0-2 修复：支持环境变量覆盖默认 Schema 名称
 * - DEV_SCHEMA: 开发环境 Schema 名称（默认 dev_schema）
 * - PROD_SCHEMA: 生产环境 Schema 名称（默认 public）
 */
const PROJECT_ENV = process.env.COZE_PROJECT_ENV || 'DEV';
const DB_SCHEMA = PROJECT_ENV === 'PROD' 
  ? (process.env.PROD_SCHEMA || 'public') 
  : (process.env.DEV_SCHEMA || 'dev_schema');

console.log(`[DB] 环境模式: ${PROJECT_ENV}, 目标 Schema: ${DB_SCHEMA}`);

// ==================== 数据库连接 ====================

const RAW_DATABASE_URL = process.env.DATABASE_URL;
if (!RAW_DATABASE_URL) {
  throw new Error('[DB] DATABASE_URL 环境变量未设置，请检查 .env.local 配置');
}

/**
 * 获取原始数据库连接 URL（不含 search_path，用于创建迁移连接）
 */
export function getRawDatabaseUrl(): string {
  return RAW_DATABASE_URL;
}

/**
 * 创建数据库连接（统一连接池配置 + Schema 隔离）
 * 
 * Schema 隔离方案：
 * 使用 postgres.js 的 connection.options 参数，通过 PostgreSQL Startup Message 
 * 传递 `-c search_path=xxx` 命令，在连接建立时就设置好 search_path。
 * 
 * 这是 postgres.js 推荐的方式，因为：
 * 1. connection 对象的属性会作为 Startup Message 参数传递给 PostgreSQL
 * 2. 每个新连接都会自动应用，无需额外的 SQL 查询
 * 3. 不依赖 URL 参数（某些中间件会过滤 URL options）
 * 4. 比 onconnect 回调更早执行（在认证之前就生效）
 * 
 * search_path 设计：
 * - DEV 模式: search_path = dev_schema, public
 *   - 优先查 dev_schema，如果表不存在则回退到 public
 *   - 这确保了即使 dev_schema 尚未创建表，系统仍可正常运行
 * - PROD 模式: 不设置 connection.options（PostgreSQL 默认使用 public）
 */
function createConnection(): postgres.Sql {
  const isDev = DB_SCHEMA !== 'public';
  
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- postgres.js requires generic parameter
  const config: postgres.Options<{}> = {
    ssl: 'require',
    max: 10,
    idle_timeout: 60,
    connect_timeout: 10,
    max_lifetime: 30 * 60, // 30 分钟
    keep_alive: 30, // TCP keepalive 间隔（秒）
  };

  // DEV 模式：通过 PostgreSQL Startup Message 设置 search_path
  if (isDev) {
    // postgres.js 类型定义已包含 connection: Partial<ConnectionParameters>
    // ConnectionParameters 包含 [name: string] 索引签名，因此 options 字段类型安全
    // 该字段通过 Startup Message 传递 -c 参数，比 URL options 更可靠
    // 参考: https://www.postgresql.org/docs/current/protocol-flow.html#id-1.10.5.7.3
    config.connection = {
      options: `-c search_path=${DB_SCHEMA},public`,
    };
  }

  return postgres(RAW_DATABASE_URL, config);
}

// 创建全局数据库连接（单例，全进程共享连接池）
const client = createConnection();
export const db = drizzle(client, { schema });

// 重新导出 schema 供其他模块使用
export { schema };

// 🔴 P0 修复：统一返回类型
type DatabaseInstance = ReturnType<typeof drizzle>;

/**
 * 获取数据库连接实例
 */
export function getDatabase(): DatabaseInstance {
  return db;
}

/**
 * 获取数据库连接实例（带重试机制）
 */
export async function getDatabaseWithRetry(retries = 3, baseDelay = 1000): Promise<DatabaseInstance> {
  for (let i = 0; i < retries; i++) {
    try {
      await db.execute(sql`SELECT 1`);
      return db;
    } catch (error) {
      console.error(`[DB] 连接验证第 ${i + 1}/${retries} 次失败:`, error instanceof Error ? error.message : String(error));
      if (i < retries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  throw new Error('Failed to connect to database after retries');
}

// ==================== Schema 管理工具 ====================

/**
 * 获取当前使用的 Schema 名称
 */
export function getCurrentSchema(): string {
  return DB_SCHEMA;
}

/**
 * 获取当前环境模式
 */
export function getProjectEnv(): string {
  return PROJECT_ENV;
}

/**
 * 检查指定 Schema 是否存在
 */
export async function checkSchemaExists(schemaName: string): Promise<boolean> {
  const result = await db.execute(sql`SELECT schema_name FROM information_schema.schemata WHERE schema_name = ${schemaName}`);
  return Array.isArray(result) && result.length > 0;
}

/**
 * 创建 Schema（如果不存在）
 */
export async function createSchemaIfNotExists(schemaName: string): Promise<void> {
  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS ${sql.identifier(schemaName)}`);
  console.log(`[DB] Schema "${schemaName}" 已确保存在`);
}

/**
 * 清空指定 Schema 的所有数据（⚠️ 危险操作，仅用于开发环境）
 * 
 * 🔴 P1-3 安全防护：
 * 1. 只能清空当前激活的 schema（防止误操作其他 schema）
 * 2. 绝对不允许清空 public schema（即使是 DEV 环境也不允许，public 可能包含生产数据）
 */
export async function truncateSchema(schemaName: string): Promise<void> {
  // 安全检查1：只能清空当前激活的 schema
  if (schemaName !== DB_SCHEMA) {
    throw new Error(`[DB] 安全限制：只能清空当前 schema (${DB_SCHEMA})，请求的 ${schemaName} 不匹配`);
  }
  
  // 安全检查2：绝对不允许清空 public schema
  if (schemaName === 'public') {
    throw new Error('[DB] 安全限制：不允许清空 public schema（可能包含生产数据）');
  }
  
  const tables = await db.execute(sql`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = ${schemaName} AND table_type = 'BASE TABLE'
  `);
  
  if (Array.isArray(tables) && tables.length > 0) {
    for (const row of tables) {
      const tableName = row.table_name as string;
      await db.execute(sql`TRUNCATE TABLE ${sql.identifier(schemaName)}.${sql.identifier(tableName)} CASCADE`);
    }
    console.log(`[DB] Schema "${schemaName}" 数据已清空 (${tables.length} 张表)`);
  }
}

/**
 * 将源 schema 的表结构复制到目标 schema（不含数据）
 */
export async function cloneSchemaStructure(sourceSchema: string, targetSchema: string): Promise<void> {
  await createSchemaIfNotExists(targetSchema);
  
  const tables = await db.execute(sql`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = ${sourceSchema} AND table_type = 'BASE TABLE'
  `);
  
  let cloned = 0;
  if (Array.isArray(tables) && tables.length > 0) {
    for (const row of tables) {
      const tableName = row.table_name as string;
      const exists = await db.execute(sql`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = ${targetSchema} AND table_name = ${tableName}
      `);
      
      if (!Array.isArray(exists) || exists.length === 0) {
        try {
          await db.execute(sql`
            CREATE TABLE ${sql.identifier(targetSchema)}.${sql.identifier(tableName)} 
            (LIKE ${sql.identifier(sourceSchema)}.${sql.identifier(tableName)} INCLUDING ALL)
          `);
          cloned++;
        } catch (e) {
          console.warn(`[DB] 克隆表 ${tableName} 失败:`, e instanceof Error ? e.message : String(e));
        }
      }
    }
  }
  console.log(`[DB] Schema 结构克隆完成: ${sourceSchema} → ${targetSchema} (${cloned} 张表)`);
}

// ==================== 健康检查 ====================

/**
 * 数据库连接健康检查
 */
export async function checkDatabaseHealth(): Promise<{
  connected: boolean;
  latencyMs: number;
  schema: string;
  projectEnv: string;
  currentSearchPath?: string;
  error?: string;
  poolStats?: {
    total: number;
    idle: number;
    waiting: number;
  };
}> {
  const startTime = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    const latencyMs = Date.now() - startTime;

    // 查询当前 search_path 验证 Schema 隔离
    let currentSearchPath: string | undefined;
    try {
      const spResult = await db.execute(sql`SHOW search_path`);
      if (Array.isArray(spResult) && spResult.length > 0) {
        currentSearchPath = (spResult[0] as Record<string, unknown>).search_path as string;
      }
    } catch {
      // 查询 search_path 失败不影响健康检查
    }

    // P2-5: postgres.js 内部 pool 结构可能随版本变化，安全获取
    const poolStats = {
      total: (client as unknown as { pool?: { size?: number } }).pool?.size ?? -1,
      idle: (client as unknown as { pool?: { available?: number } }).pool?.available ?? -1,
      waiting: (client as unknown as { pool?: { waiting?: number } }).pool?.waiting ?? -1,
    };

    return {
      connected: true,
      latencyMs,
      schema: DB_SCHEMA,
      projectEnv: PROJECT_ENV,
      currentSearchPath,
      poolStats,
    };
  } catch (error) {
    return {
      connected: false,
      latencyMs: Date.now() - startTime,
      schema: DB_SCHEMA,
      projectEnv: PROJECT_ENV,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ==================== 优雅关闭 ====================

let dbClosing = false;

/**
 * 优雅关闭数据库连接
 */
export async function closeDatabase(): Promise<void> {
  if (dbClosing) {
    console.log('[DB] 连接池正在关闭中，跳过重复调用');
    return;
  }
  dbClosing = true;
  try {
    console.log('[DB] 正在关闭数据库连接池...');
    await client.end();
    console.log('[DB] 数据库连接池已关闭');
  } catch (error) {
    console.error('[DB] 关闭数据库连接池失败:', error);
  }
}

// 进程退出时优雅关闭连接
declare global {
  // eslint-disable-next-line no-var
  var __dbGracefulShutdownRegistered: boolean | undefined;
}

if (!global.__dbGracefulShutdownRegistered) {
  global.__dbGracefulShutdownRegistered = true;

  process.on('SIGTERM', async () => {
    await closeDatabase();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await closeDatabase();
    process.exit(0);
  });
}

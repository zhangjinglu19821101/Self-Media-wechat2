/**
 * 数据库连接和操作服务
 * 
 * 🔴 阶段1优化：
 * 1. 连接池参数调优（idle_timeout、connect_timeout）
 * 2. 修复 getDatabase() 连接泄漏（不再每次创建新连接）
 * 3. 新增连接健康检查（用于 /api/health）
 * 4. 优雅关闭（进程退出时释放连接池）
 * 
 * 🔴 P0 修复：
 * 5. getDatabase/getDatabaseWithRetry 返回类型统一
 * 6. closeDatabase() 竞态保护
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// 从环境变量获取数据库连接字符串
const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require';

/**
 * 创建数据库连接（统一连接池配置）
 * 
 * 参数说明：
 * - max: 连接池大小，10 足够单实例使用（引擎串行 + API 并发）
 * - idle_timeout: 空闲连接超时 30s，平衡连接复用和资源释放
 * - connect_timeout: 连接建立超时 10s，快速失败而非长时间阻塞
 * - max_lifetime: 连接最长生命周期 30min，避免长时间运行导致的连接状态异常
 */
function createConnection(): postgres.Sql {
  return postgres(DATABASE_URL, {
    ssl: 'require',
    max: 10,
    idle_timeout: 30,
    connect_timeout: 10,
    // 🔴 阶段1新增：连接最长生命周期，防止长时间运行的连接状态异常
    max_lifetime: 30 * 60, // 30 分钟
    // 🔴 阶段1新增：连接创建回调（用于监控）
    onconnect: () => {
      console.log('[DB] 新连接已建立');
    },
    // 🔴 阶段1新增：连接关闭回调
    onclose: () => {
      // 静默处理，避免日志过多
    },
  });
}

// 创建全局数据库连接（单例，全进程共享连接池）
const client = createConnection();
export const db = drizzle(client, { schema });

// 🔴 P0 修复：统一返回类型
type DatabaseInstance = ReturnType<typeof drizzle>;

/**
 * 获取数据库连接实例
 * 
 * 🔴 阶段1修复：直接返回全局单例，不再每次创建新连接
 * 旧版 getDatabase() 每次创建新连接但不关闭，导致连接泄漏
 * 
 * 🔴 P0 修复：返回类型与 getDatabaseWithRetry 统一
 */
export function getDatabase(): DatabaseInstance {
  return db;
}

/**
 * 获取数据库连接实例（带重试机制）
 * 
 * 🔴 阶段1优化：重试间隔改为指数退避，避免固定间隔导致的重试风暴
 * 🔴 P0 修复：返回类型与 getDatabase 统一（均为 DatabaseInstance）
 */
export async function getDatabaseWithRetry(retries = 3, baseDelay = 1000): Promise<DatabaseInstance> {
  for (let i = 0; i < retries; i++) {
    try {
      // 直接尝试执行一个简单查询验证连接可用
      await db.execute(sql`SELECT 1`);
      return db;
    } catch (error) {
      console.error(`[DB] 连接验证第 ${i + 1}/${retries} 次失败:`, error instanceof Error ? error.message : String(error));
      if (i < retries - 1) {
        // 指数退避：1s, 2s, 4s...
        const delay = baseDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  throw new Error('Failed to connect to database after retries');
}

/**
 * 🔴 阶段1新增：数据库连接健康检查
 * 用于 /api/health 端点
 * @returns 连接状态信息
 */
export async function checkDatabaseHealth(): Promise<{
  connected: boolean;
  latencyMs: number;
  error?: string;
  poolStats?: {
    total: number;
    idle: number;
    waiting: number;
  };
}> {
  const startTime = Date.now();
  try {
    // 执行简单查询验证连接可用
    await db.execute(sql`SELECT 1`);
    const latencyMs = Date.now() - startTime;

    // 获取连接池统计（postgres.js 的 pool 统计）
    const poolStats = {
      total: (client as any).pool?.size ?? -1,
      idle: (client as any).pool?.available ?? -1,
      waiting: (client as any).pool?.waiting ?? -1,
    };

    return {
      connected: true,
      latencyMs,
      poolStats,
    };
  } catch (error) {
    return {
      connected: false,
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// 🔴 P0 修复：closeDatabase 竞态保护
let dbClosing = false;

/**
 * 🔴 阶段1新增：优雅关闭数据库连接
 * 在进程退出时调用，确保所有连接正确释放
 * 
 * 🔴 P0 修复：使用 closing 标志防止并发关闭和竞态
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

// 🔴 阶段1新增：进程退出时优雅关闭连接
// 防止进程异常退出时连接未释放
// 使用 once + 全局标记防止 Next.js 热更新导致重复注册
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

/**
 * 导出 schema
 */
export { schema };

// 需要导入 sql 以用于健康检查查询
import { sql } from 'drizzle-orm';

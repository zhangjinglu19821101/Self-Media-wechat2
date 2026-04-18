/**
 * 数据库连接和操作服务
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// 从环境变量获取数据库连接字符串
const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

/**
 * 创建数据库连接
 */
function createConnection(): postgres.Sql {
  return postgres(DATABASE_URL, {
    ssl: 'require',
    max: 10,  // 增加连接池大小
    idle_timeout: 20,  // 减少空闲超时时间
    connect_timeout: 60,  // 增加连接超时时间
  });
}

// 创建全局数据库连接
const client = createConnection();
export const db = drizzle(client, { schema });

/**
 * 获取数据库连接实例
 */
export function getDatabase() {
  try {
    // 每次都创建新的连接，避免连接被服务器关闭的问题
    const newClient = createConnection();
    const newDb = drizzle(newClient, { schema });
    return newDb;
  } catch (error) {
    console.error('Database connection error:', error);
    // 如果连接失败，返回一个空对象
    throw error;
  }
}

/**
 * 获取数据库连接实例（带重试机制）
 */
export async function getDatabaseWithRetry(retries = 3, delay = 1000): Promise<ReturnType<typeof drizzle>> {
  for (let i = 0; i < retries; i++) {
    try {
      const newClient = createConnection();
      const newDb = drizzle(newClient, { schema });
      return newDb;
    } catch (error) {
      console.error(`Database connection attempt ${i + 1} failed:`, error);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  throw new Error('Failed to connect to database after retries');
}

/**
 * 关闭数据库连接（不使用，因为每次都创建新连接）
 */
export async function closeDatabase() {
  // 不需要实现，因为每次都创建新连接
}

/**
 * 导出 schema
 */
export { schema };

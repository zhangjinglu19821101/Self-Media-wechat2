/**
 * 数据库初始化脚本
 * 创建所有必要的数据库表
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// 创建数据库连接
const connectionString = process.env.DATABASE_URL || '';
const client = postgres(connectionString, { ssl: 'require' });
const db = drizzle(client, { schema });

/**
 * 初始化数据库表
 */
export async function initDatabase() {
  console.log('开始初始化数据库...');

  try {
    // 创建 agent_tasks 表
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS agent_tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id TEXT NOT NULL UNIQUE,
        from_agent_id TEXT NOT NULL,
        to_agent_id TEXT NOT NULL,
        command TEXT NOT NULL,
        command_type TEXT NOT NULL DEFAULT 'instruction',
        priority TEXT NOT NULL DEFAULT 'normal',
        status TEXT NOT NULL DEFAULT 'pending',
        result TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMP
      );
    `);

    // 创建索引
    await client.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_agent_tasks_from_agent ON agent_tasks(from_agent_id);
      CREATE INDEX IF NOT EXISTS idx_agent_tasks_to_agent ON agent_tasks(to_agent_id);
      CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status);
      CREATE INDEX IF NOT EXISTS idx_agent_tasks_created_at ON agent_tasks(created_at);
    `);

    console.log('agent_tasks 表创建成功');

    // 创建其他表（如果不存在）
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id TEXT NOT NULL UNIQUE,
        user_id TEXT,
        agent_id TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'active',
        variables JSONB DEFAULT '{}',
        context JSONB DEFAULT '{}',
        metadata JSONB DEFAULT '{}',
        started_at TIMESTAMP NOT NULL DEFAULT NOW(),
        ended_at TIMESTAMP,
        last_active_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        tokens INTEGER,
        model TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS agent_memories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id TEXT NOT NULL,
        memory_type TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        tags JSONB DEFAULT '[]',
        importance INTEGER NOT NULL DEFAULT 0,
        source TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    console.log('所有数据库表创建成功');
    console.log('数据库初始化完成');

    return { success: true };
  } catch (error) {
    console.error('数据库初始化失败:', error);
    return { success: false, error };
  } finally {
    await client.end();
  }
}

// 如果直接运行此脚本，执行初始化
if (require.main === module) {
  initDatabase()
    .then((result) => {
      if (result.success) {
        console.log('✅ 数据库初始化成功');
        process.exit(0);
      } else {
        console.error('❌ 数据库初始化失败');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ 数据库初始化异常:', error);
      process.exit(1);
    });
}

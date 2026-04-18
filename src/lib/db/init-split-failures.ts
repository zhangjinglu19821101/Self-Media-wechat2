/**
 * 数据库初始化脚本
 * 创建 split_failures 表
 */

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function createSplitFailuresTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS split_failures (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        failure_id TEXT NOT NULL UNIQUE,
        task_id TEXT NOT NULL,
        task_name TEXT NOT NULL,
        core_command TEXT NOT NULL,
        failure_reason TEXT NOT NULL,
        retry_count INTEGER NOT NULL DEFAULT 0,
        agent_b_responses JSONB DEFAULT '[]',
        exception_status TEXT NOT NULL DEFAULT 'pending',
        exception_priority TEXT NOT NULL DEFAULT 'normal',
        assigned_to TEXT,
        assigned_at TIMESTAMP,
        manual_split_result JSONB DEFAULT '{}',
        processing_notes TEXT,
        resolved_by TEXT,
        resolved_at TIMESTAMP,
        resolution_method TEXT,
        resolution_result JSONB DEFAULT '{}',
        from_agent_id TEXT NOT NULL,
        to_agent_id TEXT NOT NULL,
        conversation_id TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    
    // 创建索引
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_split_failures_task_id ON split_failures(task_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_split_failures_exception_status ON split_failures(exception_status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_split_failures_created_at ON split_failures(created_at DESC)`);
    
    console.log('✅ split_failures 表创建成功');
    return true;
  } catch (error) {
    console.error('❌ 创建 split_failures 表失败:', error);
    return false;
  }
}

// 如果直接运行此脚本，则创建表
if (import.meta.url === `file://${process.argv[1]}`) {
  createSplitFailuresTable()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

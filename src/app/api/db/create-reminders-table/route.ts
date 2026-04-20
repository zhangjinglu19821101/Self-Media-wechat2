/**
 * 提醒表迁移 API
 * 
 * V1: 基础表创建
 * V2: 新增 requester_name / assignee_name / direction 字段（谁要求谁做什么）
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    console.log('[create-reminders-table] 开始创建/迁移提醒表...');

    // V1: 创建 reminders 表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS reminders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content TEXT NOT NULL,
        remind_at TIMESTAMP NOT NULL,
        reminded_at TIMESTAMP,
        status VARCHAR(20) DEFAULT 'pending',
        repeat_mode VARCHAR(20) DEFAULT 'once',
        notify_methods JSONB DEFAULT '["browser", "popup"]'::jsonb,
        workspace_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // V2: 新增字段（谁要求谁做什么）
    // 检查字段是否已存在
    const columns = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'reminders' AND column_name IN ('requester_name', 'assignee_name', 'direction')
    `);

    const existingColumns = columns.map((row: any) => row.column_name);

    if (!existingColumns.includes('requester_name')) {
      await db.execute(sql`ALTER TABLE reminders ADD COLUMN requester_name VARCHAR(100) NOT NULL DEFAULT '我'`);
      console.log('[create-reminders-table] 新增 requester_name 字段');
    }

    if (!existingColumns.includes('assignee_name')) {
      await db.execute(sql`ALTER TABLE reminders ADD COLUMN assignee_name VARCHAR(100) NOT NULL DEFAULT '我'`);
      console.log('[create-reminders-table] 新增 assignee_name 字段');
    }

    if (!existingColumns.includes('direction')) {
      await db.execute(sql`ALTER TABLE reminders ADD COLUMN direction VARCHAR(20) NOT NULL DEFAULT 'outbound'`);
      console.log('[create-reminders-table] 新增 direction 字段');
    }

    // 创建索引
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_reminders_workspace_id ON reminders(workspace_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_reminders_remind_at ON reminders(remind_at)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_reminders_direction ON reminders(direction)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_reminders_requester ON reminders(requester_name)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_reminders_assignee ON reminders(assignee_name)`);

    console.log('[create-reminders-table] 提醒表迁移成功');

    return NextResponse.json({
      success: true,
      message: '提醒表迁移成功',
      table: 'reminders',
      addedFields: ['requester_name', 'assignee_name', 'direction'],
      indexes: [
        'idx_reminders_workspace_id',
        'idx_reminders_status',
        'idx_reminders_remind_at',
        'idx_reminders_direction',
        'idx_reminders_requester',
        'idx_reminders_assignee',
      ],
    });
  } catch (error: any) {
    console.error('[create-reminders-table] 迁移失败:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

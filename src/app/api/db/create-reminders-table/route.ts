/**
 * 创建提醒表迁移 API
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    console.log('[create-reminders-table] 开始创建提醒表...');

    // 创建 reminders 表
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

    // 创建索引
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_reminders_workspace_id ON reminders(workspace_id);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_reminders_remind_at ON reminders(remind_at);
    `);

    console.log('[create-reminders-table] 提醒表创建成功');

    return NextResponse.json({
      success: true,
      message: '提醒表创建成功',
      table: 'reminders',
      indexes: ['idx_reminders_workspace_id', 'idx_reminders_status', 'idx_reminders_remind_at'],
    });
  } catch (error: any) {
    console.error('[create-reminders-table] 创建失败:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

/**
 * 数据库迁移：给 accounts 表添加 role 和 status 字段
 * 
 * GET /api/db/add-account-role-fields
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    console.log('[Migration] 开始添加 accounts 表 role 和 status 字段...');

    // 1. 添加 role 字段（如果不存在）
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'accounts' AND column_name = 'role'
        ) THEN
          ALTER TABLE accounts ADD COLUMN role text NOT NULL DEFAULT 'normal';
          RAISE NOTICE 'Added role column to accounts table';
        END IF;
      END $$;
    `);

    // 2. 添加 status 字段（如果不存在）
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'accounts' AND column_name = 'status'
        ) THEN
          ALTER TABLE accounts ADD COLUMN status text NOT NULL DEFAULT 'active';
          RAISE NOTICE 'Added status column to accounts table';
        END IF;
      END $$;
    `);

    // 3. 创建索引
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_accounts_role ON accounts(role);
      CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
    `);

    // 4. 查询当前状态
    const result = await db.execute(sql`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'accounts' AND column_name IN ('role', 'status')
      ORDER BY column_name;
    `);

    return NextResponse.json({
      success: true,
      message: 'accounts 表字段迁移完成',
      fields: result.rows,
    });
  } catch (error) {
    console.error('[Migration] 添加字段失败:', error);
    return NextResponse.json({
      success: false,
      error: String(error),
    }, { status: 500 });
  }
}

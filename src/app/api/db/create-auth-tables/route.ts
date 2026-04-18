/**
 * 创建认证相关表
 * 
 * GET /api/db/create-auth-tables
 * 
 * 创建 accounts, workspaces, workspace_members, account_sessions 四张表
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  const results: string[] = [];

  try {
    // 1. 创建 accounts 表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        email_verified BOOLEAN DEFAULT FALSE,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        avatar_url TEXT,
        phone TEXT,
        failed_login_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMPTZ,
        timezone TEXT DEFAULT 'Asia/Shanghai',
        locale TEXT DEFAULT 'zh-CN',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        last_login_at TIMESTAMPTZ,
        last_login_ip TEXT
      );
    `);
    results.push('✅ accounts 表已创建');

    // 创建 accounts 索引
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email);`);
    results.push('✅ accounts 索引已创建');

    // 2. 创建 workspaces 表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS workspaces (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL DEFAULT 'personal',
        owner_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        company_name TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    results.push('✅ workspaces 表已创建');

    // 创建 workspaces 索引
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_account_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_workspaces_type ON workspaces(type);`);
    results.push('✅ workspaces 索引已创建');

    // 3. 创建 workspace_members 表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS workspace_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'viewer',
        status TEXT NOT NULL DEFAULT 'active',
        invited_by UUID REFERENCES accounts(id),
        invited_at TIMESTAMPTZ DEFAULT NOW(),
        joined_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    results.push('✅ workspace_members 表已创建');

    // 创建 workspace_members 索引
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_members_unique ON workspace_members(workspace_id, account_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_workspace_members_account ON workspace_members(account_id);`);
    results.push('✅ workspace_members 索引已创建');

    // 4. 创建 account_sessions 表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS account_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        device_info JSONB,
        ip_address TEXT,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    results.push('✅ account_sessions 表已创建');

    // 创建 account_sessions 索引
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_sessions_account ON account_sessions(account_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_sessions_token ON account_sessions(token);`);
    results.push('✅ account_sessions 索引已创建');

    return NextResponse.json({
      success: true,
      message: '认证系统表创建完成',
      results,
    });
  } catch (error: any) {
    console.error('[create-auth-tables] 建表失败:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      results,
    }, { status: 500 });
  }
}

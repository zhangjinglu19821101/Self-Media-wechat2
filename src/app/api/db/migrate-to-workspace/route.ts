/**
 * Workspace 数据迁移 API
 * 
 * GET /api/db/migrate-to-workspace
 * 
 * 执行以下操作：
 * 1. 11张表 user_id → workspace_id 重命名
 * 2. 核心业务表添加 workspace_id 字段
 * 3. 创建必要的索引
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  const results: string[] = [];
  const errors: string[] = [];

  try {
    // =============================================
    // Step 1: 已有 user_id 的表 → 重命名为 workspace_id
    // =============================================
    const renameTables = [
      'style_templates',
      'platform_accounts',
      'account_style_configs',
      'style_assets',
      'core_anchor_assets',
      'feedback_assets',
      'material_library',
      'material_usage_log',
      'article_hashes',
      'feedback_records',
      'notifications_v3',
    ];

    for (const table of renameTables) {
      try {
        // 检查 workspace_id 列是否已存在
        const columnCheck = await db.execute(sql`
          SELECT column_name FROM information_schema.columns 
          WHERE table_name = ${table} AND column_name = 'workspace_id'
          LIMIT 1;
        `);

        if (columnCheck.rows && columnCheck.rows.length > 0) {
          results.push(`⏭️ ${table}.workspace_id 已存在，跳过重命名`);
          continue;
        }

        // 检查 user_id 列是否存在
        const userIdCheck = await db.execute(sql`
          SELECT column_name FROM information_schema.columns 
          WHERE table_name = ${table} AND column_name = 'user_id'
          LIMIT 1;
        `);

        if (userIdCheck.rows && userIdCheck.rows.length > 0) {
          await db.execute(sql`ALTER TABLE ${sql.identifier(table)} RENAME COLUMN user_id TO workspace_id;`);
          results.push(`✅ ${table}.user_id → workspace_id 重命名成功`);
        } else {
          // user_id 不存在，直接添加 workspace_id
          await db.execute(sql`ALTER TABLE ${sql.identifier(table)} ADD COLUMN IF NOT EXISTS workspace_id TEXT;`);
          results.push(`✅ ${table}.workspace_id 新增成功（原无 user_id）`);
        }

        // 创建索引
        try {
          await db.execute(sql`
            CREATE INDEX IF NOT EXISTS ${sql.identifier(`idx_${table}_workspace_id`)} 
            ON ${sql.identifier(table)}(workspace_id);
          `);
        } catch (idxErr: any) {
          // 索引创建失败不阻塞
        }

      } catch (err: any) {
        errors.push(`❌ ${table}: ${err.message}`);
      }
    }

    // =============================================
    // Step 2: 核心业务表添加 workspace_id 字段
    // =============================================
    const addWorkspaceIdTables = [
      'agent_tasks',
      'daily_task',
      'agent_sub_tasks',
      'agent_sub_tasks_step_history',
      'agent_sub_tasks_mcp_executions',
      'command_results',
      'agent_a_todos',
      'agent_notifications',
      'agent_feedbacks',
      'agent_interactions',
      'agent_reports',
      'split_failures',
      'conversations',
    ];

    for (const table of addWorkspaceIdTables) {
      try {
        // 检查 workspace_id 是否已存在
        const columnCheck = await db.execute(sql`
          SELECT column_name FROM information_schema.columns 
          WHERE table_name = ${table} AND column_name = 'workspace_id'
          LIMIT 1;
        `);

        if (columnCheck.rows && columnCheck.rows.length > 0) {
          results.push(`⏭️ ${table}.workspace_id 已存在，跳过`);
          continue;
        }

        // 添加 workspace_id 字段
        await db.execute(sql`
          ALTER TABLE ${sql.identifier(table)} 
          ADD COLUMN IF NOT EXISTS workspace_id TEXT;
        `);

        // 创建索引
        try {
          await db.execute(sql`
            CREATE INDEX IF NOT EXISTS ${sql.identifier(`idx_${table}_workspace_id`)} 
            ON ${sql.identifier(table)}(workspace_id);
          `);
        } catch (idxErr: any) {
          // 索引创建失败不阻塞
        }

        results.push(`✅ ${table}.workspace_id 新增成功`);
      } catch (err: any) {
        errors.push(`❌ ${table} 添加 workspace_id 失败: ${err.message}`);
      }
    }

    // =============================================
    // Step 3: 反馈表也补上 userId（如果还没有的话）
    // =============================================
    try {
      const fbCheck = await db.execute(sql`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'feedback_assets' AND column_name = 'user_id'
        LIMIT 1;
      `);
      if (fbCheck.rows && fbCheck.rows.length > 0) {
        // 如果还有 user_id，说明还没被重命名。重命名
        const wsCheck = await db.execute(sql`
          SELECT column_name FROM information_schema.columns 
          WHERE table_name = 'feedback_assets' AND column_name = 'workspace_id'
          LIMIT 1;
        `);
        if (!wsCheck.rows || wsCheck.rows.length === 0) {
          await db.execute(sql`ALTER TABLE feedback_assets RENAME COLUMN user_id TO workspace_id;`);
          results.push(`✅ feedback_assets.user_id → workspace_id 重命名成功`);
        }
      }
    } catch (err: any) {
      // feedback_assets 可能没有 user_id，忽略
    }

    return NextResponse.json({
      success: true,
      message: 'Workspace 迁移完成',
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('[migrate-to-workspace] 迁移失败:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      results,
      errors,
    }, { status: 500 });
  }
}

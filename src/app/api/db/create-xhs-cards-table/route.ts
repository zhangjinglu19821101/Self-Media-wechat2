/**
 * 创建 xhs_cards 和 xhs_card_groups 表的迁移 API
 * GET /api/db/create-xhs-cards-table
 * 
 * 表说明：
 * - xhs_cards: 存储每张卡片的元信息和对象存储 key
 * - xhs_card_groups: 存储一次生成任务产生的一组卡片
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    console.log('[Migration] 开始创建 xhs_cards 和 xhs_card_groups 表...');
    
    // ========== 创建 xhs_cards 表 ==========
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS xhs_cards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sub_task_id TEXT,
        command_result_id TEXT,
        card_index INTEGER NOT NULL,
        card_type TEXT NOT NULL,
        storage_key TEXT NOT NULL,
        file_format TEXT NOT NULL DEFAULT 'png',
        title_snapshot TEXT,
        content_snapshot TEXT,
        width INTEGER NOT NULL DEFAULT 1080,
        height INTEGER NOT NULL DEFAULT 1440,
        file_size INTEGER,
        gradient_scheme TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        is_public BOOLEAN NOT NULL DEFAULT true,
        workspace_id TEXT,
        created_at TIMESTAMP DEFAULT now() NOT NULL,
        updated_at TIMESTAMP DEFAULT now() NOT NULL,
        expires_at TIMESTAMP
      );
    `);
    
    // 创建 xhs_cards 索引
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_xhs_cards_sub_task_id ON xhs_cards(sub_task_id);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_xhs_cards_command_result_id ON xhs_cards(command_result_id);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_xhs_cards_card_index ON xhs_cards(card_index);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_xhs_cards_status ON xhs_cards(status);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_xhs_cards_workspace_id ON xhs_cards(workspace_id);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_xhs_cards_expires_at ON xhs_cards(expires_at);
    `);
    
    // ========== 创建 xhs_card_groups 表 ==========
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS xhs_card_groups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sub_task_id TEXT NOT NULL,
        command_result_id TEXT,
        total_cards INTEGER NOT NULL,
        card_count_mode TEXT NOT NULL,
        gradient_scheme TEXT,
        article_title TEXT,
        article_intro TEXT,
        card_ids TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'active',
        workspace_id TEXT,
        created_at TIMESTAMP DEFAULT now() NOT NULL,
        updated_at TIMESTAMP DEFAULT now() NOT NULL
      );
    `);
    
    // 创建 xhs_card_groups 索引
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_xhs_card_groups_sub_task_id ON xhs_card_groups(sub_task_id);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_xhs_card_groups_command_result_id ON xhs_card_groups(command_result_id);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_xhs_card_groups_status ON xhs_card_groups(status);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_xhs_card_groups_workspace_id ON xhs_card_groups(workspace_id);
    `);
    
    console.log('[Migration] xhs_cards 和 xhs_card_groups 表创建成功');
    
    return NextResponse.json({
      success: true,
      message: 'xhs_cards 和 xhs_card_groups 表创建成功',
      tables: ['xhs_cards', 'xhs_card_groups'],
      indexes: {
        xhs_cards: [
          'idx_xhs_cards_sub_task_id',
          'idx_xhs_cards_command_result_id',
          'idx_xhs_cards_card_index',
          'idx_xhs_cards_status',
          'idx_xhs_cards_workspace_id',
          'idx_xhs_cards_expires_at',
        ],
        xhs_card_groups: [
          'idx_xhs_card_groups_sub_task_id',
          'idx_xhs_card_groups_command_result_id',
          'idx_xhs_card_groups_status',
          'idx_xhs_card_groups_workspace_id',
        ],
      },
    });
  } catch (error) {
    console.error('[Migration] 创建 xhs_cards 表失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

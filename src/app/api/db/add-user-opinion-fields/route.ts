/**
 * 数据库迁移：添加用户观点和素材字段
 * GET /api/db/add-user-opinion-fields
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    console.log('[Migration] 开始添加用户观点和素材字段...');

    // 1. agent_tasks 表添加字段
    await db.execute(sql`
      ALTER TABLE agent_tasks 
      ADD COLUMN IF NOT EXISTS user_opinion TEXT;
    `);
    console.log('[Migration] agent_tasks.user_opinion 添加成功');

    await db.execute(sql`
      ALTER TABLE agent_tasks 
      ADD COLUMN IF NOT EXISTS material_ids JSONB DEFAULT '[]';
    `);
    console.log('[Migration] agent_tasks.material_ids 添加成功');

    // 2. agent_sub_tasks 表添加字段
    await db.execute(sql`
      ALTER TABLE agent_sub_tasks 
      ADD COLUMN IF NOT EXISTS user_opinion TEXT;
    `);
    console.log('[Migration] agent_sub_tasks.user_opinion 添加成功');

    await db.execute(sql`
      ALTER TABLE agent_sub_tasks 
      ADD COLUMN IF NOT EXISTS material_ids JSONB DEFAULT '[]';
    `);
    console.log('[Migration] agent_sub_tasks.material_ids 添加成功');

    // 3. daily_task 表添加字段
    await db.execute(sql`
      ALTER TABLE daily_task 
      ADD COLUMN IF NOT EXISTS user_opinion TEXT;
    `);
    console.log('[Migration] daily_task.user_opinion 添加成功');

    await db.execute(sql`
      ALTER TABLE daily_task 
      ADD COLUMN IF NOT EXISTS material_ids JSONB DEFAULT '[]';
    `);
    console.log('[Migration] daily_task.material_ids 添加成功');

    // 4. 创建索引（提高查询效率）
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_agent_tasks_material_ids 
      ON agent_tasks USING GIN(material_ids);
    `);
    console.log('[Migration] agent_tasks.material_ids 索引创建成功');

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_daily_task_material_ids 
      ON daily_task USING GIN(material_ids);
    `);
    console.log('[Migration] daily_task.material_ids 索引创建成功');

    return NextResponse.json({
      success: true,
      message: '用户观点和素材字段添加成功',
      changes: [
        'agent_tasks.user_opinion (TEXT)',
        'agent_tasks.material_ids (JSONB)',
        'agent_sub_tasks.user_opinion (TEXT)',
        'agent_sub_tasks.material_ids (JSONB)',
        'daily_task.user_opinion (TEXT)',
        'daily_task.material_ids (JSONB)',
        'idx_agent_tasks_material_ids (GIN索引)',
        'idx_daily_task_material_ids (GIN索引)'
      ]
    });
  } catch (error: any) {
    console.error('[Migration] 添加字段失败:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error.stack
    }, { status: 500 });
  }
}

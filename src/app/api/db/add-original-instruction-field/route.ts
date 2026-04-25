/**
 * 数据库迁移 API：新增 original_instruction 字段
 * 
 * 目的：将用户原始指令从 user_opinion 中分离，独立存储
 * - user_opinion: 仅存储创作引导结构化内容（核心观点+情感基调+文章结构）
 * - original_instruction: 存储用户原始输入的自由文本指令
 * 
 * 影响表：agent_tasks, daily_task, agent_sub_tasks
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  const results: string[] = [];

  try {
    // 1. agent_tasks 表新增 original_instruction 字段
    try {
      await db.execute(sql`
        ALTER TABLE agent_tasks 
        ADD COLUMN IF NOT EXISTS original_instruction TEXT
      `);
      results.push('✅ agent_tasks: 新增 original_instruction 字段');
    } catch (e: any) {
      if (e.message?.includes('already exists')) {
        results.push('⏭️ agent_tasks: original_instruction 字段已存在，跳过');
      } else {
        results.push(`❌ agent_tasks: ${e.message}`);
      }
    }

    // 2. daily_task 表新增 original_instruction 字段
    try {
      await db.execute(sql`
        ALTER TABLE daily_task 
        ADD COLUMN IF NOT EXISTS original_instruction TEXT
      `);
      results.push('✅ daily_task: 新增 original_instruction 字段');
    } catch (e: any) {
      if (e.message?.includes('already exists')) {
        results.push('⏭️ daily_task: original_instruction 字段已存在，跳过');
      } else {
        results.push(`❌ daily_task: ${e.message}`);
      }
    }

    // 3. agent_sub_tasks 表新增 original_instruction 字段
    try {
      await db.execute(sql`
        ALTER TABLE agent_sub_tasks 
        ADD COLUMN IF NOT EXISTS original_instruction TEXT
      `);
      results.push('✅ agent_sub_tasks: 新增 original_instruction 字段');
    } catch (e: any) {
      if (e.message?.includes('already exists')) {
        results.push('⏭️ agent_sub_tasks: original_instruction 字段已存在，跳过');
      } else {
        results.push(`❌ agent_sub_tasks: ${e.message}`);
      }
    }

    // 4. 迁移现有数据：从 user_opinion 中提取【原始指令】部分到 original_instruction
    //    并从 user_opinion 中删除该部分
    try {
      // agent_sub_tasks 表的数据迁移
      const subTasksMigration = await db.execute(sql`
        UPDATE agent_sub_tasks
        SET 
          original_instruction = REGEXP_REPLACE(
            SUBSTRING(user_opinion FROM '【原始指令】([\s\S]*)'),
            '^\s+|\s+$', '', 'g'
          ),
          user_opinion = REGEXP_REPLACE(
            REGEXP_REPLACE(user_opinion, '【原始指令】[\s\S]*', '', 'g'),
            '\s+$', '', 'g'
          )
        WHERE user_opinion LIKE '%【原始指令】%'
        AND original_instruction IS NULL
      `);
      results.push(`✅ agent_sub_tasks 数据迁移: ${subTasksMigration.count} 条记录已提取原始指令`);
    } catch (e: any) {
      results.push(`⚠️ agent_sub_tasks 数据迁移: ${e.message}`);
    }

    try {
      // daily_task 表的数据迁移
      const dailyTaskMigration = await db.execute(sql`
        UPDATE daily_task
        SET 
          original_instruction = REGEXP_REPLACE(
            SUBSTRING(user_opinion FROM '【原始指令】([\s\S]*)'),
            '^\s+|\s+$', '', 'g'
          ),
          user_opinion = REGEXP_REPLACE(
            REGEXP_REPLACE(user_opinion, '【原始指令】[\s\S]*', '', 'g'),
            '\s+$', '', 'g'
          )
        WHERE user_opinion LIKE '%【原始指令】%'
        AND original_instruction IS NULL
      `);
      results.push(`✅ daily_task 数据迁移: ${dailyTaskMigration.count} 条记录已提取原始指令`);
    } catch (e: any) {
      results.push(`⚠️ daily_task 数据迁移: ${e.message}`);
    }

    try {
      // agent_tasks 表的数据迁移
      const agentTaskMigration = await db.execute(sql`
        UPDATE agent_tasks
        SET 
          original_instruction = REGEXP_REPLACE(
            SUBSTRING(user_opinion FROM '【原始指令】([\s\S]*)'),
            '^\s+|\s+$', '', 'g'
          ),
          user_opinion = REGEXP_REPLACE(
            REGEXP_REPLACE(user_opinion, '【原始指令】[\s\S]*', '', 'g'),
            '\s+$', '', 'g'
          )
        WHERE user_opinion LIKE '%【原始指令】%'
        AND original_instruction IS NULL
      `);
      results.push(`✅ agent_tasks 数据迁移: ${agentTaskMigration.count} 条记录已提取原始指令`);
    } catch (e: any) {
      results.push(`⚠️ agent_tasks 数据迁移: ${e.message}`);
    }

    return NextResponse.json({
      success: true,
      message: 'original_instruction 字段迁移完成',
      results,
    });
  } catch (error: any) {
    console.error('迁移失败:', error);
    return NextResponse.json(
      { success: false, error: error.message, results },
      { status: 500 }
    );
  }
}

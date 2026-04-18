/**
 * 数据库测试 API
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    console.log('开始测试数据库连接...');

    // 测试 1: 简单查询
    console.log('测试 1: 简单查询');
    const result1 = await db.execute(sql`SELECT NOW()`);
    console.log('当前时间:', result1);

    // 测试 2: 查询表是否存在
    console.log('测试 2: 查询表是否存在');
    const result2 = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'agent_tasks'
    `);
    console.log('agent_tasks 表是否存在:', result2.rowCount);

    // 测试 3: 查询表结构
    console.log('测试 3: 查询表结构');
    const result3 = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'agent_tasks'
      ORDER BY ordinal_position
    `);
    console.log('表结构:', result3);

    // 测试 4: 使用原始 SQL 插入任务
    console.log('测试 4: 使用原始 SQL 插入任务');
    const taskId = `task-test-${Date.now()}`;
    const result4 = await db.execute(sql`
      INSERT INTO agent_tasks (
        task_id, task_name, core_command, executor,
        task_duration_start, task_duration_end, total_deliverables,
        task_priority, task_status, creator, updater, from_agent_id, command_type
      ) VALUES (
        ${taskId}, '测试任务', '测试指令', 'agent insurance-d',
        NOW() + INTERVAL '1 day', NOW() + INTERVAL '7 days', '测试交付物',
        'normal', 'unsplit', 'user', 'TS', 'user', 'instruction'
      )
      RETURNING task_id
    `);
    console.log('插入结果:', result4);

    // 测试 5: 查询刚插入的任务
    console.log('测试 5: 查询刚插入的任务');
    const result5 = await db.execute(sql`
      SELECT * FROM agent_tasks WHERE task_id = ${taskId}
    `);
    console.log('查询结果:', result5);

    return NextResponse.json({
      success: true,
      tests: {
        test1: { now: Array.isArray(result1) && result1[0]?.now ? result1[0].now : result1 },
        test2: { tableExists: Array.isArray(result2) ? result2.length > 0 : result2.rowCount > 0 },
        test3: { columns: Array.isArray(result3) ? result3 : result3.rows },
        test4: { inserted: Array.isArray(result4) ? result4.length : result4.rowCount, taskId: (Array.isArray(result4) && result4[0]?.task_id) ? result4[0].task_id : (result4.rows?.[0]?.task_id) },
        test5: { found: Array.isArray(result5) ? result5.length > 0 : result5.rowCount > 0, task: Array.isArray(result5) ? result5[0] : result5.rows?.[0] }
      }
    });

  } catch (error) {
    console.error('数据库测试失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '数据库测试失败',
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

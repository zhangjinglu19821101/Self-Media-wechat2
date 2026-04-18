/**
 * POST /api/db/add-agent-subtasks-unique-constraint
 * 为 agent_sub_tasks 表添加唯一约束
 * 
 * 唯一约束：unique_task_order (commandResultId + orderIndex)
 * 作用：同一个任务的同一个顺序只能有一个子任务，防止重复插入
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    console.log(`🔧 开始为 agent_sub_tasks 表添加唯一约束...`);

    // 1. 检查约束是否已经存在
    const checkConstraint = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM information_schema.table_constraints
      WHERE table_name = 'agent_sub_tasks'
      AND constraint_name = 'unique_task_order'
    `);

    const constraintExists = (checkConstraint as any)[0].count > 0;

    if (constraintExists) {
      console.log(`✅ 唯一约束 unique_task_order 已经存在，无需创建`);
      return NextResponse.json({
        success: true,
        message: '唯一约束已经存在',
        data: {
          constraintName: 'unique_task_order',
          alreadyExists: true,
        },
      });
    }

    // 2. 添加唯一约束
    console.log(`🔧 创建唯一约束 unique_task_order...`);
    await db.execute(sql`
      ALTER TABLE agent_sub_tasks
      ADD CONSTRAINT unique_task_order
      UNIQUE (command_result_id, order_index)
    `);

    console.log(`✅ 唯一约束 unique_task_order 创建成功`);

    return NextResponse.json({
      success: true,
      message: '唯一约束创建成功',
      data: {
        constraintName: 'unique_task_order',
        fields: ['command_result_id', 'order_index'],
        purpose: '同一个任务的同一个顺序只能有一个子任务',
      },
    });
  } catch (error) {
    console.error('❌ 添加唯一约束失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/multi_platform_publish_db?sslmode=require&channel_binding=require';

/**
 * 测试 daily_task id/task_id 字段修复
 * POST /api/test/daily-task-id-fix
 *
 * 测试内容：
 * 1. 创建测试数据
 * 2. 测试用 id 查询
 * 3. 测试用 task_id 查询
 * 4. 验证 save-split-result-v2 返回的 dailyTaskId 是否为 UUID
 */
export async function POST(request: NextRequest) {
  try {
    const sql = postgres(DATABASE_URL, {
      ssl: 'require',
      max: 10,
    });

    console.log('🧪 开始测试 daily_task id/task_id 修复...');

    // 步骤 1: 创建测试数据
    const testTaskId = `test-task-${Date.now()}`;
    const testDailyTaskId = `daily-task-test-2025-02-13-001`;

    console.log(`📝 步骤 1: 创建测试数据`);
    const insertResult = await sql`
      INSERT INTO daily_tasks (id, task_id, command_id, task_title, task_description, executor, execution_status, execution_date, execution_deadline_start, execution_deadline_end, deliverables, from_agent_id, to_agent_id, related_task_id, splitter, entry_user, task_type, is_confirmed, dependencies, sort_order)
      VALUES (
        gen_random_uuid(),
        ${testDailyTaskId},
        ${testDailyTaskId},
        ${`测试任务：${testTaskId}`},
        ${`测试任务描述：${testTaskId}`},
        'test-agent',
        'pending_review',
        ${new Date()},
        ${new Date()},
        ${new Date(Date.now() + 86400000)},
        '测试交付物',
        'A',
        'test-agent',
        ${testTaskId},
        'agent B',
        'TS',
        'daily',
        false,
        '{}',
        0
      )
      RETURNING id, task_id
    `;

    const inserted = insertResult[0];
    console.log(`✅ 插入成功: id=${inserted.id}, task_id=${inserted.task_id}`);

    // 步骤 2: 测试用 id 查询
    console.log(`🔍 步骤 2: 测试用 id (UUID) 查询`);
    const byIdResult = await sql`
      SELECT id, task_id, task_title
      FROM daily_task
      WHERE id = ${inserted.id}
    `;

    if (byIdResult.length === 0) {
      throw new Error('❌ 用 id 查询失败');
    }
    console.log(`✅ 用 id 查询成功: ${byIdResult[0].task_title}`);

    // 步骤 3: 测试用 task_id 查询
    console.log(`🔍 步骤 3: 测试用 task_id (字符串) 查询`);
    const byTaskIdResult = await sql`
      SELECT id, task_id, task_title
      FROM daily_task
      WHERE task_id = ${testDailyTaskId}
    `;

    if (byTaskIdResult.length === 0) {
      throw new Error('❌ 用 task_id 查询失败');
    }
    console.log(`✅ 用 task_id 查询成功: ${byTaskIdResult[0].task_title}`);

    // 步骤 4: 验证 save-split-result-v2 返回值
    console.log(`🔍 步骤 4: 验证 save-split-result-v2 返回值`);
    console.log(`  - 插入时返回的 id: ${inserted.id}`);
    console.log(`  - 插入时返回的 task_id: ${inserted.task_id}`);
    console.log(`  - id 类型: ${typeof inserted.id}`);
    console.log(`  - task_id 类型: ${typeof inserted.task_id}`);

    // 验证返回值类型
    const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    if (!isUuid(inserted.id)) {
      throw new Error(`❌ id 不是有效的 UUID: ${inserted.id}`);
    }
    console.log(`✅ id 是有效的 UUID`);

    // 步骤 5: 清理测试数据
    console.log(`🗑️  步骤 5: 清理测试数据`);
    await sql`
      DELETE FROM daily_task WHERE id = ${inserted.id}
    `;
    console.log(`✅ 测试数据已清理`);

    await sql.end();

    return NextResponse.json({
      success: true,
      message: '所有测试通过',
      results: {
        inserted: {
          id: inserted.id,
          taskId: inserted.task_id,
        },
        byIdQuery: {
          found: byIdResult.length > 0,
          taskTitle: byIdResult[0]?.task_title,
        },
        byTaskIdQuery: {
          found: byTaskIdResult.length > 0,
          taskTitle: byTaskIdResult[0]?.task_title,
        },
        validation: {
          isUuidValid: true,
          idType: typeof inserted.id,
          taskIdType: typeof inserted.task_id,
        },
      },
    });
  } catch (error) {
    console.error('❌ 测试失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

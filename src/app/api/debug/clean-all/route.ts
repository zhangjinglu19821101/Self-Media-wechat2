import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/multi_platform_publish_db?sslmode=require&channel_binding=require';

/**
 * 清空所有测试数据
 * POST /api/debug/clean-all
 * Body: { dryRun?: boolean, tables?: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const dryRun = body.dryRun === true;
    const tables = body.tables || ['agent_tasks', 'daily_task', 'agent_sub_tasks', 'agent_notifications'];

    const sql = postgres(DATABASE_URL, {
      ssl: 'require',
      max: 10,
    });

    console.log(`🧹 [clean-all] 开始${dryRun ? '模拟' : '执行'}清理`);
    console.log(`🧹 [clean-all] 要清理的表: ${tables.join(', ')}`);

    // 查询每个表的数据统计
    const stats: any = {};

    for (const table of tables) {
      const tableName = table === 'agent_sub_tasks' ? 'agent_sub_tasks' :
                       table === 'daily_task' ? 'daily_task' :
                       table === 'agent_tasks' ? 'agent_tasks' :
                       'agent_notifications';

      try {
        const countResult = await sql`SELECT COUNT(*) as total FROM ${sql.unsafe(tableName)}`;
        stats[table] = {
          table: tableName,
          total: countResult[0].total,
        };
        console.log(`📊 [clean-all] ${tableName}: ${countResult[0].total} 条记录`);
      } catch (error) {
        console.error(`❌ [clean-all] 查询 ${tableName} 失败:`, error);
        stats[table] = {
          table: tableName,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    if (dryRun) {
      await sql.end();
      return NextResponse.json({
        success: true,
        dryRun: true,
        message: '模拟清理完成（未实际删除）',
        data: stats,
      });
    }

    // 按照外键依赖顺序删除：notifications -> sub_tasks -> daily_task -> agent_tasks
    const deleteOrder = ['agent_notifications', 'agent_sub_tasks', 'daily_task', 'agent_tasks'];
    const deletedStats: any = {};

    for (const table of deleteOrder) {
      if (!tables.includes(table)) continue;

      const tableName = table === 'agent_sub_tasks' ? 'agent_sub_tasks' :
                       table === 'daily_task' ? 'daily_task' :
                       table === 'agent_tasks' ? 'agent_tasks' :
                       'agent_notifications';

      try {
        // 先删除数据
        await sql`DELETE FROM ${sql.unsafe(tableName)}`;
        // 再查询剩余数量
        const countResult = await sql`SELECT COUNT(*) as total FROM ${sql.unsafe(tableName)}`;
        deletedStats[table] = stats[table].total - countResult[0].total;
        console.log(`✅ [clean-all] 删除 ${tableName}: ${deletedStats[table]} 条记录`);
      } catch (error) {
        console.error(`❌ [clean-all] 删除 ${tableName} 失败:`, error);
        deletedStats[table] = {
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    await sql.end();

    return NextResponse.json({
      success: true,
      message: '清理完成',
      data: {
        stats,      // 清理前的数据统计
        deleted: deletedStats,  // 实际删除的数量
      },
    });
  } catch (error) {
    console.error('❌ 清理失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

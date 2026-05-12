/**
 * 测试数据清理 API
 * 用于系统测试前清理相关表数据，避免历史数据干扰
 *
 * POST /api/test/cleanup-data
 * Body: { "tables": ["agent_sub_tasks", "daily_task"] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks, dailyTask } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

// 允许清理的表白名单及其别名映射
const ALLOWED_TABLES: Record<string, string[]> = {
  'agent_sub_tasks': ['agent_sub_tasks'],
  'daily_task': ['daily_task', 'daily_tasks'], // 支持单数和复数
  'daily_tasks': ['daily_task', 'daily_tasks'],
  'agent_reports': ['agent_reports'],
  'agent_interactions': ['agent_interactions'],
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tables = ['agent_sub_tasks', 'daily_task'] } = body;

    console.log('🧹 [数据清理] 开始清理测试数据...');
    console.log('📋 待清理表:', tables);

    const results: Record<string, { success: boolean; count?: number; error?: string; triedNames?: string[] }> = {};

    for (const tableName of tables) {
      // 安全检查：只允许清理白名单中的表
      if (!ALLOWED_TABLES[tableName]) {
        results[tableName] = { success: false, error: '不在允许清理的表白名单中' };
        continue;
      }

      // 尝试多个可能的表名（别名映射）
      const possibleNames = ALLOWED_TABLES[tableName];
      let success = false;
      const triedNames: string[] = [];
      let lastError: string = '';

      for (const nameToTry of possibleNames) {
        try {
          triedNames.push(nameToTry);
          // 使用原生 SQL 删除数据
          await db.execute(sql`DELETE FROM ${sql.raw(nameToTry)}`);
          
          console.log(`✅ 已清理表: ${nameToTry}`);
          results[tableName] = { success: true, triedNames };
          success = true;
          break; // 成功则跳出循环
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.log(`⚠️ 清理表失败: ${nameToTry} - ${errorMsg}`);
          lastError = errorMsg;
          // 继续尝试下一个表名
        }
      }

      if (!success) {
        results[tableName] = { 
          success: false, 
          error: lastError,
          triedNames 
        };
      }
    }

    const allSuccess = Object.values(results).every(r => r.success);

    return NextResponse.json({
      success: allSuccess,
      message: allSuccess ? '✅ 数据清理完成' : '⚠️ 部分表清理失败',
      cleanedTables: tables.filter(t => results[t]?.success),
      failedTables: tables.filter(t => !results[t]?.success),
      details: results,
      note: '建议在运行系统测试前执行此操作，避免历史数据干扰',
    });

  } catch (error) {
    console.error('❌ 数据清理失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

/**
 * GET - 获取清理API信息
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    description: '测试数据清理 API',
    usage: {
      method: 'POST',
      endpoint: '/api/test/cleanup-data',
      body: {
        tables: ['agent_sub_tasks', 'daily_task'], // 支持清理的表
      },
    },
    allowedTables: ALLOWED_TABLES,
    example: {
      curl: `curl -s -X POST 'http://localhost:5000/api/test/cleanup-data' \\
  -H "Content-Type: application/json" \\
  -d '{"tables":["agent_sub_tasks","daily_task"]}'`,
    },
    warning: '⚠️ 此操作会删除表中的所有数据，请谨慎使用！',
  });
}

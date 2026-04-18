import { NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

export async function GET() {
  try {
    console.log('🚀 开始执行 migration: 添加 result_text 字段');
    console.log('');

    const db = await getDb();

    // 读取 migration 文件
    const migrationPath = path.join(
      process.cwd(),
      'src/lib/db/migrations/0015_add_result_text_to_mcp_executions.sql'
    );
    
    const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
    
    console.log('📄 Migration SQL:');
    console.log(migrationSql);
    console.log('');

    // 执行 migration
    console.log('⚙️  正在执行 migration...');
    
    const statements = migrationSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      console.log(`   执行: ${statement.substring(0, 80)}...`);
      await db.execute(sql.raw(statement));
    }

    console.log('');
    console.log('✅ Migration 执行成功！');
    console.log('');

    // 验证字段是否添加成功
    console.log('🔍 验证结果:');
    const verifyResult = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'agent_sub_tasks_mcp_executions' 
      AND column_name = 'result_text'
    `);

    const hasResultText = verifyResult.rows.length > 0;
    
    if (hasResultText) {
      console.log('   ✅ result_text 字段已成功添加！');
      
      // 获取字段详情
      const columnDetails = await db.execute(sql`
        SELECT 
          column_name,
          data_type,
          is_nullable
        FROM information_schema.columns
        WHERE table_name = 'agent_sub_tasks_mcp_executions'
        AND column_name = 'result_text'
      `);
      
      const col = columnDetails.rows[0] as any;
      console.log(`   字段名: ${col.column_name}`);
      console.log(`   数据类型: ${col.data_type}`);
      console.log(`   可空: ${col.is_nullable}`);
      
    } else {
      console.log('   ❌ 字段添加失败！');
    }

    console.log('');
    console.log('============================================================================');
    console.log('');

    return NextResponse.json({
      success: true,
      message: 'Migration 执行完成',
      migrationApplied: true,
      hasResultText
    });

  } catch (error) {
    console.error('❌ Migration 执行失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

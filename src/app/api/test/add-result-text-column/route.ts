import { NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    console.log('🚀 直接添加 result_text 字段');
    console.log('');

    const db = await getDb();

    // 1. 先检查字段是否已存在
    const checkResult = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'agent_sub_tasks_mcp_executions' 
      AND column_name = 'result_text'
    `);

    if (checkResult.rows.length > 0) {
      console.log('ℹ️  字段已存在，无需重复添加');
      return NextResponse.json({
        success: true,
        message: '字段已存在',
        alreadyExists: true
      });
    }

    // 2. 添加字段
    console.log('⚙️  正在添加 result_text 字段...');
    
    await db.execute(sql`
      ALTER TABLE agent_sub_tasks_mcp_executions 
      ADD COLUMN result_text TEXT
    `);

    console.log('✅ 字段添加成功！');
    console.log('');

    // 3. 验证
    console.log('🔍 验证结果:');
    const verifyResult = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'agent_sub_tasks_mcp_executions'
      AND column_name = 'result_text'
    `);

    if (verifyResult.rows.length > 0) {
      const col = verifyResult.rows[0] as any;
      console.log('   ✅ 验证成功！');
      console.log(`   字段名: ${col.column_name}`);
      console.log(`   数据类型: ${col.data_type}`);
      console.log(`   可空: ${col.is_nullable}`);
    } else {
      console.log('   ❌ 验证失败！');
    }

    console.log('');
    console.log('============================================================================');
    console.log('');

    return NextResponse.json({
      success: true,
      message: '字段添加完成',
      columnAdded: true,
      verification: verifyResult.rows[0]
    });

  } catch (error) {
    console.error('❌ 添加字段失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getDb } from 'coze-coding-dev-sdk';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    console.log('🔍 开始检查 agent_sub_tasks_mcp_executions 表结构...');
    console.log('');

    const db = await getDb();

    // 1. 查询表是否存在
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'agent_sub_tasks_mcp_executions'
      )
    `);

    const existsResult = tableExists.rows[0] as any;
    console.log('📋 表存在性检查:', existsResult.exists);

    if (!existsResult.exists) {
      return NextResponse.json({
        success: true,
        message: '表不存在',
        tableExists: false
      });
    }

    // 2. 查询所有字段
    const columns = await db.execute(sql`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'agent_sub_tasks_mcp_executions'
      ORDER BY ordinal_position
    `);

    const columnsData = columns.rows as any[];

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 agent_sub_tasks_mcp_executions 表字段列表:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');

    columnsData.forEach((col: any, index: number) => {
      const status = col.column_name === 'result_text' ? '✅ 🔴' : '   ';
      console.log(`${status} ${String(index + 1).padStart(2, ' ')}. ${col.column_name.padEnd(25)} ${col.data_type.padEnd(15)} NULL: ${col.is_nullable}`);
    });

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');

    // 3. 检查 result_text 字段
    const hasResultText = columnsData.some((col: any) => col.column_name === 'result_text');

    console.log('');
    console.log('🔍 result_text 字段检查:');
    console.log(`   存在: ${hasResultText ? '✅ 是' : '❌ 否'}`);

    if (hasResultText) {
      const resultTextCol = columnsData.find((col: any) => col.column_name === 'result_text');
      console.log(`   数据类型: ${resultTextCol.data_type}`);
      console.log(`   可空: ${resultTextCol.is_nullable}`);
    } else {
      console.log('   ❌ 该字段缺失！');
    }

    // 4. 查询表注释
    const tableComment = await db.execute(sql`
      SELECT obj_description('agent_sub_tasks_mcp_executions'::regclass) as comment
    `);

    const tableCommentResult = tableComment.rows[0] as any;
    console.log('');
    console.log('📝 表注释:', tableCommentResult.comment || '无');

    // 5. 查询 result_text 字段注释（如果存在）
    let columnCommentResult: any = null;
    if (hasResultText) {
      const columnComment = await db.execute(sql`
        SELECT col_description('agent_sub_tasks_mcp_executions'::regclass, 
          (SELECT ordinal_position FROM information_schema.columns 
           WHERE table_name = 'agent_sub_tasks_mcp_executions' 
           AND column_name = 'result_text')) as comment
      `);
      columnCommentResult = columnComment.rows[0] as any;
      console.log('📝 result_text 字段注释:', columnCommentResult.comment || '无');
    }

    console.log('');
    console.log('============================================================================');
    console.log('');

    return NextResponse.json({
      success: true,
      message: '表结构检查完成',
      tableExists: existsResult.exists,
      hasResultText,
      columns: columnsData.map((c: any) => ({
        name: c.column_name,
        type: c.data_type,
        nullable: c.is_nullable
      })),
      tableComment: tableCommentResult.comment,
      columnComment: columnCommentResult?.comment
    });

  } catch (error) {
    console.error('❌ 查询失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

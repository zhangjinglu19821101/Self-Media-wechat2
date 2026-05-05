import { NextResponse } from 'next/server';
import { getRawDatabaseUrl, db } from '@/lib/db';
import postgres from 'postgres';

export async function GET() {
  try {
    const rawUrl = getRawDatabaseUrl();
    
    // 解析数据库名
    let dbName = 'unknown';
    try {
      const url = new URL(rawUrl.replace('postgresql://', 'http://'));
      dbName = url.pathname.replace('/', '') || 'postgres';
    } catch {}
    
    // 直接测试连接
    const sql = postgres(rawUrl, { ssl: 'require', max: 1 });
    const result = await sql`SELECT current_database() as db_name`;
    const actualDbName = result[0].db_name;
    await sql.end();
    
    // 查一下有多少数据
    const agentSubTasksCount = await db.query.agentSubTasks.findMany();
    const accountsCount = await db.query.accounts.findMany();
    
    return NextResponse.json({
      success: true,
      rawUrlLength: rawUrl.length,
      rawUrlPreview: rawUrl.substring(0, 50) + '...',
      parsedDbName: dbName,
      actualDbName: actualDbName,
      agentSubTasksCount: agentSubTasksCount.length,
      accountsCount: accountsCount.length,
      accounts: accountsCount.map(a => ({ email: a.email, name: a.name }))
    });
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      error: e.message
    }, { status: 500 });
  }
}
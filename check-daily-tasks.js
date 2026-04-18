#!/usr/bin/env node
/**
 * 简单的数据库查询脚本，用于查看 daily_task 表数据
 */

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

async function main() {
  const sql = postgres(DATABASE_URL, {
    ssl: 'require',
    max: 1,
  });

  try {
    console.log('🔍 查询数据库表列表...');
    const tables = await sql`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `;
    
    console.log('📋 数据库表列表:');
    tables.forEach(table => {
      console.log(`  - ${table.tablename}`);
    });

    // 查找可能的 daily task 表名
    const possibleTableNames = tables.filter(table => 
      table.tablename.toLowerCase().includes('task') ||
      table.tablename.toLowerCase().includes('daily')
    );
    
    console.log('\n🎯 可能的任务相关表:');
    possibleTableNames.forEach(table => {
      console.log(`  - ${table.tablename}`);
    });

    // 尝试查询每个可能的表
    for (const table of possibleTableNames) {
      try {
        console.log(`\n🔍 查询表 ${table.tablename} 的前 10 条记录...`);
        
        const records = await sql`
          SELECT * FROM ${sql(table.tablename)} 
          ORDER BY created_at DESC 
          LIMIT 10;
        `;
        
        console.log(`✅ 表 ${table.tablename} 有 ${records.length} 条记录`);
        
        if (records.length > 0) {
          console.log('\n📊 示例数据:');
          records.slice(0, 3).forEach((record, index) => {
            console.log(`\n--- 记录 ${index + 1} ---`);
            console.log(JSON.stringify(record, null, 2).substring(0, 500));
          });
        }
      } catch (err) {
        console.log(`❌ 查询表 ${table.tablename} 失败:`, err.message);
      }
    }

  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    await sql.end();
  }
}

main();

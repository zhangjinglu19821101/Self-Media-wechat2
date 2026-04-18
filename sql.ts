#!/usr/bin/env tsx

/**
 * 最简单的 SQL 执行工具
 * 使用方法：pnpm tsx sql.ts "SELECT * FROM agent_sub_tasks LIMIT 10"
 */

import { db } from './src/lib/db/index';
import { sql } from 'drizzle-orm';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('使用方法: pnpm tsx sql.ts "你的 SQL 语句"');
    console.log('');
    console.log('示例:');
    console.log('  pnpm tsx sql.ts "SELECT * FROM agent_sub_tasks LIMIT 10"');
    console.log('  pnpm tsx sql.ts "SELECT status, COUNT(*) FROM agent_sub_tasks GROUP BY status"');
    console.log('  pnpm tsx sql.ts "SELECT * FROM daily_task ORDER BY created_at DESC LIMIT 5"');
    process.exit(0);
  }

  const sqlQuery = args.join(' ');
  
  try {
    console.log(`执行 SQL: ${sqlQuery}\n`);
    const result = await db.execute(sql.raw(sqlQuery));
    // Drizzle ORM 返回 RowList，需要转换为数组
    console.log(JSON.stringify([...result], null, 2));
  } catch (error) {
    console.error('❌ 执行失败:', error);
    process.exit(1);
  }
}

main();

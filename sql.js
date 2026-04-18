#!/usr/bin/env node

/**
 * 最简单的 SQL 执行工具（纯 JavaScript 版本）
 * 使用方法：node sql.js "SELECT * FROM agent_sub_tasks LIMIT 10"
 */

const { db } = require('./src/lib/db/index.js');
const { sql } = require('drizzle-orm');

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('使用方法: node sql.js "你的 SQL 语句"');
    console.log('');
    console.log('示例:');
    console.log('  node sql.js "SELECT * FROM agent_sub_tasks LIMIT 10"');
    console.log('  node sql.js "SELECT status, COUNT(*) FROM agent_sub_tasks GROUP BY status"');
    console.log('  node sql.js "SELECT * FROM daily_task ORDER BY created_at DESC LIMIT 5"');
    process.exit(0);
  }

  const sqlQuery = args.join(' ');
  
  try {
    console.log(`执行 SQL: ${sqlQuery}\n`);
    const result = await db.execute(sql.raw(sqlQuery));
    console.log(JSON.stringify(result.rows, null, 2));
  } catch (error) {
    console.error('❌ 执行失败:', error);
    process.exit(1);
  }
}

main();

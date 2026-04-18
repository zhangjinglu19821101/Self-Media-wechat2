#!/usr/bin/env node

/**
 * 终端 SQL 查询工具
 * 使用方法: node query-sql.js "SELECT * FROM agent_sub_tasks LIMIT 10"
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

// 从环境变量获取数据库连接信息
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 获取 SQL 参数
const sql = process.argv[2];

if (!sql) {
  console.log('使用方法: node query-sql.js "<SQL语句>"');
  console.log('');
  console.log('示例:');
  console.log('  node query-sql.js "SELECT * FROM agent_sub_tasks LIMIT 10"');
  console.log('  node query-sql.js "SELECT * FROM daily_task LIMIT 10"');
  console.log('  node query-sql.js "SELECT * FROM agent_notifications LIMIT 10"');
  process.exit(1);
}

async function executeQuery() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 执行 SQL:', sql);
    console.log('');
    
    const result = await client.query(sql);
    
    if (result.rows.length === 0) {
      console.log('(空结果)');
    } else {
      // 打印表头
      const columns = Object.keys(result.rows[0]);
      console.log(columns.join('\t'));
      console.log('-'.repeat(columns.join('\t').length));
      
      // 打印数据
      result.rows.forEach(row => {
        const values = columns.map(col => {
          let value = row[col];
          if (value === null) return 'NULL';
          if (typeof value === 'object') return JSON.stringify(value).substring(0, 50);
          if (typeof value === 'string' && value.length > 50) return value.substring(0, 50) + '...';
          return String(value);
        });
        console.log(values.join('\t'));
      });
      
      console.log('');
      console.log(`✅ 查询成功，共 ${result.rows.length} 条记录`);
    }
  } catch (error) {
    console.error('❌ 执行失败:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

executeQuery();

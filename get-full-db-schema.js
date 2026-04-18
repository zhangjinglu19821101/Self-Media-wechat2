#!/usr/bin/env node
import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

const OUTPUT_FILE = path.join('/workspace/projects', 'DATABASE_SCHEMA_REFERENCE.md');

async function main() {
  const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1 });
  try {
    console.log('🔍 获取完整的数据库结构...\n');
    
    // 获取所有表
    const tables = await sql`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `;

    let mdContent = '# 数据库结构参考文档\n\n';
    mdContent += '> 本文档由脚本自动生成，反映数据库的实际结构\n';
    mdContent += `> 生成时间: ${new Date().toISOString()}\n\n`;
    mdContent += '---\n\n';

    for (const table of tables) {
      const tableName = table.tablename;
      console.log(`📋 处理表: ${tableName}`);
      
      mdContent += `## 表: \`${tableName}\`\n\n`;
      
      // 获取列信息
      const columns = await sql`
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default,
          ordinal_position
        FROM information_schema.columns
        WHERE table_name = ${tableName}
        ORDER BY ordinal_position;
      `;
      
      mdContent += '| 字段名 | 数据类型 | 可空 | 默认值 |\n';
      mdContent += '|--------|----------|------|--------|\n';
      
      columns.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? '✓' : '✗';
        const defaultVal = col.column_default || '-';
        mdContent += `| \`${col.column_name}\` | ${col.data_type} | ${nullable} | \`${defaultVal}\` |\n`;
      });
      
      mdContent += '\n';
      
      // 获取主键信息
      const primaryKeys = await sql`
        SELECT a.attname as column_name
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = ${tableName}::regclass
        AND i.indisprimary;
      `;
      
      if (primaryKeys.length > 0) {
        mdContent += `**主键**: ${primaryKeys.map(k => `\`${k.column_name}\``).join(', ')}\n\n`;
      }
      
      // 尝试获取示例数据
      try {
        const sampleData = await sql`
          SELECT * FROM ${sql(tableName)} LIMIT 1;
        `;
        
        if (sampleData.length > 0) {
          mdContent += '**示例数据字段**:\n';
          mdContent += '```json\n';
          mdContent += JSON.stringify(Object.keys(sampleData[0]), null, 2);
          mdContent += '\n```\n\n';
        }
      } catch (e) {
        // 忽略查询错误
      }
      
      mdContent += '---\n\n';
    }

    // 写入文件
    fs.writeFileSync(OUTPUT_FILE, mdContent, 'utf-8');
    console.log(`\n✅ 数据库结构文档已生成: ${OUTPUT_FILE}`);
    
    // 同时输出关键表的 TypeScript 接口定义
    console.log('\n📝 生成关键表的 TypeScript 接口定义...\n');
    
    const keyTables = ['daily_task', 'agent_notifications', 'agent_sub_tasks'];
    
    for (const tableName of keyTables) {
      console.log(`\n// ===== ${tableName} =====`);
      
      const columns = await sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = ${tableName}
        ORDER BY ordinal_position;
      `;
      
      console.log(`interface ${toPascalCase(tableName)} {`);
      columns.forEach(col => {
        const tsType = getTsType(col.data_type);
        const nullable = col.is_nullable === 'YES' ? ' | null' : '';
        const optional = col.is_nullable === 'YES' ? '?' : '';
        console.log(`  ${col.column_name}${optional}: ${tsType}${nullable};`);
      });
      console.log(`}`);
    }

  } catch (e) { 
    console.error('❌ 错误:', e); 
  } finally { 
    await sql.end(); 
  }
}

function toPascalCase(str) {
  return str.split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

function getTsType(pgType) {
  const typeMap: Record<string, string> = {
    'uuid': 'string',
    'text': 'string',
    'character varying': 'string',
    'timestamp without time zone': 'Date',
    'timestamp with time zone': 'Date',
    'jsonb': 'any',
    'json': 'any',
    'integer': 'number',
    'bigint': 'number',
    'boolean': 'boolean',
    'date': 'Date'
  };
  return typeMap[pgType] || 'any';
}

main();

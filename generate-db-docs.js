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
    mdContent += '> ⚠️  重要：本文档反映数据库的**实际**结构，代码中必须使用这些字段名！\n';
    mdContent += `> 生成时间: ${new Date().toISOString()}\n\n`;
    mdContent += '---\n\n';

    // 先列出关键表快速参考
    mdContent += '## 🔑 关键表快速参考\n\n';
    mdContent += '| 表名 | 说明 |\n';
    mdContent += '|------|------|\n';
    mdContent += '| `daily_task` | 每日任务表（不是 daily_task）|\n';
    mdContent += '| `agent_notifications` | Agent 通知表 |\n';
    mdContent += '| `agent_sub_tasks` | Agent 子任务表 |\n';
    mdContent += '\n---\n\n';

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
        const defaultVal = col.column_default ? `\`${col.column_default}\`` : '-';
        mdContent += `| \`${col.column_name}\` | ${col.data_type} | ${nullable} | ${defaultVal} |\n`;
      });
      
      mdContent += '\n';
      
      // 尝试获取示例数据
      try {
        const sampleData = await sql`
          SELECT * FROM ${sql(tableName)} LIMIT 1;
        `;
        
        if (sampleData.length > 0) {
          mdContent += '**实际字段列表**:\n';
          mdContent += '```typescript\n';
          mdContent += '// 从数据库实际读取的字段\n';
          mdContent += JSON.stringify(Object.keys(sampleData[0]), null, 2);
          mdContent += '\n```\n\n';
        }
      } catch (e) {
        // 忽略查询错误
      }
      
      mdContent += '---\n\n';
    }

    // 添加重要提醒
    mdContent += '## ⚠️  重要提醒\n\n';
    mdContent += '### 常见错误字段对照\n\n';
    mdContent += '| ❌ 错误的字段名 | ✅ 正确的字段名 | 所在表 |\n';
    mdContent += '|------------------|-----------------|--------|\n';
    mdContent += '| `daily_task` | `daily_task` | 表名 |\n';
    mdContent += '| `notificationId` | `id` 或 `notification_id` | `agent_notifications` |\n';
    mdContent += '| `task_id` (在 agent_sub_tasks 中) | 不存在，使用 `command_result_id` | `agent_sub_tasks` |\n';
    mdContent += '| `task_name` (在 agent_sub_tasks 中) | `task_title` | `agent_sub_tasks` |\n';
    mdContent += '| `execution_status` (在 agent_sub_tasks 中) | `status` | `agent_sub_tasks` |\n';
    mdContent += '| `sort_order` (在 agent_sub_tasks 中) | `order_index` | `agent_sub_tasks` |\n';
    mdContent += '| `read` (在 agent_notifications 中) | `is_read` | `agent_notifications` |\n';
    mdContent += '\n';

    // 写入文件
    fs.writeFileSync(OUTPUT_FILE, mdContent, 'utf-8');
    console.log(`\n✅ 数据库结构文档已生成: ${OUTPUT_FILE}`);
    
    // 现在也生成一个简单的 JSON 版本
    const keySchemaData = {};
    const keyTables = ['daily_task', 'agent_notifications', 'agent_sub_tasks'];
    
    for (const tableName of keyTables) {
      const columns = await sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = ${tableName}
        ORDER BY ordinal_position;
      `;
      keySchemaData[tableName] = columns.map(c => ({
        name: c.column_name,
        type: c.data_type,
        nullable: c.is_nullable === 'YES'
      }));
    }
    
    const schemaJsonFile = path.join('/workspace/projects', 'database-schema.json');
    fs.writeFileSync(schemaJsonFile, JSON.stringify(keySchemaData, null, 2), 'utf-8');
    console.log(`✅ JSON 格式 schema 已生成: ${schemaJsonFile}`);

  } catch (e) { 
    console.error('❌ 错误:', e); 
  } finally { 
    await sql.end(); 
  }
}

main();

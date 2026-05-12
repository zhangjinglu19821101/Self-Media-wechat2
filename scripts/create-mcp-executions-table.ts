import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

// 从环境变量获取数据库连接字符串
const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/multi_platform_publish_db?sslmode=require&channel_binding=require';

async function createMcpExecutionsTable() {
  const sql = postgres(DATABASE_URL, {
    ssl: 'require',
    max: 10,
  });

  try {
    console.log('🔄 开始创建 agent_sub_tasks_mcp_executions 表...');

    // 读取迁移文件
    const migrationPath = path.join(process.cwd(), 'src/lib/db/migrations/0013_create_mcp_executions_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // 直接执行整个 SQL 文件
    console.log('执行迁移 SQL...');
    await sql.unsafe(migrationSQL);

    console.log('✅ agent_sub_tasks_mcp_executions 表创建完成！');

    // 验证表是否创建成功
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'agent_sub_tasks_mcp_executions'
    `;

    if (tables.length > 0) {
      console.log('✅ agent_sub_tasks_mcp_executions 表创建成功！');
      
      // 查看表结构
      const columns = await sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'agent_sub_tasks_mcp_executions'
        ORDER BY ordinal_position
      `;
      
      console.log('📊 表结构:');
      columns.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? '可空' : '必填'})`);
      });
    } else {
      console.log('❌ agent_sub_tasks_mcp_executions 表未找到，请检查迁移是否成功');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ 创建表失败:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await sql.end();
  }
}

createMcpExecutionsTable();

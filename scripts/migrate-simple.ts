import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

// 从环境变量获取数据库连接字符串
const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

async function runMigration() {
  const sql = postgres(DATABASE_URL, {
    ssl: 'require',
    max: 10,
  });

  try {
    console.log('🔄 开始执行数据库迁移...');

    // 读取迁移文件
    const migrationPath = path.join(process.cwd(), 'src/lib/db/migrations/manual_add_report_fields.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // 直接执行整个 SQL 文件
    console.log('执行迁移...');
    await sql.unsafe(migrationSQL);

    console.log('✅ 数据库迁移完成！');

    // 验证表是否创建成功
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'agent_reports'
    `;

    if (tables.length > 0) {
      console.log('✅ agent_reports 表创建成功！');
    } else {
      console.log('⚠️  agent_reports 表未找到，请检查迁移是否成功');
    }

  } catch (error) {
    console.error('❌ 迁移失败:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();

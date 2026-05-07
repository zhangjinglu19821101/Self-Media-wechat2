import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

// 从环境变量获取数据库连接字符串
const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('[migrate.ts] DATABASE_URL 环境变量未设置');
}

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

    // 分割 SQL 语句（按分号分割）
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    // 执行每个 SQL 语句
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`执行: ${statement.substring(0, 50)}...`);
        try {
          await sql.unsafe(statement);
          console.log('✅ 执行成功');
        } catch (error) {
          console.error('❌ 执行失败:', error instanceof Error ? error.message : String(error));
          // 继续执行下一条语句
        }
      }
    }

    console.log('✅ 数据库迁移完成！');
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();

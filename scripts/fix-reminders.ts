import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require';

async function fixReminders() {
  const sql = postgres(DATABASE_URL, {
    ssl: 'require',
    max: 10,
  });

  try {
    console.log('🔧 开始修复 reminders 表...');

    console.log('1️⃣  添加 direction 字段...');
    await sql`
      ALTER TABLE reminders ADD COLUMN IF NOT EXISTS direction VARCHAR(20) NOT NULL DEFAULT 'outbound'
    `;
    console.log('✅ direction 字段已添加');

    console.log('2️⃣  添加索引...');
    await sql`CREATE INDEX IF NOT EXISTS idx_reminders_direction ON reminders(direction)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_reminders_requester ON reminders(requester_name)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_reminders_assignee ON reminders(assignee_name)`;
    console.log('✅ 索引已添加');

    console.log('3️⃣  检查数据...');
    const count = await sql`SELECT COUNT(*) FROM reminders`;
    console.log('📊 reminders 表现有数据:', count[0].count, '条');

    console.log('\n✅ 修复完成！');
  } catch (error) {
    console.error('❌ 修复失败:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await sql.end();
  }
}

fixReminders();
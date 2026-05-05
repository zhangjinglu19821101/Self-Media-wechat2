import postgres from 'postgres';

// 硬编码我们正确的数据库连接
const CORRECT_DATABASE_URL = 'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require';

async function checkCorrectDb() {
  console.log('🔍 连接到正确的数据库...');
  console.log('URL:', CORRECT_DATABASE_URL);
  
  const sql = postgres(CORRECT_DATABASE_URL, {
    ssl: 'require',
    max: 10,
  });

  try {
    const result = await sql`SELECT current_database() as db_name`;
    console.log('✓ 数据库名:', result[0].db_name);
    
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    
    console.log('\n✅ 找到', tables.length, '个表:');
    tables.forEach(t => console.log('  -', t.table_name));
    
    if (tables.some(t => t.table_name === 'reminders')) {
      console.log('\n📋 检查 reminders 表结构:');
      const columns = await sql`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'reminders'
        ORDER BY ordinal_position
      `;
      columns.forEach(c => {
        console.log(`  ${c.column_name}: ${c.data_type} ${c.is_nullable === 'YES' ? '(nullable)' : '(not null)'} ${c.column_default ? 'DEFAULT ' + c.column_default : ''}`);
      });
      
      const hasDirection = columns.some(c => c.column_name === 'direction');
      if (!hasDirection) {
        console.log('\n⚠️  缺少 direction 字段！正在添加...');
        await sql`
          ALTER TABLE reminders ADD COLUMN IF NOT EXISTS direction VARCHAR(20) NOT NULL DEFAULT 'outbound'
        `;
        await sql`CREATE INDEX IF NOT EXISTS idx_reminders_direction ON reminders(direction)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_reminders_requester ON reminders(requester_name)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_reminders_assignee ON reminders(assignee_name)`;
        console.log('✅ direction 字段和索引已添加！');
      } else {
        console.log('\n✅ direction 字段已存在');
      }
      
      const count = await sql`SELECT COUNT(*) FROM reminders`;
      console.log('\n📊 reminders 表数据量:', count[0].count);
    }

  } catch (error) {
    console.error('❌ 错误:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await sql.end();
  }
}

checkCorrectDb();
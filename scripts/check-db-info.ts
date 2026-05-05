import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require';

async function checkDb() {
  const sql = postgres(DATABASE_URL, {
    ssl: 'require',
    max: 10,
  });

  try {
    console.log('🔍 检查数据库信息:');
    
    const result = await sql`
      SELECT 
        current_database() as db_name,
        current_user as db_user
    `;
    console.log('数据库名:', result[0].db_name);
    console.log('用户:', result[0].db_user);
    
    console.log('\n📋 所有表:');
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    
    tables.forEach(t => console.log('  -', t.table_name));
    
    if (tables.length === 1 && tables[0].table_name === 'health_check') {
      console.log('\n⚠️  WARNING: 数据库几乎是空的！只有 health_check 表！');
    }

  } catch (error) {
    console.error('❌ 错误:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await sql.end();
  }
}

checkDb();
import postgres from 'postgres';
import { parse } from 'url';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require';

console.log('原始 URL:', DATABASE_URL);
const parsed = parse(DATABASE_URL);
console.log('解析后路径:', parsed.pathname);
const dbName = parsed.pathname?.replace('/', '') || 'postgres';
console.log('数据库名:', dbName);

// 直接构建带数据库名的连接字符串
const parts = DATABASE_URL.split('?');
const baseUrl = parts[0];
const params = parts[1] ? '?' + parts[1] : '';
const newUrl = baseUrl.replace(/\/[^\/]*$/, '/' + dbName) + params;
console.log('修正后 URL:', newUrl);

async function testConnection() {
  console.log('\n测试连接...');
  const sql = postgres(newUrl, { ssl: 'require', max: 1 });
  
  try {
    const result = await sql`SELECT current_database() as db_name`;
    console.log('✓ 成功连接到数据库:', result[0].db_name);
    
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    console.log('\n数据库表数量:', tables.length);
    console.log('表列表:');
    tables.forEach(t => console.log('  -', t.table_name));
  } finally {
    await sql.end();
  }
}

testConnection();
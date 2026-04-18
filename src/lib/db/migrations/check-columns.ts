import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

async function checkColumns() {
  const client = postgres(DATABASE_URL, {
    ssl: 'require',
    max: 1,
  });
  
  try {
    console.log("Checking daily_task columns...");
    const columns = await client`
      SELECT column_name, is_nullable, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'daily_task'
      ORDER BY ordinal_position
    `;
    
    console.log("\nDaily task columns:");
    for (const col of columns) {
      console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULLABLE'} ${col.column_default ? 'DEFAULT ' + col.column_default : ''}`);
    }
  } catch (error: any) {
    console.error("Error:", error.message);
  }
  
  await client.end();
  process.exit(0);
}

checkColumns();

import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

async function alterColumn() {
  const client = postgres(DATABASE_URL, {
    ssl: 'require',
    max: 1,
  });
  
  try {
    console.log("Altering command_id column to allow NULL...");
    
    await client`ALTER TABLE daily_task ALTER COLUMN command_id DROP NOT NULL`;
    
    console.log("✓ command_id column now allows NULL");
    
    // 验证
    const columns = await client`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'daily_task' AND column_name = 'command_id'
    `;
    console.log("\nVerification:", columns[0]);
    
  } catch (error: any) {
    console.error("Error:", error.message);
  }
  
  await client.end();
  process.exit(0);
}

alterColumn();

import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/multi_platform_publish_db?sslmode=require&channel_binding=require';

async function alterColumn() {
  const client = postgres(DATABASE_URL, {
    ssl: 'require',
    max: 1,
  });
  
  try {
    console.log("Altering original_command column to allow NULL...");
    
    await client`ALTER TABLE daily_task ALTER COLUMN original_command DROP NOT NULL`;
    
    console.log("✓ original_command column now allows NULL");
    
  } catch (error: any) {
    console.error("Error:", error.message);
  }
  
  await client.end();
  process.exit(0);
}

alterColumn();

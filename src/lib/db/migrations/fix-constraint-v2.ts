import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

async function fix() {
  const client = postgres(DATABASE_URL, {
    ssl: 'require',
    max: 1,
  });
  
  try {
    console.log("Dropping existing unique index...");
    await client`DROP INDEX IF EXISTS idx_command_result_step_type`;
    console.log("✓ Dropped");
    
    console.log("Creating new unique index with interact_num...");
    await client`CREATE UNIQUE INDEX idx_command_result_step_type_num ON agent_sub_tasks_step_history(command_result_id, step_no, interact_type, interact_num)`;
    console.log("✓ Created new unique index (command_result_id, step_no, interact_type, interact_num)");
    
  } catch (e: any) {
    console.error("Error:", e.message);
  }
  
  await client.end();
  process.exit(0);
}

fix();

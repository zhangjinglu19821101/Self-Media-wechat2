import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

async function check() {
  const client = postgres(DATABASE_URL, {
    ssl: 'require',
    max: 1,
  });
  
  try {
    console.log("Checking indexes...");
    const indexes = await client`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'agent_sub_tasks_step_history'
    `;
    for (const idx of indexes) {
      console.log(`  ${idx.indexname}: ${idx.indexdef}`);
    }
    
    console.log("\nTrying to add unique constraint with interact_type...");
    try {
      await client`DROP INDEX IF EXISTS idx_command_result_step_no`;
      await client`CREATE UNIQUE INDEX idx_command_result_step_type ON agent_sub_tasks_step_history(command_result_id, step_no, interact_type)`;
      console.log("✓ Created new unique index with interact_type");
    } catch (e: any) {
      console.log("  Error:", e.message);
    }
    
  } catch (e: any) {
    console.error("Error:", e.message);
  }
  
  await client.end();
  process.exit(0);
}

check();

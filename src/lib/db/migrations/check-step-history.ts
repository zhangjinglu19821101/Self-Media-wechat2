import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

async function checkTable() {
  const client = postgres(DATABASE_URL, {
    ssl: 'require',
    max: 1,
  });
  
  try {
    console.log("Checking agent_sub_tasks_step_history columns...");
    const columns = await client`
      SELECT column_name, is_nullable, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'agent_sub_tasks_step_history'
      ORDER BY ordinal_position
    `;
    
    console.log("\nColumns:");
    for (const col of columns) {
      console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULLABLE'} ${col.column_default ? 'DEFAULT ' + col.column_default : ''}`);
    }
    
    // Try inserting a test row
    console.log("\nTrying test insert...");
    try {
      await client`
        INSERT INTO agent_sub_tasks_step_history (
          command_result_id, step_no, interact_type, interact_content, interact_user, interact_time
        ) VALUES (
          '74e9c97c-8e31-4ad8-90f2-223449c03f5b', 1, 'response', '{}', 'agent B', now()
        )
      `;
      console.log("✓ Test insert succeeded");
      await client`DELETE FROM agent_sub_tasks_step_history WHERE command_result_id = '74e9c97c-8e31-4ad8-90f2-223449c03f5b'`;
    } catch (e: any) {
      console.log("✗ Test insert failed:", e.message);
      if (e.detail) console.log("  Detail:", e.detail);
    }
    
  } catch (error: any) {
    console.error("Error:", error.message);
  }
  
  await client.end();
  process.exit(0);
}

checkTable();

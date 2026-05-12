import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/multi_platform_publish_db?sslmode=require&channel_binding=require';

async function debug() {
  const client = postgres(DATABASE_URL, {
    ssl: 'require',
    max: 1,
  });
  
  const commandId = 'b687b341-2a02-487d-9e23-280d1ec57f08';
  
  try {
    console.log("Checking existing records...");
    const rows = await client`
      SELECT step_no, interact_type, interact_num, interact_user FROM agent_sub_tasks_step_history 
      WHERE command_result_id = ${commandId} 
      ORDER BY step_no, interact_type
    `;
    console.log(`Found ${rows.length} records:`);
    for (const row of rows) {
      console.log(`  step_no=${row.step_no}, type=${row.interact_type}, num=${row.interact_num}, user=${row.interact_user}`);
    }
    
    console.log("\nTrying to insert new record...");
    try {
      await client`
        INSERT INTO agent_sub_tasks_step_history (
          command_result_id, step_no, interact_type, interact_content, interact_user, interact_time, interact_num
        ) VALUES (
          ${commandId}, 1, 'request', ${JSON.stringify({ test: true })}, 'human', ${new Date().toISOString()}, 2
        )
      `;
      console.log("✓ Insert succeeded");
    } catch (e: any) {
      console.log("✗ Insert failed:", e.message);
    }
    
  } catch (e: any) {
    console.error("Error:", e.message);
  }
  
  await client.end();
  process.exit(0);
}

debug();

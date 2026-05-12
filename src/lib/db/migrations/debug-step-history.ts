import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/multi_platform_publish_db?sslmode=require&channel_binding=require';

async function debug() {
  const client = postgres(DATABASE_URL, {
    ssl: 'require',
    max: 1,
  });
  
  const commandId = '8c226828-0380-4cf1-a24c-db8a2fba48c1';
  
  try {
    console.log("Checking existing step history...");
    const rows = await client`
      SELECT * FROM agent_sub_tasks_step_history WHERE command_result_id = ${commandId} ORDER BY step_no
    `;
    console.log(`Found ${rows.length} records:`);
    for (const row of rows) {
      console.log(`  step_no=${row.step_no}, type=${row.interact_type}, user=${row.interact_user}`);
    }
  } catch (e: any) {
    console.error("Error:", e.message);
  }
  
  await client.end();
  process.exit(0);
}

debug();

import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/multi_platform_publish_db?sslmode=require&channel_binding=require';

async function checkNotNull() {
  const client = postgres(DATABASE_URL, {
    ssl: 'require',
    max: 1,
  });
  
  try {
    console.log("Checking NOT NULL columns in daily_task...");
    const columns = await client`
      SELECT column_name, is_nullable, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'daily_task' AND is_nullable = 'NO'
      ORDER BY ordinal_position
    `;
    
    console.log("\nNOT NULL columns:");
    for (const col of columns) {
      console.log(`  ${col.column_name}: ${col.data_type} ${col.column_default ? 'DEFAULT ' + col.column_default : '(no default)'}`);
    }
    
    // Try inserting a test row
    console.log("\nTrying test insert...");
    try {
      await client`
        INSERT INTO daily_task (
          id, task_id, related_task_id, task_title, task_description,
          executor, task_priority, execution_date, execution_deadline_start, execution_deadline_end,
          deliverables, execution_status, from_agent_id, to_agent_id, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), 'test-task', 'agent-task', '测试标题', '测试描述',
          'insurance-d', 'normal', '2026-03-05', now(), now(),
          '交付物', 'new', 'agent-a', 'insurance-d', now(), now()
        )
      `;
      console.log("✓ Test insert succeeded");
      // Clean up
      await client`DELETE FROM daily_task WHERE task_id = 'test-task'`;
    } catch (e: any) {
      console.log("✗ Test insert failed:", e.message);
    }
    
  } catch (error: any) {
    console.error("Error:", error.message);
  }
  
  await client.end();
  process.exit(0);
}

checkNotNull();

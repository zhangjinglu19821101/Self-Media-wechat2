import postgres from "postgres";
import { randomUUID } from "crypto";

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/multi_platform_publish_db?sslmode=require&channel_binding=require';

async function debugInsert() {
  const client = postgres(DATABASE_URL, {
    ssl: 'require',
    max: 1,
  });
  
  try {
    const taskId = `test-${Date.now()}`;
    console.log("Attempting to insert daily_task...");
    
    const result = await client`
      INSERT INTO daily_task (
        id, task_id, related_task_id, task_title, task_description,
        executor, task_priority, execution_date, execution_deadline_start, execution_deadline_end,
        deliverables, execution_status, from_agent_id, to_agent_id, created_at, updated_at
      ) VALUES (
        ${randomUUID()}, ${taskId}, ${'agent-task-test'}, ${'测试标题'}, ${'测试描述'},
        ${'insurance-d'}, ${'normal'}, ${'2026-03-05'}, ${new Date().toISOString()}, ${new Date(Date.now() + 86400000).toISOString()},
        ${'测试交付物'}, ${'new'}, ${'agent-a'}, ${'insurance-d'}, ${new Date().toISOString()}, ${new Date().toISOString()}
      )
    `;
    
    console.log("Insert successful:", result);
  } catch (error: any) {
    console.error("Insert failed:", error);
    console.error("Error message:", error.message);
    if (error.detail) console.error("Detail:", error.detail);
  }
  
  await client.end();
  process.exit(0);
}

debugInsert();

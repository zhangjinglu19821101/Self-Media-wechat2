import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/multi_platform_publish_db?sslmode=require&channel_binding=require';

async function cleanup() {
  const client = postgres(DATABASE_URL, {
    ssl: 'require',
    max: 1,
  });
  
  try {
    console.log("Cleaning up test data...");
    
    // Get sub tasks for insurance-d
    const subTasks = await client`
      SELECT id FROM agent_sub_tasks WHERE from_parents_executor = 'insurance-d'
    `;
    
    console.log(`Found ${subTasks.length} sub tasks`);
    
    for (const task of subTasks) {
      const id = task.id;
      
      // Delete step history
      const historyDel = await client`
        DELETE FROM agent_sub_tasks_step_history WHERE command_result_id = ${id}
      `;
      console.log(`  Deleted ${historyDel.count} history records for ${id}`);
    }
    
    // Delete sub tasks
    const subDel = await client`
      DELETE FROM agent_sub_tasks WHERE from_parents_executor = 'insurance-d'
    `;
    console.log(`  Deleted ${subDel.count} sub tasks`);
    
    // Delete daily tasks
    const dailyDel = await client`
      DELETE FROM daily_task WHERE executor = 'insurance-d'
    `;
    console.log(`  Deleted ${dailyDel.count} daily tasks`);
    
    console.log("\n✓ Cleanup complete");
    
  } catch (error: any) {
    console.error("Error:", error.message);
  }
  
  await client.end();
  process.exit(0);
}

cleanup();
